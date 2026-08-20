import assert from "node:assert/strict";
import { getInvoicesSnapshot, getReceivablesSnapshot, replaceInvoicesSnapshot } from "@/modules/invoices";
import { getOrdersSnapshot } from "@/modules/orders";
import { getPaymentsSnapshot, replacePaymentsSnapshot } from "@/modules/payments";
import {
  approveReturnRequest,
  confirmReturnedItemsReceivedSnapshot,
  createReturnRequestSnapshot,
  getReturnSnapshot,
  getReturnsSnapshot,
  linkReturnIntentExternalReferenceSnapshot,
  replaceReturnsSnapshot,
  requestRefundResolutionSnapshot,
} from "@/modules/returns";
import { executeReturnCreditRefund } from "@/workflows/return-credit-refund";
import { syncReturnResolutionIntentFromEvidence } from "@/workflows/return-resolution-evidence";
import { money } from "@/shared/money";

const invoiceBefore = getInvoicesSnapshot();
const paymentBefore = getPaymentsSnapshot();
const returnBefore = getReturnsSnapshot();
const now = "2026-07-15T08:00:00.000Z";
const order = Object.values(getOrdersSnapshot()).flat().find((item) => item.id === "o1");
assert.ok(order, "Seed Order o1 is required for the return credit/refund contract.");
const orderLine = order.items[0];
assert.ok(orderLine, "Seed Order o1 requires at least one line.");

try {
  replaceReturnsSnapshot({ requests: [], intents: [] });
  const request = createReturnRequestSnapshot({
    id: "return_credit_refund_contract",
    code: "RET-OTC-001",
    orderId: order.id,
    buyerRef: order.buyerRef,
    ownerId: "qa-user",
    items: [{
      orderLineId: orderLine.id,
      productId: orderLine.productId,
      productNameSnapshot: orderLine.productNameSnapshot,
      orderedQuantity: orderLine.quantity,
      previouslyAcceptedReturnQuantity: 0,
      requestedQuantity: 1,
    }],
    reason: "DEFECTIVE",
    requestedResolution: "REFUND",
    manualDeliveryEvidence: { deliveredAt: now, reason: "Contract fixture delivery evidence", evidenceRef: "manual-delivery-otc-001" },
    actorId: "qa-user",
    actorName: "QA User",
    now,
  });
  approveReturnRequest(request.id, { reason: "Approved for contract validation", actorId: "qa-user", actorName: "QA User", now });
  confirmReturnedItemsReceivedSnapshot(request.id, {
    items: [{ orderLineId: orderLine.id, receivedQuantity: 1, acceptedQuantity: 1, rejectedQuantity: 0, condition: "DEFECTIVE" }],
    conditionNote: "Received and inspected",
    actorId: "qa-user",
    actorName: "QA User",
    now,
  });

  const result = await executeReturnCreditRefund({
    returnId: request.id,
    amount: money("1000000", "VND"),
    reasonCode: "RETURN_ACCEPTED_REFUND",
    reason: "Accepted defective item",
    actorId: "qa-user",
    actorName: "QA User",
    now,
  });

  assert.equal(result.request.status, "RESOLVED");
  assert.equal(result.creditNotes.length, 1);
  assert.equal(result.creditNotes[0].state, "ISSUED");
  assert.equal(result.creditNotes[0].sourceReturnId, request.id);
  assert.equal(result.refundIntents.length, 1);
  assert.equal(result.refundIntents[0].state, "SUCCEEDED");
  assert.equal(result.refundIntents[0].sourceReturnId, request.id);
  assert.equal(result.refundPaymentRecords.length, 1);
  assert.equal(result.refundPaymentRecords[0].kind, "REFUND");
  assert.equal(result.refundPaymentRecords[0].state, "SUCCEEDED");
  assert.equal(result.refundedAmount.amount, "1000000");

  const resolved = getReturnSnapshot(request.id);
  assert.equal(resolved?.resolution?.type, "REFUND");
  if (resolved?.resolution?.type === "REFUND") {
    assert.deepEqual(resolved.resolution.creditNoteIds, result.creditNotes.map((item) => item.id));
    assert.deepEqual(resolved.resolution.refundPaymentRecordIds, result.refundPaymentRecords.map((item) => item.id));
  }

  const receivable = getReceivablesSnapshot().find((item) => item.invoiceId === "inv_o1_001");
  assert.equal(receivable?.outstandingAmount.amount, "0", "Credit Note plus reallocated Payment must keep the fully paid Invoice settled.");
  const effectiveAllocation = getPaymentsSnapshot().allocations.find((item) => item.invoiceId === "inv_o1_001" && item.state === "EFFECTIVE");
  assert.equal(effectiveAllocation?.amount.amount, "196400000", "The original allocation must be reversed and reallocated net of the refund.");

  const replay = await executeReturnCreditRefund({
    returnId: request.id,
    amount: money("1000000", "VND"),
    reasonCode: "RETURN_ACCEPTED_REFUND",
    reason: "Accepted defective item",
    actorId: "qa-user",
    actorName: "QA User",
    now,
  });
  assert.equal(replay.creditNotes.length, 1, "Workflow replay must not create a duplicate Credit Note.");
  assert.equal(replay.refundIntents.length, 1, "Workflow replay must not create a duplicate Refund Intent.");

  const otherRequest = createReturnRequestSnapshot({
    id: "return_foreign_refund_contract",
    code: "RET-OTC-FOREIGN",
    orderId: order.id,
    buyerRef: order.buyerRef,
    ownerId: "qa-user",
    items: [{
      orderLineId: orderLine.id,
      productId: orderLine.productId,
      productNameSnapshot: orderLine.productNameSnapshot,
      orderedQuantity: orderLine.quantity,
      previouslyAcceptedReturnQuantity: 0,
      requestedQuantity: 1,
    }],
    reason: "DEFECTIVE",
    requestedResolution: "REFUND",
    manualDeliveryEvidence: { deliveredAt: now, reason: "Foreign refund evidence contract", evidenceRef: "manual-delivery-foreign" },
    actorId: "qa-user",
    actorName: "QA User",
    now,
  });
  approveReturnRequest(otherRequest.id, {
    reason: "Approved for foreign evidence test",
    overrideReason: "Contract fixture isolates foreign evidence ownership after an earlier accepted return.",
    actorId: "qa-user",
    actorName: "QA User",
    now,
  });
  confirmReturnedItemsReceivedSnapshot(otherRequest.id, {
    items: [{ orderLineId: orderLine.id, receivedQuantity: 1, acceptedQuantity: 1, rejectedQuantity: 0, condition: "DEFECTIVE" }],
    conditionNote: "Received and inspected",
    actorId: "qa-user",
    actorName: "QA User",
    now,
  });
  const foreignIntent = requestRefundResolutionSnapshot(otherRequest.id, {
    amount: money("1000000", "VND"),
    actorId: "qa-user",
    actorName: "QA User",
    now,
  });
  linkReturnIntentExternalReferenceSnapshot(foreignIntent.intent.id, {
    externalReference: result.refundPaymentRecords[0].id,
    actorId: "qa-user",
    actorName: "QA User",
    now,
  });
  assert.throws(
    () => syncReturnResolutionIntentFromEvidence(foreignIntent.intent.id, { actorId: "qa-user", actorName: "QA User", now }),
    /does not belong to this Return/,
    "A succeeded refund owned by another Return must not resolve this Return.",
  );

  console.log("Return Credit/Refund contracts: PASS");
} finally {
  replaceInvoicesSnapshot(invoiceBefore);
  replacePaymentsSnapshot(paymentBefore);
  replaceReturnsSnapshot(returnBefore);
}
