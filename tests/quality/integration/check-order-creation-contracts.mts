import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { executeOrderCreation } from "@/workflows/order-creation";
import { convertAcceptedQuoteToOrderDraftCommand } from "@/workflows/accepted-quote-order-conversion";
import { getOrdersSnapshot, replaceOrders, type CustomerOrder, type OrderItem } from "@/modules/orders";
import {
  configureMutationAuthority,
  resetMutationAuthority,
  type BackendMutationCommand,
  type MutationCommandMetadata,
  type MutationOutcome,
} from "@/shared/application";
import { ApplicationError } from "@/shared/domain";
import { paymentRepository } from "@/modules/payments/runtime/paymentModuleRuntime";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

const now = "2026-07-15T10:00:00.000Z";
const originalOrders = getOrdersSnapshot();
const originalPayments = paymentRepository.snapshot();

const line: OrderItem = {
  id: "line-create-1",
  productId: "prod-create-1",
  productNameSnapshot: "Create flow product",
  quantity: 1,
  unitPriceSnapshot: 100_000,
  discountPercent: 0,
  lineSubtotal: 100_000,
  lineDiscountAmount: 0,
  lineTaxAmount: 0,
  lineTotal: 100_000,
};

function order(id: string): CustomerOrder {
  return {
    id,
    orderNumber: `ORD-${id}`,
    orderDate: "2026-07-15",
    buyerRef: { type: "CONTACT", id: `contact-${id}` },
    customerId: `customer-${id}`,
    customerName: "Buyer",
    state: "DRAFT",
    items: [{ ...line }],
    currency: "VND",
    grandTotal: 100_000,
    totalAmount: 100_000,
    recipientName: "Buyer",
    recipientPhone: "0900000000",
    shippingAddress: { line1: "2 Buyer", city: "HCM" },
    createdAt: now,
    updatedAt: now,
  };
}

try {
  const orderId = "order-draft-contract";
  const command = {
    order: order(orderId),
    paymentPlan: [{
      id: `legacy-schedule-${orderId}`,
      label: "Prepaid",
      amountDue: 100_000,
      currency: "VND",
      method: "BANK_TRANSFER" as const,
      term: "PREPAID" as const,
      timing: "PREPAID" as const,
      fulfillmentGate: "BEFORE_BOOKING" as const,
      idempotencyKey: `legacy-plan:${orderId}`,
    }],
    actorId: "qa",
    actorName: "QA",
    now,
  };

  const first = await executeOrderCreation(command);
  assert.equal(first.order.state, "DRAFT", "New Order must remain DRAFT until the confirmation workflow runs");
  assert.equal(first.order.confirmedAt, undefined, "Draft creation must not fabricate confirmation evidence");
  assert.equal(first.orderCreated, true);
  assert.ok(first.order.paymentAgreementSnapshot, "Order must preserve the versioned Payment Agreement snapshot");

  const paymentSnapshot = paymentRepository.snapshot();
  const plan = paymentSnapshot.plans.find((item) => item.orderId === orderId);
  assert.ok(plan, "Order creation must create a Payment Plan draft");
  assert.equal(plan?.state, "DRAFT", "Payment Plan must remain DRAFT until Order confirmation");
  assert.equal(plan?.agreementSnapshot.version, first.order.paymentAgreementSnapshot?.version);

  const replay = await executeOrderCreation(command);
  assert.equal(replay.orderCreated, false, "Replay must reuse the existing Order");
  assert.equal(Object.values(getOrdersSnapshot()).flat().filter((item) => item.id === orderId).length, 1, "Replay must not duplicate the Order");
  assert.equal(paymentRepository.snapshot().plans.filter((item) => item.orderId === orderId).length, 1, "Replay must not duplicate the Payment Plan");

  await assert.rejects(
    () => executeOrderCreation({ ...command, order: { ...command.order, state: "CONFIRMED" as const } }),
    /must be created as DRAFT/i,
    "Create workflow must reject pre-confirmed Orders",
  );

  const directDealOrder = await executeOrderCreation({
    ...command,
    order: { ...command.order, id: "order-open-deal-contract", orderNumber: "ORD-open-deal-contract", sourceDealId: "d1" },
    paymentPlan: command.paymentPlan.map((line) => ({
      ...line,
      id: `${line.id}:open-deal`,
      idempotencyKey: `${line.idempotencyKey}:open-deal`,
    })),
  });
  assert.equal(directDealOrder.order.state, "DRAFT", "An open Deal may create a direct Order draft");
  assert.equal(directDealOrder.order.sourceDealId, "d1", "The direct Order must preserve its source Deal lineage");

  const workflowSource = readPresentationComposition(path.resolve("src/workflows/order-creation/index.ts"), "utf8");
  assert.equal(workflowSource.includes("createOrderOutboundShippingBooking"), false, "Order draft creation must not create Shipping inline");
  assert.equal(workflowSource.includes("shippingBooking"), false, "Order creation result must not imply a Shipping owner result");
  assert.ok(workflowSource.includes("savePaymentPlanDraftSnapshot"), "Order creation must create a Payment Plan draft");

  const formSource = readPresentationComposition(path.resolve("src/modules/orders/presentation/pages/OrderFormPage.tsx"), "utf8");
  assert.ok(formSource.includes("executeOrderDraftCreationCommand"), "Create Order form must use the create Order draft command");
  assert.ok(formSource.includes("executeOrderDraftUpdateCommand"), "Edit Order form must use the update Order draft command");
  assert.ok(formSource.includes('state: orderToEdit?.state ?? "DRAFT"'), "Create Order form must build a DRAFT Order");
  assert.equal(formSource.includes("create-shipping-with-order"), false, "Order form must not offer inline Shipping creation");
  assert.equal(formSource.includes("shipping: createShipping"), false, "Order form must not submit Shipping ownership data");
  assert.equal(formSource.includes("setCreateShipping"), false, "Removed inline Shipping state must not remain");
  assert.equal(formSource.includes("chưa Chốt thắng"), false, "An open Deal no longer needs to be manually closed before creating a direct Order");

  const dealDetailSource = readPresentationComposition(path.resolve("src/modules/deals/presentation/pages/DealDetailPage.tsx"), "utf8");
  assert.ok(dealDetailSource.includes("tự động Chốt thắng"), "Accepted Quote guidance must explain automatic Deal closure");

  const orderDetailSource = readPresentationComposition(path.resolve("src/modules/orders/presentation/pages/OrderDetailPage.tsx"), "utf8");
  assert.ok(orderDetailSource.includes('label: locale === "vi" ? "Tài liệu" : "Documents"'), "Order customer-delivery tab must be named Documents/Tài liệu");
  assert.ok(orderDetailSource.includes("canCreateShippingNow"), "Shipping tab must expose an explicit Create shipment eligibility action");

  // ---------------------------------------------------------------------------
  // Accepted Quote -> Draft Order must use the canonical conversion command.
  // ---------------------------------------------------------------------------
  const conversionCalls: Array<{ command: BackendMutationCommand<unknown>; metadata: MutationCommandMetadata }> = [];
  const convertedOrderId = "order-assigned-by-backend";
  const acceptedQuoteId = "quote-accepted-contract";
  const acceptedQuoteVersion = 7;
  const creationIntentId = `order-intent:${acceptedQuoteId}:${acceptedQuoteVersion}`;
  const conversionInput = {
    creationIntentId,
    quoteId: acceptedQuoteId,
    expectedQuoteVersion: acceptedQuoteVersion,
    idempotencyKey: `order.convert-accepted-quote:${creationIntentId}`,
  };

  configureMutationAuthority({
    async execute<TPayload, TResult>(
      command: BackendMutationCommand<TPayload>,
      metadata: MutationCommandMetadata,
    ): Promise<MutationOutcome<TResult>> {
      conversionCalls.push({ command: command as BackendMutationCommand<unknown>, metadata });
      return {
        data: {
          order: { ...order(convertedOrderId), sourceQuoteId: acceptedQuoteId },
          sourceQuoteId: acceptedQuoteId,
          sourceQuoteResourceVersion: acceptedQuoteVersion,
          commercialSnapshotFingerprint: "fingerprint-0123456789abcdef",
        } as TResult,
        commandId: "cmd_convert",
        commandType: command.commandType,
        aggregateType: command.aggregateType,
        aggregateId: convertedOrderId,
        idempotencyKey: metadata.idempotencyKey,
        correlationId: metadata.correlationId ?? "corr_convert",
        occurredAt: "2026-07-15T10:00:00.000Z",
        version: 1,
        outcome: "COMMITTED",
        emittedEvents: [],
        audit: { authority: "backend", evidenceIds: [] },
      };
    },
  });

  const ordersBeforeConversion = Object.values(getOrdersSnapshot()).flat().length;
  const conversionOutcome = await convertAcceptedQuoteToOrderDraftCommand(conversionInput);

  assert.equal(conversionCalls.length, 1, "Accepted Quote conversion must issue exactly one backend command");
  assert.equal(conversionCalls[0]?.command.commandType, "order.convert-accepted-quote-to-draft", "Accepted Quote must not be converted through order.create");
  assert.equal(conversionCalls[0]?.command.aggregateType, "order");
  assert.equal(conversionCalls[0]?.command.aggregateId, creationIntentId, "Conversion must carry the client creation intent id as the command target");
  assert.equal(conversionCalls[0]?.metadata.idempotencyKey, conversionInput.idempotencyKey, "Conversion must send the required Idempotency-Key");
  assert.equal(conversionCalls[0]?.metadata.expectedVersion, acceptedQuoteVersion, "Conversion must send the accepted Quote optimistic-concurrency version");
  assert.equal(conversionOutcome.data.order.id, convertedOrderId, "Navigation must use the backend-assigned Order id, never the client intent id");
  assert.equal(conversionOutcome.data.sourceQuoteId, acceptedQuoteId, "Conversion result must retain accepted Quote lineage");
  assert.equal(
    Object.values(getOrdersSnapshot()).flat().length,
    ordersBeforeConversion,
    "Conversion must not write a local Order read model from the presentation layer",
  );

  // A repeated submission replays the same intent instead of creating a second Order.
  await convertAcceptedQuoteToOrderDraftCommand(conversionInput);
  assert.equal(conversionCalls.length, 2);
  assert.equal(
    conversionCalls[1]?.metadata.idempotencyKey,
    conversionCalls[0]?.metadata.idempotencyKey,
    "A repeated conversion submission must replay the same Idempotency-Key",
  );
  assert.equal(
    conversionCalls[1]?.command.aggregateId,
    conversionCalls[0]?.command.aggregateId,
    "A repeated conversion submission must reuse the same creation intent id",
  );

  // A failed conversion must not fabricate a local Order.
  configureMutationAuthority({
    async execute() {
      throw new ApplicationError({
        code: "VERSION_CONFLICT",
        message: "The Quote changed on the server.",
        category: "CONFLICT",
      });
    },
  });
  const ordersBeforeFailure = Object.values(getOrdersSnapshot()).flat().length;
  await assert.rejects(
    () => convertAcceptedQuoteToOrderDraftCommand(conversionInput),
    /changed on the server/i,
    "A rejected conversion must surface the backend failure",
  );
  assert.equal(
    Object.values(getOrdersSnapshot()).flat().length,
    ordersBeforeFailure,
    "A failed conversion must not create a local or fake Order",
  );
  resetMutationAuthority();

  const quoteDetailSource = readPresentationComposition(path.resolve("src/modules/quotes/presentation/pages/QuoteDetailPage.tsx"), "utf8");
  assert.ok(quoteDetailSource.includes("convertAcceptedQuoteToOrderDraftCommand"), "Quote detail must convert through the canonical accepted-Quote command");
  assert.ok(quoteDetailSource.includes("navigate(`/orders/${outcome.data.order.id}`)"), "Quote detail must navigate with the backend-assigned Order id");
  assert.ok(quoteDetailSource.includes("expectedQuoteVersion: quote.resourceVersion"), "Conversion must send the Quote resource version for optimistic concurrency");
  assert.equal(
    /case "create-order":[\s\S]{0,600}?navigate\(`\/orders\/new\?quoteId=/.test(quoteDetailSource),
    false,
    "The create-order action must not open direct-order authoring directly",
  );

  assert.ok(formSource.includes("isOrderConnectedMode()"), "Order form must know whether it runs against the backend");
  assert.ok(
    formSource.includes('searchParams.get("quoteId") && isOrderConnectedMode()'),
    "Connected direct-order authoring must refuse an accepted-Quote source",
  );

  console.log("Order draft creation and Payment Plan draft contracts: PASS");
} finally {
  resetMutationAuthority();
  replaceOrders(originalOrders);
  paymentRepository.replace(originalPayments);
}
