import assert from "node:assert/strict";
import { PaymentHttpAdapter } from "@/modules/payments/infrastructure/http/PaymentHttpAdapter";
import { InvoiceHttpAdapter } from "@/modules/invoices/infrastructure/http/InvoiceHttpAdapter";
import { ReceivablesHttpAdapter } from "@/modules/invoices/infrastructure/http/ReceivablesHttpAdapter";
import type { HttpRequest } from "@/platform/api";

const calls: Array<{ method: string; path: string }> = [];
const now = "2026-07-15T00:00:00.000Z";
const zero = { amount: "0", currency: "VND" };
const buyerRef = { type: "CONTACT" as const, id: "buyer" };
const paymentDocument = {
  id: "payment",
  buyerRef,
  kind: "PAYMENT",
  state: "SUCCEEDED",
  amount: zero,
  methodCode: "BANK_TRANSFER",
  channel: "BANK",
  occurredAt: now,
  reconciliationState: "UNRECONCILED",
  effectiveForReceivables: true,
  resourceVersion: 1,
  createdAt: now,
  updatedAt: now,
};
const intentDocument = {
  id: "intent",
  buyerRef,
  invoiceIds: [],
  scheduleLineIds: [],
  amount: zero,
  methodCode: "BANK_TRANSFER",
  providerCode: "MANUAL",
  state: "CREATED",
  expiresAt: now,
  resourceVersion: 1,
  createdAt: now,
  updatedAt: now,
};
const refundDocument = {
  id: "refund-intent",
  buyerRef,
  source: { type: "PAYMENT_RECORD", id: "payment" },
  amount: zero,
  state: "CREATED",
  reasonCode: "TEST",
  reason: "Contract test",
  resourceVersion: 1,
  createdAt: now,
  updatedAt: now,
};
const legalParty = { name: "Unicore", addressLines: [] };
const invoiceDocument = {
  id: "invoice",
  buyerRef,
  sellerSnapshot: legalParty,
  buyerSnapshot: legalParty,
  lifecycleState: "DRAFT",
  deliveryState: "NOT_SENT",
  currency: "VND",
  lines: [],
  totals: { subtotal: zero, discountTotal: zero, taxTotal: zero, grandTotal: zero },
  sourceLinks: { orderId: "order" },
  version: 1,
  idempotencyKey: "invoice-contract",
  createdAt: now,
  updatedAt: now,
};
// Dedicated Invoice/Payment mutations return the backend's authoritative evidence
// envelope, so contract fakes must supply it exactly as OpenAPI requires it.
const mutationEvidence = {
  commandId: "cmd_order_to_cash_contract",
  correlationId: "corr_order_to_cash_contract",
  aggregateType: "INVOICE",
  version: 1,
  occurredAt: now,
  outcome: "COMMITTED" as const,
};
const client = {
  request: async <TResponse,>(input: HttpRequest): Promise<TResponse> => {
    calls.push(input);
    if (input.path === "/payment-plans/plan/preview") {
      return {
        ready: true,
        orderAmount: zero,
        scheduledAmount: zero,
        remainingAmount: zero,
        resolvedLines: [],
        warnings: [],
        blockers: [],
        prospectiveVersion: 2,
      } as TResponse;
    }
    if (input.path === "/payments/manual-records") return { ...mutationEvidence, aggregateId: "payment", aggregateType: "PAYMENT_RECORD", result: { payment: paymentDocument } } as TResponse;
    if (input.path === "/payment-intents/intent/retry") return { result: { intent: intentDocument } } as TResponse;
    if (input.path === "/payment-intents/intent") return intentDocument as TResponse;
    if (input.path === "/payment-allocations") return { result: { allocations: [], remainingAmount: zero } } as TResponse;
    if (input.path === "/refund-intents") return { result: refundDocument } as TResponse;
    if (input.path === "/refunds/refund-intent") return refundDocument as TResponse;
    if (input.path === "/invoices/drafts") return { aggregateId: "invoice", result: invoiceDocument } as TResponse;
    if (input.path === "/invoices/invoice/draft") return { aggregateId: "invoice", result: invoiceDocument } as TResponse;
    if (input.path === "/invoices/invoice/issue-readiness") return { ready: true, blockers: [], invoiceVersion: 1 } as TResponse;
    if (input.path === "/invoices/invoice/retry-issue" || input.path === "/invoices/invoice/discard") {
      return { ...mutationEvidence, aggregateId: "invoice", result: { invoice: invoiceDocument } } as TResponse;
    }
    if (input.path === "/receivables") {
      return { asOfDate: "2026-07-17", items: [], pageInfo: { hasNextPage: false } } as TResponse;
    }
    if (input.path === "/receivables/summary") {
      return {
        asOfDate: "2026-07-17",
        outstandingAmount: { amount: "0", currency: "VND" },
        overdueAmount: { amount: "0", currency: "VND" },
        openInvoiceCount: 0,
        overdueInvoiceCount: 0,
      } as TResponse;
    }
    if (input.path === "/receivables/aging") {
      const empty = { count: 0, amount: { amount: "0", currency: "VND" } };
      return {
        asOfDate: "2026-07-17",
        buckets: { NOT_DUE: empty, CURRENT: empty, "1_30": empty, "31_60": empty, "61_90": empty, "90_PLUS": empty },
      } as TResponse;
    }
    if (input.path.endsWith("/account-statement")) {
      return { asOfDate: "2026-07-17", buyerRef: { type: "CONTACT", id: "buyer" }, items: [] } as TResponse;
    }
    return {} as TResponse;
  },
};

const payments = new PaymentHttpAdapter(client);
const invoices = new InvoiceHttpAdapter(client);
const receivables = new ReceivablesHttpAdapter(client);
await payments.previewPlan({ id: "plan", orderId: "order", buyerRef: { type: "CONTACT", id: "buyer" }, version: 1, agreementSnapshot: { version: 1, kind: "FULL_PAYMENT", currency: "VND", policyVersion: "test", lines: [] }, orderAmount: { amount: "0", currency: "VND" }, requiresPhysicalShipping: false, idempotencyKey: "plan", now: "2026-07-15" });
await payments.recordManualPayment({ id: "payment", buyerRef, amount: zero, methodCode: "BANK_TRANSFER", channel: "BANK", occurredAt: now, idempotencyKey: "manual-payment", now, allowUnapplied: false });
await payments.retryIntent("intent", { id: "retry-intent", expectedVersion: 1, expiresAt: now, idempotencyKey: "retry-intent", now });
await payments.getIntentStatus("intent");
await payments.allocate({ paymentRecordId: "payment", allocations: [], expectedSourceVersion: 1, now: "2026-07-15" });
await payments.createRefundIntent({ id: "refund-intent", buyerRef, paymentRecordId: "payment", expectedSourceVersion: 1, amount: zero, reasonCode: "TEST", reason: "Contract test", idempotencyKey: "refund-intent", now });
await payments.getRefund("refund-intent");
await invoices.createDraft({} as never);
await invoices.saveDraft({ invoiceId: "invoice", expectedVersion: 1, idempotencyKey: "save-invoice" } as never);
await invoices.getIssueReadiness("invoice");
await invoices.retryIssue("invoice", { expectedVersion: 1 });
await invoices.discardDraft("invoice", { expectedVersion: 1 });
await receivables.list();
await receivables.summary();
await receivables.aging();
await receivables.accountStatement({ type: "CONTACT", id: "buyer" });

for (const expected of [
  "POST /payment-plans/plan/preview",
  "POST /payments/manual-records",
  "POST /payment-intents/intent/retry",
  "GET /payment-intents/intent",
  "POST /payment-allocations",
  "POST /refund-intents",
  "GET /refunds/refund-intent",
  "POST /invoices/drafts",
  "PATCH /invoices/invoice/draft",
  "GET /invoices/invoice/issue-readiness",
  "POST /invoices/invoice/retry-issue",
  "POST /invoices/invoice/discard",
  "GET /receivables",
  "GET /receivables/summary",
  "GET /receivables/aging",
  "GET /buyers/CONTACT/buyer/account-statement",
]) {
  assert.ok(calls.some((call) => `${call.method} ${call.path}` === expected), `Missing API contract ${expected}`);
}
assert.ok(!calls.some((call) => call.path.includes("mark-success")), "Frontend must not expose mark-success endpoint");
console.log("Order-to-cash API contracts: PASS");
