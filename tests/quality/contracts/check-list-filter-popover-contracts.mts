import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

const root = repositoryRoot;
const read = (relativePath: string) => readPresentationComposition(path.join(root, relativePath), "utf8");

const sharedPopover = read("src/components/crm/list-archetype/ListFilterPopover.tsx");
for (const marker of [
  'data-list-filter-popover="v1"',
  'role="dialog"',
  "absolute inset-x-0",
  "max-h-[min(660px,calc(100vh-10rem))]",
  "overflow-y-auto",
  "sm:grid-cols-2",
  "xl:grid-cols-4",
]) {
  assert.ok(sharedPopover.includes(marker), `Canonical list-filter popover missing ${marker}`);
}
assert.equal(sharedPopover.includes("<Drawer"), false, "Canonical list filters must not render through a Drawer.");
assert.equal(sharedPopover.includes("createPortal"), false, "Canonical list filters must remain anchored to the list toolbar.");

const controlBar = read("src/components/crm/ListControlBar.tsx");
for (const marker of [
  "filterPopoverRef",
  "onCloseFilters",
  'event.key === "Escape"',
  'document.addEventListener("pointerdown"',
  "filtersOpen && filtersPanel",
  "aria-controls={filtersPanel ? filterPanelId : undefined}",
]) {
  assert.ok(controlBar.includes(marker), `List toolbar filter lifecycle missing ${marker}`);
}

const filterPages = [
  "src/modules/leads/presentation/pages/LeadListPage.tsx",
  "src/modules/contacts/presentation/views/ContactListView.tsx",
  "src/modules/customers/presentation/pages/CustomerListPage.tsx",
  "src/modules/deals/presentation/pages/DealPipelinePage.tsx",
  "src/modules/orders/presentation/views/OrderListView.tsx",
  "src/modules/organizations/presentation/pages/OrganizationAccountListPage.tsx",
  "src/modules/quotes/presentation/pages/QuoteListPage.tsx",
  "src/modules/invoices/presentation/pages/InvoiceListPage.tsx",
  "src/modules/invoices/presentation/pages/ReceivablesPage.tsx",
  "src/modules/returns/presentation/pages/ReturnListPage.tsx",
  "src/modules/shipping/presentation/pages/ShippingBookingListPage.tsx",
  "src/modules/support/presentation/pages/SupportCaseListPage.tsx",
  "src/modules/tasks/presentation/pages/TaskListPage.tsx",
  "src/modules/products/presentation/components/ProductToolbar.tsx",
];

for (const file of filterPages) {
  const source = read(file);
  for (const marker of ["showFilters", "onOpenFilters", "onCloseFilters", "filtersOpen=", "filtersPanel="]) {
    assert.ok(source.includes(marker), `${file} must participate in the canonical toolbar-filter lifecycle: ${marker}`);
  }
  assert.equal(source.includes("fixed right-0 top-0 bottom-0"), false, `${file} must not open filters in a right-side panel.`);
  assert.equal(source.includes("fixed inset-0 bg-black"), false, `${file} must not add a page-blocking filter backdrop.`);
}

const filterOwners = [
  "src/modules/leads/presentation/components/LeadFilterPopover.tsx",
  "src/modules/contacts/presentation/list/ContactFilterPopover.tsx",
  "src/modules/customers/presentation/list/CustomerFilterPopover.tsx",
  "src/modules/orders/presentation/list/OrderFilterPopover.tsx",
  "src/modules/quotes/presentation/components/QuoteFilterPopover.tsx",
  "src/components/crm/operations/OperationFilterPopover.tsx",
  "src/modules/products/presentation/components/ProductToolbar.tsx",
];
for (const file of filterOwners) {
  const source = read(file);
  assert.match(source, /ListFilterPopover|OperationFilterPopover/, `${file} must reuse the canonical filter popover.`);
  for (const retiredPattern of ["<Drawer", "createPortal", "fixed right-0", 'initial={{ x: "100%" }}']) {
    assert.equal(source.includes(retiredPattern), false, `${file} must not retain right-drawer filter implementation: ${retiredPattern}`);
  }
}

for (const retiredPath of [
  ["src/components/crm/operations/OperationFilter", "DrawerShell.tsx"].join(""),
  ["src/modules/leads/presentation/components/LeadFilter", "Drawer.tsx"].join(""),
  ["src/modules/contacts/presentation/list/ContactFilter", "Drawer.tsx"].join(""),
  ["src/modules/customers/presentation/list/CustomerFilter", "Drawer.tsx"].join(""),
  ["src/modules/orders/presentation/list/OrderFilter", "Drawer.tsx"].join(""),
  ["src/modules/deals/presentation/components/DealPipeline", "HeaderActions.tsx"].join(""),
  ["src/modules/contacts/presentation/list/Contact", "Toolbar.tsx"].join(""),
]) {
  assert.equal(fs.existsSync(path.join(root, retiredPath)), false, `${retiredPath} is obsolete and must stay removed.`);
}

const invoiceList = read("src/modules/invoices/presentation/pages/InvoiceListPage.tsx");
const receivables = read("src/modules/invoices/presentation/pages/ReceivablesPage.tsx");
assert.equal(invoiceList.includes('leftSlot={(\n          <label'), false, "Invoice state must live inside the shared filter dropdown.");
assert.equal(receivables.includes('leftSlot={(\n          <label'), false, "Receivables aging must live inside the shared filter dropdown.");


const dealPipeline = read("src/modules/deals/presentation/pages/DealPipelinePage.tsx");
assert.equal(dealPipeline.includes("flex h-[calc(100dvh-84px)] min-h-[520px] flex-col overflow-hidden pb-0"), false, "Deal pipeline shell must not clip the anchored filter dropdown.");
const orderList = read("src/modules/orders/presentation/views/OrderListView.tsx");
assert.equal(orderList.includes('className="overflow-hidden text-slate-700"'), false, "Order list frame must not clip the anchored filter dropdown.");

const productToolbar = read("src/modules/products/presentation/components/ProductToolbar.tsx");
for (const marker of ["filtersPanel={(", "onCloseFilters", "filtersOpen={isFiltersOpen}"]) {
  assert.ok(productToolbar.includes(marker), `Product filters must use the canonical toolbar dropdown: ${marker}`);
}

console.log(`List filter popover contracts PASS — ${filterPages.length} CRM list surfaces share one dropdown model.`);
