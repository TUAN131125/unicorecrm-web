// @ts-nocheck -- Runtime contract for M5 / RC-04 direct unavailable business ports.
//
// Invariant: a connected production action must not reach a business port whose connected
// binding cannot perform the authoritative mutation. Either an authoritative command carries
// it, or the boundary refuses before anything is written.
//
// The connected composition here uses an HTTP client that records every request, so a refused
// action is proven to make no transport call, and a migrated action is proven to reach its
// real backend operation. Local business state is snapshotted around each action so a silent
// local write cannot pass unnoticed.
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: "http://localhost/#/w/unicore-vietnam/crm/receivables",
  pretendToBeVisual: true,
});
const { window } = dom;

Object.defineProperties(globalThis, {
  window: { value: window, configurable: true },
  document: { value: window.document, configurable: true },
  navigator: { value: window.navigator, configurable: true },
  localStorage: { value: window.localStorage, configurable: true },
  HTMLElement: { value: window.HTMLElement, configurable: true },
  Element: { value: window.Element, configurable: true },
  Node: { value: window.Node, configurable: true },
  Event: { value: window.Event, configurable: true },
});

const { signIn } = await import("../../../src/platform/identity-auth/index");
assert.equal(
  signIn({ email: "admin@unicorecrm.local", password: "admin123" }).ok,
  true,
  "Unavailable-port contracts need an authenticated session.",
);

const SOURCE_ORDER_ID = "order_m5_source";
const DUPLICATE_ORDER_ID = "order_m5_duplicate";

interface Recorded { operationId: string; method: string; path: string; body: unknown }
const requests: Recorded[] = [];

const zero = { amount: "0", currency: "VND" };

/** Backend `OrderReadModel` shape, as the Order mapper expects to receive it. */
function orderReadModel(id: string, orderNumber: string) {
  return {
    id,
    orderNumber,
    orderDate: "2026-08-23",
    buyerRef: { type: "CONTACT", id: "contact_1" },
    state: "DRAFT",
    currency: "VND",
    lineItems: [],
    subtotal: zero,
    discountTotal: zero,
    taxTotal: zero,
    grandTotal: zero,
    actions: [],
    resourceVersion: id === SOURCE_ORDER_ID ? 4 : 1,
    createdAt: "2026-08-23T00:00:00.000Z",
    updatedAt: "2026-08-23T00:00:00.000Z",
  };
}

/** Projected `CustomerOrder` shape, for seeding the connected Order projection directly. */
function projectedOrder(id: string, orderNumber: string) {
  return {
    id,
    orderNumber,
    orderDate: "2026-08-23",
    buyerRef: { type: "CONTACT", id: "contact_1" },
    state: "DRAFT",
    currency: "VND",
    items: [],
    subtotal: 0,
    discountTotal: 0,
    taxTotal: 0,
    grandTotal: 0,
    totalAmount: 0,
    resourceVersion: id === SOURCE_ORDER_ID ? 4 : 1,
    createdAt: "2026-08-23T00:00:00.000Z",
    updatedAt: "2026-08-23T00:00:00.000Z",
  };
}

const connectedClient = {
  async request(input: Recorded) {
    requests.push({ operationId: input.operationId, method: input.method, path: input.path, body: input.body });
    if (input.operationId === "duplicateOrderDraft") {
      return {
        commandId: "cmd_order_duplicate",
        correlationId: "corr_order_duplicate",
        aggregateId: DUPLICATE_ORDER_ID,
        aggregateType: "order",
        version: 1,
        occurredAt: "2026-08-23T00:00:00.000Z",
        outcome: "COMMITTED",
        result: { order: orderReadModel(DUPLICATE_ORDER_ID, "ORD-0007-COPY") },
      };
    }
    throw new Error(`UNEXPECTED_CONNECTED_OPERATION:${input.operationId}`);
  },
};

const { initializeApplicationComposition } = await import("../../../src/app/composition");
await initializeApplicationComposition({ mode: "connected", http: { client: connectedClient } });

const { getUnavailableBusinessOperations, isBusinessOperationUnavailable } = await import("../../../src/shared/application/index");

// The connected composition declares its non-authoritative operations as it binds them.
const declared = getUnavailableBusinessOperations();
assert.ok(declared.length > 0, "The connected composition must declare its non-authoritative operations.");
for (const operation of [
  "Receivable collection activity save",
  "Receivable collection activity state update",
  "Invoice seller-information save",
  "Payment configuration save",
  "Deal stage reset",
  "Deal pipeline configuration save",
  "Product type configuration save",
  "Product demo catalog reset",
]) {
  assert.ok(declared.includes(operation), `${operation} must be declared unavailable in connected mode.`);
  assert.equal(isBusinessOperationUnavailable(operation), true);
}

// ---------------------------------------------------------------------------
// A + B + E. A refused action writes nothing locally and calls no HTTP operation.
// ---------------------------------------------------------------------------

const {
  isReceivableCollectionActivityUnavailable,
  isInvoiceSellerInformationSaveUnavailable,
  getReceivableCollectionActivities,
  saveReceivableCollectionActivity,
} = await import("../../../src/modules/invoices/public/api");
const { isPaymentConfigurationSaveUnavailable } = await import("../../../src/modules/payments/public/api");
const { isDealStageResetUnavailable, isDealPipelineConfigurationSaveUnavailable, getDealPipelines } =
  await import("../../../src/modules/deals/public/deals");
const { isProductConfigurationSaveUnavailable, getConfiguredProductTypes } =
  await import("../../../src/modules/products/public/configuration");
const { isProductDemoCatalogResetUnavailable } = await import("../../../src/modules/products/public/catalog");

// Every predicate a presentation preflight consults agrees with the composition.
assert.equal(isReceivableCollectionActivityUnavailable(), true);
assert.equal(isInvoiceSellerInformationSaveUnavailable(), true);
assert.equal(isPaymentConfigurationSaveUnavailable(), true);
assert.equal(isDealStageResetUnavailable(), true);
assert.equal(isDealPipelineConfigurationSaveUnavailable(), true);
assert.equal(isProductConfigurationSaveUnavailable(), true);
assert.equal(isProductDemoCatalogResetUnavailable(), true);

const pipelinesBefore = JSON.stringify(getDealPipelines());
const productTypesBefore = JSON.stringify(getConfiguredProductTypes());
const activitiesBefore = JSON.stringify(getReceivableCollectionActivities());
const httpCallsBefore = requests.length;

// F. The port itself still fails closed, so a handler that skipped its preflight cannot
// quietly succeed. It must throw rather than return.
assert.throws(
  () => saveReceivableCollectionActivity({
    buyerId: "contact_1",
    type: "COLLECTION_NOTE",
    note: "probe",
    state: "COMPLETED",
    createdBy: "test",
  }),
  /unavailable as a local operation in connected mode/u,
  "A non-authoritative port must keep failing closed behind the preflight.",
);

assert.equal(JSON.stringify(getReceivableCollectionActivities()), activitiesBefore, "No local activity may be written.");
assert.equal(JSON.stringify(getDealPipelines()), pipelinesBefore, "No local pipeline configuration may be written.");
assert.equal(JSON.stringify(getConfiguredProductTypes()), productTypesBefore, "No local product configuration may be written.");
assert.equal(requests.length, httpCallsBefore, "A refused operation must make no HTTP call.");

// ---------------------------------------------------------------------------
// C. The migrated action reaches its authoritative backend boundary.
// ---------------------------------------------------------------------------

const { duplicateOrderDraftCommand, getOrdersSnapshot, replaceOrders, getOrderSnapshot } =
  await import("../../../src/modules/orders/public/orders");
const { runBackendProjection } = await import("../../../src/shared/application/index");

runBackendProjection("orders", () => replaceOrders({ contact_1: [projectedOrder(SOURCE_ORDER_ID, "ORD-0007")] }));
assert.equal(getOrderSnapshot(SOURCE_ORDER_ID)?.resourceVersion, 4, "The source Order must be seeded from the backend projection.");

requests.length = 0;
const duplicated = (await duplicateOrderDraftCommand(SOURCE_ORDER_ID)).data;

const duplicateRequest = requests.find((request) => request.operationId === "duplicateOrderDraft");
assert.ok(duplicateRequest, "Duplicating an Order must reach the authoritative duplicateOrderDraft operation.");
assert.equal(duplicateRequest.method, "POST");
assert.match(duplicateRequest.path, new RegExp(SOURCE_ORDER_ID, "u"), "The duplicate must target the source Order.");
assert.equal(duplicated.id, DUPLICATE_ORDER_ID, "The new Order identity must come from the backend response.");
assert.equal(duplicated.orderNumber, "ORD-0007-COPY", "The new Order number must come from the backend response.");
assert.equal(duplicated.resourceVersion, 1, "The new Order version must come from the backend response.");

const snapshot = Object.values(getOrdersSnapshot()).flat();
assert.equal(
  snapshot.filter((order) => order.id === DUPLICATE_ORDER_ID).length,
  1,
  "The duplicate must be projected exactly once, from the authoritative response.",
);

// The Order list is the caller that was migrated onto that command. It must reach the
// command and must not write the authoritative Order collection itself: cloning a committed
// aggregate in the browser fabricates an Order the backend never issued.
const orderListController = (await import("node:fs")).readFileSync(
  "src/modules/orders/presentation/hooks/useOrderListController.tsx",
  "utf8",
);
assert.match(
  orderListController,
  /duplicateOrderDraftCommand\s*\(/u,
  "The Order list must duplicate through the authoritative order.duplicate-draft command.",
);
const duplicateHandler = orderListController.slice(
  orderListController.indexOf("const duplicateOrder"),
  orderListController.indexOf("// Bulk execution"),
);
assert.ok(duplicateHandler.length > 0, "The duplicate handler must be readable.");
for (const writer of ["replaceOrderList", "replaceOrders", "saveOrderSnapshot", "updateOrders", "setOrders"]) {
  assert.doesNotMatch(
    duplicateHandler,
    new RegExp(`\\b${writer}\\s*\\(`, "u"),
    `Duplicating an Order must not write the authoritative Order collection locally (${writer}).`,
  );
}

// ---------------------------------------------------------------------------
// D. Demo mode keeps the local operations it legitimately owns.
// ---------------------------------------------------------------------------

await initializeApplicationComposition({ mode: "demo" });

assert.deepEqual(getUnavailableBusinessOperations(), [], "Demo mode declares no unavailable business operation.");
assert.equal(isReceivableCollectionActivityUnavailable(), false);
assert.equal(isInvoiceSellerInformationSaveUnavailable(), false);
assert.equal(isPaymentConfigurationSaveUnavailable(), false);
assert.equal(isDealStageResetUnavailable(), false);
assert.equal(isDealPipelineConfigurationSaveUnavailable(), false);
assert.equal(isProductConfigurationSaveUnavailable(), false);
assert.equal(isProductDemoCatalogResetUnavailable(), false);

const demoActivity = saveReceivableCollectionActivity({
  buyerId: "contact_1",
  type: "COLLECTION_NOTE",
  note: "demo collection note",
  state: "COMPLETED",
  createdBy: "test",
});
assert.equal(demoActivity.note, "demo collection note", "Demo mode still records collection activity locally.");
assert.ok(
  getReceivableCollectionActivities().some((activity) => activity.id === demoActivity.id),
  "The demo activity must be readable from the demo store.",
);

console.log("Connected unavailable port containment: PASS");
