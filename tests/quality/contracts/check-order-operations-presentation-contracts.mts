import { walkFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { resolveOrderActionIds } from "@/modules/orders/presentation/model/orderActionPolicy";
import { resolvePaymentActionIds } from "@/modules/payments/presentation/model/paymentActionPolicy";
import { resolveShippingActionIds } from "@/modules/shipping/presentation/model/shippingActionPolicy";
import { resolveReturnActionIds } from "@/modules/returns/presentation/model/returnActionPolicy";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

const root = repositoryRoot;
const read = (file: string) => readPresentationComposition(path.join(root, file), "utf8");

const listTsxFiles = (relativeDirectory: string): string[] => walkFiles(path.join(root, relativeDirectory), {
  include: (_filePath: string, entryName: string) => entryName.endsWith(".tsx"),
}).map((absolutePath: string) => path.relative(root, absolutePath));

for (const directory of ["src/modules/shipping/presentation", "src/modules/returns/presentation"]) {
  const files = listTsxFiles(directory);
  const typographySource = files.map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
  assert.doesNotMatch(typographySource, /font-black|font-extrabold|font-bold/, `${directory} must keep a restrained operational typography hierarchy.`);
  assert.ok((typographySource.match(/font-semibold/g) || []).length <= 5, `${directory} must reserve semibold text for primary titles and values.`);
}

const listFiles = {
  orders: "src/modules/orders/presentation/list/OrderTable.tsx",
  payments: "src/modules/payments/presentation/pages/PaymentOperationsPage.tsx",
  shipping: "src/modules/shipping/presentation/list/ShippingBookingTable.tsx",
  returns: "src/modules/returns/presentation/list/ReturnTable.tsx",
};


const statisticsSurfaces = [
  "src/modules/orders/presentation/list/OrderStatisticsDrawer.tsx",
  "src/modules/payments/presentation/pages/PaymentOperationsPage.tsx",
  "src/modules/invoices/presentation/pages/ReceivablesPage.tsx",
  "src/modules/shipping/presentation/pages/ShippingBookingListPage.tsx",
  "src/modules/returns/presentation/pages/ReturnListPage.tsx",
  "src/modules/organizations/presentation/list/OrganizationStatisticsDrawer.tsx",
];
for (const file of statisticsSurfaces) {
  const source = read(file);
  assert.ok(source.includes("<Modal"), `${file} must render statistics in the centered Modal archetype`);
  assert.equal(source.includes("<Drawer isOpen={showStats"), false, `${file} must not open statistics in a right-side drawer`);
  assert.equal(source.includes('statsLabel="Chỉ số"') || source.includes('text("Chỉ số", "Metrics")'), false, `${file} must label the action Thống kê/Statistics`);
}

for (const [moduleName, file] of Object.entries(listFiles)) {
  const source = read(file);
  for (const marker of ["ListTableSurface", "ListDataTable", "ListTableHeaderCell", "ListTableRow", "ListTableCell"]) {
    assert.ok(source.includes(marker), `${moduleName} list must use shared ${marker}`);
  }
  assert.equal(/window\.(confirm|prompt|alert)\s*\(/.test(source), false, `${moduleName} list must not use native browser confirmation`);
}

for (const moduleName of ["orders", "shipping", "returns"] as const) {
  const source = read(listFiles[moduleName]);
  assert.ok(source.includes("ActionDropdownTrigger"), `${moduleName} list must render one shared overflow trigger`);
  assert.equal((source.match(/<ActionDropdownTrigger/g) || []).length, 1, `Each ${moduleName} row template must render exactly one overflow trigger`);
}

const orderTable = read(listFiles.orders);
assert.ok(orderTable.includes("minWidth={1320}"));
assert.equal(/Eye|Edit3|Copy|Trash2/.test(orderTable), false, "Order action cell must not render direct action icons");

const paymentList = read(listFiles.payments);
for (const marker of ["COLLECTIONS", "INTENTS", "PAYMENTS", "RECONCILIATION", "CREDITS", "ListRecordIdentity"]) {
  assert.ok(paymentList.includes(marker), `Payment workspace must preserve ${marker}`);
}
assert.ok(paymentList.includes("Mở Công nợ") || paymentList.includes("Open Receivables"));
const shippingList = read(listFiles.shipping);
assert.ok(shippingList.includes("ShippingBookingStatusBadge"));
const returnList = read(listFiles.returns);
assert.ok(returnList.includes("ReturnStatusBadge"));

const orderDetail = read("src/modules/orders/presentation/pages/OrderDetailPage.tsx");
const lifecycleRail = read("src/components/crm/operations/OperationLifecycleRail.tsx");
assert.ok(orderDetail.includes('!shippingRequired ? "skipped" as const'), "Service/digital Orders must mark Shipping as not applicable instead of completed");
assert.ok(orderDetail.includes('"Không cần vận đơn"'), "Order orchestration and lifecycle must use one consistent no-shipment label");
assert.ok(orderDetail.includes('Tài liệu đơn hàng đã gửi qua'), "Customer document communication must not be presented as product delivery");
assert.ok(orderDetail.includes('Việc gửi tài liệu đơn hàng qua Zalo, email hoặc Gmail chỉ là gửi chứng từ cho khách, không phải giao sản phẩm.'), "No-shipment guidance must distinguish document sending from physical fulfillment");
assert.ok(orderDetail.includes('Đã hoàn tất sau khi đủ điều kiện thanh toán và thực hiện'), "Service/digital completion evidence must not be labeled as shipping confirmation");
assert.equal(orderDetail.includes('Đã hoàn tất từ xác nhận giao hàng'), false, "No Order completion surface may infer shipping evidence for no-shipment Orders");
assert.ok(lifecycleRail.includes('"skipped"'), "Shared lifecycle rail must support a not-applicable state");
assert.ok(lifecycleRail.includes("<Minus"), "Not-applicable lifecycle steps must not render a completion checkmark");

// State policies: presentation surfaces render a resolver result rather than duplicating broad status if-chains.
const fullOrderPermissions = { canView: true, canUpdate: true, canCreate: true, canDelete: true, canConfirm: true, canComplete: true, canCreateShipping: true, canRecordPayment: true, canCreateInvoice: true };
const orderItem = { id: "line-1", productId: "product-1", productNameSnapshot: "Product", quantity: 1, unitPriceSnapshot: 100, discountPercent: 0, lineSubtotal: 100, lineDiscountAmount: 0, lineTaxAmount: 0, lineTotal: 100 };
const physicalItems = [{ ...orderItem, fulfillmentKind: "PHYSICAL_SHIPMENT" as const }];
const serviceItems = [{ ...orderItem, fulfillmentKind: "SERVICE" as const }];
assert.ok(resolveOrderActionIds({ state: "CONFIRMED", items: physicalItems }, fullOrderPermissions, { completionReady: true }).includes("complete"));
assert.ok(resolveOrderActionIds({ state: "CONFIRMED", items: physicalItems }, fullOrderPermissions, { completionReady: false }).includes("create-shipping"));
assert.equal(resolveOrderActionIds({ state: "CONFIRMED", items: serviceItems }, fullOrderPermissions, { completionReady: false }).includes("create-shipping"), false, "Service-only Orders must not offer Shipping");
assert.equal(resolveOrderActionIds({ state: "COMPLETED", items: physicalItems }, fullOrderPermissions, { completionReady: true }).includes("complete"), false);
assert.ok(resolveOrderActionIds({ state: "DRAFT", items: physicalItems }, fullOrderPermissions, { completionReady: false }).includes("confirm"));
assert.equal(resolveOrderActionIds({ state: "CANCELLED", items: physicalItems }, fullOrderPermissions, { completionReady: true }).includes("create-shipping"), false);

const paymentPermissions = { canView: true, canRecord: true, canRefund: true, canReconcile: true };
assert.ok(resolvePaymentActionIds({ kind: "PAYMENT", status: "FAILED", reconciliationState: "UNRECONCILED" }, paymentPermissions).includes("retry"));
assert.equal(resolvePaymentActionIds({ kind: "REFUND", status: "SUCCEEDED", reconciliationState: "MATCHED" }, paymentPermissions).includes("refund"), false);

const shippingPermissions = { canView: true, canSync: true, canRetry: true, canCancel: true };
assert.ok(resolveShippingActionIds({ bookingStatus: "FAILED", externalBookingId: undefined }, shippingPermissions).includes("retry"));
assert.equal(resolveShippingActionIds({ bookingStatus: "CANCELLED", externalBookingId: "external" }, shippingPermissions).includes("cancel"), false);

const returnPermissions = { canView: true, canApprove: true, canUpdate: true, canResolve: true };
assert.deepEqual(resolveReturnActionIds({ status: "REQUESTED" }, returnPermissions), ["view", "approve", "reject"]);
assert.deepEqual(resolveReturnActionIds({ status: "RECEIVED" }, returnPermissions), ["view", "resolve"]);
assert.deepEqual(resolveReturnActionIds({ status: "CLOSED" }, returnPermissions), ["view"]);

// All operation details belong to the exact shared record-detail component family.
for (const file of [
  "src/modules/orders/presentation/pages/OrderDetailPage.tsx",
  "src/modules/payments/presentation/pages/PaymentDetailPage.tsx",
  "src/modules/shipping/presentation/pages/ShippingBookingDetailPage.tsx",
  "src/modules/returns/presentation/pages/ReturnDetailPage.tsx",
]) {
  const source = read(file);
  assert.ok(source.includes("RecordDetailHeader"), `${file} must use shared RecordDetailHeader`);
  assert.ok(source.includes("recordDetailHeaderActionButtonClassName"), `${file} must use shared header action sizing`);
  assert.equal(/window\.(confirm|prompt|alert)\s*\(/.test(source), false, `${file} must use shared dialogs`);
}

// Shared floating owner prevents list menus from table/card clipping.
const dropdownSource = read("src/components/crm/ActionDropdown.tsx");
assert.ok(dropdownSource.includes("createPortal"));
assert.ok(dropdownSource.includes("document.body"));
assert.ok(dropdownSource.includes("openAbove"));

// Create Order preserves required business regions and optional Shipping.
const orderCreate = read("src/modules/orders/presentation/pages/OrderFormPage.tsx");
for (const marker of ["source-context", "customer-recipient", "order-lines", "payment-plan", "optional-shipping", "summary"]) {
  assert.ok(orderCreate.includes(`data-order-section=\"${marker}\"`), `Create Order must preserve ${marker} responsibility`);
}
assert.ok(orderCreate.includes("executeOrderCreation"));
assert.ok(orderCreate.includes("initializedPrefillKeyRef"));
assert.equal(/window\.(confirm|prompt|alert)\s*\(/.test(orderCreate), false);

console.log("Order/Payment/Shipping/Returns presentation contracts: PASS");
