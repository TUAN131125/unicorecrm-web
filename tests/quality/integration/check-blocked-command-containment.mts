// @ts-nocheck -- Runtime contract for M4 command dispatch integrity.
//
// Invariants:
//   B. A READY command owned by a dedicated workflow adapter must not reach the routed
//      mutation authority, and must not fall back to a frontend-coordinated local workflow
//      in connected mode.
//   C. A BLOCKED canonical command must not be reachable as a connected routed production
//      mutation. The boundary refuses before the mutation authority is entered.
//
// Both are proven by driving the real public command boundaries against a connected
// composition whose HTTP client fails the test if it is ever called, and then against a
// demo composition where the same boundaries must still work locally.
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: "http://localhost/#/w/unicore-vietnam/crm/contacts",
  pretendToBeVisual: true,
});
const { window } = dom;

Object.defineProperties(globalThis, {
  window: { value: window, configurable: true },
  document: { value: window.document, configurable: true },
  navigator: { value: window.navigator, configurable: true },
  localStorage: { value: window.localStorage, configurable: true },
  HTMLElement: { value: window.HTMLElement, configurable: true },
  Element: { value: window.Element, configurable: true },
  Node: { value: window.Node, configurable: true },
  Event: { value: window.Event, configurable: true },
});

const { signIn } = await import("../../../src/platform/identity-auth/index");
assert.equal(
  signIn({ email: "admin@unicorecrm.local", password: "admin123" }).ok,
  true,
  "Command containment contracts need an authenticated session.",
);

/** Any HTTP call at all means a refused command still reached transport. */
let httpCalls = 0;
const connectedClient = {
  async request(input: { operationId: string }) {
    httpCalls += 1;
    throw new Error(`BLOCKED_COMMAND_REACHED_TRANSPORT: ${input.operationId}`);
  },
};

const { initializeApplicationComposition } = await import("../../../src/app/composition");
await initializeApplicationComposition({ mode: "connected", http: { client: connectedClient } });

const { isMutationCommandUnavailable } = await import("../../../src/shared/application/index");

// The canonical registry is the authority for what "unavailable" means here.
const registry = JSON.parse(
  (await import("node:fs")).readFileSync("docs/backend-readiness/command-registry.json", "utf8"),
) as { commands: { commandType: string; status: string; runtimeImplementationMode: string }[] };

const blocked = registry.commands.filter((command) => command.status === "BLOCKED").map((command) => command.commandType);
const dedicatedWorkflow = registry.commands
  .filter((command) => command.status === "PRODUCTION_CONTRACT_READY" && command.runtimeImplementationMode === "DEDICATED_WORKFLOW_HTTP_ADAPTER")
  .map((command) => command.commandType);
const routed = ["payment.create-intent", "invoice.issue", "order.cancel"];

assert.ok(blocked.length > 0 && dedicatedWorkflow.length > 0, "The registry must declare both classes.");

for (const commandType of blocked) {
  assert.equal(isMutationCommandUnavailable(commandType), true, `${commandType} is BLOCKED and must be unavailable in connected mode.`);
}
for (const commandType of dedicatedWorkflow) {
  assert.equal(
    isMutationCommandUnavailable(commandType),
    true,
    `${commandType} is owned by a dedicated workflow adapter, so the shared authority must not claim it.`,
  );
}
// A normal routed READY command must stay available, or the guard would be a blanket refusal.
for (const commandType of routed) {
  assert.equal(isMutationCommandUnavailable(commandType), false, `${commandType} must remain a routable production command.`);
}

// ---------------------------------------------------------------------------
// Connected boundaries refuse before the mutation authority.
// ---------------------------------------------------------------------------

const { archiveContactCommand, restoreContactCommand, anonymizeContactCommand, isContactRetentionUnavailable } =
  await import("../../../src/modules/contacts/public/contacts");
const { archiveCustomerCommand, anonymizeCustomerCommand, isCustomerRetentionUnavailable } =
  await import("../../../src/modules/customers/public/api");
const { allocateReceivableCanonical, isReceivableAllocationUnavailable } =
  await import("../../../src/modules/invoices/public/api");
const { refreshPaymentIntentCanonical, isPaymentIntentRefreshUnavailable } =
  await import("../../../src/modules/payments/public/api");
const {
  upsertContactOrganizationRelationshipCommand,
  endContactOrganizationRelationshipCommand,
  setPrimaryOrganizationRepresentativeCommand,
  isContactOrganizationRelationshipUnavailable,
} = await import("../../../src/workflows/contact-organization-relationship/index");
const { executeOrderClosingCommand } = await import("../../../src/workflows/order-closing/index");
const { reconcileCustomerConversionCommand } = await import("../../../src/workflows/customer-conversion/index");
const { executeDealRecycleCommand } = await import("../../../src/workflows/deal-recycle/index");
const {
  archiveOrganizationAccountCommand,
  restoreOrganizationAccountCommand,
  anonymizeOrganizationAccountCommand,
} = await import("../../../src/modules/organizations/public/api");

/**
 * Refusal at the command-dispatch boundary: the command type is not a routable production
 * contract, so `assertMutationCommandSupported` rejects it.
 */
const DISPATCH_REFUSAL = /not a routable production command contract/u;

/**
 * Refusal owned by the workflow itself (M6-M8, M12).
 *
 * A BLOCKED command whose owning workflow is `connectedFrontendCoordinatorAllowed: false`
 * is refused by the workflow *before* dispatch, so the dispatch diagnostic is never reached.
 * That is stronger containment, not weaker: the caller refuses on the workflow rather than
 * inheriting protection from the command registry. The gate therefore requires the
 * workflow-owned refusal for those, and the dispatch refusal for the rest, so a workflow
 * silently losing its declaration and falling back to dispatch refusal still fails here.
 */
const WORKFLOW_REFUSAL = /WF-\d+ [a-z-]+ is BLOCKED|may not coordinate|may not reconcile|may not sequence/u;

/** Commands whose refusal is owned by their workflow rather than by command dispatch. */
const WORKFLOW_OWNED_REFUSALS = new Set([
  "customer-conversion.reconcile",
  "deal.mark-lost-and-plan-recycle",
  "order.complete-from-fulfillment-evidence",
]);

const refusals: [string, () => unknown][] = [
  ["contact.archive", () => archiveContactCommand("contact_1", { reason: "r", actorId: "u1" })],
  ["contact.restore", () => restoreContactCommand("contact_1", { reason: "r", actorId: "u1" })],
  ["contact.anonymize", () => anonymizeContactCommand("contact_1", { reason: "r", actorId: "u1" })],
  ["customer.archive", () => archiveCustomerCommand("customer_1", { reason: "r", actorId: "u1" })],
  ["customer.anonymize", () => anonymizeCustomerCommand("customer_1", { reason: "r", actorId: "u1" })],
  ["organization.archive", () => archiveOrganizationAccountCommand("org_1", { reason: "r", actorId: "u1" })],
  ["organization.restore", () => restoreOrganizationAccountCommand("org_1", { reason: "r", actorId: "u1" })],
  ["organization.anonymize", () => anonymizeOrganizationAccountCommand("org_1", { reason: "r", actorId: "u1" })],
  ["invoice.allocate-receivable", () => allocateReceivableCanonical({
    invoiceId: "inv_1",
    expectedInvoiceVersion: 1,
    amount: { amount: "1.00", currency: "VND" },
    paymentRecordId: "pay_1",
    expectedSourceVersion: 1,
    idempotencyKey: "k",
    now: "2026-08-22T00:00:00.000Z",
  })],
  ["payment.refresh-intent-status", () => refreshPaymentIntentCanonical("intent_1")],
  ["contact-organization.upsert-relationship", () => upsertContactOrganizationRelationshipCommand({
    contactId: "contact_1",
    relationship: { organizationAccountId: "org_1", role: "EMPLOYEE", effectiveFrom: "2026-08-22T00:00:00.000Z" },
    actorId: "u1",
  })],
  ["contact-organization.end-relationship", () => endContactOrganizationRelationshipCommand({
    contactId: "contact_1", organizationAccountId: "org_1", actorId: "u1", reason: "r",
  })],
  ["contact-organization.set-primary-representative", () => setPrimaryOrganizationRepresentativeCommand({
    organizationAccountId: "org_1", contactId: "contact_1", actorId: "u1",
  })],
  ["customer-conversion.reconcile", () => reconcileCustomerConversionCommand()],
  ["deal.mark-lost-and-plan-recycle", () => executeDealRecycleCommand({
    dealId: "deal_1", reason: "lost", recycleDecision: "DO_NOT_RECYCLE", occurredAt: "2026-08-22T00:00:00.000Z",
  })],
  ["order.complete-from-fulfillment-evidence", () => executeOrderClosingCommand({ orderIds: ["order_1"] })],
];

for (const [commandType, run] of refusals) {
  const workflowOwned = WORKFLOW_OWNED_REFUSALS.has(commandType);
  assert.throws(
    run,
    workflowOwned ? WORKFLOW_REFUSAL : DISPATCH_REFUSAL,
    workflowOwned
      ? `${commandType} belongs to a BLOCKED coordinator-forbidden workflow, so it must be refused by that workflow `
        + "before command dispatch is reached."
      : `${commandType} must be refused at its boundary before the mutation authority.`,
  );
}

assert.equal(httpCalls, 0, "No refused command may reach transport.");

// The presentation-facing preflight predicates must agree with the boundary refusal, so a
// connected UI can disable the action instead of discovering the refusal by exception.
assert.equal(isContactRetentionUnavailable(), true);
assert.equal(isCustomerRetentionUnavailable(), true);
assert.equal(isReceivableAllocationUnavailable(), true);
assert.equal(isPaymentIntentRefreshUnavailable(), true);
assert.equal(isContactOrganizationRelationshipUnavailable(), true);

// ---------------------------------------------------------------------------
// Demo mode keeps its local behaviour.
// ---------------------------------------------------------------------------

await initializeApplicationComposition({ mode: "demo" });

assert.equal(isContactRetentionUnavailable(), false, "Demo mode must keep Contact retention available.");
assert.equal(isCustomerRetentionUnavailable(), false, "Demo mode must keep Customer retention available.");
assert.equal(isReceivableAllocationUnavailable(), false, "Demo mode must keep receivable allocation available.");
assert.equal(isPaymentIntentRefreshUnavailable(), false, "Demo mode must keep intent refresh available.");
assert.equal(isContactOrganizationRelationshipUnavailable(), false, "Demo mode must keep relationship changes available.");
for (const commandType of [...blocked, ...dedicatedWorkflow]) {
  assert.equal(
    isMutationCommandUnavailable(commandType),
    false,
    `Demo mode owns ${commandType} locally and must not be refused by the connected guard.`,
  );
}

// A demo boundary still executes rather than refusing: the local executor runs and the
// failure, if any, comes from the domain (unknown record), never from the dispatch guard.
await assert.rejects(
  () => executeDealRecycleCommand({ dealId: "deal_does_not_exist", reason: "lost", recycleDecision: "DO_NOT_RECYCLE", occurredAt: "2026-08-22T00:00:00.000Z" }),
  (error: Error) => !DISPATCH_REFUSAL.test(error.message) && !WORKFLOW_REFUSAL.test(error.message),
  "Demo mode must run the local executor instead of refusing at the dispatch guard or the workflow guard.",
);

console.log("Blocked command containment: PASS");
