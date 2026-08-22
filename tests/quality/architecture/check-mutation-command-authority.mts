import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  LocalMutationAuthority,
  MutationCommandError,
  type BackendMutationCommand,
  type MutationCommandMetadata,
  type MutationOutcome,
} from "../../../src/shared/application";
import { RoutedHttpMutationAuthority, createHttpModuleDataAuthorityRegistry, type HttpClient, type HttpRequest } from "../../../src/platform/api";
import { classifyMutationFailure } from "../../../src/shared/operations/mutationState";

const root = repositoryRoot;
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

const authority = new LocalMutationAuthority();
const command: BackendMutationCommand<{ target: string }> = {
  commandType: "test.transition",
  aggregateType: "test-record",
  aggregateId: "record-1",
  payload: { target: "READY" },
};
const metadata: MutationCommandMetadata = {
  idempotencyKey: "test-transition:record-1:ready",
  correlationId: "corr-test-transition",
  expectedVersion: 3,
};
let executions = 0;
const first = authority.execute(command, metadata, () => {
  executions += 1;
  return { id: "record-1", state: "READY", version: 4 };
});
const second = authority.execute(command, metadata, () => {
  executions += 1;
  return { id: "record-1", state: "READY", version: 4 };
});
const [firstOutcome, secondOutcome] = await Promise.all([first, second]);
assert.equal(executions, 1, "Local idempotency must execute a command once.");
assert.equal(firstOutcome.commandId, secondOutcome.commandId);
assert.equal(firstOutcome.version, 4);
assert.deepEqual(firstOutcome.emittedEvents, ["test.transition.completed"]);
assert.equal(firstOutcome.audit.authority, "demo");
assert.equal(firstOutcome.audit.evidenceIds.length, 1);

await assert.rejects(
  Promise.resolve().then(() => authority.execute({ ...command, payload: { target: "CLOSED" } }, metadata, () => ({ id: "record-1" }))),
  (error: unknown) => error instanceof MutationCommandError && error.code === "IDEMPOTENCY_KEY_REUSED",
);

const commandFailure = new MutationCommandError({
  code: "VERSION_CONFLICT",
  message: "The record changed on the server.",
  correlationId: "corr-version-conflict",
  blockers: ["REFRESH_REQUIRED"],
});
const classified = classifyMutationFailure(commandFailure);
assert.equal(classified.state, "CONFLICTED");
assert.equal(classified.correlationId, "corr-version-conflict");
assert.deepEqual(classified.businessBlockers, ["REFRESH_REQUIRED"]);

let capturedRequest: HttpRequest | undefined;
const remoteResponse = {
  commandId: "cmd-remote",
  correlationId: "corr-remote-authoritative",
  aggregateId: "order-remote",
  aggregateType: "order",
  version: 8,
  occurredAt: "2026-07-24T00:00:00.000Z",
  outcome: "COMMITTED" as const,
  emittedEventIds: ["order.cancelled"],
  auditEvidenceIds: ["audit-remote"],
  result: {
    orderId: "order-remote",
    orderState: "CANCELLED",
    alreadyCancelled: false,
    cancelledAt: "2026-07-24T00:00:00.000Z",
  },
};
const fakeClient: HttpClient = {
  async request<TResponse, TBody>(input: HttpRequest<TBody>): Promise<TResponse> {
    capturedRequest = input;
    return remoteResponse as TResponse;
  },
};
const routedAuthority = new RoutedHttpMutationAuthority(fakeClient, createHttpModuleDataAuthorityRegistry(fakeClient));
const remote = await routedAuthority.execute(
  { commandType: "order.cancel", aggregateType: "order", aggregateId: "order-remote", payload: { reasonCode: "CUSTOMER_REQUEST", reason: "Customer requested cancellation." } },
  { idempotencyKey: "remote-key", expectedVersion: 7, correlationId: "corr-client-hint" },
);
assert.equal(remote.audit.authority, "backend");
assert.equal(remote.commandId, "cmd-remote");
assert.equal(remote.correlationId, "corr-remote-authoritative");
assert.equal(capturedRequest?.operationId, "cancelOrder");
assert.equal(capturedRequest?.path, "/orders/order-remote/cancel");
assert.equal(capturedRequest?.method, "POST");
assert.equal(capturedRequest?.idempotencyKey, "remote-key");
assert.equal(capturedRequest?.expectedVersion, 7);
assert.equal(capturedRequest?.correlationId, "corr-client-hint");
assert.equal(capturedRequest?.retry, "idempotent");
assert.equal(capturedRequest?.auth, "required");
assert.equal(capturedRequest?.workspace, "required");
assert.deepEqual(capturedRequest?.body, {
  reasonCode: "CUSTOMER_REQUEST",
  reason: "Customer requested cancellation.",
}, "Connected commands must serialize only the operation-specific OpenAPI request DTO.");

const incompleteClient: HttpClient = {
  async request<TResponse>(): Promise<TResponse> {
    return { result: remoteResponse.result } as TResponse;
  },
};
const incompleteAuthority = new RoutedHttpMutationAuthority(incompleteClient, createHttpModuleDataAuthorityRegistry(incompleteClient));
await assert.rejects(
  incompleteAuthority.execute(
    { commandType: "order.cancel", aggregateType: "order", aggregateId: "order-remote", payload: { reason: "Customer requested cancellation." } },
    { idempotencyKey: "missing-evidence", expectedVersion: 7 },
  ),
  (error: unknown) => error instanceof MutationCommandError && error.code === "CONNECTED_CONTRACT_VIOLATION",
  "Connected mode must fail closed when the backend omits authoritative mutation evidence.",
);

await assert.rejects(
  routedAuthority.execute(
    { commandType: "order.cancel-with-compensation", aggregateType: "order", aggregateId: "order-remote", payload: {} },
    { idempotencyKey: "deprecated-command", expectedVersion: 7 },
  ),
  (error: unknown) => error instanceof MutationCommandError && error.code === "CONNECTED_COMMAND_CONTRACT_BLOCKED",
  "Deprecated or blocked commands must be rejected before network I/O.",
);

const requiredEvidence: Record<string, RegExp[]> = {
  "src/app/composition/applicationComposition.ts": [/HttpMutationAuthority/, /configureMutationAuthority/, /mode === "connected"/],
  "src/modules/leads/public/leads.ts": [/advanceLeadWorkStateViaApi/, /disqualifyLeadViaApi/, /reopenDisqualifiedLeadViaApi/, /archiveLeadViaApi/],
  "src/workflows/lead-qualification/public/leadQualification.ts": [/executeLeadNurtureCommand/, /executeLeadOpportunityCommand/, /executeLeadDirectSaleCommand/],
  "src/modules/deals/public/deals.ts": [/transitionDealStageCommand/, /closeDealWonCommand/, /closeDealLostCommand/],
  "src/workflows/deal-recycle/index.ts": [/executeDealRecycleCommand/, /deal\.mark-lost-and-plan-recycle/],
  "src/modules/quotes/public/quotes.ts": [/transitionQuoteStatusCommand/, /requestQuoteApprovalCommand/, /approveQuoteCommand/, /requestQuoteApprovalChangesCommand/],
  "src/workflows/quote-acceptance/index.ts": [/acceptQuoteAndCloseDealCommand/, /replaceQuotes/, /replaceDeals/],
  "src/workflows/order-confirmation/index.ts": [/executeOrderConfirmationCommand/, /order\.confirm-with-payment-plan/],
  "src/workflows/order-cancellation/index.ts": [/executeOrderCancellationCommand/, /order\.cancel/],
  "src/workflows/order-closing/index.ts": [/executeOrderClosingCommand/, /order\.complete-from-fulfillment-evidence/],
  "src/modules/invoices/public/api.ts": [/createInvoiceDraftCanonical/, /issueInvoiceCanonical/, /voidInvoiceCanonical/, /executeMutationCommand/],
  "src/modules/payments/public/api.ts": [/recordManualPaymentCanonical/, /allocatePaymentCanonical/, /createRefundIntentCanonical/, /reconcilePaymentRecordCanonical/, /executeMutationCommand/],
  "src/modules/shipping/public/api.ts": [/createShippingBookingCommandBoundary/, /cancelShippingBookingCommandBoundary/, /syncShippingBookingCommandBoundary/],
  "src/modules/returns/public/api.ts": [/approveReturnCommand/, /confirmReturnedItemsReceivedCommand/, /completeReturnResolutionCommand/, /closeReturnCommand/],
  "src/workflows/return-credit-refund/index.ts": [/executeReturnCreditRefundCommand/, /replaceInvoicesSnapshot/, /replacePaymentsSnapshot/, /replaceReturnsSnapshot/],
  "src/workflows/return-resolution/index.ts": [/beginReturnPickupCommand/, /beginReturnReplacementCommand/, /completeReturnReplacementFromDeliveryCommand/, /completeReturnRepairCommand/],
  "src/modules/support/public/cases.ts": [/transitionSupportCaseCommand/, /reassignSupportCaseCommand/, /saveSupportCaseCommand/, /support\.transition/],
  // Commands wired by the connected-mutation repair phases.
  "src/workflows/accepted-quote-order-conversion/index.ts": [/convertAcceptedQuoteToOrderDraftCommand/, /order\.convert-accepted-quote-to-draft/],
  "src/modules/quotes/presentation/pages/QuoteDetailPage.tsx": [/convertAcceptedQuoteToOrderDraftCommand/, /outcome\.data\.order\.id/],
  "src/workflows/work-activation/index.ts": [/export async function ensureDealNextActionTask/, /createTaskCommand\(/, /NOT ATOMIC WITH THE DEAL COMMAND/],
  "src/workflows/customer-commercial-actions/index.ts": [/createDealCommand/, /createTaskCommand/, /NOT atomic/],
  "src/modules/customers/presentation/pages/Customer360Page.tsx": [/completeTaskCommand/, /logActivityCommand/],
  "src/modules/organizations/presentation/pages/OrganizationAccountDetailPage.tsx": [/logActivityCommand/],
  "src/modules/contacts/presentation/hooks/useContactDetailController.tsx": [/createTaskCommand/, /completeTaskCommand/, /rescheduleTaskCommand/],
};
for (const [relative, patterns] of Object.entries(requiredEvidence)) {
  const source = read(relative);
  for (const pattern of patterns) assert.match(source, pattern, `${relative} is missing mutation-authority evidence ${pattern}.`);
}

const forbiddenPresentationSymbols = [
  "changeLeadWorkStateSnapshot",
  "startLeadVerificationSnapshot",
  "closeLeadSnapshot",
  "disqualifyLeadSnapshot",
  "reopenLeadSnapshot",
  "requestQuoteApprovalSnapshot",
  "approveQuoteSnapshot",
  "requestQuoteApprovalChangesSnapshot",
  "cancelShippingBookingSnapshot",
  "retryShippingBookingSnapshot",
  "changeShippingProviderSnapshot",
  "syncShippingBookingSnapshot",
  "approveReturnRequest",
  "rejectReturnRequest",
  "confirmReturnedItemsReceivedSnapshot",
  "completeReturnResolutionSnapshot",
  "closeReturnRequest",
  "saveSupportCaseSnapshot",
  "executeOrderConfirmation(",
  "executeOrderCancellation(",
  "executeOrderClosing(",
  "executeDealRecycle(",
  "executeReturnCreditRefund(",
  "executeMutationCommand(",
  // Task/Activity and Deal snapshot bridges: a production-ready canonical command
  // exists for every one of these, so presentation use is always a defect.
  "createTaskSnapshot",
  "completeTaskSnapshot",
  "cancelTaskSnapshot",
  "reassignTaskSnapshot",
  "rescheduleTaskSnapshot",
  "logActivitySnapshot",
  "createDealSnapshot",
  "reassignDealSnapshot",
  "updateDealForecastSnapshot",
  "importDealsDemoSample",
];
const presentationFiles = walkAllFiles(path.join(root, "src"))
  .filter((file) => /[\\/]presentation[\\/].*\.(ts|tsx)$/.test(file));
const violations: string[] = [];
for (const file of presentationFiles) {
  const source = fs.readFileSync(file, "utf8");
  for (const symbol of forbiddenPresentationSymbols) {
    if (source.includes(symbol)) violations.push(`${path.relative(root, file)} -> ${symbol}`);
  }
}
assert.deepEqual(violations, [], `Presentation must use application/workflow command boundaries:\n${violations.join("\n")}`);

// ---------------------------------------------------------------------------
// Pinned inventory of presentation-layer local mutations that remain ONLY because
// their backend contract is still BLOCKED. Each entry fails closed in connected
// mode; none is a silent local fallback. The inventory is compared exactly, so a
// NEW blocked local mutation fails this gate until it is justified and pinned, and
// an entry that disappears (because the backend contract landed) must be removed.
// ---------------------------------------------------------------------------
const blockedPresentationMutations: Record<string, readonly { symbol: string; blockedBy: string }[]> = {
  "src/modules/contacts/presentation/hooks/useContacts.ts": [
    { symbol: "updateContacts", blockedBy: "DEC-COMMAND-SEMANTICS / updateContact" },
  ],
  "src/modules/contacts/presentation/hooks/useContactListController.tsx": [
    { symbol: "saveContactSnapshot", blockedBy: "DEC-COMMAND-SEMANTICS / createContact" },
    { symbol: "upsertContactOrganizationRelationshipWorkflow", blockedBy: "DEC-WORKFLOW-CONTACT-ORGANIZATION-RELATIONSHIP (WF-02)" },
  ],
  "src/modules/contacts/presentation/hooks/useContactDetailController.tsx": [
    { symbol: "executeContactOpportunityCreation", blockedBy: "DEC-WORKFLOW-CONTACT-OPPORTUNITY-CREATION (WF-01)" },
  ],
  "src/modules/customers/presentation/list/ExistingCustomerOnboardingModal.tsx": [
    { symbol: "onboardExistingCustomerWorkflow", blockedBy: "DEC-WORKFLOW-CUSTOMER-ONBOARDING (WF-07)" },
  ],
  "src/modules/customers/presentation/pages/Customer360Page.tsx": [
    { symbol: "updateCustomerLifecycleSnapshot", blockedBy: "DEC-COMMAND-SEMANTICS / updateCustomerLifecycle" },
    { symbol: "completeCustomerOnboardingSnapshot", blockedBy: "DEC-COMMAND-SEMANTICS / completeCustomerOnboarding" },
    { symbol: "updateCustomerIdentityFrom360", blockedBy: "DEC-WORKFLOW-CUSTOMER-IDENTITY (WF-06)" },
  ],
  "src/modules/organizations/presentation/detail/OrganizationEditModal.tsx": [
    { symbol: "saveOrganizationAccountSnapshot", blockedBy: "DEC-COMMAND-SEMANTICS / updateOrganization" },
  ],
  "src/modules/organizations/presentation/list/OrganizationCreateModal.tsx": [
    { symbol: "createOrganizationWithRepresentativeWorkflow", blockedBy: "DEC-WORKFLOW-CONTACT-ORGANIZATION-RELATIONSHIP (WF-02)" },
  ],
  "src/modules/organizations/presentation/detail/OrganizationRepresentativeModal.tsx": [
    { symbol: "createOrganizationRepresentativeWorkflow", blockedBy: "DEC-WORKFLOW-CONTACT-ORGANIZATION-RELATIONSHIP (WF-02)" },
  ],
};
const trackedBlockedSymbols = [...new Set(Object.values(blockedPresentationMutations).flatMap((entries) => entries.map((entry) => entry.symbol)))];
const observedBlocked: string[] = [];
for (const file of presentationFiles) {
  const source = fs.readFileSync(file, "utf8");
  const relative = path.relative(root, file).split(path.sep).join("/");
  for (const symbol of trackedBlockedSymbols) {
    if (source.includes(symbol)) observedBlocked.push(`${relative} -> ${symbol}`);
  }
}
const pinnedBlocked = Object.entries(blockedPresentationMutations)
  .flatMap(([relative, entries]) => entries.map((entry) => `${relative} -> ${entry.symbol}`));
assert.deepEqual(
  observedBlocked.slice().sort(),
  pinnedBlocked.slice().sort(),
  "Blocked presentation mutations must match the pinned backend-blocked inventory exactly.",
);

// Every pinned entry must still be genuinely blocked: no pinned symbol may point at
// an OpenAPI operation that has become production-ready without being rewired.
const openApiDocument = JSON.parse(fs.readFileSync(path.join(root, "docs/api/openapi.json"), "utf8")) as {
  paths: Record<string, Record<string, { operationId?: string; "x-contract-status"?: string }>>;
};
const readyOperationIds = new Set<string>();
for (const item of Object.values(openApiDocument.paths)) {
  for (const operation of Object.values(item)) {
    if (!operation?.operationId) continue;
    if ((operation["x-contract-status"] ?? "PRODUCTION_CONTRACT_READY") === "PRODUCTION_CONTRACT_READY") {
      readyOperationIds.add(operation.operationId);
    }
  }
}
for (const operationId of ["createContact", "updateContact", "createOrganization", "updateOrganization", "onboardExistingCustomer", "updateCustomerLifecycle", "completeCustomerOnboarding"]) {
  assert.equal(
    readyOperationIds.has(operationId),
    false,
    `${operationId} is now production-ready: rewire its presentation flow and remove it from the blocked inventory.`,
  );
}

// ---------------------------------------------------------------------------
// Blocked-action UX: a backend-blocked business action must never fail silently and
// must never leak an architecture error code or decision id to an end user.
// ---------------------------------------------------------------------------
const availabilityHelper = read("src/shared/operations/backendAvailability.ts");
for (const code of [
  "CONNECTED_LOCAL_WRITE_FORBIDDEN",
  "CONNECTED_OPERATION_REQUIRES_BACKEND",
  "CONNECTED_COMMAND_CONTRACT_BLOCKED",
  "CONNECTED_COMMAND_REQUIRES_ASYNC_AUTHORITY",
]) {
  assert.ok(availabilityHelper.includes(code), `Backend-availability helper must recognize ${code}.`);
}
assert.doesNotMatch(availabilityHelper, /DEC-[A-Z-]+/u, "User-facing copy must not embed decision ids.");

const blockedUxEvidence: Record<string, RegExp[]> = {
  "src/modules/contacts/presentation/hooks/useContactListController.tsx": [
    /isContactConnectedMode/, /refuseUnavailableContactWrite/, /backendUnavailableMessage/,
  ],
  "src/modules/contacts/presentation/hooks/useContactDetailController.tsx": [
    /isContactConnectedMode/, /refuseUnavailableContactWrite/, /backendUnavailableMessage/,
  ],
  "src/modules/customers/presentation/pages/Customer360Page.tsx": [/formatOperationUnavailableError/],
};
for (const [relative, patterns] of Object.entries(blockedUxEvidence)) {
  const source = read(relative);
  for (const pattern of patterns) assert.match(source, pattern, `${relative} must report blocked actions to the user (${pattern}).`);
}

// No presentation file may render a raw architecture error code.
const leakedCodes = presentationFiles.flatMap((file) => {
  const source = fs.readFileSync(file, "utf8");
  return ["CONNECTED_OPERATION_REQUIRES_BACKEND", "CONNECTED_COMMAND_CONTRACT_BLOCKED", "CONNECTED_COMMAND_REQUIRES_ASYNC_AUTHORITY"]
    .filter((code) => source.includes(code))
    .map((code) => `${path.relative(root, file)} -> ${code}`);
});
assert.deepEqual(leakedCodes, [], `Presentation must not embed architecture error codes:\n${leakedCodes.join("\n")}`);

// ---------------------------------------------------------------------------
// Non-atomic Deal+Task flows must report partial success, never total failure.
// ---------------------------------------------------------------------------
const partialFailureEvidence: Record<string, RegExp[]> = {
  "src/modules/deals/presentation/hooks/useDealPipelineController.ts": [
    /Opportunity created, but its next-action Task was not created/,
    /was updated\. Its next-action Task was not created/,
  ],
  "src/modules/contacts/presentation/hooks/useContactListController.tsx": [
    /was created\. Its follow-up Task was not created/,
  ],
  "src/modules/organizations/presentation/detail/OrganizationCreateOpportunityModal.tsx": [
    /was created\. Its next-action Task was not created/,
  ],
};
for (const [relative, patterns] of Object.entries(partialFailureEvidence)) {
  const source = read(relative);
  for (const pattern of patterns) assert.match(source, pattern, `${relative} must report Deal+Task partial success (${pattern}).`);
}

// Retry safety: every Task activation keeps a deterministic idempotency key.
assert.match(read("src/workflows/work-activation/index.ts"), /idempotencyKey: `task\.create:\$\{intentId\}`/u, "Deal next-action Task activation must stay replay-safe.");
assert.match(read("src/modules/contacts/presentation/hooks/useContactListController.tsx"), /idempotencyKey: `task\.create:\$\{followUpTaskId\}`/u, "Contact follow-up Task must stay replay-safe.");

// Product Picker must be outcome-gated on the authoritative Deal command.
const dealDialogs = read("src/modules/deals/presentation/views/DealDetailDialogs.tsx");
assert.match(dealDialogs, /handleApplyLineItems\(nextLines\)\.then\(\(applied\) => \{/u, "Product Picker must await the Deal command outcome.");
assert.match(dealDialogs, /if \(applied\) setIsProductPickerOpen\(false\)/u, "Product Picker must stay open when the Deal command fails.");
assert.doesNotMatch(dealDialogs, /setDeals\(/u, "Product Picker must not write the Deal projection locally.");

const directStorageOrNetwork = presentationFiles.flatMap((file) => {
  const source = fs.readFileSync(file, "utf8");
  const hits = ["localStorage", "sessionStorage", "fetch("].filter((token) => source.includes(token));
  return hits.map((token) => `${path.relative(root, file)} -> ${token}`);
});
assert.deepEqual(directStorageOrNetwork, [], `Presentation must not own transport/storage mutations:\n${directStorageOrNetwork.join("\n")}`);

console.log("Mutation command authority OK: idempotency, backend metadata, lifecycle coverage, transaction workflows, and presentation boundaries are protected.");
