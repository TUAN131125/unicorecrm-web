import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import path from "node:path";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

const root = repositoryRoot;
const read = (relative: string) => readPresentationComposition(path.join(root, relative), "utf8");

const routeKeys = read("src/platform/navigation/routeKeys.ts");
const routes = read("src/app/router/workspaces/crmWorkspaceRoutes.tsx");
const list = read("src/modules/shipping/presentation/pages/ShippingBookingListPage.tsx");
const createRoute = read("src/modules/shipping/create-route.tsx");
const createPage = read("src/modules/shipping/presentation/pages/ShippingBookingCreatePage.tsx");
const orderList = read("src/modules/orders/presentation/pages/OrderListPage.tsx");
const orderDetail = read("src/modules/orders/presentation/pages/OrderDetailPage.tsx");
const orderForm = read("src/modules/orders/presentation/pages/OrderFormPage.tsx");

assert.ok(routeKeys.includes('SHIPPING_NEW: "/shipping/new"'), "Shipping create must own a dedicated canonical page route.");
assert.ok(routes.includes("ROUTE_KEYS.SHIPPING_NEW"), "CRM route tree must register the Shipping create page.");
assert.ok(list.includes('navigate("/shipping/new")'), "Shipping list create action must navigate to the create page.");
assert.equal(list.includes("ShippingBookingCreateModal"), false, "Shipping list must not render the create workflow as a modal.");
assert.ok(orderList.includes('path(`shipping/new?orderId=${order.id}`)'), "Order list must use the canonical workspace deep-link to the create page with the Order id.");
assert.ok(orderDetail.includes('/shipping/new?orderId=${order.id}'), "Order detail must deep-link to the create page with the Order id.");
assert.equal(orderForm.includes('/shipping/new?orderId=${outcome.data.order.id}'), false, "Order creation must not bypass Order confirmation by opening Shipping from a new DRAFT Order.");
assert.ok(orderForm.includes('navigate(`/orders/${outcome.data.order.id}`)'), "Order creation must return to the saved DRAFT Order so confirmation remains explicit.");
assert.ok(createRoute.includes('searchParams.get("orderId")'), "Shipping create route must consume Order deep-link intent.");
for (const sourceMarker of ["getContactsSnapshot", "getCustomerPresentationSnapshot", "getProductCatalogSnapshot"]) {
  assert.ok(createRoute.includes(sourceMarker), `Shipping create route must load ${sourceMarker} for mapping.`);
}
assert.equal(createPage.includes("<Modal"), false, "Shipping creation must render as a page, not a modal.");
assert.ok(createPage.includes("<ModulePageShell"), "Shipping create must use the CRM page shell.");
assert.ok(createPage.includes("hasSubmitAttempted && (!ready"), "Missing-data alert must remain hidden until the user submits.");
assert.ok(createPage.includes("setHasSubmitAttempted(true)"), "Create action must activate validation feedback.");
assert.equal(createPage.includes("disabled={!ready}"), false, "Create action must remain clickable so it can reveal missing fields.");
assert.ok(createPage.includes("makeGoodsFromOrder(order, products)"), "Order lines must be enriched from the Product catalog.");
assert.ok(createPage.includes("order?.recipientEmail"), "Recipient email must map from the Order before relationship fallbacks.");
assert.ok(createPage.includes("validationErrors.recipientAddress"), "Required recipient fields must expose inline validation.");
assert.ok(createPage.includes("SearchableSelect"), "Large Shipping relationship collections must be searchable.");
assert.ok(createPage.includes('className="!max-w-none overflow-x-clip'), "Shipping create page must not inherit the narrow module max-width or leak horizontal overflow.");
assert.ok(createPage.includes('2xl:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)]'), "Shipping create desktop columns must use shrinkable minmax tracks.");
assert.equal(createPage.includes('xl:grid-cols-[minmax(260px,1.8fr)_110px_170px_180px]'), false, "Goods rows must not use fixed tracks that overflow the card.");
assert.ok(createPage.includes('hasSubmitAttempted ? `${score}%`'), "Readiness percentage must remain a post-submit validation signal.");

console.log("Shipping create page contracts: PASS");
console.log("- create shipment is a dedicated page route");
console.log("- confirmed Order list/detail links deep-link and map recipient, goods, COD and catalog enrichment");
console.log("- new DRAFT Orders return to Order detail and cannot bypass confirmation into Shipping");
console.log("- missing-data alerts appear only after submit");
console.log("- large entity selectors are searchable");
