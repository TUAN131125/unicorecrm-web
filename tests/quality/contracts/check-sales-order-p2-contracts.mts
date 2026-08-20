import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildRepositoryInventory } from "../../../scripts/repository-inventory/repositoryInventory.mjs";

const root = repositoryRoot;
const read = (relative: string): string => fs.readFileSync(path.join(root, relative), "utf8");
const lineCount = (relative: string): number => read(relative).split(/\r?\n/u).length;
const exists = (relative: string): boolean => fs.existsSync(path.join(root, relative));

const dedicatedCreateAdapters = [
  ["src/modules/deals/infrastructure/http/DealHttpApiAdapter.ts", "createDealCommand"],
  ["src/modules/quotes/infrastructure/http/QuoteHttpApiAdapter.ts", "createQuoteCommand"],
  ["src/modules/orders/infrastructure/http/OrderHttpApiAdapter.ts", "createOrderDraftCommand"],
  ["src/modules/shipping/infrastructure/http/ShippingHttpApiAdapter.ts", "createShippingBookingCommand"],
  ["src/modules/returns/infrastructure/http/ReturnHttpApiAdapter.ts", "createReturnRequestCommand"],
] as const;
for (const [relativePath, operationId] of dedicatedCreateAdapters) {
  assert.match(
    read(relativePath),
    new RegExp(`this\\.api\\.${operationId}\\b`, "u"),
    `${relativePath} must call the generated ${operationId} client operation.`,
  );
}

const spec = JSON.parse(read("docs/api/openapi.json")) as { paths: Record<string, Record<string, { operationId?: string }>> };
const collectionCreates = new Map([
  ["/deals", "createDealCommand"],
  ["/quotes", "createQuoteCommand"],
  ["/orders", "createOrderDraftCommand"],
  ["/shipping", "createShippingBookingCommand"],
  ["/returns", "createReturnRequestCommand"],
]);
for (const [route, operationId] of collectionCreates) {
  assert.equal(spec.paths[route]?.post?.operationId, operationId, `${route} must expose a collection create contract.`);
}
for (const legacyRoute of [
  "/deals/{dealId}/create",
  "/quotes/{quoteId}/create",
  "/orders/{orderId}/create",
  "/shipping/{bookingId}/create-booking",
  "/returns/{returnId}/create",
]) assert.equal(spec.paths[legacyRoute], undefined, `${legacyRoute} must not return as a client-numbered create endpoint.`);

const ids = read("src/shared/ids/index.ts");
assert.match(ids, /pending_\$\{prefix\}/);
assert.match(ids, /DRAFT-\$\{prefix\}/);
assert.match(ids, /Secure UUID generation is unavailable/);
assert.doesNotMatch(ids, /Date\.now\(\)/);

const identityFiles = [
  "src/modules/deals/presentation/hooks/useDealPipelineController.ts",
  "src/modules/deals/presentation/hooks/useDealDetailController.tsx",
  "src/modules/deals/presentation/views/DealDetailDialogs.tsx",
  "src/modules/orders/presentation/hooks/useOrderFormController.tsx",
  "src/modules/orders/presentation/hooks/useOrderListController.tsx",
  "src/modules/shipping/presentation/create/useShippingBookingCreateController.ts",
  "src/modules/shipping/presentation/pages/ShippingBookingListPage.tsx",
  "src/modules/shipping/presentation/pages/ShippingBookingDetailPage.tsx",
  "src/modules/returns/presentation/pages/ReturnFormPage.tsx",
  "src/modules/returns/presentation/pages/ReturnDetailPage.tsx",
];
const timestampIdentityPattern = /(?:\bid\b|\bcode\b|\bnumber\b)\s*:\s*[^\n]{0,100}Date\.now\(\)|(?:deal-new|ret_|ship_|return_|order_)\$\{Date\.now\(\)\}/u;
for (const relative of identityFiles) {
  assert.ok(exists(relative), `${relative} must exist.`);
  assert.doesNotMatch(read(relative), timestampIdentityPattern, `${relative} must not allocate aggregate/document identities from a browser timestamp.`);
}

const retiredStatusModal = ["src/modules/orders/presentation/components", "OrderStatusConfigurationModal.tsx"].join("/");
assert.equal(exists(retiredStatusModal), false, "Order lifecycle configuration must stay out of the operational list UI.");
const orderListView = read("src/modules/orders/presentation/views/OrderListView.tsx");
const orderListController = read("src/modules/orders/presentation/hooks/useOrderListController.tsx");
const orderListRoute = read("src/modules/orders/list-route.tsx");
const listControlBar = read("src/components/crm/ListControlBar.tsx");
assert.match(
  orderListController,
  /projectPaymentSummaryFromSnapshot\(\s*payments,\s*order\.id/u,
  "Order list payment projection must receive the subscribed Payment snapshot before the Order id.",
);
for (const retiredRecoveryToken of ["OrderListRecoveryBoundary", "clearOrderPresentationPreferences", "removeOrderPreference", "Cần khôi phục cấu hình danh sách"]) {
  assert.equal(orderListRoute.includes(retiredRecoveryToken), false, `Order list route must not mask programming errors as preference recovery: ${retiredRecoveryToken}`);
}
for (const retiredToken of ["OrderStatusConfigurationModal", "showStatusConfig", "onOpenStatusConfig", "statusLabel", "saveStatusConfig", "setStatusConfigs", "normalizeStoredStatusConfigs", "centrix_order_status_config"]) {
  assert.equal(orderListView.includes(retiredToken), false, `Order list must not expose ${retiredToken}.`);
  assert.equal(orderListController.includes(retiredToken), false, `Order controller must not retain ${retiredToken}.`);
  assert.equal(listControlBar.includes(retiredToken), false, `Shared list controls must not retain ${retiredToken}.`);
}
const orderLifecycle = read("src/modules/orders/domain/rules/orderLifecycle.ts");
for (const status of ["DRAFT", "CONFIRMED", "COMPLETED", "CANCELLED"]) assert.ok(orderLifecycle.includes(status));

const presentationBudgets = new Map<string, number>([
  ["src/modules/shipping/presentation/pages/ShippingBookingCreatePage.tsx", 40],
  ["src/modules/shipping/presentation/create/useShippingBookingCreateController.ts", 600],
  ["src/modules/shipping/presentation/create/ShippingBookingCreateView.tsx", 380],
  ["src/modules/shipping/presentation/create/ShippingBookingCreatePresentation.tsx", 180],
  ["src/modules/shipping/presentation/create/shippingBookingCreateModel.ts", 120],
  ["src/modules/returns/presentation/pages/ReturnDetailPage.tsx", 500],
  ["src/modules/returns/presentation/detail/returnDetailModel.ts", 200],
  ["src/modules/returns/presentation/detail/ReturnDetailPrimitives.tsx", 60],
  ["src/modules/returns/presentation/detail/ReturnDetailChrome.tsx", 80],
]);
for (const [relative, budget] of presentationBudgets) {
  assert.ok(exists(relative), `${relative} must exist.`);
  assert.ok(lineCount(relative) <= budget, `${relative} exceeds its ${budget}-line responsibility budget.`);
}
const shippingEntry = read("src/modules/shipping/presentation/pages/ShippingBookingCreatePage.tsx");
assert.match(shippingEntry, /ShippingBookingCreateView/);
assert.match(read("src/modules/shipping/presentation/create/ShippingBookingCreateView.tsx"), /ShippingBookingCreatePresentation/);
assert.doesNotMatch(shippingEntry, /useState|useEffect|<form/u);
const returnDetail = read("src/modules/returns/presentation/pages/ReturnDetailPage.tsx");
for (const companion of ["returnDetailModel", "ReturnDetailPrimitives", "ReturnDetailChrome"]) {
  assert.ok(returnDetail.includes(companion), `Return detail must compose ${companion}.`);
}

const e2e = read("tests/e2e/sales-order-operations.spec.ts");
assert.match(e2e, /Order list keeps lifecycle configuration out of the operational toolbar/);
assert.match(e2e, /Shipping create form stays responsive/);
assert.match(e2e, /Lifecycle\|Vòng đời/);
assert.match(e2e, /scrollWidth - document\.documentElement\.clientWidth/);

const inventory = buildRepositoryInventory();
assert.ok(inventory.largeFiles.length <= 44, `Sales/order P2 must keep the reviewed 44-file large-source ratchet; found ${inventory.largeFiles.length}.`);
assert.equal(inventory.circularDependencies.length, 0, "Sales/order P2 must not introduce dependency cycles.");

console.log(`Sales and Order Operations P2 contracts: PASS (${dedicatedCreateAdapters.length} dedicated create adapters, ${collectionCreates.size} server-authoritative creates, ${presentationBudgets.size} presentation budgets, ${inventory.largeFiles.length} large files).`);
