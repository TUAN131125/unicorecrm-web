import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

interface PresentationCompositionContract {
  entry: string;
  maxEntryLines: number;
  controller?: string;
  view?: string;
  maxControllerLines?: number;
  maxViewLines?: number;
}

const contracts: readonly PresentationCompositionContract[] = [
  {
    entry: "src/modules/quotes/presentation/pages/QuoteBuilderPage.tsx",
    controller: "src/modules/quotes/presentation/hooks/useQuoteBuilderController.tsx",
    view: "src/modules/quotes/presentation/views/QuoteBuilderView.tsx",
    maxEntryLines: 40,
    maxControllerLines: 1_000,
    maxViewLines: 1_150,
  },
  {
    entry: "src/modules/contacts/presentation/pages/ContactListPage.tsx",
    controller: "src/modules/contacts/presentation/hooks/useContactListController.tsx",
    view: "src/modules/contacts/presentation/views/ContactListView.tsx",
    maxEntryLines: 40,
    maxControllerLines: 1_250,
    maxViewLines: 700,
  },
  {
    entry: "src/modules/deals/presentation/pages/DealDetailPage.tsx",
    controller: "src/modules/deals/presentation/hooks/useDealDetailController.tsx",
    view: "src/modules/deals/presentation/views/DealDetailView.tsx",
    maxEntryLines: 80,
    maxControllerLines: 600,
    maxViewLines: 80,
  },
  {
    entry: "src/modules/leads/presentation/pages/LeadDetailPage.tsx",
    controller: "src/modules/leads/presentation/hooks/useLeadDetailController.tsx",
    view: "src/modules/leads/presentation/views/LeadDetailView.tsx",
    maxEntryLines: 80,
    maxControllerLines: 700,
    maxViewLines: 1_150,
  },
  {
    entry: "src/modules/contacts/presentation/pages/ContactDetailPage.tsx",
    controller: "src/modules/contacts/presentation/hooks/useContactDetailController.tsx",
    view: "src/modules/contacts/presentation/views/ContactDetailView.tsx",
    maxEntryLines: 80,
    maxControllerLines: 1_350,
    maxViewLines: 450,
  },
  {
    entry: "src/modules/orders/presentation/pages/OrderListPage.tsx",
    controller: "src/modules/orders/presentation/hooks/useOrderListController.tsx",
    view: "src/modules/orders/presentation/views/OrderListView.tsx",
    maxEntryLines: 40,
    maxControllerLines: 750,
    maxViewLines: 900,
  },
  {
    entry: "src/components/LeadForm.tsx",
    controller: "src/modules/leads/presentation/hooks/useLeadFormController.tsx",
    view: "src/modules/leads/presentation/components/LeadFormView.tsx",
    maxEntryLines: 40,
    maxControllerLines: 700,
    maxViewLines: 980,
  },
  {
    entry: "src/modules/orders/presentation/pages/OrderFormPage.tsx",
    controller: "src/modules/orders/presentation/hooks/useOrderFormController.tsx",
    view: "src/modules/orders/presentation/views/OrderFormView.tsx",
    maxEntryLines: 40,
    maxControllerLines: 950,
    maxViewLines: 550,
  },
  {
    entry: "src/modules/shipping/presentation/pages/ShippingBookingCreatePage.tsx",
    controller: "src/modules/shipping/presentation/create/useShippingBookingCreateController.ts",
    view: "src/modules/shipping/presentation/create/ShippingBookingCreateView.tsx",
    maxEntryLines: 40,
    maxControllerLines: 600,
    maxViewLines: 380,
  },
];


const dealDetailComposition = "src/modules/deals/presentation/views/DealDetailView.tsx";
const dealDetailCompanions: ReadonlyArray<{ file: string; maxLines: number; exportName: string }> = [
  { file: "src/modules/deals/presentation/views/DealDetailHeaderSection.tsx", maxLines: 260, exportName: "DealDetailHeaderSection" },
  { file: "src/modules/deals/presentation/views/DealDetailCommercialWorkspace.tsx", maxLines: 30, exportName: "DealDetailCommercialWorkspace" },
  { file: "src/modules/deals/presentation/views/DealDetailPipelineWorkspace.tsx", maxLines: 400, exportName: "DealDetailPipelineWorkspace" },
  { file: "src/modules/deals/presentation/views/DealDetailQuoteWorkspace.tsx", maxLines: 300, exportName: "DealDetailQuoteWorkspace" },
  { file: "src/modules/deals/presentation/views/DealDetailActivityTimeline.tsx", maxLines: 300, exportName: "DealDetailActivityTimeline" },
  { file: "src/modules/deals/presentation/views/DealDetailSidebar.tsx", maxLines: 30, exportName: "DealDetailSidebar" },
  { file: "src/modules/deals/presentation/views/DealDetailSidebarActions.tsx", maxLines: 380, exportName: "DealDetailSidebarActions" },
  { file: "src/modules/deals/presentation/views/DealDetailRelatedRecords.tsx", maxLines: 300, exportName: "DealDetailRelatedRecords" },
  { file: "src/modules/deals/presentation/views/DealDetailDialogs.tsx", maxLines: 360, exportName: "DealDetailDialogs" },
];
const dealDetailViewSource = read(dealDetailComposition);
for (const companion of dealDetailCompanions) {
  assert.ok(lineCount(companion.file) <= companion.maxLines, `${companion.file} exceeds its focused responsibility budget`);
  assert.ok(read(companion.file).includes(`export function ${companion.exportName}`), `${companion.file} must own ${companion.exportName}`);
  if (["DealDetailHeaderSection", "DealDetailCommercialWorkspace", "DealDetailActivityTimeline", "DealDetailSidebar", "DealDetailDialogs"].includes(companion.exportName)) {
    assert.ok(dealDetailViewSource.includes(companion.exportName), `${dealDetailComposition} must compose ${companion.exportName}`);
  }
}
assert.doesNotMatch(dealDetailViewSource, /<Modal|<Table|navigator\.clipboard|ProductPickerModal/, "DealDetailView must remain orchestration-only");

const customerTabEntry = "src/modules/customers/presentation/detail/CustomerDetailTabContent.tsx";
const customerSections = "src/modules/customers/presentation/detail/CustomerDetailSections.tsx";

function read(file: string): string {
  assert.ok(fs.existsSync(file), `${file} must exist`);
  return fs.readFileSync(file, "utf8");
}

function lineCount(file: string): number {
  return read(file).split(/\r?\n/).length;
}

function hasJsx(file: string): boolean {
  const source = read(file);
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found = false;
  function visit(node: ts.Node): void {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return found;
}

for (const contract of contracts) {
  const entrySource = read(contract.entry);
  assert.ok(
    lineCount(contract.entry) <= contract.maxEntryLines,
    `${contract.entry} must stay at or below ${contract.maxEntryLines} orchestration lines`,
  );
  assert.ok(contract.controller && entrySource.includes(contract.controller.split("/").at(-1)!.replace(/\.tsx?$/, "")), `${contract.entry} must compose its controller hook`);
  assert.ok(contract.view && entrySource.includes(contract.view.split("/").at(-1)!.replace(/\.tsx?$/, "")), `${contract.entry} must compose its dedicated view`);
  assert.doesNotMatch(entrySource, /\buse(?:State|Effect|Memo|Ref|Callback|Reducer)\s*\(/, `${contract.entry} must not own stateful presentation logic`);
  assert.ok(lineCount(contract.controller!) <= contract.maxControllerLines!, `${contract.controller} exceeds its controller budget`);
  assert.ok(lineCount(contract.view!) <= contract.maxViewLines!, `${contract.view} exceeds its rendering budget`);
  assert.equal(hasJsx(contract.controller!), false, `${contract.controller} must remain render-free`);
  assert.equal(/\blocalStorage\b|\bsessionStorage\b/.test(read(contract.view!)), false, `${contract.view} must not own browser persistence`);
}


const returnDetailContracts: ReadonlyArray<{ file: string; maxLines: number }> = [
  { file: "src/modules/returns/presentation/pages/ReturnDetailPage.tsx", maxLines: 500 },
  { file: "src/modules/returns/presentation/detail/returnDetailModel.ts", maxLines: 200 },
  { file: "src/modules/returns/presentation/detail/ReturnDetailPrimitives.tsx", maxLines: 60 },
  { file: "src/modules/returns/presentation/detail/ReturnDetailChrome.tsx", maxLines: 80 },
];
for (const contract of returnDetailContracts) {
  assert.ok(lineCount(contract.file) <= contract.maxLines, `${contract.file} exceeds its return-detail responsibility budget`);
}
const returnDetailSource = read("src/modules/returns/presentation/pages/ReturnDetailPage.tsx");
for (const companion of ["returnDetailModel", "ReturnDetailPrimitives", "ReturnDetailChrome"]) {
  assert.ok(returnDetailSource.includes(companion), `Return detail must compose ${companion}`);
}

const customerEntrySource = read(customerTabEntry);
assert.ok(lineCount(customerTabEntry) <= 450, `${customerTabEntry} must remain a focused tab orchestrator`);
assert.ok(customerEntrySource.includes("CustomerDetailSections"), `${customerTabEntry} must delegate tab sections`);
assert.ok(lineCount(customerSections) <= 20, `${customerSections} must remain a thin section-composition barrel`);

const customerSectionContracts: ReadonlyArray<{ file: string; maxLines: number; sections: readonly string[] }> = [
  {
    file: "src/modules/customers/presentation/detail/CustomerRelationshipSections.tsx",
    maxLines: 240,
    sections: ["ContactsTab", "NotesTab"],
  },
  {
    file: "src/modules/customers/presentation/detail/CustomerCommercialSections.tsx",
    maxLines: 480,
    sections: ["OpportunitiesTab", "OrdersTab", "PaymentsTab", "PurchaseHistoryTab", "PurchasedProductsTab", "QuotationsTab"],
  },
  {
    file: "src/modules/customers/presentation/detail/CustomerOperationsSections.tsx",
    maxLines: 400,
    sections: ["ReturnsTab", "ShippingTab", "SupportTab", "TasksTab"],
  },
];

const customerSectionsBarrel = read(customerSections);
for (const contract of customerSectionContracts) {
  assert.ok(lineCount(contract.file) <= contract.maxLines, `${contract.file} exceeds its focused section budget`);
  assert.ok(customerSectionsBarrel.includes(contract.file.split("/").at(-1)!.replace(/\.tsx$/, "")), `${customerSections} must compose ${contract.file}`);
  const source = read(contract.file);
  for (const section of contract.sections) {
    assert.ok(source.includes(`export const ${section}`), `${contract.file} must own ${section}`);
  }
}
assert.ok(
  lineCount("src/modules/customers/presentation/detail/CustomerDetailSectionPrimitives.tsx") <= 300,
  "Customer detail shared primitives must remain focused",
);

console.log("Presentation responsibility contracts: PASS");
console.log(`- Thin entrypoints protected: ${contracts.length}`);
console.log("- Controller hooks are render-free and views do not own browser persistence.");
console.log("- Customer detail tab orchestration delegates its relationship, sales, transaction and work sections.");
