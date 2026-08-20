import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  approveReturn,
  completeReturnResolution,
  confirmReturnedItemsReceived,
  createReturnRequest,
  linkReturnIntentExternalReference,
  markReturnAwaitingItem,
  requestCreditNoteResolution,
  requestRefundResolution,
  requestReplacementResolution,
  succeedReturnIntent,
} from "@/modules/returns/application/commands/returnCommands";
import { InMemoryReturnRepository } from "@/modules/returns/infrastructure/InMemoryReturnRepository";
import { createShippingBooking, syncShippingBooking } from "@/modules/shipping/application/commands/shippingCommands";
import { InMemoryShippingRepository } from "@/modules/shipping/infrastructure/InMemoryShippingRepository";
import { ShippingProviderRegistry } from "@/modules/shipping/infrastructure/ShippingProviderRegistry";
import { ManualShippingProvider } from "@/modules/shipping/infrastructure/providers/manual/ManualShippingProvider";
import { getOrdersSnapshot, replaceOrders, OrderState } from "@/modules/orders";
import { savePaymentPlanSnapshot } from "@/modules/payments";
import { createOrderOutboundShippingBooking } from "@/workflows/order-shipping-booking";

const root = repositoryRoot;
const now = "2026-07-08T10:00:00.000Z";
const actor = { actorId: "qa-user", actorName: "QA User", now };


// Shipping and Returns are durable owners and expose no hard-delete command.
const shippingCommandsSource = fs.readFileSync(path.join(root, "src/modules/shipping/application/commands/shippingCommands.ts"), "utf8");
const returnCommandsSource = fs.readFileSync(path.join(root, "src/modules/returns/application/commands/returnCommands.ts"), "utf8");
assert.equal(/deleteShipping|removeShipping|hardDelete/i.test(shippingCommandsSource), false, "Shipping must not expose hard delete commands");
assert.equal(/deleteReturn|removeReturn|hardDelete/i.test(returnCommandsSource), false, "Returns must not expose hard delete commands");



const paymentCommandsSource = fs.readFileSync(path.join(root, "src/modules/payments/application/commands/paymentCommands.ts"), "utf8");
assert.equal(/saveOrder|changeOrderState|updateOrder/.test(paymentCommandsSource), false, "Payment must not write Order state");
const evidenceWorkflowSource = fs.readFileSync(path.join(root, "src/workflows/return-resolution-evidence/index.ts"), "utf8");
assert.ok(evidenceWorkflowSource.includes("getPaymentsSnapshot"), "Refund resolution evidence must be read from the Payment owner");
assert.ok(
  evidenceWorkflowSource.includes('record.kind !== "REFUND"')
  && evidenceWorkflowSource.includes('record.state !== "SUCCEEDED"')
  && evidenceWorkflowSource.includes("refundIntent.sourceReturnId !== request.id"),
  "Return refund intent must require owned canonical Payment REFUND SUCCEEDED evidence",
);
assert.ok(evidenceWorkflowSource.includes("getInvoicesSnapshot") && evidenceWorkflowSource.includes('note.state !== "ISSUED"'), "Return credit intent must require actual Invoice Credit Note ISSUED evidence");
assert.ok(evidenceWorkflowSource.includes('booking.purpose !== "REPLACEMENT_OUTBOUND"') && evidenceWorkflowSource.includes("isDeliveredShippingEvidence"), "Replacement resolution must require canonical Shipping DELIVERED evidence");
const returnDetailSource = fs.readFileSync(path.join(root, "src/modules/returns/presentation/pages/ReturnDetailPage.tsx"), "utf8");
const returnResolutionWorkflowSource = fs.readFileSync(path.join(root, "src/workflows/return-resolution/index.ts"), "utf8");
const returnCreditRefundWorkflowSource = fs.readFileSync(path.join(root, "src/workflows/return-credit-refund/index.ts"), "utf8");
assert.ok(returnDetailSource.includes("completeReturnReplacementFromDeliveryCommand") && returnDetailSource.includes("executeReturnCreditRefundCommand"), "Return Detail must delegate downstream completion to canonical workflow commands");
assert.ok(returnResolutionWorkflowSource.includes("syncReturnResolutionIntentFromEvidence") && returnCreditRefundWorkflowSource.includes("syncReturnResolutionIntentFromEvidence"), "Return workflows must verify downstream success through the evidence owner");
assert.equal(returnDetailSource.includes("succeedReturnIntentSnapshot"), false, "Return UI must not directly mark downstream intent success");
for (const legacyMarker of ["recordPayment(", "recordRefund(", "savePaymentPlanSnapshot(", "getPaymentObligationsForOrderSnapshot", "getRefundablePaymentTransactionsForOrderSnapshot"]) {
  assert.equal(returnDetailSource.includes(legacyMarker), false, `Exchange UI must not use legacy ${legacyMarker} behavior`);
}
assert.ok(returnResolutionWorkflowSource.includes("createPaymentIntentAuthoritative"), "Positive Exchange delta must create a provider-owned Payment Intent inside the canonical workflow");
assert.ok(returnResolutionWorkflowSource.includes("prepareReturnCreditRefundEvidence"), "Negative Exchange delta must prepare Credit Note and Refund evidence inside the canonical workflow");
assert.ok(returnDetailSource.includes("getPaymentMethodCatalogSnapshot"), "Exchange payment methods must come from the catalog");
for (const directory of ["src/modules/returns/domain", "src/modules/returns/application"]) {
  for (const file of walkAllFiles(path.join(root, directory)).filter((candidate) => /\.(ts|tsx)$/.test(candidate))) {
    const text = fs.readFileSync(file, "utf8");
    assert.equal(/@\/modules\/(payments|orders)/.test(text), false, `${path.relative(root, file)} must emit intentions instead of writing downstream owners`);
  }
}
assert.ok(returnCommandsSource.includes("findIntentByIdempotencyKey"), "Return resolution intentions must dedupe by idempotency key");

// Shipping aggregate behavior.
const shippingRepository = new InMemoryShippingRepository();
const providers = new ShippingProviderRegistry([new ManualShippingProvider()]);
const shippingInput = {
  id: "ship-test-1",
  workspaceId: "ws-default",
  code: "SB-TEST-1",
  sourceType: "ORDER" as const,
  sourceId: "order-confirmed",
  purpose: "ORDER_OUTBOUND" as const,
  providerId: "manual",
  pickupLocationSnapshot: { line1: "1 Pickup", city: "HCM", name: "Main Pickup" },
  recipientSnapshot: { name: "Buyer", phone: "0900000000", address: { line1: "2 Buyer", city: "HCM" } },
  packageSnapshot: { packageCount: 1, totalWeightGrams: 1200 },
  shipmentGroupId: "attempt-1",
  idempotencyKey: "ship-test-idempotency-1",
  correlationId: "corr-ship-test-1",
  ...actor,
};
const firstBooking = await createShippingBooking(shippingRepository, providers, shippingInput);
assert.equal(firstBooking.bookingStatus, "BOOKED");
assert.equal(firstBooking.externalStatus, "ACCEPTED");
const replay = await createShippingBooking(shippingRepository, providers, { ...shippingInput, id: "ship-test-duplicate" });
assert.equal(replay.id, firstBooking.id, "Idempotency must return the original booking");
assert.equal(shippingRepository.list().length, 1, "Idempotency must prevent duplicate booking records");

let synced = await syncShippingBooking(shippingRepository, providers, firstBooking.id, actor);
assert.equal(synced.externalStatus, "ACCEPTED", "Manual sync must not fabricate carrier progress");
assert.equal(synced.deliveredAt, undefined, "Delivery evidence must not be invented by repeated sync calls");
ManualShippingProvider.recordVerifiedSnapshot(firstBooking.externalBookingId!, {
  externalStatus: "DELIVERED",
  providerUpdatedAt: "2026-07-08T12:00:00.000Z",
  trackingCode: firstBooking.trackingCode,
  deliveredAt: "2026-07-08T12:00:00.000Z",
});
synced = await syncShippingBooking(shippingRepository, providers, firstBooking.id, actor);
assert.equal(synced.externalStatus, "DELIVERED");
assert.ok(synced.deliveredAt, "DELIVERED must carry externally verified deliveredAt evidence");
assert.equal(synced.bookingStatus, "BOOKED", "External status sync must not rewrite booking status");

// Order -> Shipping workflow must enforce CONFIRMED and keep Order state unchanged.
const originalOrders = getOrdersSnapshot();
try {
  const baseItem = {
    id: "line-1",
    productId: "prod-1",
    productNameSnapshot: "Sản phẩm kiểm thử",
    quantity: 1,
    unitPriceSnapshot: 100000,
    discountPercent: 0,
    lineSubtotal: 100000,
    lineDiscountAmount: 0,
    lineTaxAmount: 0,
    lineTotal: 100000,
  };
  replaceOrders({
    buyer: [
      {
        id: "order-cancelled",
        orderNumber: "ORD-CANCELLED",
        orderDate: "2026-07-08",
        buyerRef: { type: "CONTACT", id: "contact-1" },
        state: OrderState.CANCELLED,
        items: [baseItem],
        totalAmount: 100000,
        recipientName: "Buyer",
        recipientPhone: "0900000000",
        shippingAddress: { line1: "2 Buyer", city: "HCM" },
        cancelledAt: "2026-07-08",
        cancellation: { reason: "Test cancellation", actorId: "qa-user", occurredAt: now },
      },
      {
        id: "order-confirmed",
        orderNumber: "ORD-CONFIRMED",
        orderDate: "2026-07-08",
        buyerRef: { type: "CONTACT", id: "contact-1" },
        state: OrderState.CONFIRMED,
        items: [baseItem],
        totalAmount: 100000,
        currency: "VND",
        recipientName: "Buyer",
        recipientPhone: "0900000000",
        shippingAddress: { line1: "2 Buyer", city: "HCM" },
      },
    ],
  });

  await assert.rejects(
    () => createOrderOutboundShippingBooking({
      orderId: "order-cancelled",
      id: "ship-order-cancelled",
      code: "SB-CANCELLED",
      providerId: "manual",
      pickupLocationSnapshot: { line1: "1 Pickup", city: "HCM" },
      packageSnapshot: { packageCount: 1, totalWeightGrams: 1000 },
      shipmentGroupId: "attempt-1",
      idempotencyKey: "ship-order-cancelled-key",
      correlationId: "corr-cancelled",
      ...actor,
    }),
    /CONFIRMED/,
  );

  savePaymentPlanSnapshot({
    orderId: "order-confirmed",
    buyerRef: { type: "CONTACT", id: "contact-1" },
    lines: [{ id: "obl-cod", label: "COD", amountDue: 100000, currency: "VND", method: "COD", term: "POSTPAID", timing: "ON_DELIVERY", fulfillmentGate: "NONE", idempotencyKey: "obl-cod-key" }],
    fulfillmentContext: { requiresPhysicalShipping: true },
    actorId: "qa-user",
    actorName: "QA User",
    now,
  });

  const orderStateBefore = Object.values(getOrdersSnapshot()).flat().find((order) => order.id === "order-confirmed")?.state;
  const createdFromOrder = await createOrderOutboundShippingBooking({
    orderId: "order-confirmed",
    id: "ship-order-confirmed",
    code: "SB-CONFIRMED",
    providerId: "manual",
    serviceCode: "standard",
    transportMode: "DOMESTIC",
    pickupLocationSnapshot: { line1: "1 Pickup", city: "HCM" },
    recipientSnapshot: { name: "Buyer", phone: "0900000000", address: { line1: "2 Buyer", city: "HCM", countryCode: "VN" } },
    packageSnapshot: { packageCount: 1, totalWeightGrams: 1000, transportMode: "DOMESTIC", goodsType: "PARCEL", handling: { fragile: true, containsBattery: true } },
    shipmentGroupId: "attempt-1",
    idempotencyKey: "ship-order-confirmed-key",
    correlationId: "corr-confirmed",
    ...actor,
  });
  assert.equal(createdFromOrder.sourceType, "ORDER");
  assert.equal(createdFromOrder.purpose, "ORDER_OUTBOUND");
  assert.equal(createdFromOrder.codAmount?.amount, "100000");
  assert.equal(createdFromOrder.transportMode, "DOMESTIC");
  assert.equal(createdFromOrder.serviceCode, "standard");
  assert.equal(createdFromOrder.recipientSnapshot.address.countryCode, "VN");
  assert.equal(createdFromOrder.packageSnapshot.handling?.containsBattery, true);
  const orderStateAfter = Object.values(getOrdersSnapshot()).flat().find((order) => order.id === "order-confirmed")?.state;
  assert.equal(orderStateAfter, orderStateBefore, "Shipping must not mutate Order state");
} finally {
  replaceOrders(originalOrders);
}

// Return lifecycle, line-level quantity and downstream completion boundaries.
const returnRepository = new InMemoryReturnRepository({ requests: [], intents: [] });
const returnBase = {
  workspaceId: "ws-default",
  code: "RET-TEST-1",
  orderId: "order-confirmed",
  buyerRef: { type: "CONTACT", id: "contact-1" } as const,
  ownerId: "qa-user",
  reason: "DEFECTIVE" as const,
  requestedResolution: "REPLACEMENT" as const,
  deliveredAt: "2026-07-01T10:00:00.000Z",
  deliveryEvidenceShippingBookingId: "ship-delivered-order",
  items: [{
    orderLineId: "line-1",
    productId: "prod-1",
    productNameSnapshot: "Sản phẩm kiểm thử",
    orderedQuantity: 2,
    previouslyAcceptedReturnQuantity: 0,
    requestedQuantity: 1,
  }],
  ...actor,
};
assert.throws(() => createReturnRequest(returnRepository, {
  id: "return-invalid-raw-delivery",
  ...returnBase,
  deliveryEvidenceShippingBookingId: undefined,
}), /requires both deliveredAt and booking reference/i, "A raw deliveredAt value is not valid Shipping evidence");
const manualEvidenceRequest = createReturnRequest(returnRepository, {
  id: "return-manual-evidence",
  ...returnBase,
  deliveredAt: undefined,
  deliveryEvidenceShippingBookingId: undefined,
  manualDeliveryEvidence: {
    deliveredAt: "2026-07-01T10:00:00.000Z",
    reason: "Carrier history migrated with signed handover receipt",
    evidenceRef: "HANDOVER-001",
  },
});
assert.equal(manualEvidenceRequest.manualDeliveryEvidence?.evidenceRef, "HANDOVER-001");
assert.equal(manualEvidenceRequest.manualDeliveryEvidence?.actorId, actor.actorId, "Manual evidence must retain its author for audit");
const requested = createReturnRequest(returnRepository, { id: "return-1", ...returnBase });
assert.equal(requested.status, "REQUESTED");
assert.equal(requested.eligibilityResult.eligible, true);
const approved = approveReturn(returnRepository, requested.id, { reason: "Eligible and accepted by reviewer", ...actor });
assert.equal(approved.status, "APPROVED", "Approval is a separate decision after eligibility");
const awaiting = markReturnAwaitingItem(returnRepository, requested.id, { shippingBookingId: "ship-return-pickup", ...actor });
assert.equal(awaiting.status, "AWAITING_ITEM");
assert.equal(awaiting.returnPickupShippingBookingId, "ship-return-pickup");
assert.equal(awaiting.deliveryEvidenceShippingBookingId, "ship-delivered-order", "Return pickup must not overwrite original delivery evidence");
const received = confirmReturnedItemsReceived(returnRepository, requested.id, {
  items: [{ orderLineId: "line-1", receivedQuantity: 1, acceptedQuantity: 1, rejectedQuantity: 0 }],
  conditionNote: "Actual receive and inspection completed",
  ...actor,
});
assert.equal(received.status, "RECEIVED");

const secondRequest = createReturnRequest(returnRepository, {
  id: "return-2",
  ...returnBase,
  code: "RET-TEST-2",
  items: [{ ...returnBase.items[0], requestedQuantity: 2 }],
});
assert.equal(secondRequest.eligibilityResult.eligible, false);
assert.equal(secondRequest.eligibilityResult.reasonCode, "QUANTITY_EXCEEDS_REMAINING");

const replacement = requestReplacementResolution(returnRepository, requested.id, {
  type: "REPLACEMENT",
  lines: [{ productId: "prod-1", productNameSnapshot: "Sản phẩm kiểm thử", quantity: 1 }],
  ...actor,
});
linkReturnIntentExternalReference(returnRepository, replacement.intent.id, { externalReference: synced.id, ...actor });
assert.throws(
  () => completeReturnResolution(returnRepository, requested.id, {
    resolution: { type: "REPLACEMENT", replacementLines: [{ productId: "prod-1", productNameSnapshot: "Sản phẩm kiểm thử", quantity: 1 }], shippingBookingId: synced.id },
    intentId: replacement.intent.id,
    ...actor,
  }),
  /downstream intent has succeeded/,
  "A BOOKED/PENDING downstream action must not resolve the Return",
);
succeedReturnIntent(returnRepository, replacement.intent.id, { evidenceType: "SHIPPING_DELIVERED", externalReference: synced.id, ...actor });
const resolved = completeReturnResolution(returnRepository, requested.id, {
  resolution: { type: "REPLACEMENT", replacementLines: [{ productId: "prod-1", productNameSnapshot: "Sản phẩm kiểm thử", quantity: 1 }], shippingBookingId: synced.id },
  intentId: replacement.intent.id,
  ...actor,
});
assert.equal(resolved.status, "RESOLVED");

const refundRepository = new InMemoryReturnRepository({ requests: [], intents: [] });
const refundRequest = createReturnRequest(refundRepository, { id: "return-refund", ...returnBase, code: "RET-REFUND", requestedResolution: "REFUND" });
approveReturn(refundRepository, refundRequest.id, { reason: "Approved", ...actor });
confirmReturnedItemsReceived(refundRepository, refundRequest.id, {
  items: [{ orderLineId: "line-1", receivedQuantity: 1, acceptedQuantity: 1, rejectedQuantity: 0 }],
  conditionNote: "Received",
  ...actor,
});
const refundIntent = requestRefundResolution(refundRepository, refundRequest.id, {
  amount: { amount: "100000", currency: "VND" },
  ...actor,
});
const creditIntent = requestCreditNoteResolution(refundRepository, refundRequest.id, { amount: { amount: "100000", currency: "VND" }, invoiceIds: ["invoice-1"], ...actor });
linkReturnIntentExternalReference(refundRepository, creditIntent.intent.id, { externalReference: "credit-note-1", ...actor });
succeedReturnIntent(refundRepository, creditIntent.intent.id, { evidenceType: "CREDIT_NOTE_ISSUED", externalReference: "credit-note-1", ...actor });
assert.throws(
  () => succeedReturnIntent(refundRepository, refundIntent.intent.id, { evidenceType: "SHIPPING_DELIVERED", externalReference: "ship-x", ...actor }),
  /Refund Succeeded/,
  "Refund intent must require Payment success evidence",
);
succeedReturnIntent(refundRepository, refundIntent.intent.id, { evidenceType: "REFUND_SUCCEEDED", externalReference: "refund-tx-1", ...actor });
const refundResolved = completeReturnResolution(refundRepository, refundRequest.id, {
  resolution: { type: "REFUND", creditNoteIds: ["credit-note-1"], refundIntentId: refundIntent.intent.id, refundPaymentRecordIds: ["refund-tx-1"], creditedAmount: { amount: "100000", currency: "VND" }, refundedAmount: { amount: "100000", currency: "VND" } },
  intentIds: [creditIntent.intent.id, refundIntent.intent.id],
  ...actor,
});
assert.equal(refundResolved.status, "RESOLVED");

const exchangeRepository = new InMemoryReturnRepository({ requests: [], intents: [] });
const exchangeRequest = createReturnRequest(exchangeRepository, { id: "return-exchange", ...returnBase, code: "RET-EXCHANGE", requestedResolution: "EXCHANGE" });
approveReturn(exchangeRepository, exchangeRequest.id, { reason: "Approved", ...actor });
confirmReturnedItemsReceived(exchangeRepository, exchangeRequest.id, {
  items: [{ orderLineId: "line-1", receivedQuantity: 1, acceptedQuantity: 1, rejectedQuantity: 0 }],
  conditionNote: "Received",
  ...actor,
});
const positiveExchange = requestReplacementResolution(exchangeRepository, exchangeRequest.id, {
  type: "EXCHANGE",
  lines: [{ productId: "prod-1", productNameSnapshot: "Sản phẩm kiểm thử", quantity: 1 }],
  commercialDelta: 25000,
  currency: "VND",
  ...actor,
});
assert.equal(positiveExchange.paymentIntent?.action, "COLLECT_EXCHANGE_DELTA", "Positive Exchange must create a collection intent");
const negativeExchangeRepository = new InMemoryReturnRepository({ requests: [], intents: [] });
const negativeExchangeRequest = createReturnRequest(negativeExchangeRepository, { id: "return-exchange-negative", ...returnBase, code: "RET-EXCHANGE-NEG", requestedResolution: "EXCHANGE" });
approveReturn(negativeExchangeRepository, negativeExchangeRequest.id, { reason: "Approved", ...actor });
confirmReturnedItemsReceived(negativeExchangeRepository, negativeExchangeRequest.id, {
  items: [{ orderLineId: "line-1", receivedQuantity: 1, acceptedQuantity: 1, rejectedQuantity: 0 }],
  conditionNote: "Received",
  ...actor,
});
const negativeExchange = requestReplacementResolution(negativeExchangeRepository, negativeExchangeRequest.id, {
  type: "EXCHANGE",
  lines: [{ productId: "prod-1", productNameSnapshot: "Sản phẩm kiểm thử", quantity: 1 }],
  commercialDelta: -25000,
  currency: "VND",
  ...actor,
});
assert.equal(negativeExchange.paymentIntent, undefined, "Negative Exchange must not create a fake refund intent before Invoice/Payment owners produce evidence");


console.log("Shipping and Returns contracts: PASS");
