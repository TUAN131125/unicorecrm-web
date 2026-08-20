import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { InMemoryPaymentRepository } from "@/modules/payments/infrastructure/InMemoryPaymentRepository";
import { recordSucceededPayment, recordSucceededRefund, savePaymentPlan } from "@/modules/payments/application/commands/paymentCommands";
import { evaluatePaymentCompletionReadiness, getCodCollectibleAmountForOrder, projectPaymentSummary } from "@/modules/payments/application/queries/paymentQueries";
import { resolvePaymentActionIds } from "@/modules/payments/presentation/model/paymentActionPolicy";

const now = "2026-07-09T10:00:00.000Z";
const buyerRef = { type: "CONTACT", id: "contact-payment-test" } as const;
const repository = new InMemoryPaymentRepository();


const migratedRepository = new InMemoryPaymentRepository({
  transactions: [{
    id: "legacy-payment-shape",
    orderId: "order-legacy-shape",
    buyerRef,
    kind: "PAYMENT",
    status: "SUCCEEDED",
    amount: 25_000,
    currency: "VND",
    occurredAt: now,
    source: "IMPORTED_LEGACY",
    obligationId: "obl-legacy-shape",
    allocationAmount: 25_000,
  } as never],
});
const migratedTransaction = migratedRepository.listTransactions()[0];
assert.deepEqual(
  migratedTransaction.allocations,
  [{ obligationId: "obl-legacy-shape", amount: 25_000 }],
  "Persisted single-allocation transactions must migrate to canonical allocations",
);
assert.equal("obligationId" in migratedTransaction, false, "Repository snapshots must not leak the removed single-obligation field");
assert.equal("allocationAmount" in migratedTransaction, false, "Repository snapshots must not leak the removed allocation total field");

const plan = savePaymentPlan(repository, {
  orderId: "order-payment-test",
  buyerRef,
  lines: [
    { id: "obl-deposit", label: "30% deposit", amountDue: 30_000, currency: "VND", term: "DEPOSIT", method: "BANK_TRANSFER", idempotencyKey: "plan:deposit" },
    { id: "obl-cod", label: "70% COD", amountDue: 70_000, currency: "VND", term: "POSTPAID", method: "COD", timing: "ON_DELIVERY", fulfillmentGate: "NONE", idempotencyKey: "plan:cod" },
  ],
  fulfillmentContext: { requiresPhysicalShipping: true },
  actorId: "qa",
  now,
});

assert.equal(plan.length, 2);
assert.equal(plan[0].term, "DEPOSIT");
assert.equal(plan[0].method, "BANK_TRANSFER");
assert.notEqual(plan[0].term, plan[0].method, "Payment Term and Payment Method are separate concepts");
assert.equal(plan[1].term, "POSTPAID");
assert.equal(plan[1].method, "COD");
assert.throws(() => savePaymentPlan(new InMemoryPaymentRepository(), {
  orderId: "order-service-only",
  buyerRef,
  lines: [{ id: "obl-invalid-cod", amountDue: 10_000, currency: "VND", term: "POSTPAID", method: "COD", timing: "ON_DELIVERY", fulfillmentGate: "NONE", idempotencyKey: "plan:invalid-cod" }],
  fulfillmentContext: { requiresPhysicalShipping: false },
  actorId: "qa",
  now,
}), /only available for Orders with physical shipping/i, "Service-only Orders must reject COD obligations at the command boundary");
assert.throws(() => savePaymentPlan(new InMemoryPaymentRepository(), {
  orderId: "order-invalid-cod-timing",
  buyerRef,
  lines: [{ id: "obl-invalid-cod-timing", amountDue: 10_000, currency: "VND", term: "POSTPAID", method: "COD", timing: "POSTPAID", fulfillmentGate: "NONE", idempotencyKey: "plan:invalid-cod-timing" }],
  fulfillmentContext: { requiresPhysicalShipping: true },
  actorId: "qa",
  now,
}), /must be collected ON_DELIVERY/i, "COD with POSTPAID timing must not be projected into Shipping collectible amount");
assert.throws(() => savePaymentPlan(new InMemoryPaymentRepository(), {
  orderId: "order-invalid-cod-gate",
  buyerRef,
  lines: [{ id: "obl-invalid-cod-gate", amountDue: 10_000, currency: "VND", term: "POSTPAID", method: "COD", timing: "ON_DELIVERY", fulfillmentGate: "BEFORE_COMPLETION", idempotencyKey: "plan:invalid-cod-gate" }],
  fulfillmentContext: { requiresPhysicalShipping: true },
  actorId: "qa",
  now,
}), /must not block shipping booking or Order completion/i, "COD must not create a zero-collectible fulfillment blocker");

let summary = projectPaymentSummary(repository, "order-payment-test", 100_000, "VND");
assert.equal(summary.outstandingAmount, 100_000);
assert.equal(summary.obligationCount, 2);
assert.deepEqual(new Set(summary.methods), new Set(["BANK_TRANSFER", "COD"]));
assert.deepEqual(new Set(summary.terms), new Set(["DEPOSIT", "POSTPAID"]));
assert.equal(evaluatePaymentCompletionReadiness(repository, "order-payment-test").ready, false, "Outstanding deposit blocks completion policy");
assert.equal(getCodCollectibleAmountForOrder(repository, "order-payment-test"), 70_000);

const depositPayment = recordSucceededPayment(repository, {
  id: "pay-deposit",
  orderId: "order-payment-test",
  buyerRef,
  amount: 30_000,
  currency: "VND",
  occurredAt: now,
  allocations: [{ obligationId: "obl-deposit", amount: 30_000 }],
  method: "BANK_TRANSFER",
  termSnapshot: "DEPOSIT",
  idempotencyKey: "payment:deposit",
  actorId: "qa",
});
assert.equal(depositPayment.status, "SUCCEEDED");
assert.equal(evaluatePaymentCompletionReadiness(repository, "order-payment-test").ready, true, "Outstanding POSTPAID/COD may remain after fulfillment");
assert.equal(getCodCollectibleAmountForOrder(repository, "order-payment-test"), 70_000, "COD collectible remains Payment-owned outstanding amount");
summary = projectPaymentSummary(repository, "order-payment-test", 100_000, "VND");
assert.equal(summary.outstandingAmount, 70_000);
assert.equal(summary.state, "PARTIAL");

const refund = recordSucceededRefund(repository, {
  id: "refund-deposit",
  orderId: "order-payment-test",
  buyerRef,
  amount: 10_000,
  currency: "VND",
  occurredAt: "2026-07-09T11:00:00.000Z",
  refundOfTransactionId: depositPayment.id,
  idempotencyKey: "refund:deposit:10k",
  actorId: "qa",
});
assert.equal(refund.kind, "REFUND");
assert.equal(refund.status, "SUCCEEDED", "Refund success is produced by the Payment owner");

const permissions = { canView: true, canRecord: true, canRefund: true, canReconcile: true };
assert.deepEqual(resolvePaymentActionIds({ kind: "PAYMENT", status: "FAILED", reconciliationState: "UNRECONCILED" }, permissions), ["view", "retry"]);
assert.deepEqual(resolvePaymentActionIds({ kind: "PAYMENT", status: "SUCCEEDED", reconciliationState: "UNRECONCILED" }, permissions), ["view", "refund", "reconcile-match", "reconcile-mismatch"]);
assert.equal(resolvePaymentActionIds({ kind: "REFUND", status: "SUCCEEDED", reconciliationState: "MATCHED" }, permissions).includes("refund"), false);


const paymentTypes = fs.readFileSync(path.resolve("src/modules/payments/domain/model/payment.types.ts"), "utf8");
assert.equal(paymentTypes.includes("obligationId?: string"), false, "PaymentTransaction must use allocations instead of a single-obligation compatibility pointer");
assert.equal(paymentTypes.includes("allocationAmount?: number"), false, "PaymentTransaction must derive allocation totals from allocations");
const paymentCommands = fs.readFileSync(path.resolve("src/modules/payments/application/commands/paymentCommands.ts"), "utf8");
assert.equal(/saveOrder|changeOrderState|completeOrder|failOrder/.test(paymentCommands), false, "Payment owner must not mutate Order lifecycle");
const shippingCommands = fs.readFileSync(path.resolve("src/modules/shipping/application/commands/shippingCommands.ts"), "utf8");
assert.equal(/recordPayment|markOrderPaid|paymentStatus/.test(shippingCommands), false, "Shipping must not mark Order or Payment paid");

console.log("Payment method/terms, obligations, COD boundary and state-action contracts: PASS");
