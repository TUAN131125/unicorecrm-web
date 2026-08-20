import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

const read = (file: string) => readPresentationComposition(file, "utf8");
const includesAll = (file: string, markers: readonly string[]) => {
  const source = read(file);
  for (const marker of markers) assert.ok(source.includes(marker), `${file} must include ${marker}`);
  return source;
};

const invoiceForm = includesAll("src/modules/invoices/presentation/pages/InvoiceFormPage.tsx", [
  "creationIntentId",
  "getInvoiceableOrderLinesSnapshot",
  "invoiceableQuantity",
  "setPreviewOpen(true)",
  "seller.taxId",
  "value.taxId",
]);
assert.equal(invoiceForm.includes("existing.lines[0]"), false, "Invoice edit must never rebuild from only the first line");
assert.ok(invoiceForm.includes("setLines(existing.lines.map(asEditable))"), "Invoice edit must preserve every existing line after authoritative hydration");

const invoiceQuery = includesAll("src/modules/invoices/application/queries/invoiceableOrderLines.ts", [
  "alreadyInvoicedQuantity",
  "invoiceableQuantity",
  "sourceOrderLineId",
]);
assert.ok(invoiceQuery.includes('!["DISCARDED", "VOIDED"].includes(invoice.lifecycleState)'), "Only effective invoice evidence may consume invoiceable quantity");

const paymentDetail = includesAll("src/modules/payments/presentation/pages/PaymentDetailPage.tsx", [
  "usePaymentRecordDetailQuery",
  "EvidencePanel",
  "reconcilePaymentRecordCanonical",
  "reversePaymentAllocationCanonical",
  "refundableAmount",
  "unallocatedAmount",
]);
assert.equal(paymentDetail.includes("snapshot.transactions"), false, "Payment Detail must not use the legacy transaction model");

includesAll("src/modules/payments/application/queries/effectivePaymentMethodCatalog.ts", [
  "getPaymentConfiguration",
  "supportsPaymentRequest",
  "supportsRefund",
  "supportsReconciliation",
]);
includesAll("src/modules/shipping/runtime/shippingModuleRuntime.ts", ["ConfiguredShippingProvider", "getShippingProviderConfigurations"]);
includesAll("src/modules/shipping/application/commands/shippingCommands.ts", [
  'provider.status !== "ACTIVE"',
  "configuredService",
  "provider.capabilities?.booking",
  "supportsCod",
]);
includesAll("src/modules/shipping/presentation/model/shippingActionPolicy.ts", ["capabilities", "label"]);

includesAll("src/modules/payments/domain/model/paymentConfiguration.types.ts", [
  "PaymentConfiguration",
  "ConfiguredPaymentMethod",
  "planTemplates",
]);
includesAll("src/modules/invoices/domain/model/invoiceConfiguration.types.ts", ["InvoiceSellerInformation"]);
includesAll("src/platform/configuration-runtime/types.ts", ["RuntimeReceivableConfiguration", "RuntimeReasonCatalog"]);
includesAll("src/platform/configuration-runtime/configurationRuntime.ts", [
  "getReceivableConfiguration",
  "getReasonCatalog",
]);
includesAll("src/modules/payments/public/api.ts", ["getPaymentConfigurationSnapshot"]);
includesAll("src/modules/invoices/public/api.ts", ["getInvoiceSellerInformation"]);

includesAll("src/modules/payments/presentation/components/PaymentRequestComposer.tsx", [
  "communicationHistory",
  'await record("EMAIL", content)',
  "recordPaymentRequestDeliveryCanonical",
  "useMutationTask",
  "Sao chép link",
  "Hiển thị QR",
  "Tải hướng dẫn",
  "Gửi lại",
]);
includesAll("src/shared/operations/mutationState.ts", [
  '"SUBMITTING"',
  '"VALIDATION_FAILED"',
  '"BUSINESS_BLOCKED"',
  '"CONFLICTED"',
  '"NETWORK_FAILED"',
  '"CANCELLED"',
]);
includesAll("src/shared/operations/useMutationTask.ts", ["AbortController", "authoritativeEntity"]);
includesAll("src/shared/operations/mutationState.ts", ["retryable", "authoritativeEntity"]);

includesAll("src/modules/orders/presentation/pages/OrderFormPage.tsx", ["planTemplates", "applyPaymentTemplate"]);
includesAll("src/workflows/order-confirmation/index.ts", ["creditPolicy", "creditApproval", "CREDIT_APPROVAL_REQUIRED"]);
includesAll("src/modules/invoices/presentation/pages/InvoiceDetailPage.tsx", [
  "creditLineAmounts",
  "downloadDocument",
  "printDocument",
  "sendInvoiceCanonical",
  "getReasonCatalog",
]);

includesAll("src/modules/invoices/application/ports/ReceivableOperationsPort.ts", [
  '"PROMISE_TO_PAY"',
  '"DISPUTE_OPENED"',
  '"OWNER_ASSIGNED"',
  '"CREDIT_HOLD_APPLIED"',
  '"WRITE_OFF_PROPOSED"',
]);
const statement = includesAll("src/modules/invoices/presentation/pages/AccountStatementPage.tsx", [
  "opening",
  "closing",
  "ALLOCATION_REVERSAL",
  "CUSTOMER_CREDIT",
  "CSV",
]);
assert.ok(statement.includes("currency"), "Account Statement must remain currency-aware");

includesAll("src/modules/returns/presentation/pages/ReturnFormPage.tsx", [
  "shippingBookingId",
  "previouslyAcceptedReturnQuantity",
  "Remaining returnable",
]);
includesAll("src/modules/orders/presentation/pages/OrderDetailPage.tsx", ["Tạo yêu cầu đổi/trả", "shippingBookingId"]);
includesAll("src/modules/shipping/presentation/pages/ShippingBookingDetailPage.tsx", ["Tạo yêu cầu đổi/trả", "EvidencePanel"]);
includesAll("src/shared/evidence/EvidencePanel.tsx", ["verificationState", "capturedAt", "capturedBy", "Download"]);

const allocationCommand = includesAll("src/modules/payments/application/commands/paymentAllocationCommands.ts", [
  "reasonCode",
  "reversalReasonCode",
  "reversedBy",
]);
assert.ok(allocationCommand.includes('state: "REVERSED"'), "Allocation reversal must be durable state, not deletion");
includesAll("src/platform/notifications/index.ts", [
  "OrderToCashEventType",
  "CustomerCommunicationRecord",
  "CUSTOMER_COMMUNICATION_VERSION_CONFLICT",
  "retryCustomerCommunication",
]);

const orderCommands = read("src/modules/orders/application/commands/orderRepositoryCommands.ts");
assert.ok(orderCommands.includes('retentionClass: "DURABLE"'), "Order must remain a durable retained record.");
assert.ok(orderCommands.includes('action: "ARCHIVE"'), "Order destructive UI must resolve to archive, not hard delete.");

console.log("Order operations frontend contracts: PASS");
