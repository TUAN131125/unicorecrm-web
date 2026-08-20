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

const directStorageOrNetwork = presentationFiles.flatMap((file) => {
  const source = fs.readFileSync(file, "utf8");
  const hits = ["localStorage", "sessionStorage", "fetch("].filter((token) => source.includes(token));
  return hits.map((token) => `${path.relative(root, file)} -> ${token}`);
});
assert.deepEqual(directStorageOrNetwork, [], `Presentation must not own transport/storage mutations:\n${directStorageOrNetwork.join("\n")}`);

console.log("Mutation command authority OK: idempotency, backend metadata, lifecycle coverage, transaction workflows, and presentation boundaries are protected.");
