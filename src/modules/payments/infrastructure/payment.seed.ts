import type { PaymentRepositorySnapshot } from "../application/ports/PaymentRepository";
import { PAYMENT_METHOD_CATALOG, PAYMENT_PROVIDER_CATALOG } from "./paymentCatalog.seed";

export const INITIAL_PAYMENT_STATE: PaymentRepositorySnapshot = {
  obligations: [
    { id: "obl_o1_prepaid", orderId: "o1", buyerRef: { type: "ORGANIZATION_ACCOUNT", id: "org_c1" }, label: "Thanh toán trước", amountDue: 197400000, amountPaid: 197400000, amountOutstanding: 0, currency: "VND", method: "BANK_TRANSFER", term: "PREPAID", status: "SETTLED", idempotencyKey: "legacy-plan:o1:prepaid", createdAt: "2025-06-12T08:30:00Z", updatedAt: "2025-06-15T15:30:00Z" },
    { id: "obl_o2_prepaid", orderId: "o2", buyerRef: { type: "ORGANIZATION_ACCOUNT", id: "org_c1" }, label: "Thanh toán trước", amountDue: 171600000, amountPaid: 171600000, amountOutstanding: 0, currency: "VND", method: "BANK_TRANSFER", term: "PREPAID", status: "SETTLED", idempotencyKey: "legacy-plan:o2:prepaid", createdAt: "2025-12-12T09:00:00Z", updatedAt: "2025-12-14T09:45:00Z" },
    { id: "obl_o4_prepaid", orderId: "o4", buyerRef: { type: "CONTACT", id: "contact_customer_c3" }, label: "Thanh toán trước", amountDue: 16940000, amountPaid: 16940000, amountOutstanding: 0, currency: "VND", method: "BANK_TRANSFER", term: "PREPAID", status: "SETTLED", idempotencyKey: "legacy-plan:o4:prepaid", createdAt: "2026-05-18T15:20:00Z", updatedAt: "2026-05-25T14:30:00Z" },
    { id: "obl_o5_deposit", orderId: "o5", buyerRef: { type: "ORGANIZATION_ACCOUNT", id: "org_c1" }, label: "Đặt cọc 30%", amountDue: 4950000, amountPaid: 0, amountOutstanding: 4950000, currency: "VND", method: "BANK_TRANSFER", term: "DEPOSIT", status: "OPEN", idempotencyKey: "seed-plan:o5:deposit", createdAt: "2026-06-05T14:30:00Z", updatedAt: "2026-06-05T14:30:00Z" },
    { id: "obl_o5_balance", orderId: "o5", buyerRef: { type: "ORGANIZATION_ACCOUNT", id: "org_c1" }, label: "Thanh toán sau nghiệm thu 70%", amountDue: 11550000, amountPaid: 0, amountOutstanding: 11550000, currency: "VND", method: "BANK_TRANSFER", term: "POSTPAID", planType: "DEPOSIT_AND_BALANCE", purpose: "BALANCE", timing: "POSTPAID", fulfillmentGate: "NONE", status: "OPEN", idempotencyKey: "seed-plan:o5:balance", createdAt: "2026-06-05T14:30:00Z", updatedAt: "2026-06-05T14:30:00Z" },
  ],
  transactions: [
    { id: "pay_import_o1", orderId: "o1", buyerRef: { type: "ORGANIZATION_ACCOUNT", id: "org_c1" }, kind: "PAYMENT", status: "SUCCEEDED", amount: 197400000, currency: "VND", occurredAt: "2025-06-15T15:30:00Z", source: "IMPORTED_LEGACY", allocations: [{ obligationId: "obl_o1_prepaid", amount: 197400000 }], method: "BANK_TRANSFER", termSnapshot: "PREPAID", idempotencyKey: "legacy-paid:o1" },
    { id: "pay_import_o2", orderId: "o2", buyerRef: { type: "ORGANIZATION_ACCOUNT", id: "org_c1" }, kind: "PAYMENT", status: "SUCCEEDED", amount: 171600000, currency: "VND", occurredAt: "2025-12-14T09:45:00Z", source: "IMPORTED_LEGACY", allocations: [{ obligationId: "obl_o2_prepaid", amount: 171600000 }], method: "BANK_TRANSFER", termSnapshot: "PREPAID", idempotencyKey: "legacy-paid:o2" },
    { id: "pay_import_o4", orderId: "o4", buyerRef: { type: "CONTACT", id: "contact_customer_c3" }, kind: "PAYMENT", status: "SUCCEEDED", amount: 16940000, currency: "VND", occurredAt: "2026-05-25T14:30:00Z", source: "IMPORTED_LEGACY", allocations: [{ obligationId: "obl_o4_prepaid", amount: 16940000 }], method: "BANK_TRANSFER", termSnapshot: "PREPAID", idempotencyKey: "legacy-paid:o4" },
  ],
  migrationReviews: [
    { orderId: "o3", legacyState: "PARTIAL", rule: "PARTIAL_PAYMENT_AMOUNT_REQUIRES_EVIDENCE", message: "Legacy partial payment has no transaction amount evidence. Review before importing a financial fact." },
  ],
  plans: [
    {
      id: "plan_o5_v1", orderId: "o5", buyerRef: { type: "ORGANIZATION_ACCOUNT", id: "org_c1" }, version: 1,
      kind: "DEPOSIT_AND_BALANCE", state: "ACTIVE", currency: "VND", scheduleLineIds: ["psl_o5_deposit", "psl_o5_balance"],
      evidenceCount: 0, idempotencyKey: "plan:o5:v1", createdAt: "2026-06-05T14:30:00Z", updatedAt: "2026-06-05T14:30:00Z", activatedAt: "2026-06-05T14:30:00Z",
      agreementSnapshot: {
        version: 1, kind: "DEPOSIT_AND_BALANCE", currency: "VND", acceptedAt: "2026-06-05T14:30:00Z", policyVersion: "payment-plan/1",
        lines: [
          { id: "psl_o5_deposit", sequence: 1, label: "Đặt cọc 30%", purpose: "DEPOSIT", amountRule: { type: "PERCENTAGE", percentage: "30" }, previewAmount: { amount: "4950000", currency: "VND" }, dueRule: { type: "EVENT_RELATIVE", event: "ORDER_CONFIRMED", offsetDays: 0, dayBasis: "CALENDAR" }, allowedMethodCodes: ["bank-transfer", "gateway-card"], preferredMethodCode: "bank-transfer", channel: "BANK", fulfillmentGate: "BEFORE_BOOKING", invoicePolicyCode: "DEPOSIT_OPTIONAL" },
          { id: "psl_o5_balance", sequence: 2, label: "Thanh toán sau nghiệm thu 70%", purpose: "BALANCE", amountRule: { type: "REMAINDER" }, previewAmount: { amount: "11550000", currency: "VND" }, dueRule: { type: "EVENT_RELATIVE", event: "ACCEPTANCE_CONFIRMED", offsetDays: 0, dayBasis: "CALENDAR" }, allowedMethodCodes: ["bank-transfer"], preferredMethodCode: "bank-transfer", channel: "BANK", fulfillmentGate: "NONE", invoicePolicyCode: "MILESTONE" },
        ],
      },
    },
  ],
  scheduleLines: [
    { id: "psl_o5_deposit", planId: "plan_o5_v1", planVersion: 1, orderId: "o5", buyerRef: { type: "ORGANIZATION_ACCOUNT", id: "org_c1" }, sequence: 1, label: "Đặt cọc 30%", purpose: "DEPOSIT", amountRule: { type: "PERCENTAGE", percentage: "30" }, amount: { amount: "4950000", currency: "VND" }, dueRule: { type: "EVENT_RELATIVE", event: "ORDER_CONFIRMED", offsetDays: 0, dayBasis: "CALENDAR" }, allowedMethodCodes: ["bank-transfer", "gateway-card"], preferredMethodCode: "bank-transfer", channel: "BANK", fulfillmentGate: "BEFORE_BOOKING", invoicePolicyCode: "DEPOSIT_OPTIONAL", state: "DUE", satisfiedAmount: { amount: "0", currency: "VND" }, outstandingAmount: { amount: "4950000", currency: "VND" }, idempotencyKey: "plan:o5:v1:1", createdAt: "2026-06-05T14:30:00Z", updatedAt: "2026-06-05T14:30:00Z" },
    { id: "psl_o5_balance", planId: "plan_o5_v1", planVersion: 1, orderId: "o5", buyerRef: { type: "ORGANIZATION_ACCOUNT", id: "org_c1" }, sequence: 2, label: "Thanh toán sau nghiệm thu 70%", purpose: "BALANCE", amountRule: { type: "REMAINDER" }, amount: { amount: "11550000", currency: "VND" }, dueRule: { type: "EVENT_RELATIVE", event: "ACCEPTANCE_CONFIRMED", offsetDays: 0, dayBasis: "CALENDAR" }, allowedMethodCodes: ["bank-transfer"], preferredMethodCode: "bank-transfer", channel: "BANK", fulfillmentGate: "NONE", invoicePolicyCode: "MILESTONE", state: "NOT_DUE", satisfiedAmount: { amount: "0", currency: "VND" }, outstandingAmount: { amount: "11550000", currency: "VND" }, idempotencyKey: "plan:o5:v1:2", createdAt: "2026-06-05T14:30:00Z", updatedAt: "2026-06-05T14:30:00Z" },
  ],
  intents: [],
  refundIntents: [],
  paymentRecords: [
    { id: "payment_o1_authoritative", buyerRef: { type: "ORGANIZATION_ACCOUNT", id: "org_c1" }, orderId: "o1", kind: "PAYMENT", state: "SUCCEEDED", amount: { amount: "197400000", currency: "VND" }, methodCode: "bank-transfer", channel: "BANK", occurredAt: "2025-06-15T15:30:00Z", externalReference: "BANK-O1-001", reconciliationState: "MATCHED", effectiveForReceivables: true, idempotencyKey: "payment:o1:authoritative", version: 1, createdAt: "2025-06-15T15:30:00Z", updatedAt: "2025-06-15T15:30:00Z" },
  ],
  allocations: [
    { id: "alloc_o1_inv_001", buyerRef: { type: "ORGANIZATION_ACCOUNT", id: "org_c1" }, invoiceId: "inv_o1_001", paymentRecordId: "payment_o1_authoritative", amount: { amount: "197400000", currency: "VND" }, state: "EFFECTIVE", idempotencyKey: "allocation:o1:inv_o1_001", version: 1, createdAt: "2025-06-15T15:30:00Z" },
  ],
  customerCredits: [],
  methodCatalog: PAYMENT_METHOD_CATALOG,
  providerCatalog: PAYMENT_PROVIDER_CATALOG,
};
