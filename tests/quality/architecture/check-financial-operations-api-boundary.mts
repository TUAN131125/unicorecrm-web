import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";

const root = repositoryRoot;
const requiredFiles = [
  "src/modules/invoices/application/ports/InvoiceApiPort.ts",
  "src/modules/invoices/application/ports/ReceivablesApiPort.ts",
  "src/modules/invoices/infrastructure/http/InvoiceApiMapper.ts",
  "src/modules/invoices/infrastructure/http/InvoiceHttpAdapter.ts",
  "src/modules/invoices/infrastructure/http/ReceivablesHttpAdapter.ts",
  "src/modules/payments/application/ports/PaymentApiPort.ts",
  "src/modules/payments/infrastructure/http/PaymentHttpAdapter.ts",
  "src/modules/payments/infrastructure/http/paymentLedgerDtoMapper.ts",
  "docs/architecture/financial-operations-api-boundary.md",
];
for (const file of requiredFiles) assert.ok(existsSync(join(root, file)), `Missing ${file}`);

const openApi = JSON.parse(read("docs/api/openapi.json")) as any;
const operations = new Map<string, any>();
for (const pathItem of Object.values(openApi.paths) as any[]) {
  for (const method of ["get", "post", "put", "patch", "delete"]) {
    const operation = pathItem?.[method];
    if (operation?.operationId) operations.set(operation.operationId, operation);
  }
}

const legacyBlocked = new Set(["allocatePayment", "allocateCustomerCredit"]);
const financialOperations = [...operations.entries()].filter(([, operation]) =>
  operation["x-module-owner"] === "invoices" || operation["x-module-owner"] === "payments",
);
assert.equal(financialOperations.length, 49, "Financial operation inventory drift");
for (const [operationId, operation] of financialOperations) {
  if (legacyBlocked.has(operationId)) {
    assert.equal(operation["x-contract-status"], "BLOCKED", `${operationId} must remain fail closed`);
    continue;
  }
  assert.equal(operation["x-contract-status"], "PRODUCTION_CONTRACT_READY", `${operationId} must be ready`);
}
assert.equal(financialOperations.filter(([id]) => !legacyBlocked.has(id)).length, 47);

const newlyReady = [
  "createInvoiceCreditNote",
  "discardInvoiceDraft",
  "retryInvoiceIssue",
  "sendInvoice",
  "voidInvoice",
  "recordManualPayment",
  "recordPaymentRequestDelivery",
];
for (const operationId of newlyReady) {
  const operation = operations.get(operationId);
  assert.equal(operation["x-idempotency-policy"], "REQUIRED", `${operationId} must require idempotency`);
}
for (const operationId of newlyReady.filter((id) => id !== "recordManualPayment")) {
  assert.equal(operations.get(operationId)["x-concurrency-policy"], "IF_MATCH_REQUIRED", `${operationId} must require If-Match`);
}
assert.equal(operations.get("recordManualPayment")["x-concurrency-policy"], "NOT_APPLICABLE");
assert.equal(operations.get("allocatePaymentSource")["x-transaction-boundary"], "SINGLE_LEDGER_TRANSACTION");
assert.equal(operations.get("createRefundIntent")["x-transaction-boundary"], "SINGLE_REFUND_INTENT_TRANSACTION");

const schemas = openApi.components.schemas;
for (const schemaName of [
  "CreateInvoiceCreditNoteRequest",
  "DiscardInvoiceDraftRequest",
  "RetryInvoiceIssueRequest",
  "SendInvoiceRequest",
  "VoidInvoiceRequest",
  "InvoiceMutationResponse",
  "InvoiceCreditNoteMutationResponse",
  "InvoiceDeliveryMutationResponse",
  "ManualPaymentRequest",
  "ManualPaymentResponse",
  "PaymentRequestDeliveryRequest",
  "PaymentRequestDeliveryResponse",
  "CreditNoteDocument",
  "InvoiceDeliveryDocument",
]) assert.equal(schemas[schemaName]?.additionalProperties, false, `${schemaName} must be closed`);
assert.equal(schemas.ManualPaymentRequest.properties.amount.$ref, "#/components/schemas/Money");
assert.equal(schemas.CreateInvoiceCreditNoteLineRequest.properties.amount.$ref, "#/components/schemas/Money");
assert.equal(schemas.CreditNoteDocument.properties.total.$ref, "#/components/schemas/Money");
assert.equal(schemas.ReceivableEntry.properties.outstandingAmount.$ref, "#/components/schemas/Money");
for (const forbidden of ["id", "state", "resourceVersion", "createdAt", "updatedAt", "customerCreditId", "idempotencyKey", "now"])
  assert.ok(!(forbidden in schemas.ManualPaymentRequest.properties), `ManualPaymentRequest must not accept ${forbidden}`);
for (const forbidden of ["id", "state", "sentAt", "failureCode", "providerReference", "createdAt"])
  assert.ok(!(forbidden in schemas.PaymentRequestDeliveryRequest.properties), `PaymentRequestDeliveryRequest must not accept ${forbidden}`);

const invoiceAdapter = read("src/modules/invoices/infrastructure/http/InvoiceHttpAdapter.ts");
for (const operationId of [
  "listInvoices", "getInvoice", "listCreditNotes", "listInvoiceDeliveries", "createInvoiceDraft", "saveInvoiceDraft",
  "getInvoiceIssueReadiness", "issueInvoice", "retryInvoiceIssue", "sendInvoice", "createInvoiceCreditNote",
  "discardInvoiceDraft", "voidInvoice",
]) assert.match(invoiceAdapter, new RegExp(`\\.${operationId}(?:<|\\()`), `Invoice adapter must own ${operationId}`);
assert.match(invoiceAdapter, /const \{ idempotencyKey, \.\.\.body \} = input/u);
assert.match(invoiceAdapter, /InvoiceCreditNoteMutationResponse/u);
assert.match(invoiceAdapter, /InvoiceDeliveryMutationResponse/u);
assert.match(invoiceAdapter, /expectedVersion: input\.expectedVersion/u, "Invoice delivery must send If-Match from authoritative version");
const invoicePort = read("src/modules/invoices/application/ports/InvoiceApiPort.ts");
assert.match(invoicePort, /interface SendInvoiceInput[\s\S]*expectedVersion: number/u);
const invoicePage = read("src/modules/invoices/presentation/pages/InvoiceDetailPage.tsx");
assert.match(invoicePage, /sendInvoiceCanonical\(invoice\.id, \{ expectedVersion: invoice\.version/u);

const paymentAdapter = read("src/modules/payments/infrastructure/http/PaymentHttpAdapter.ts");
for (const operationId of [
  "listPaymentRecords", "getPaymentRecordDetail", "recordManualPayment", "allocatePaymentSource", "reversePaymentAllocation",
  "reconcilePaymentRecord", "recordPaymentRequestDelivery", "createRefundIntent", "requestRefundCancellation", "retryRefundIntent",
]) assert.match(paymentAdapter, new RegExp(`\\.${operationId}(?:<|\\()`), `Payment adapter must own ${operationId}`);
assert.match(paymentAdapter, /const body: ManualPaymentRequest/u);
assert.doesNotMatch(paymentAdapter, /recordManualPayment<[^>]+, typeof command>\(command/u);
assert.match(paymentAdapter, /const body: PaymentRequestDeliveryRequest/u);
assert.doesNotMatch(paymentAdapter, /recordPaymentRequestDelivery<[^>]+, typeof command>\(intentId, command/u);
assert.match(paymentAdapter, /idempotencyKey: command\.idempotencyKey/u);
const paymentPort = read("src/modules/payments/application/ports/PaymentApiPort.ts");
assert.match(paymentPort, /interface RecordPaymentRequestDeliveryInput[\s\S]*idempotencyKey: string/u);
assert.doesNotMatch(paymentPort, /RecordPaymentRequestDeliveryCommand/u, "Connected port must not accept browser-authored delivery evidence");
const paymentComposer = read("src/modules/payments/presentation/components/PaymentRequestComposer.tsx");
assert.doesNotMatch(paymentComposer, /delivery:\s*\{/u, "Presentation must not construct delivery evidence");
assert.doesNotMatch(paymentComposer, /failureCode|sentAt:\s*new Date|state:\s*"(?:SENT|FAILED|SENDING)"/u);

const connected = read("src/app/composition/connected/connectedFinancialModuleServices.ts");
assert.match(connected, /new PaymentHttpAdapter\(httpClient\)/u);
assert.match(connected, /new InvoiceHttpAdapter\(httpClient\)/u);
assert.match(connected, /new ReceivablesHttpAdapter\(httpClient\)/u);
assert.doesNotMatch(connected, /InMemoryInvoiceApiAdapter|InMemoryPaymentApiAdapter/u);

const ownership = JSON.parse(read("scripts/api/openapi/client-ownership.json"));
const financial = ownership.clients.find((client: { id: string }) => client.id === "financial");
assert.equal(financial.adapterByTag.Invoices, "src/modules/invoices/infrastructure/http/InvoiceHttpAdapter.ts");
assert.equal(financial.adapterByTag.Payments, "src/modules/payments/infrastructure/http/PaymentHttpAdapter.ts");
assert.ok(financial.testGateIds.includes("quality.financial-operations-api-boundary"));

const commandRegistry = JSON.parse(read("docs/backend-readiness/command-registry.json"));
for (const commandType of [
  "invoice.create-credit-note", "invoice.discard-draft", "invoice.retry-issue", "invoice.send", "invoice.void",
  "payment.record-manual", "payment.record-request-delivery",
]) {
  const command = commandRegistry.commands.find((item: any) => item.commandType === commandType);
  assert.equal(command?.status, "PRODUCTION_CONTRACT_READY", `${commandType} command registry drift`);
  assert.equal(command?.runtimeImplementationMode, "DEDICATED_MODULE_HTTP_ADAPTER");
}

console.log("Financial operations API boundary: PASS (47 authoritative operations, 2 legacy operations fail closed).");
function read(relative: string): string { return readFileSync(join(root, relative), "utf8"); }
