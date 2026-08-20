import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import path from "node:path";
import { InMemoryPaymentRepository } from "@/modules/payments/infrastructure/InMemoryPaymentRepository";
import { recordSucceededPayment, savePaymentPlan } from "@/modules/payments/application/commands/paymentCommands";
import { InMemoryShippingRepository } from "@/modules/shipping/infrastructure/InMemoryShippingRepository";
import { ShippingProviderRegistry } from "@/modules/shipping/infrastructure/ShippingProviderRegistry";
import { ManualShippingProvider } from "@/modules/shipping/infrastructure/providers/manual/ManualShippingProvider";
import { createShippingBooking } from "@/modules/shipping/application/commands/shippingCommands";
import { evaluateShippingBookingReadiness } from "@/modules/shipping/domain/rules/shippingRules";
import { InMemoryReturnRepository } from "@/modules/returns/infrastructure/InMemoryReturnRepository";
import {
  approveReturn,
  completeReturnResolution,
  confirmReturnedItemsReceived,
  createReturnRequest,
  requestRefundResolution,
  requestReplacementResolution,
  requestRepairResolution,
  completeRepairIntentFromEvidence,
  succeedReturnIntent,
} from "@/modules/returns/application/commands/returnCommands";
import { orderRequiresShipping } from "@/workflows/order-closing/domain/orderClosingPolicy";
import type { CustomerOrder } from "@/modules/orders";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

const now = "2026-07-10T10:00:00.000Z";
const actor = { actorId: "qa-hardening", actorName: "QA Hardening", now };
const buyerRef = { type: "CONTACT", id: "contact-hardening" } as const;

// Payment: reject overpayment before persisting any transaction or changing obligation balances.
{
  const repository = new InMemoryPaymentRepository();
  savePaymentPlan(repository, {
    orderId: "order-overpay",
    buyerRef,
    lines: [{ id: "obl-overpay", amountDue: 100, currency: "VND", term: "PREPAID", method: "BANK_TRANSFER", idempotencyKey: "obl-overpay-key" }],
    ...actor,
  });
  assert.throws(() => recordSucceededPayment(repository, {
    id: "pay-overpay",
    orderId: "order-overpay",
    buyerRef,
    amount: 200,
    currency: "VND",
    occurredAt: now,
    source: "MANUAL",
    ...actor,
  }), /exceeds|outstanding|unapplied/i);
  assert.equal(repository.listTransactions().length, 0, "Rejected overpayment must not persist a transaction");
  assert.equal(repository.listObligations()[0].amountPaid, 0, "Rejected overpayment must not mutate obligation balance");
}

// Payment: one transaction may allocate across multiple obligations and plan edits use stable identities.
{
  const repository = new InMemoryPaymentRepository();
  const planInput = {
    orderId: "order-allocation",
    buyerRef,
    lines: [
      { id: "obl-a", label: "Deposit", amountDue: 30, currency: "VND", term: "DEPOSIT" as const, method: "BANK_TRANSFER" as const, idempotencyKey: "order-allocation:obl-a" },
      { id: "obl-b", label: "Installment", amountDue: 70, currency: "VND", term: "POSTPAID" as const, method: "BANK_TRANSFER" as const, idempotencyKey: "order-allocation:obl-b" },
    ],
    ...actor,
  };
  savePaymentPlan(repository, planInput);
  const transaction = recordSucceededPayment(repository, {
    id: "pay-multi",
    orderId: "order-allocation",
    buyerRef,
    amount: 50,
    currency: "VND",
    occurredAt: now,
    allocations: [{ obligationId: "obl-a", amount: 30 }, { obligationId: "obl-b", amount: 20 }],
    source: "MANUAL",
    ...actor,
  });
  assert.deepEqual(transaction.allocations, [{ obligationId: "obl-a", amount: 30 }, { obligationId: "obl-b", amount: 20 }]);
  assert.equal(repository.listObligations().find((item) => item.id === "obl-a")?.status, "SETTLED");
  assert.equal(repository.listObligations().find((item) => item.id === "obl-b")?.amountOutstanding, 50);
  assert.throws(() => savePaymentPlan(repository, { ...planInput, lines: [planInput.lines[1]] }), /already has payment allocation/i, "Paid obligations cannot disappear from edited plans");
}

// Payment: an omitted unpaid line becomes VOIDED rather than remaining as hidden debt.
{
  const repository = new InMemoryPaymentRepository();
  savePaymentPlan(repository, {
    orderId: "order-void",
    buyerRef,
    lines: [
      { id: "obl-keep", amountDue: 60, currency: "VND", term: "PREPAID", method: "BANK_TRANSFER", idempotencyKey: "order-void:keep" },
      { id: "obl-remove", amountDue: 40, currency: "VND", term: "POSTPAID", method: "BANK_TRANSFER", idempotencyKey: "order-void:remove" },
    ],
    ...actor,
  });
  savePaymentPlan(repository, {
    orderId: "order-void",
    buyerRef,
    lines: [{ id: "obl-keep", amountDue: 100, currency: "VND", term: "PREPAID", method: "BANK_TRANSFER", idempotencyKey: "order-void:keep" }],
    ...actor,
  });
  assert.equal(repository.listObligations().find((item) => item.id === "obl-remove")?.status, "VOIDED");
}

// Shipping: readiness is explicit and separate logical shipment groups can coexist for one source.
{
  const missing = evaluateShippingBookingReadiness({
    sourceType: "ORDER",
    sourceId: "order-shipping",
    purpose: "ORDER_OUTBOUND",
    providerId: "strict",
    pickupLocationSnapshot: { line1: "", city: "" },
    recipientSnapshot: { name: "", phone: "", address: { line1: "", city: "" } },
    packageSnapshot: { packageCount: 0, totalWeightGrams: 0 },
  }, { serviceCode: true, administrativeCodes: true, dimensions: true, lineAllocations: true, declaredValue: true, feePayer: true, inspectionPolicy: true }, now);
  assert.equal(missing.ready, false);
  assert.ok(missing.missingRequired.length >= 8, "Strict carrier readiness must expose missing booking requirements");

  const repository = new InMemoryShippingRepository();
  const providers = new ShippingProviderRegistry([new ManualShippingProvider()]);
  const base = {
    workspaceId: "ws-default",
    code: "SB-GROUP",
    sourceType: "ORDER" as const,
    sourceId: "order-shipping",
    purpose: "ORDER_OUTBOUND" as const,
    providerId: "manual",
    pickupLocationSnapshot: { line1: "1 Pickup", city: "HCM" },
    recipientSnapshot: { name: "Buyer", phone: "0901111111", address: { line1: "2 Buyer", city: "HCM" } },
    packageSnapshot: { packageCount: 1, totalWeightGrams: 500 },
    correlationId: "corr-shipping-groups",
    ...actor,
  };
  await createShippingBooking(repository, providers, { ...base, id: "ship-group-a", shipmentGroupId: "group-a", idempotencyKey: "group-a:attempt:1" });
  await createShippingBooking(repository, providers, { ...base, id: "ship-group-b", shipmentGroupId: "group-b", idempotencyKey: "group-b:attempt:1" });
  assert.equal(repository.list().length, 2, "Split shipments need independent logical groups, not one hard-coded attempt group");
}

// Order fulfillment truth: physical lines require shipping even without address; service-only lines do not merely because an address exists.
{
  const baseOrder = {
    id: "order-fulfillment",
    orderNumber: "ORD-FULFILLMENT",
    orderDate: "2026-07-10",
    buyerRef,
    state: "CONFIRMED" as const,
    totalAmount: 100,
    items: [],
  } satisfies CustomerOrder;
  const physical = { ...baseOrder, items: [{ id: "physical", productId: "p1", productNameSnapshot: "Goods", fulfillmentKind: "PHYSICAL_SHIPMENT" as const, quantity: 1, unitPriceSnapshot: 100, discountPercent: 0, lineSubtotal: 100, lineDiscountAmount: 0, lineTaxAmount: 0, lineTotal: 100 }] };
  const service = { ...baseOrder, id: "order-service", recipientName: "Buyer", shippingAddress: { line1: "Address", city: "HCM" }, items: [{ id: "service", productId: "s1", productNameSnapshot: "Consulting", fulfillmentKind: "SERVICE" as const, quantity: 1, unitPriceSnapshot: 100, discountPercent: 0, lineSubtotal: 100, lineDiscountAmount: 0, lineTaxAmount: 0, lineTotal: 100 }] };
  assert.equal(orderRequiresShipping(physical, []), true);
  assert.equal(orderRequiresShipping(service, []), false);
}

// Return: ineligible approval needs override, partial receipt stays operationally open, quantities are strict, and evidence types cannot be swapped.
{
  const repository = new InMemoryReturnRepository({ requests: [], intents: [] });
  const requested = createReturnRequest(repository, {
    id: "return-hardening",
    workspaceId: "ws-default",
    code: "RET-HARDENING",
    orderId: "order-return",
    buyerRef,
    ownerId: "qa-hardening",
    items: [{ orderLineId: "line-1", productId: "p1", productNameSnapshot: "Product", orderedQuantity: 2, previouslyAcceptedReturnQuantity: 0, requestedQuantity: 2 }],
    reason: "DEFECTIVE",
    requestedResolution: "REFUND",
    deliveredAt: "2026-01-01T00:00:00.000Z",
    deliveryEvidenceShippingBookingId: "ship-return-hardening",
    returnWindowDays: 30,
    ...actor,
  });
  assert.equal(requested.eligibilityResult.eligible, false);
  assert.throws(() => approveReturn(repository, requested.id, { reason: "Approve anyway", ...actor }), /override reason/i);
  approveReturn(repository, requested.id, { reason: "Manager exception", overrideReason: "Customer recovery policy", ...actor });
  assert.throws(() => confirmReturnedItemsReceived(repository, requested.id, {
    items: [{ orderLineId: "line-1", receivedQuantity: -1, acceptedQuantity: -1, rejectedQuantity: 0 }],
    conditionNote: "Invalid",
    ...actor,
  }), /invalid|negative/i);
  const partial = confirmReturnedItemsReceived(repository, requested.id, {
    items: [{ orderLineId: "line-1", receivedQuantity: 1, acceptedQuantity: 1, rejectedQuantity: 0 }],
    conditionNote: "One unit received and inspected",
    ...actor,
  });
  assert.equal(partial.status, "APPROVED", "Partial receipt must not claim the full Return is RECEIVED");
  const received = confirmReturnedItemsReceived(repository, requested.id, {
    items: [{ orderLineId: "line-1", receivedQuantity: 2, acceptedQuantity: 2, rejectedQuantity: 0 }],
    conditionNote: "All units received and inspected",
    ...actor,
  });
  assert.equal(received.status, "RECEIVED");
  const refundIntent = requestRefundResolution(repository, requested.id, {
    amount: { amount: "100", currency: "VND" },
    ...actor,
  });
  succeedReturnIntent(repository, refundIntent.intent.id, { evidenceType: "REFUND_SUCCEEDED", externalReference: "refund-evidence", ...actor });
  assert.throws(() => completeReturnResolution(repository, requested.id, {
    resolution: { type: "REPLACEMENT", replacementLines: [{ productId: "p1", productNameSnapshot: "Product", quantity: 1 }] },
    intentId: refundIntent.intent.id,
    ...actor,
  }), /REPLACEMENT resolution requires canonical SHIPPING\/REPLACEMENT_OUTBOUND/i);
}


// Return: Exchange with a commercial delta requires both Payment and Shipping evidence.
{
  const repository = new InMemoryReturnRepository({ requests: [], intents: [] });
  const requested = createReturnRequest(repository, {
    id: "return-exchange-evidence",
    workspaceId: "ws-default",
    code: "RET-EXCHANGE",
    orderId: "order-exchange",
    buyerRef,
    ownerId: "qa-hardening",
    items: [{ orderLineId: "line-exchange", productId: "p-exchange", productNameSnapshot: "Exchange Product", orderedQuantity: 1, previouslyAcceptedReturnQuantity: 0, requestedQuantity: 1 }],
    reason: "WRONG_ITEM",
    requestedResolution: "EXCHANGE",
    deliveredAt: "2026-07-01T00:00:00.000Z",
    deliveryEvidenceShippingBookingId: "ship-return-exchange",
    returnWindowDays: 30,
    ...actor,
  });
  approveReturn(repository, requested.id, { reason: "Eligible exchange", ...actor });
  confirmReturnedItemsReceived(repository, requested.id, {
    items: [{ orderLineId: "line-exchange", receivedQuantity: 1, acceptedQuantity: 1, rejectedQuantity: 0 }],
    conditionNote: "Received and inspected",
    ...actor,
  });
  const resolution = requestReplacementResolution(repository, requested.id, {
    type: "EXCHANGE",
    lines: [{ productId: "p-replacement", productNameSnapshot: "Replacement Product", quantity: 1 }],
    commercialDelta: 25,
    currency: "VND",
    ...actor,
  });
  assert.equal(resolution.paymentIntent?.action, "COLLECT_EXCHANGE_DELTA");
  succeedReturnIntent(repository, resolution.intent.id, { externalReference: "shipping-delivered", evidenceType: "SHIPPING_DELIVERED", ...actor });
  assert.throws(() => completeReturnResolution(repository, requested.id, {
    resolution: { type: "EXCHANGE", exchangeLines: [{ productId: "p-replacement", productNameSnapshot: "Replacement Product", quantity: 1 }], commercialDelta: 25, currency: "VND" },
    intentIds: [resolution.intent.id],
    ...actor,
  }), /PAYMENT\/COLLECT_EXCHANGE_DELTA/i);
  succeedReturnIntent(repository, resolution.paymentIntent!.id, { externalReference: "payment-succeeded", evidenceType: "PAYMENT_SUCCEEDED", ...actor });
  const completed = completeReturnResolution(repository, requested.id, {
    resolution: { type: "EXCHANGE", exchangeLines: [{ productId: "p-replacement", productNameSnapshot: "Replacement Product", quantity: 1 }], commercialDelta: 25, currency: "VND", paymentIntentId: resolution.paymentIntent!.id },
    intentIds: [resolution.intent.id, resolution.paymentIntent!.id],
    ...actor,
  });
  assert.equal(completed.status, "RESOLVED");
}

// Return: Repair requires explicit repair-job evidence before resolution.
{
  const repository = new InMemoryReturnRepository({ requests: [], intents: [] });
  const requested = createReturnRequest(repository, {
    id: "return-repair-evidence",
    workspaceId: "ws-default",
    code: "RET-REPAIR",
    orderId: "order-repair",
    buyerRef,
    ownerId: "qa-hardening",
    items: [{ orderLineId: "line-repair", productId: "p-repair", productNameSnapshot: "Repair Product", orderedQuantity: 1, previouslyAcceptedReturnQuantity: 0, requestedQuantity: 1 }],
    reason: "DEFECTIVE",
    requestedResolution: "REPAIR",
    deliveredAt: "2026-07-01T00:00:00.000Z",
    deliveryEvidenceShippingBookingId: "ship-return-repair",
    returnWindowDays: 30,
    ...actor,
  });
  approveReturn(repository, requested.id, { reason: "Eligible repair", ...actor });
  confirmReturnedItemsReceived(repository, requested.id, {
    items: [{ orderLineId: "line-repair", receivedQuantity: 1, acceptedQuantity: 1, rejectedQuantity: 0 }],
    conditionNote: "Received for repair",
    ...actor,
  });
  const repair = requestRepairResolution(repository, requested.id, { reference: "JOB-001", provider: "Repair Center", ...actor });
  assert.throws(() => completeReturnResolution(repository, requested.id, {
    resolution: { type: "REPAIR", repairJob: { reference: "JOB-001", provider: "Repair Center", status: "COMPLETED", result: "Repaired" } },
    intentId: repair.intent.id,
    ...actor,
  }), /until every matching downstream intent has succeeded/i);
  const evidence = completeRepairIntentFromEvidence(repository, repair.intent.id, { reference: "JOB-001", provider: "Repair Center", result: "Main board replaced and tested", ...actor });
  const completed = completeReturnResolution(repository, requested.id, {
    resolution: { type: "REPAIR", repairJob: { reference: "JOB-001", provider: "Repair Center", status: "COMPLETED", result: "Main board replaced and tested" } },
    intentId: evidence.id,
    ...actor,
  });
  assert.equal(completed.status, "RESOLVED");
}

// Permanent source guards for the operational regressions that triggered this hardening work.
{
  const root = repositoryRoot;
  const returnDetail = readPresentationComposition(path.join(root, "src/modules/returns/presentation/pages/ReturnDetailPage.tsx"), "utf8");
  const shippingList = readPresentationComposition(path.join(root, "src/modules/shipping/presentation/pages/ShippingBookingListPage.tsx"), "utf8");
  const orderForm = readPresentationComposition(path.join(root, "src/modules/orders/presentation/pages/OrderFormPage.tsx"), "utf8");
  const shippingCommands = readPresentationComposition(path.join(root, "src/modules/shipping/application/commands/shippingCommands.ts"), "utf8");
  const codEvidenceWorkflow = readPresentationComposition(path.join(root, "src/workflows/shipping-cod-evidence/index.ts"), "utf8");
  const returnResolutionWorkflow = readPresentationComposition(path.join(root, "src/workflows/return-resolution/index.ts"), "utf8");
  assert.equal(returnDetail.includes('phone: order.recipientPhone || "0900000000"'), false, "Return booking UI must never invent a recipient phone");
  assert.equal(/totalWeightGrams:\s*1000/.test(returnDetail), false, "Return booking UI must require actual package weight");
  assert.ok(returnDetail.includes("completeReturnRepairCommand"), "Return detail must delegate repair completion to the canonical workflow command");
  assert.ok(returnResolutionWorkflow.includes("requestRepairResolutionSnapshot") && returnResolutionWorkflow.includes("completeRepairIntentFromEvidenceSnapshot"), "Return repair workflow must retain canonical repair evidence behavior");
  assert.ok(returnDetail.includes('type: "REJECT_AFTER_INSPECTION"'), "Return detail must expose reject-after-inspection resolution");
  assert.ok(returnDetail.includes("approvalDraft[item.orderLineId]"), "Return approval UI must support line-level approved quantities");
  assert.ok(orderForm.includes("bổ sung khối lượng") || orderForm.includes("complete weight"), "Order-to-shipping handoff must require actual package weight");
  assert.equal(shippingList.includes("attempt-group-1"), false, "Shipping create UI must not collapse all shipments into one hard-coded group");
  assert.equal(shippingList.includes("useState(1000)"), false, "Shipping create UI must require actual package weight instead of inventing 1000g");
  assert.ok(orderForm.includes("order-payment-plan:${order.id}:${line.localId}"), "Payment plan idempotency must follow stable line identity rather than row index");
  assert.ok(shippingCommands.includes("const shipmentGroupId = current.shipmentGroupId"), "Retry/provider-change must stay in the original logical shipment group");
  assert.equal(shippingCommands.includes("attemptGroup"), false, "Canonical Shipping commands must not depend on the removed attemptGroup alias.");
  assert.ok(codEvidenceWorkflow.includes('codCollectionState: "COLLECTED"') && codEvidenceWorkflow.includes('source: "CARRIER"'), "Carrier COD evidence must cross into Payment through an explicit workflow");
}

console.log("Order operations hardening contracts: PASS");
