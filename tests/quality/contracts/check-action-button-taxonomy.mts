import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import path from "node:path";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

const root = repositoryRoot;
const read = (file: string) => readPresentationComposition(path.join(root, file), "utf8");

const buttonFile = "src/shared/components/ui/Button.tsx";
const button = read(buttonFile);
for (const marker of [
  "ButtonActionIntent",
  "actionIntentVariantMap",
  "inferButtonVariantFromAction",
  "resolveButtonVariant",
  "whitespace-nowrap",
  "leading-none",
]) {
  assert.ok(button.includes(marker), `${buttonFile} must keep ${marker}`);
}
assert.ok(button.includes('destructive: "danger"'), "Destructive actions must map to danger");
assert.ok(button.includes('complete: "success"'), "Completion actions must map to success");
assert.ok(button.includes('retry: "warning"'), "Retry actions must map to warning");
assert.ok(button.includes('navigate: "info"'), "Navigation actions must map to info");

const pageHeaderActionsFile = "src/components/crm/PageHeaderActions.tsx";
const pageHeaderActions = read(pageHeaderActionsFile);
assert.ok(pageHeaderActions.includes("resolveButtonVariant"), "Header actions must use the shared action taxonomy");
assert.ok(pageHeaderActions.includes("h-9") && pageHeaderActions.includes("whitespace-nowrap"), "Header actions must retain stable original dimensions");

const relationshipActionBar = read("src/components/crm/relationship-panel/RelationshipPanelActionBar.tsx");
assert.ok(relationshipActionBar.includes('className="h-9 w-9 justify-self-center"'), "Relationship quick actions must render as square controls instead of thin stretched pills");
assert.equal(relationshipActionBar.includes('className="h-8 w-full min-w-0"'), false, "Relationship quick actions must not collapse across equal-width grid tracks");

const dropdownFile = "src/components/crm/ActionDropdown.tsx";
const dropdown = read(dropdownFile);
assert.ok(dropdown.includes("inferButtonVariantFromAction"), "Action dropdowns must use the shared action taxonomy");
assert.ok(dropdown.includes('resolvedVariant = item.destructive ? "danger"'), "Destructive dropdown actions must stay dangerous");
assert.ok(dropdown.includes("whitespace-normal") && dropdown.includes("break-words"), "Action dropdown labels must wrap instead of clipping");

const headerContract = read("src/components/crm/detail-archetype/recordDetailHeaderContract.ts");
assert.ok(headerContract.includes("whitespace-nowrap") && headerContract.includes("h-9"), "Record detail header actions must retain stable original dimensions");

const operationalExpectations: Array<[string, string[]]> = [
  ["src/modules/payments/presentation/pages/PaymentOperationsPage.tsx", ['actionIntent="confirm" className="text-white [&_svg]:stroke-white"', 'actionIntent="sync" onClick={() => retryIntent(intent)}']],
  ["src/modules/payments/presentation/pages/PaymentDetailPage.tsx", ['variant="warning" size="sm" icon={<RotateCcw', 'variant="danger" size="sm" icon={<Undo2', 'variant="warning" size="sm" icon={<RefreshCw']],
  ["src/modules/shipping/presentation/pages/ShippingBookingListPage.tsx", ['actionIntent="create" size="sm" icon={<Plus']],
  ["src/modules/shipping/presentation/create/ShippingBookingCreatePresentation.tsx", ['actionIntent="neutral" size="lg" onClick={onCancel}', 'actionIntent="create" size="lg" onClick={onSubmit}']],
  ["src/modules/shipping/presentation/pages/ShippingBookingDetailPage.tsx", ['actionIntent="sync" size="sm" icon={<RefreshCw', 'actionIntent="retry" size="sm" icon={<RotateCcw', 'actionIntent="destructive" size="sm" icon={<XCircle']],
  ["src/modules/orders/presentation/pages/OrderDetailPage.tsx", ['id === "create-shipping") return <Button key={id} variant="primary"', 'id === "record-payment") return <Button key={id} variant="info"', 'id === "cancel") return <Button key={id} variant="danger"']],
  ["src/modules/returns/presentation/pages/ReturnListPage.tsx", ['actionIntent="create" size="sm" icon={<Plus', 'actionIntent="navigate" size="sm" onClick={() => selectedRows[0]']],
  ["src/modules/returns/presentation/pages/ReturnDetailPage.tsx", ['actionId === "approve") return <Button key={actionId} type="button" actionIntent="confirm"', 'actionId === "receive") return <Button key={actionId} type="button" actionIntent="save"', 'actionIntent="destructive" size="sm" onClick={() => run(rejectAfterInspection', 'actionIntent="sync" size="sm" icon={<RefreshCw']],
  ["src/modules/support/presentation/pages/SupportCaseListPage.tsx", ['actionIntent="create" size="sm" icon={<Plus', 'showFilters', 'onOpenFilters={() => setFilterOpen', '<OperationFilterPopover']],
  ["src/modules/support/presentation/pages/SupportCaseDetailPage.tsx", ['actionIntent="create" size="sm" loading={busyAction === "reply"}', 'actionIntent="save" size="sm" loading={busyAction === "note"}', 'actionIntent="create" size="sm" icon={<Plus']],
  ["src/modules/support/presentation/pages/SupportCaseFormPage.tsx", ['actionIntent="save" size="sm" icon={<Save']],
  ["src/modules/tasks/presentation/pages/TaskListPage.tsx", ['actionIntent="complete" size="sm" icon={<CheckCircle2', 'actionIntent="destructive" size="sm" icon={<XCircle', 'actionIntent="navigate" size="sm" icon={<CalendarDays', 'actionIntent="create" size="sm" icon={<Plus']],
  ["src/modules/tasks/presentation/pages/TaskDetailPage.tsx", ['actionIntent="complete" size="sm" icon={<CheckCircle2', 'actionIntent="retry" size="sm" icon={<RotateCcw', 'actionIntent="destructive" size="sm" icon={<XCircle']],
  ["src/modules/deals/presentation/pages/DealDetailPage.tsx", ['data-deal-quote-workspace="responsive-cards"', 'actionIntent="confirm"', 'actionIntent="destructive"']],
];
for (const [file, markers] of operationalExpectations) {
  const source = read(file);
  for (const marker of markers) assert.ok(source.includes(marker), `${file} must keep action taxonomy marker ${marker}`);
}


const listControlBar = read("src/components/crm/ListControlBar.tsx");
assert.ok(listControlBar.includes("{showFilters && onOpenFilters && ("), "Filter action taxonomy must be owned by the shared list control bar");
assert.ok(listControlBar.includes("<Filter size={15} />"), "Shared list filter actions must keep the filter affordance");
assert.ok(listControlBar.includes('border-slate-200 bg-white text-slate-600 hover:bg-slate-50'), "Inactive list filters must retain the neutral action treatment");
assert.ok(listControlBar.includes('border-violet-200 bg-violet-50 text-violet-700'), "Active list filters must expose the selected action state");

const dealDetail = read("src/modules/deals/presentation/pages/DealDetailPage.tsx");
const quoteWorkspaceStart = dealDetail.indexOf('data-deal-quote-workspace="responsive-cards"');
const quoteWorkspaceEnd = dealDetail.indexOf('/* Activities Workspace & Timeline */', quoteWorkspaceStart);
const quoteWorkspace = dealDetail.slice(quoteWorkspaceStart, quoteWorkspaceEnd > quoteWorkspaceStart ? quoteWorkspaceEnd : undefined);
assert.ok(quoteWorkspaceStart >= 0, "Deal detail must keep the responsive quote workspace");
assert.equal(quoteWorkspace.includes("overflow-x-auto"), false, "Deal detail quote workspace must not use a horizontal scrollbar");
assert.equal(quoteWorkspace.includes("<Table"), false, "Deal detail quote workspace must use responsive cards instead of a wide table");

const insightPanel = read("src/components/crm/operations/OperationInsightPanel.tsx");
assert.equal(insightPanel.includes("ArrowRight"), false, "Operation next-step buttons must not render the trailing arrow icon");
const orderDetail = read("src/modules/orders/presentation/pages/OrderDetailPage.tsx");
assert.ok(orderDetail.includes('activeTab === "ACTIVITY" ? undefined'), "Order detail must hide the Activity CTA when Activity is already open");
const returnDetailModel = read("src/modules/returns/presentation/detail/returnDetailModel.ts");
assert.ok(returnDetailModel.includes('input.activeTab === "ACTIVITY") return undefined'), "Return detail must hide the Activity CTA when Activity is already open");

const tsxFiles = walkAllFiles(path.join(root, "src"), {
  include: (_filePath, entryName) => entryName.endsWith(".tsx"),
});

for (const file of tsxFiles) {
  const source = readPresentationComposition(file, "utf8");
  assert.equal(/<Button\b[^>]*className=["'\{][^\n>]*(?:truncate|line-clamp-|text-ellipsis)/.test(source), false, `${path.relative(root, file)} must not reintroduce clipped shared action labels`);
}

console.log(`Action button taxonomy contracts: PASS (${tsxFiles.length} TSX files audited)`);
