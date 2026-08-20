import assert from "node:assert/strict";
import { buildOrderToCashMetrics } from "@/workspaces/crm/order-to-cash/orderToCashMetrics";

const buyerRef = { type: "CONTACT", id: "c1" } as const;
const metrics = buildOrderToCashMetrics({
  now: "2026-07-31T00:00:00Z",
  orders: [{ id: "o1", orderNumber: "O1", orderDate: "2026-07-01", confirmedAt: "2026-07-01", buyerRef, state: "COMPLETED", items: [], totalAmount: 100, completedAt: "2026-07-10" }],
  transactions: [{ id: "p1", orderId: "o1", buyerRef, kind: "PAYMENT", status: "SUCCEEDED", amount: 80, currency: "VND", occurredAt: "2026-07-11", source: "CARRIER", method: "COD", reconciliationState: "MATCHED", codCollectionState: "REMITTED" }],
  shipping: [{ id: "s1", workspaceId: "ws", code: "S1", sourceType: "ORDER", sourceId: "o1", purpose: "ORDER_OUTBOUND", providerId: "p", providerNameSnapshot: "Provider", bookingStatus: "BOOKED", externalStatus: "DELIVERED", pickupLocationSnapshot: { line1: "a", city: "HCM" }, recipientSnapshot: { name: "A", phone: "1", address: { line1: "b", city: "HCM" } }, packageSnapshot: { packageCount: 1, totalWeightGrams: 1 }, idempotencyKey: "s1", shipmentGroupId: "g", correlationId: "c", createdAt: "2026-07-01", updatedAt: "2026-07-10", version: 1 }],
  returns: [{ id: "r1", workspaceId: "ws", code: "R1", orderId: "o1", buyerRef, ownerId: "u", items: [], reason: "DEFECTIVE", requestedResolution: "REFUND", status: "RESOLVED", requestedAt: "2026-07-12", eligibilityResult: { eligible: true, reasonCode: "OK", explanation: "", evaluatedAt: "2026-07-12" }, resolvedAt: "2026-07-17", correlationId: "r", createdAt: "2026-07-12", updatedAt: "2026-07-17", version: 1 }],
  receivables: [{ invoiceId: "i1", invoiceNumber: "INV-1", buyerRef, buyerName: "Buyer", issueDate: "2026-07-01", dueDate: "2026-07-15", originalAmount: { amount: "100", currency: "VND" }, allocatedAmount: { amount: "20", currency: "VND" }, creditedAmount: { amount: "0", currency: "VND" }, outstandingAmount: { amount: "80", currency: "VND" }, settlementState: "OVERDUE", agingBucket: "1_30", version: 1 }],
});

assert.equal(metrics.collectionCycleDays, 10);
assert.equal(metrics.deliverySuccessRate, 100);
assert.equal(metrics.codReconciliationRate, 100);
assert.equal(metrics.returnRate, 100);
assert.equal(metrics.refundCycleDays, 5);
assert.equal(metrics.receivables?.outstandingAmount.amount, "80");
assert.equal(metrics.receivables?.overdueAmount.amount, "80");
assert.equal(metrics.receivables?.agingCounts["1_30"], 1);
assert.equal("dsoDays" in metrics, false);
console.log("Order-to-cash metrics: PASS — authoritative receivables plus operational collection, delivery, COD, return, and refund metrics verified");
