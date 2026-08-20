import assert from "node:assert/strict";
import { money } from "@/shared/money";
import { buildPaymentPlanPreview } from "@/modules/payments/domain/rules/paymentPlanRules";
import { savePaymentPlanDraft } from "@/modules/payments/application/commands/paymentPlanCommands";
import { InMemoryPaymentRepository } from "@/modules/payments/infrastructure/InMemoryPaymentRepository";
import { PAYMENT_METHOD_CATALOG } from "@/modules/payments/infrastructure/paymentCatalog.seed";
import type { PaymentAgreementSnapshot } from "@/modules/payments/domain/model/paymentPlan.types";

const buyerRef = { type: "ORGANIZATION_ACCOUNT", id: "buyer-plan" } as const;
const now = "2026-07-15T00:00:00.000Z";
const line = (id: string, amount: string, methodCode = "bank-transfer", gate: "NONE" | "BEFORE_BOOKING" = "NONE") => ({
  id, sequence: Number(id.split("-").at(-1) ?? 1), label: id, purpose: "INSTALLMENT" as const,
  amountRule: { type: "FIXED" as const, amount: money(amount, "VND") }, previewAmount: money(amount, "VND"),
  dueRule: { type: "EVENT_RELATIVE" as const, event: methodCode === "carrier-cod" ? "DELIVERY_CONFIRMED" as const : "ORDER_CONFIRMED" as const, offsetDays: 0, dayBasis: "CALENDAR" as const },
  allowedMethodCodes: [methodCode], preferredMethodCode: methodCode, fulfillmentGate: gate,
});
const agreement: PaymentAgreementSnapshot = { version: 1, kind: "INSTALLMENT", currency: "VND", policyVersion: "test", lines: [line("line-1", "30"), { ...line("line-2", "70"), amountRule: { type: "REMAINDER" as const } }] };
const preview = buildPaymentPlanPreview(agreement, money("100", "VND"), PAYMENT_METHOD_CATALOG, { requiresPhysicalShipping: false, now, orderId: "order-plan", buyerRef });
assert.equal(preview.ready, true);
assert.equal(preview.scheduledAmount.amount, "100");
assert.equal(preview.remainingAmount.amount, "0");

const codAgreement: PaymentAgreementSnapshot = { version: 1, kind: "FULL_PAYMENT", currency: "VND", policyVersion: "test", lines: [{ ...line("line-1", "100", "carrier-cod"), purpose: "FULL", amountRule: { type: "REMAINDER" } }] };
assert.ok(buildPaymentPlanPreview(codAgreement, money("100", "VND"), PAYMENT_METHOD_CATALOG, { requiresPhysicalShipping: false, now, orderId: "order-cod", buyerRef }).blockers.some((item) => item.code === "COD_REQUIRES_PHYSICAL_SHIPPING"));
assert.equal(buildPaymentPlanPreview(codAgreement, money("100", "VND"), PAYMENT_METHOD_CATALOG, { requiresPhysicalShipping: true, now, orderId: "order-cod", buyerRef }).ready, true);

const recurring: PaymentAgreementSnapshot = { ...agreement, lines: [{ ...line("line-1", "100"), amountRule: { type: "REMAINDER" }, dueRule: { type: "RECURRING_FINITE", firstDueDate: "2026-07-15", interval: "MONTHLY", count: 0 } }] };
assert.ok(buildPaymentPlanPreview(recurring, money("100", "VND"), PAYMENT_METHOD_CATALOG, { requiresPhysicalShipping: false, now, orderId: "order-recurring", buyerRef }).blockers.some((item) => item.code === "RECURRING_COUNT_REQUIRED"));

const repo = new InMemoryPaymentRepository({ methodCatalog: PAYMENT_METHOD_CATALOG, plans: [{ id: "active", orderId: "order", buyerRef, version: 1, kind: "FULL_PAYMENT", state: "ACTIVE", currency: "VND", agreementSnapshot: codAgreement, scheduleLineIds: ["line-1"], evidenceCount: 1, idempotencyKey: "active", createdAt: now, updatedAt: now }] });
assert.throws(() => savePaymentPlanDraft(repo, { id: "active", orderId: "order", buyerRef, version: 2, agreementSnapshot: codAgreement, orderAmount: money("100", "VND"), requiresPhysicalShipping: true, idempotencyKey: "active", now }), /cannot be edited|Only DRAFT/i);
console.log("Payment Plan contracts: PASS");
