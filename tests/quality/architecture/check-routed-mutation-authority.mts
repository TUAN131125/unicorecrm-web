import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import { subscribeModuleQueryInvalidation, type BackendMutationCommand, type MutationCommandMetadata } from "../../../src/shared/application";
import { createHttpModuleDataAuthorityRegistry, resolveCommandRoute, RoutedHttpMutationAuthority, type HttpClient, type HttpRequest } from "../../../src/platform/api";
import { projectProductionCommandPayload } from "../../../src/platform/api/contracts/productionCommandPayloadProjection.ts";

const issueResponse = JSON.parse(fs.readFileSync(path.join(repositoryRoot, "tests/fixtures/backend-contract/issue-invoice-success.json"), "utf8"));
const createResponse = JSON.parse(fs.readFileSync(path.join(repositoryRoot, "tests/fixtures/backend-contract/invoice-draft/create-success.json"), "utf8"));
const createRequest = JSON.parse(fs.readFileSync(path.join(repositoryRoot, "tests/fixtures/backend-contract/invoice-draft/create-request.json"), "utf8"));
const requests: HttpRequest[] = [];
const client: HttpClient = {
  async request<TResponse>(request: HttpRequest): Promise<TResponse> {
    requests.push(request);
    const response = request.operationId === "createInvoiceDraft" ? createResponse : issueResponse;
    return response as TResponse;
  },
};
const registry = createHttpModuleDataAuthorityRegistry(client);
const invalidations: string[] = [];
const committed: string[] = [];
const unsubscribe = subscribeModuleQueryInvalidation("invoices", (event) => {
  invalidations.push(`${event.commandType}:${event.aggregateId}`);
});
const authority = new RoutedHttpMutationAuthority(client, registry, { onCommitted: (event) => { committed.push(`${event.commandType}:${event.moduleKeys.join(",")}`); } });
const metadata: MutationCommandMetadata = { idempotencyKey: "idem_issue_inv_001_v3", expectedVersion: 3, correlationId: "corr-client" };
const command: BackendMutationCommand<{ expectedVersion: number }> = { commandType: "invoice.issue", aggregateType: "INVOICE", aggregateId: "inv_001", payload: { expectedVersion: 3 } };
const outcome = await authority.execute(command, metadata);
assert.equal(requests.length, 1);
assert.equal(requests[0]?.operationId, "issueInvoice");
assert.equal(requests[0]?.path, "/invoices/inv_001/issue");
assert.equal(requests[0]?.idempotencyKey, metadata.idempotencyKey);
assert.equal(requests[0]?.expectedVersion, 3);
assert.equal(outcome.commandId, issueResponse.commandId);
assert.equal(outcome.correlationId, issueResponse.correlationId);
assert.equal(outcome.version, 4);
assert.equal(outcome.occurredAt, issueResponse.occurredAt);
assert.equal(outcome.audit.authority, "backend");
assert.deepEqual(outcome.audit.evidenceIds, issueResponse.auditEvidenceIds);
assert.deepEqual(invalidations, ["invoice.issue:inv_001"]);
assert.deepEqual(committed, ["invoice.issue:invoices"]);
unsubscribe();

const createInvalidations: string[] = [];
const createUnsubscribe = subscribeModuleQueryInvalidation("invoices", (event) => {
  createInvalidations.push(`${event.commandType}:${event.aggregateId}`);
});
const createMetadata: MutationCommandMetadata = { idempotencyKey: "idem_invoice_create_001", correlationId: "corr-client-create" };
const createCommand: BackendMutationCommand<typeof createRequest> = {
  commandType: "invoice.create-draft",
  aggregateType: "INVOICE",
  aggregateId: createRequest.creationIntentId,
  payload: createRequest,
};
const createOutcome = await authority.execute(createCommand, createMetadata);
assert.equal(requests.length, 2);
assert.equal(requests[1]?.operationId, "createInvoiceDraft");
assert.equal(requests[1]?.path, "/invoices/drafts");
assert.equal(requests[1]?.idempotencyKey, createMetadata.idempotencyKey);
assert.equal(requests[1]?.expectedVersion, undefined);
assert.equal(createOutcome.aggregateId, "inv_001");
assert.notEqual(createOutcome.aggregateId, createCommand.aggregateId, "Server-assigned aggregate ID must not reuse the client creation intent ID.");
assert.deepEqual(createInvalidations, ["invoice.create-draft:inv_001"]);
createUnsubscribe();

await assert.rejects(authority.execute({ commandType: "lead.change-work-state", aggregateType: "LEAD", aggregateId: "lead-1", payload: {} }, metadata), /not classified PRODUCTION_CONTRACT_READY/u);
assert.equal(requests.length, 2, "Blocked command must fail before network I/O.");
assert.throws(() => resolveCommandRoute("unknown.command"), /not classified PRODUCTION_CONTRACT_READY/u);
for (const commandType of [
  "invoice.create-draft",
  "invoice.issue",
  "invoice.save-draft",
  "order.cancel",
  "order.confirm-with-payment-plan",
  "order.convert-accepted-quote-to-draft",
  "order.credit-approval.approve",
  "order.credit-approval.reject",
  "order.credit-approval.request",
  "order.credit-approval.revoke",
  "payment.allocate",
  "payment.cancel-intent",
  "payment.create-intent",
  "payment.create-refund",
  "payment.reconcile-record",
  "payment.record-cod-collection",
  "payment.record-cod-remittance",
  "payment.retry-intent",
  "payment.reverse-allocation",
  "quote.accept-and-close-deal",
  "return.resolve-credit-refund",
]) assert.ok(resolveCommandRoute(commandType).operationId, `${commandType} must have one production operation.`);

for (const commandType of [
  "order.archive",
  "order.archive-many",
  "order.complete-from-fulfillment-evidence",
  "order.create",
  "order.duplicate-draft",
  "order.reprice-draft",
  "order.send",
  "order.update-draft",
  "product.archive",
  "product.archive-many",
  "product.create",
  "product.replace",
  "product.restore",
  "product.restore-many",
  "support.add-internal-note",
  "support.add-reply",
  "support.assign",
  "support.create",
  "support.transition",
  "support.update",
]) assert.throws(() => resolveCommandRoute(commandType), /not classified PRODUCTION_CONTRACT_READY/u, `${commandType} must be owned by the dedicated Support adapter.`);

const allocationProjection = projectProductionCommandPayload(resolveCommandRoute("payment.allocate"), {
  paymentRecordId: "pay_001",
  buyerRef: { type: "CONTACT", id: "buyer_client_authored" },
  expectedSourceVersion: 5,
  now: "2026-07-24T00:00:00Z",
  allocations: [{
    id: "alloc_client_authored",
    invoice: { invoiceId: "inv_001", outstandingAmount: { amount: "100.00", currency: "USD" } },
    amount: { amount: "25.00", currency: "USD" },
    idempotencyKey: "item_client_authored",
  }],
});
assert.deepEqual(allocationProjection, {
  source: { type: "PAYMENT_RECORD", id: "pay_001" },
  targets: [{ invoiceId: "inv_001", amount: { amount: "25.00", currency: "USD" } }],
});
const refundProjection = projectProductionCommandPayload(resolveCommandRoute("payment.create-refund"), {
  id: "refund_client_authored",
  paymentRecordId: "pay_001",
  buyerRef: { type: "CONTACT", id: "buyer_client_authored" },
  amount: { amount: "10.00", currency: "USD" },
  reasonCode: "RETURN",
  reason: "Approved return",
  now: "2026-07-24T00:00:00Z",
});
assert.deepEqual(refundProjection, {
  source: { type: "PAYMENT_RECORD", id: "pay_001" },
  amount: { amount: "10.00", currency: "USD" },
  reasonCode: "RETURN",
  reason: "Approved return",
});
assert.throws(() => projectProductionCommandPayload(resolveCommandRoute("payment.reverse-allocation"), {}), /non-empty string/u);
assert.throws(() => projectProductionCommandPayload(resolveCommandRoute("payment.record-cod-collection"), { state: "COLLECTED" }), /evidence reference is required/u);

await assert.rejects(authority.execute(command, { ...metadata, idempotencyKey: "" }), /requires Idempotency-Key/u);
await assert.rejects(authority.execute(command, { idempotencyKey: metadata.idempotencyKey, correlationId: metadata.correlationId }), /requires an optimistic concurrency version/u);

const source = fs.readFileSync(path.join(repositoryRoot, "src/platform/api/runtime/RoutedHttpMutationAuthority.ts"), "utf8");
assert.match(source, /PRODUCTION_COMMAND_CONTRACTS/);
assert.doesNotMatch(source, /randomUUID|new Date\(|\/commands/u);
assert.equal(fs.existsSync(path.join(repositoryRoot, "src/platform/api/runtime/HttpMutationAuthority.ts")), false);
console.log(`Routed mutation authority: PASS (23 generic-router production commands; dedicated module commands fail closed in the generic router; authoritative server-assigned and target-matched evidence required).`)
