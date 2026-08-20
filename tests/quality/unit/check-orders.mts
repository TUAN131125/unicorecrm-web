import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_ORDER_STATE_DEFINITIONS,
  applyOrderCancellation,
  applyOrderCompletion,
  applyOrderConfirmation,
  assertCanonicalOrderInvariant,
  canTransitionOrderState,
} from "@/modules/orders/domain/rules/orderLifecycle";
import { OrderState, type CustomerOrder, type OrderItem } from "@/modules/orders";
import { evaluateOrderClosingPolicy } from "@/workflows/order-closing";
import { money } from "@/shared/money";
import type { ShippingBooking } from "@/modules/shipping";

const now = "2026-07-15T10:00:00.000Z";
const baseItem: OrderItem = {
  id: "line-1", productId: "prod-1", productNameSnapshot: "Product", fulfillmentKind: "SERVICE",
  quantity: 1, unitPriceSnapshot: 100_000, discountPercent: 0,
  lineSubtotal: 100_000, lineDiscountAmount: 0, lineTaxAmount: 0, lineTotal: 100_000,
};

function createDraftOrder(id = "order-1", patch: Partial<CustomerOrder> = {}): CustomerOrder {
  return {
    id, orderNumber: `ORD-${id}`, orderDate: "2026-07-15",
    buyerRef: { type: "CONTACT", id: `contact-${id}` }, state: OrderState.DRAFT,
    items: [{ ...baseItem }], grandTotal: 100_000, totalAmount: 100_000, currency: "VND",
    paymentAgreementSnapshot: {
      version: 1, kind: "FULL_PAYMENT", currency: "VND", policyVersion: "test/v1",
      lines: [{
        id: `agreement:${id}:1`, sequence: 1, label: "Full payment", purpose: "FULL",
        amountRule: { type: "REMAINDER" }, previewAmount: money("100000", "VND"),
        dueRule: { type: "EVENT_RELATIVE", event: "ORDER_CONFIRMED", offsetDays: 0, dayBasis: "CALENDAR" },
        allowedMethodCodes: ["bank-transfer"], preferredMethodCode: "bank-transfer",
        fulfillmentGate: "BEFORE_COMPLETION", invoicePolicyCode: "STANDARD_ORDER_INVOICE",
      }],
    },
    createdAt: now, updatedAt: now, ...patch,
  };
}

function shipping(orderId: string, externalStatus: ShippingBooking["externalStatus"]): ShippingBooking {
  return {
    id: `shipping-${orderId}`, workspaceId: "ws-default", code: `SHP-${orderId}`,
    sourceType: "ORDER", sourceId: orderId, purpose: "ORDER_OUTBOUND",
    providerId: "manual", providerNameSnapshot: "Manual", bookingStatus: "BOOKED", externalStatus,
    pickupLocationSnapshot: { line1: "1 Pickup", city: "HCM" },
    recipientSnapshot: { name: "Buyer", phone: "0900000000", address: { line1: "2 Buyer", city: "HCM" } },
    packageSnapshot: { packageCount: 1, totalWeightGrams: 1000 },
    idempotencyKey: `idem-${orderId}`, shipmentGroupId: `attempt-${orderId}`, correlationId: `corr-${orderId}`,
    deliveredAt: externalStatus === "DELIVERED" ? now : undefined,
    createdAt: now, updatedAt: now, version: 1,
  };
}

assert.deepEqual(DEFAULT_ORDER_STATE_DEFINITIONS.map((item) => item.code), ["DRAFT", "CONFIRMED", "COMPLETED", "CANCELLED"]);
assert.deepEqual(Object.values(OrderState), ["DRAFT", "CONFIRMED", "COMPLETED", "CANCELLED"]);
assert.equal(canTransitionOrderState(OrderState.DRAFT, OrderState.CONFIRMED), false, "Confirmation is an explicit Order + Payment Plan workflow, not a generic state mutation");
assert.equal(canTransitionOrderState(OrderState.CONFIRMED, OrderState.COMPLETED), false, "Completion is evidence-owned, not a generic state mutation");
assert.equal(canTransitionOrderState(OrderState.CONFIRMED, OrderState.CANCELLED), false, "Cancellation requires reason and actor audit");
assert.equal(canTransitionOrderState(OrderState.COMPLETED, OrderState.CONFIRMED), false);

const draft = createDraftOrder();
assert.doesNotThrow(() => assertCanonicalOrderInvariant(draft));
const confirmed = applyOrderConfirmation(draft, now);
assert.equal(confirmed.state, OrderState.CONFIRMED);
assert.equal(confirmed.confirmedAt, now);
assert.throws(() => applyOrderConfirmation(createDraftOrder("missing-agreement", { paymentAgreementSnapshot: undefined }), now), /Payment Agreement/);

const completed = applyOrderCompletion(confirmed, {
  policyVersion: "order-closing/test", correlationId: "corr-complete", evidenceId: "evidence-1", occurredAt: now,
});
assert.equal(completed.state, OrderState.COMPLETED);
assert.equal(completed.completion?.evidenceId, "evidence-1");
assert.throws(() => applyOrderCompletion(draft, { policyVersion: "x", correlationId: "x", evidenceId: "x", occurredAt: now }), /CONFIRMED/);

const cancelled = applyOrderCancellation(draft, { reason: "Customer withdrew", actorId: "user-1" }, now);
assert.equal(cancelled.state, OrderState.CANCELLED);
assert.equal(cancelled.cancellation?.reason, "Customer withdrew");
assert.throws(() => applyOrderCancellation(draft, { reason: "", actorId: "user-1" }, now), /reason/);

const readyPayment = { ready: true, blockers: [], blockingObligationIds: [] };
assert.equal(evaluateOrderClosingPolicy(confirmed, readyPayment, []).ready, true, "Service-only Order can close without Shipping");
const physical = { ...confirmed, items: [{ ...baseItem, fulfillmentKind: "PHYSICAL_SHIPMENT" as const }] };
assert.equal(evaluateOrderClosingPolicy(physical, readyPayment, []).ready, false);
assert.equal(evaluateOrderClosingPolicy(physical, readyPayment, [shipping(physical.id, "DELIVERED")]).ready, true);

const orderSource = fs.readFileSync(path.join(repositoryRoot, "src/modules/orders/domain/model/order.types.ts"), "utf8");
assert.equal(/OrderState[\s\S]{0,240}FAILED/.test(orderSource), false, "Order lifecycle must not reintroduce FAILED");
console.log("Order lifecycle contracts: PASS");
