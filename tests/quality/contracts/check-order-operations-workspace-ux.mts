import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

const root = repositoryRoot;
const read = (file: string) => readPresentationComposition(path.join(root, file), "utf8");

const sharedUx = [
  "src/components/crm/list-archetype/ListDataTable.tsx",
  "src/components/crm/operations/OperationMetricGrid.tsx",
  "src/components/crm/operations/OperationSavedViews.tsx",
  "src/components/crm/operations/OperationFilterPopover.tsx",
  "src/components/crm/operations/OperationDetailTabs.tsx",
  "src/components/crm/operations/OperationInsightPanel.tsx",
  "src/components/crm/operations/OperationLifecycleRail.tsx",
  "src/components/crm/detail-archetype/RecordDetailFrame.tsx",
  "src/components/crm/detail-archetype/RecordDetailHeader.tsx",
];
for (const file of sharedUx) assert.ok(fs.existsSync(path.join(root, file)), `${file} must exist`);

const listPages = [
  "src/modules/orders/presentation/pages/OrderListPage.tsx",
  "src/modules/payments/presentation/pages/PaymentOperationsPage.tsx",
  "src/modules/invoices/presentation/pages/InvoiceListPage.tsx",
  "src/modules/invoices/presentation/pages/ReceivablesPage.tsx",
  "src/modules/shipping/presentation/pages/ShippingBookingListPage.tsx",
  "src/modules/returns/presentation/pages/ReturnListPage.tsx",
];
for (const file of listPages) {
  const source = read(file);
  for (const marker of ["ListPageFrame", "ListPageHeader", "ListToolbar"]) {
    assert.ok(source.includes(marker), `${file} must use the Lead/Contact/Customer ${marker} archetype`);
  }
  assert.equal(source.includes('max-w-[1600px]'), false, `${file} must use the shared max-w-7xl list canvas instead of an operational-only width`);
}

const tableOwners = [
  "src/modules/orders/presentation/list/OrderTable.tsx",
  "src/modules/payments/presentation/pages/PaymentOperationsPage.tsx",
  "src/modules/invoices/presentation/pages/InvoiceListPage.tsx",
  "src/modules/invoices/presentation/pages/ReceivablesPage.tsx",
  "src/modules/shipping/presentation/list/ShippingBookingTable.tsx",
  "src/modules/returns/presentation/list/ReturnTable.tsx",
  "src/modules/invoices/presentation/pages/ReceivableDetailPage.tsx",
  "src/modules/invoices/presentation/pages/AccountStatementPage.tsx",
];
for (const file of tableOwners) {
  const source = read(file);
  for (const marker of ["ListTableSurface", "ListDataTable", "ListTableHeaderCell", "ListTableRow", "ListTableCell"]) {
    assert.ok(source.includes(marker), `${file} must use the shared Lead/Contact/Customer table primitive ${marker}`);
  }
  assert.equal(/<table\s+className=/.test(source), false, `${file} must not introduce a module-specific raw table surface`);
}

const responsiveListPages = [
  "src/modules/orders/presentation/pages/OrderListPage.tsx",
  "src/modules/invoices/presentation/pages/InvoiceListPage.tsx",
  "src/modules/invoices/presentation/pages/ReceivablesPage.tsx",
  "src/modules/shipping/presentation/pages/ShippingBookingListPage.tsx",
  "src/modules/returns/presentation/pages/ReturnListPage.tsx",
];
for (const file of responsiveListPages) {
  const source = read(file);
  const hasCardMode = source.includes('viewMode === "card"') || source.includes('view === "card"');
  const hasTableMode = source.includes('viewMode === "table"') || source.includes('view === "table"');
  assert.ok(hasCardMode && hasTableMode, `${file} must support the shared responsive card/table modes`);
}

const paymentOperationsFile = "src/modules/payments/presentation/pages/PaymentOperationsPage.tsx";
const paymentOperations = read(paymentOperationsFile);
for (const marker of [
  '"COLLECTIONS"',
  '"INTENTS"',
  '"PAYMENTS"',
  '"RECONCILIATION"',
  '"CREDITS"',
  "getInvoiceWorkspaceResource",
  "toWorkspacePath",
  "Cần thu",
  "Đối soát & phân bổ",
  "Mở Công nợ",
  "ListRecordIdentity",
]) {
  assert.ok(paymentOperations.includes(marker), `${paymentOperationsFile} must expose the business collection workflow marker ${marker}`);
}
assert.equal(paymentOperations.includes('setTab("PLANS")'), false, "Payment operations must not default users into a technical Payment Plan table");
assert.ok(paymentOperations.includes("displayOrder") && paymentOperations.includes("displayBuyer"), "Payment operations must resolve business-facing order and customer context instead of exposing raw identifiers as the primary label");

const orderRouteFile = "src/modules/orders/list-route.tsx";
const orderRoute = read(orderRouteFile);
assert.ok(orderRoute.includes("OrderListScreen"), `${orderRouteFile} must remain a thin route composition boundary`);
for (const retiredRecoveryToken of ["OrderListRecoveryBoundary", "clearOrderPresentationPreferences", "centrix_order_status_config_v2"]) {
  assert.equal(orderRoute.includes(retiredRecoveryToken), false, `${orderRouteFile} must not mask programming errors or restore retired lifecycle preferences: ${retiredRecoveryToken}`);
}
const orderListController = read("src/modules/orders/presentation/hooks/useOrderListController.tsx");
assert.ok(orderListController.includes("centrix_order_list_columns_v2"), "Order column preferences must remain owned by the list controller");
const orderListSource = read("src/modules/orders/presentation/pages/OrderListPage.tsx");
assert.ok(orderListSource.includes("toWorkspacePath"), "Order list actions must use canonical workspace paths");
assert.equal(/navigate\(`\/(?:orders|payments|invoices|shipping|quotes|deals)/.test(orderListSource), false, "Order list actions must not escape the active workspace route");

const operationalListFiles = [
  "src/modules/shipping/presentation/pages/ShippingBookingListPage.tsx",
  "src/modules/returns/presentation/pages/ReturnListPage.tsx",
];
for (const file of operationalListFiles) {
  const source = read(file);
  for (const marker of ["OperationMetricGrid", "OperationSavedViews", "OperationFilterPopover"]) {
    assert.ok(source.includes(marker), `${file} must preserve ${marker} inside the common list shell`);
  }
}

const detailFiles = [
  "src/modules/orders/presentation/pages/OrderDetailPage.tsx",
  "src/modules/payments/presentation/pages/PaymentDetailPage.tsx",
  "src/modules/invoices/presentation/pages/InvoiceDetailPage.tsx",
  "src/modules/invoices/presentation/pages/ReceivableDetailPage.tsx",
  "src/modules/invoices/presentation/pages/AccountStatementPage.tsx",
  "src/modules/shipping/presentation/pages/ShippingBookingDetailPage.tsx",
  "src/modules/returns/presentation/pages/ReturnDetailPage.tsx",
];
for (const file of detailFiles) {
  const source = read(file);
  for (const marker of ["RecordDetailFrame", "RecordDetailHeader"]) {
    assert.ok(source.includes(marker), `${file} must use the shared Contact/Customer detail primitive ${marker}`);
  }
  assert.equal(source.includes('max-w-[1600px]'), false, `${file} must use the shared max-w-7xl detail canvas`);
  assert.equal(source.includes("ModulePageShell"), false, `${file} must not use a module-specific detail shell`);
}

const operationalDetailFiles = [
  "src/modules/orders/presentation/pages/OrderDetailPage.tsx",
  "src/modules/payments/presentation/pages/PaymentDetailPage.tsx",
  "src/modules/shipping/presentation/pages/ShippingBookingDetailPage.tsx",
  "src/modules/returns/presentation/pages/ReturnDetailPage.tsx",
];
for (const file of operationalDetailFiles) {
  const source = read(file);
  for (const marker of ["OperationDetailTabs", "OperationInsightPanel", "OperationLifecycleRail"]) {
    assert.ok(source.includes(marker), `${file} must preserve the operational ${marker} within the shared detail shell`);
  }
}

const metricGrid = read("src/components/crm/operations/OperationMetricGrid.tsx");
const insightPanel = read("src/components/crm/operations/OperationInsightPanel.tsx");
assert.ok(metricGrid.includes("useReducedMotion"), "Animated KPI cards must respect reduced-motion preferences");
assert.ok(insightPanel.includes("useReducedMotion"), "Animated readiness progress must respect reduced-motion preferences");

const shippingList = read("src/modules/shipping/presentation/pages/ShippingBookingListPage.tsx");
assert.ok(shippingList.includes("Mức độ sẵn sàng"), "Shipping list UX must expose shipment readiness");
assert.equal(shippingList.includes("useState(1000)"), false, "Shipping UX must not restore a fake default weight");

const returnList = read("src/modules/returns/presentation/pages/ReturnListPage.tsx");
assert.ok(returnList.includes("receiveProgress"), "Return list UX must expose receive progress");

const orderDetail = read("src/modules/orders/presentation/pages/OrderDetailPage.tsx");
assert.ok(orderDetail.includes("Điều phối đơn hàng"), "Order detail must expose a clear order orchestration panel");
assert.ok(orderDetail.includes("flow-summary"), "Order detail must expose the operational flow summary");

console.log("Order operations workspace UX contracts: PASS");
