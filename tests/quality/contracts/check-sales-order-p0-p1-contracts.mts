import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  createHttpModuleDataAuthorityRegistry,
  RoutedHttpMutationAuthority,
  type HttpClient,
  type HttpRequest,
} from "@/platform/api";
import { ConfiguredShippingProvider } from "@/modules/shipping/infrastructure/providers/ConfiguredShippingProvider";
import { ManualShippingProvider } from "@/modules/shipping/infrastructure/providers/manual/ManualShippingProvider";
import { InMemoryPurchaseEvidenceRepository } from "@/modules/commercial-evidence/infrastructure/InMemoryPurchaseEvidenceRepository";
import type { ShippingBooking, ShippingProviderSetup } from "@/modules/shipping";
import { MutationCommandError } from "@/shared/application";

const root = repositoryRoot;
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");
const spec = JSON.parse(read("docs/api/openapi.json")) as { paths: Record<string, Record<string, { operationId?: string }>> };

const requiredOperations = new Map<string, string>([
  ["/workflows/quote-acceptance/{quoteId}/accept-and-close-deal", "acceptQuoteAndCloseDeal"],
  ["/workflows/order-confirmation/{orderId}/confirm-with-payment-plan", "confirmOrderWithPaymentPlan"],
  ["/orders/{orderId}/cancel", "cancelOrder"],
]);
for (const [route, operationId] of requiredOperations) {
  assert.equal(spec.paths[route]?.post?.operationId, operationId, `${route} must be a generated OpenAPI command contract.`);
}
assert.equal(spec.paths["/workflows/order-cancellation/{orderId}/cancel-with-compensation"], undefined, "Misleading compensation endpoint must remain retired.");

const calls: HttpRequest[] = [];
const http: HttpClient = {
  async request<TResponse>(input: HttpRequest): Promise<TResponse> {
    calls.push(input);
    const occurredAt = "2026-07-24T00:00:00.000Z";
    if (input.operationId === "acceptQuoteAndCloseDeal") return {
      commandId: "cmd-quote-accept",
      correlationId: "corr-quote-accept",
      aggregateId: "quote-1",
      aggregateType: "quote",
      version: 4,
      occurredAt,
      outcome: "COMMITTED",
      emittedEventIds: ["quote.accepted", "deal.won"],
      auditEvidenceIds: ["audit-quote-accept"],
      result: { quoteId: "quote-1", quoteStatus: "ACCEPTED", acceptedAt: occurredAt, orderCreated: false, dealId: "deal-1", dealOutcome: "WON" },
    } as TResponse;
    if (input.operationId === "confirmOrderWithPaymentPlan") return {
      commandId: "cmd-order-confirm",
      correlationId: "corr-order-confirm",
      aggregateId: "order-1",
      aggregateType: "order",
      version: 4,
      occurredAt,
      outcome: "COMMITTED",
      emittedEventIds: ["order.confirmed", "payment-plan.activated"],
      auditEvidenceIds: ["audit-order-confirm"],
      result: { orderId: "order-1", orderState: "CONFIRMED", confirmedAt: occurredAt, paymentPlanId: "plan-1", paymentPlanState: "ACTIVE", paymentPlanVersion: 2, paymentInstructionCreated: true },
    } as TResponse;
    if (input.operationId === "cancelOrder") return {
      commandId: "cmd-order-cancel",
      correlationId: "corr-order-cancel",
      aggregateId: "order-2",
      aggregateType: "order",
      version: 6,
      occurredAt,
      outcome: "COMMITTED",
      emittedEventIds: ["order.cancelled"],
      auditEvidenceIds: ["audit-order-cancel"],
      result: { orderId: "order-2", orderState: "CANCELLED", alreadyCancelled: false, cancelledAt: occurredAt },
    } as TResponse;
    throw new Error(`Unexpected operation ${input.operationId}`);
  },
};
const authority = new RoutedHttpMutationAuthority(http, createHttpModuleDataAuthorityRegistry(http));
await authority.execute(
  { commandType: "quote.accept-and-close-deal", aggregateType: "quote", aggregateId: "quote-1", payload: { quoteId: "quote-1", occurredAt: "frontend-time-must-not-leak" } },
  { idempotencyKey: "quote-accept-1", expectedVersion: 3, correlationId: "client-correlation-hint" },
);
await authority.execute(
  { commandType: "order.confirm-with-payment-plan", aggregateType: "order", aggregateId: "order-1", payload: { orderId: "order-1", paymentAccountId: "account-1", actorId: "frontend-actor-must-not-leak" } },
  { idempotencyKey: "order-confirm-1", expectedVersion: 3 },
);
await authority.execute(
  { commandType: "order.cancel", aggregateType: "order", aggregateId: "order-2", payload: { orderId: "order-2", reasonCode: "CUSTOMER_REQUEST", reason: "Customer request", actorId: "frontend-actor-must-not-leak" } },
  { idempotencyKey: "order-cancel-1", expectedVersion: 5 },
);
assert.deepEqual(calls.map((call) => call.path), [
  "/workflows/quote-acceptance/quote-1/accept-and-close-deal",
  "/workflows/order-confirmation/order-1/confirm-with-payment-plan",
  "/orders/order-2/cancel",
]);
assert.deepEqual(calls.map((call) => call.body), [
  {},
  { paymentAccountId: "account-1" },
  { reasonCode: "CUSTOMER_REQUEST", reason: "Customer request" },
], "Connected request projection must omit frontend timestamps, actors and audit-like fields.");
const callsBeforeBlockedCommand = calls.length;
await assert.rejects(
  authority.execute(
    { commandType: "order.create", aggregateType: "order", aggregateId: "client-draft-order", payload: { state: "DRAFT" } },
    { idempotencyKey: "blocked-order-create" },
  ),
  (error: unknown) => error instanceof MutationCommandError && error.code === "CONNECTED_COMMAND_CONTRACT_BLOCKED",
);
assert.equal(calls.length, callsBeforeBlockedCommand, "Blocked commands must fail before network I/O.");

const orderCreation = read("src/workflows/order-creation/index.ts");
assert.match(orderCreation, /executeOrderDraftCreationCommand/);
assert.match(orderCreation, /executeOrderDraftUpdateCommand/);
assert.match(orderCreation, /replaceOrders\(orderSnapshot\)/);
assert.match(orderCreation, /replacePaymentsSnapshot\(paymentSnapshot\)/);
assert.match(orderCreation, /nextAgreementVersion/);
assert.match(orderCreation, /options\.mode === "update"/);

const orderConfirmation = read("src/workflows/order-confirmation/index.ts");
assert.match(orderConfirmation, /closeDealWon/);
assert.match(orderConfirmation, /type: "ORDER_CONFIRMED"/);
assert.match(orderConfirmation, /replaceDeals\(dealSnapshot\)/);

const orderClosing = read("src/workflows/order-closing/application/executeOrderClosing.ts");
assert.match(orderClosing, /ports\.evidence\.runAtomically<PurchaseEvidence>/);
assert.match(orderClosing, /ports\.orders\.restore\(orderSnapshot\)/);
assert.doesNotMatch(orderClosing, /@\/modules\/customers|ports\.customers/);
const evidenceRepository = read("src/modules/commercial-evidence/infrastructure/InMemoryPurchaseEvidenceRepository.ts");
assert.match(evidenceRepository, /runInTransaction<T>/);
assert.match(evidenceRepository, /this\.evidence = before/);
const evidenceTransactionRepository = new InMemoryPurchaseEvidenceRepository();
assert.throws(() => evidenceTransactionRepository.runInTransaction(() => {
  evidenceTransactionRepository.append({
    evidenceId: "pe-rollback",
    workspaceId: "ws-default",
    buyerRef: { type: "CONTACT", id: "contact-1" },
    sourceType: "ORDER",
    sourceId: "order-rollback",
    evidenceType: "ORDER_COMPLETED",
    occurredAt: "2026-07-21T00:00:00.000Z",
    policyVersion: "order-closing/v1",
    correlationId: "corr-rollback",
  });
  throw new Error("rollback");
}), /rollback/);
assert.equal(evidenceTransactionRepository.list().length, 0, "Failed Order Closing transactions must not leave Purchase Evidence behind.");

const quoteBuilder = read("src/modules/quotes/presentation/hooks/useQuoteBuilderController.tsx");
const quoteList = read("src/modules/quotes/presentation/pages/QuoteListPage.tsx");
const dealPipeline = read("src/modules/deals/presentation/pages/DealPipelinePage.tsx");
assert.match(quoteBuilder, /currency/);
assert.match(quoteBuilder, /requiresPhysicalShipping/);
assert.match(quoteList, /filterCurrency/);
assert.match(quoteList, /formatCurrency\(quote\.grandTotal, quote\.currency/);
assert.match(dealPipeline, /formatCurrencyTotals/);
assert.match(dealPipeline, /currencyFilter/);

for (const relative of [
  "src/modules/shipping/presentation/pages/ShippingBookingCreatePage.tsx",
  "src/modules/returns/presentation/pages/ReturnDetailPage.tsx",
  "src/modules/payments/presentation/pages/PaymentDetailPage.tsx",
]) assert.equal(read(relative).includes("CRM Operator"), false, `${relative} must derive the actor from session context.`);

const quoteType = read("src/modules/quotes/domain/model/quote.types.ts");
const deliveryType = read("src/shared/domain/commercialDocumentDelivery.ts");
assert.match(quoteType, /USER_CONFIRMED_SENT/);
assert.match(deliveryType, /PROVIDER_DELIVERED/);

const httpShippingProvider = read("src/modules/shipping/infrastructure/providers/HttpShippingProvider.ts");
assert.match(httpShippingProvider, /CONTRACT_OPERATION_BLOCKED/);
assert.match(httpShippingProvider, /DEC-SHIPPING-PROVIDER/);
assert.doesNotMatch(httpShippingProvider, /\/shipping\/providers\//, "Blocked shipping-provider operations must not retain handwritten production endpoint literals.");
assert.doesNotMatch(httpShippingProvider, /apiKey|secret|password/i, "Carrier credentials must remain server-side.");

const setup: ShippingProviderSetup = {
  id: "carrier-production",
  providerCode: "carrier",
  name: "Carrier Production",
  status: "ACTIVE",
  environment: "PRODUCTION",
  isDefault: true,
  capabilities: { booking: true, quote: true, cancel: true, sync: true, label: false, tracking: false, cod: false, returnPickup: false },
  services: [{ code: "standard", name: "Standard", enabled: true, supportedModes: ["DOMESTIC"], supportsCod: false }],
  retryPolicy: { maxAttempts: 1, backoffSeconds: 0 },
};
const productionProvider = new ConfiguredShippingProvider(setup);
await assert.rejects(
  () => productionProvider.createBooking({ booking: sampleBooking("carrier-production") }),
  /SHIPPING_CONNECTED_PROVIDER_REQUIRED/,
  "Production carrier configuration must fail closed without a connected adapter.",
);
const manual = new ManualShippingProvider();
const booked = await manual.createBooking({ booking: sampleBooking("manual") });
const firstSync = await manual.syncBooking!(booked.externalBookingId);
const secondSync = await manual.syncBooking!(booked.externalBookingId);
assert.equal(firstSync.externalStatus, "ACCEPTED");
assert.deepEqual(secondSync, firstSync, "Manual sync must never fabricate carrier progress.");

console.log(`Sales and Order Operations P0/P1 contracts: PASS (${Object.keys(spec.paths).length} OpenAPI paths, ${calls.length} production-routed command samples).`);

function sampleBooking(providerId: string): ShippingBooking {
  const timestamp = "2026-07-21T00:00:00.000Z";
  return {
    id: `booking-${providerId}`,
    workspaceId: "ws-default",
    code: `SB-${providerId}`,
    sourceType: "ORDER" as const,
    sourceId: "order-1",
    purpose: "ORDER_OUTBOUND" as const,
    providerId,
    providerNameSnapshot: providerId,
    bookingStatus: "PENDING",
    externalStatus: "UNKNOWN",
    pickupLocationSnapshot: { line1: "1 Pickup", city: "HCM" },
    recipientSnapshot: { name: "Buyer", phone: "0900000000", address: { line1: "2 Buyer", city: "HCM" } },
    packageSnapshot: { packageCount: 1, totalWeightGrams: 1000 },
    serviceCode: "standard",
    shipmentGroupId: "group-1",
    idempotencyKey: `idem-${providerId}`,
    correlationId: `corr-${providerId}`,
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
  };
}
