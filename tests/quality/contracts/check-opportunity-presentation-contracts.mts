import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import path from "node:path";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

const root = repositoryRoot;
const source = (relativePath: string) => readPresentationComposition(path.join(root, relativePath), "utf8");
const between = (text: string, start: string, end: string) => {
  const startIndex = text.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing contract start: ${start}`);
  const endIndex = text.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `Missing contract end: ${end}`);
  return text.slice(startIndex, endIndex);
};

const pipelinePage = source("src/modules/deals/presentation/pages/DealPipelinePage.tsx");
const pipelineController = source("src/modules/deals/presentation/hooks/useDealPipelineController.ts");
const pipelineModals = source("src/modules/deals/presentation/components/DealPipelineModals.tsx");
const pipelineHealth = source("src/modules/deals/presentation/components/DealPipelineHealth.tsx");
const dealActionMenu = source("src/modules/deals/presentation/components/DealActionMenu.tsx");
const contactTable = source("src/modules/contacts/presentation/list/ContactTable.tsx");
const rowActionPortal = source("src/shared/components/ui/Dialog.tsx");
const actionDropdown = source("src/components/crm/ActionDropdown.tsx");
const dealDetail = source("src/modules/deals/presentation/pages/DealDetailPage.tsx");
const dealDetailController = source("src/modules/deals/presentation/hooks/useDealDetailController.tsx");
const contactDetailHeader = source("src/modules/contacts/presentation/detail/ContactRecordHeader.tsx");
const detailHeaderContract = source("src/components/crm/detail-archetype/recordDetailHeaderContract.ts");
const recordDetailHeader = source("src/components/crm/detail-archetype/RecordDetailHeader.tsx");
const vi = source("src/i18n/translations/vi.ts");
const en = source("src/i18n/translations/en.ts");

// Opportunity list controls use the same toolbar-anchored filter popover as Lead and the other CRM lists.
assert.ok(pipelinePage.includes("<ListToolbar"), "Opportunity page must use the canonical CRM list toolbar");
assert.ok(pipelinePage.includes("<ListFilterPopover"), "Opportunity filters must use the canonical dropdown surface");
assert.ok(pipelinePage.includes("filtersPanel={"), "Opportunity filter content must be owned by the list toolbar");
assert.ok(pipelinePage.includes("onOpenFilters={() => setIsFilterOpen((open) => !open)}"), "Opportunity filter trigger must toggle the dropdown");
assert.ok(pipelinePage.includes("onCloseFilters={() => setIsFilterOpen(false)}"), "Opportunity filter dropdown must close through the toolbar contract");
assert.ok(pipelinePage.includes("PageHeaderMoreButton"), "Opportunity header must use the shared three-dot quick-action button");
assert.ok(pipelinePage.includes('onClick={() => setIsAddModalOpen(true)}'), "Add Opportunity must remain a primary page-header action");
assert.ok(pipelinePage.includes('className="flex flex-wrap items-center justify-end gap-2"'), "Opportunity page-header actions must keep the standard separate-action layout");
assert.ok(pipelinePage.includes('{t("deals.addDeal")}'), "Opportunity create action must keep its visible localized label");
assert.ok(pipelinePage.includes('className="h-9 whitespace-nowrap rounded-xl"'), "Opportunity create action must keep a stable readable button shape");
assert.equal(pipelinePage.includes('data-deal-header-actions="split"'), false, "Opportunity header must not return to the icon-only split control");
assert.equal(pipelinePage.includes('data-deal-header-create-action="true"'), false, "Opportunity header must not hide the create label behind an icon-only action");
assert.ok(pipelinePage.includes("controlsPrefix={") && pipelinePage.includes("compactControls"), "Opportunity ownership, view and filter controls must share the compact list toolbar");
assert.ok(pipelinePage.includes("<OwnershipScopeSelector") && pipelinePage.includes("compact"), "Opportunity ownership scope must use the icon-first compact selector");
assert.equal(pipelinePage.includes('className="border-b border-slate-200 bg-white px-4 py-2"'), false, "Opportunity ownership scope must not consume a separate toolbar row");
assert.equal(pipelinePage.includes("DealPipelineHeaderActions"), false, "The retired bespoke Opportunity header controls must stay removed");
assert.equal(pipelinePage.includes("fixed right-0 top-0 bottom-0"), false, "Opportunity filters must not return to a right-side drawer");
assert.equal(pipelinePage.includes("fixed inset-0 bg-black"), false, "Opening Opportunity filters must not cover the workspace with a backdrop");
assert.equal(pipelinePage.includes("showStatusConfig"), false, "Stage configuration entry point must be absent from Opportunity page");
assert.equal(pipelinePage.includes("setIsSettingsOpen(true)"), false, "Opportunity page must not open stage settings");
assert.ok(pipelineController.includes("const [isFilterOpen, setIsFilterOpen]"), "Opportunity filter state must use neutral popover naming");
for (const retiredStageSettingsToken of [
  "isSettingsOpen",
  "editingStageCode",
  "isAddingNewStageForm",
  "openDeleteStageFlow",
  "handleConfirmReassignAndDelete",
]) {
  assert.equal(pipelineController.includes(retiredStageSettingsToken), false, `Opportunity controller must not retain dead Deal-side stage settings state: ${retiredStageSettingsToken}`);
  assert.equal(pipelineModals.includes(retiredStageSettingsToken), false, `Opportunity modal composition must not retain dead Deal-side stage settings UI: ${retiredStageSettingsToken}`);
}
assert.equal(pipelineModals.includes("<Modal"), false, "Opportunity modal composition must delegate pipeline configuration to Studio and only own Deal forms");
assert.equal((pipelineModals.match(/<DealFormModal/g) || []).length, 2, "Opportunity modal composition must contain exactly the create and edit Deal forms");

// Existing view/search state contracts continue to own business behavior.
assert.ok(pipelinePage.includes("setViewMode(mode as"), "Toolbar view toggle must call the existing controller action");
assert.ok(pipelineController.includes('next.set("view", mode)'), "View mode must remain persisted through an immutable URLSearchParams update");
assert.ok(pipelineController.includes("deal.name.toLowerCase().includes(searchTerm.toLowerCase())"));
assert.ok(/filteredDeals\.filter\(\s*\(d\) => d\.stage === stage,?\s*\)/.test(pipelinePage), "Search/filter result must still drive Kanban");
assert.ok(/filteredDeals\.map\(\(deal\) =>/.test(pipelinePage), "Search/filter result must still drive List");

// Opportunity row actions reuse the Contact floating portal and trigger grammar.
for (const sharedContract of ["RowActionPortal", 'variant="secondary"', 'size="xs"']) {
  assert.ok(contactTable.includes(sharedContract), `Contact row actions must still use ${sharedContract}`);
  assert.ok(pipelinePage.includes(sharedContract), `Opportunity row actions must reuse ${sharedContract}`);
}
assert.ok(pipelinePage.includes("<DealActionMenu"), "Opportunity rows must share one action menu owner");
assert.ok(dealActionMenu.includes("MenuItemButton") && dealActionMenu.includes("MenuSection") && dealActionMenu.includes("MenuDivider"));
assert.ok(dealActionMenu.includes('data-opportunity-row-action-menu="v1"'));
assert.equal(pipelinePage.includes('className="absolute right-0 mt-1 w-44'), false, "Row menu must not render inside table/card overflow");
assert.equal(pipelinePage.includes('className="fixed inset-0 z-30"'), false, "Legacy row action backdrop must stay removed");
assert.ok(rowActionPortal.includes("createPortal") && rowActionPortal.includes("document.body"), "RowActionPortal must remain body-owned");
assert.ok(rowActionPortal.includes("openAbove"), "RowActionPortal must retain collision flipping");
assert.ok(pipelinePage.includes("navigate(`/deals/${deal.id}`"), "Opportunity title/menu must retain detail navigation");

// Page More keeps all actions, proper i18n and keyboard-capable floating menu behavior.
for (const actionId of ["import-deals", "export-deals", "refresh-deals", "reset-pipeline"]) {
  assert.ok(pipelinePage.includes(`id: "${actionId}"`), `Page More must preserve ${actionId}`);
}
assert.ok(vi.includes('importExport: "Nhập / Xuất dữ liệu"'));
assert.ok(en.includes('importExport: "Import / Export data"'));
assert.equal(pipelinePage.includes('t("common.importExport") ||'), false, "Translation lookup must not leak the raw key");
for (const keyboardContract of ['role="menu"', 'event.key === "ArrowDown"', 'event.key === "ArrowUp"', 'event.key === "Home"', 'event.key === "End"']) {
  assert.ok(actionDropdown.includes(keyboardContract), `Page More menu must support ${keyboardContract}`);
}

// Opportunity detail reuses an explicit contract derived from the active Contact detail header.
for (const contactPattern of [
  "bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-sm text-left",
  "flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between",
  "w-12 h-12 rounded-xl border font-extrabold text-base flex items-center justify-center shrink-0 uppercase shadow-inner",
  "text-sm font-black text-slate-800 tracking-tight sm:text-lg",
]) {
  assert.ok(contactDetailHeader.includes(contactPattern), `Contact detail must retain reference pattern: ${contactPattern}`);
  assert.ok(detailHeaderContract.includes(contactPattern), `Shared detail-header contract must mirror Contact: ${contactPattern}`);
}
assert.ok(recordDetailHeader.includes('data-record-detail-header="v1"'));
assert.ok(recordDetailHeader.includes("recordDetailHeaderShellClassName"));
assert.ok(recordDetailHeader.includes("recordDetailHeaderMainRowClassName"));
assert.ok(recordDetailHeader.includes("recordDetailHeaderActionsClassName"));
assert.ok(dealDetail.includes("<RecordDetailHeader"), "Opportunity detail must use the shared record-detail header component");
assert.ok(dealDetail.includes('id="deal-detail-header"'));
assert.ok(dealDetail.includes("recordDetailHeaderActionButtonClassName"));
assert.ok(dealDetail.includes("navigate(returnTo)"), "Opportunity detail must preserve back navigation");
assert.doesNotMatch(dealDetail + pipelinePage + dealDetailController, /MOCK_USERS/, "Opportunity owner and activity presentation must not fall back to arbitrary demo users");
assert.match(dealDetail + pipelinePage, /resolveWorkspaceMemberLabel/, "Opportunity owner labels must resolve from the workspace member directory");
assert.match(dealDetail, /data-deal-buyer-state="pre-customer"/, "Opportunity detail must distinguish a pursued buyer from Customer 360");
assert.match(dealDetailController, /findCustomerByRelationshipRefSnapshot\(deal\.buyerRef\)/, "Opportunity detail must resolve a post-purchase Customer by canonical buyer relationship");
assert.match(dealDetailController, /const session = getAuthSessionSnapshot\(\)/, "New opportunity notes must resolve the current signed-in session");
assert.match(dealDetailController, /actorName: session\.principal\.displayName/, "New opportunity activity must display the current signed-in actor");

// Product and Quote sections share the same SectionHeader and Button presentation grammar.
assert.ok(vi.includes('title: "Sản phẩm"'));
assert.ok(vi.includes('sectionTitle: "Báo giá"'));
assert.ok(vi.includes('addLineItem: "Thêm sản phẩm"'));
assert.ok(vi.includes('addQuote: "Thêm báo giá"'));
assert.equal(vi.includes('title: "Sản phẩm & Cách tính Giá trị"'), false);
assert.ok(vi.includes('hybrid: "Kết hợp (B2B + B2C)"'), "Vietnamese business model must use Kết hợp");
assert.equal(vi.includes("Hỗn hợp"), false, "Vietnamese UI must not use Hỗn hợp for the hybrid business model");
assert.equal(vi.includes('sectionTitle: "Báo giá liên quan"'), false);
for (const labelKey of ['t("deals.lineItems.title")', 't("deals.quotes.sectionTitle")', 't("deals.detail.addLineItem")', 't("deals.quotes.addQuote")']) {
  assert.ok(dealDetail.includes(labelKey), `Opportunity detail must use ${labelKey}`);
}
const productSectionHeader = between(dealDetail, "          {/* Line Items Inventory Table */}", "            <div className=\"overflow-x-auto\">");
const quoteSectionHeader = between(dealDetail, "          {/* Quotes & Proposals Section */}", "              {relatedQuotes.length === 0 ? (");
assert.ok(productSectionHeader.includes('variant="secondary"'));
assert.ok(productSectionHeader.includes('size="sm"'));
assert.ok(productSectionHeader.includes('icon={<Plus size={12} />}'));
assert.ok(productSectionHeader.includes('className="h-9 whitespace-nowrap rounded-xl"'));
assert.ok(quoteSectionHeader.includes('actionIntent="create"'));
assert.ok(quoteSectionHeader.includes('size="sm"'));
assert.ok(quoteSectionHeader.includes('icon={<Plus size={12} />}'));
assert.ok(quoteSectionHeader.includes('className="h-9 whitespace-nowrap rounded-xl"'));


// Opportunity Kanban cards keep the same information while using a calmer, balanced hierarchy.
assert.ok(pipelinePage.includes('data-deal-kanban-card="balanced"'), "Opportunity cards must expose the balanced card contract");
const balancedCardStart = pipelinePage.indexOf('data-deal-kanban-card="balanced"\n');
assert.ok(balancedCardStart >= 0, "Opportunity card JSX marker must remain discoverable");
const balancedCardSurface = pipelinePage.slice(
  balancedCardStart,
  pipelinePage.indexOf('/* LIST / TABLE VIEW MODE */'),
);
assert.ok(balancedCardSurface.includes("min-h-[350px]") && balancedCardSurface.includes("mt-auto"), "Opportunity cards must keep a stable body and aligned footer");
assert.equal(balancedCardSurface.includes("font-black"), false, "Opportunity cards must not use black typography");
assert.equal(balancedCardSurface.includes("font-extrabold"), false, "Opportunity cards must not overuse extra-bold typography");
assert.ok(balancedCardSurface.includes('data-deal-next-stage-action="contained"'), "The next-stage action must remain contained by the opportunity card");
assert.ok(balancedCardSurface.includes('data-deal-next-stage-button="contained"'), "The next-stage button must expose its contained control contract");
assert.ok(balancedCardSurface.includes("-mx-4 -mb-4") && balancedCardSurface.includes("bg-slate-50/80 px-4 py-3"), "The next-stage action must render in a full-width footer clipped by the card surface");
assert.ok(balancedCardSurface.includes("overflow-hidden rounded-xl"), "Opportunity cards must contain footer actions at narrow column widths");
assert.ok(pipelineController.includes("advancingDealIdsRef") && pipelineController.includes("advanceDealStage"), "Opportunity next-stage action must use one duplicate-safe controller path");
assert.equal(pipelineController.includes("handleAdvanceStage"), false, "Retired next-stage logic must stay removed");
assert.ok(pipelinePage.includes("isDealAdvancing(deal.id)") && pipelinePage.includes("aria-busy={isDealAdvancing(deal.id)}"), "Opportunity cards must expose smooth pending feedback while advancing");
assert.ok(pipelinePage.includes('data-deal-kanban-dropzone="full-column"'), "The complete Kanban column body must accept drops");
assert.ok(pipelinePage.includes('data-deal-kanban-drop-indicator="full-column"'), "Kanban must expose a full-column drop affordance");
assert.ok(pipelinePage.includes('layoutId={`deal-kanban-card-${deal.id}`}'), "Opportunity cards must animate into their settled column position");
assert.ok(pipelinePage.includes("dropPendingRef.current"), "Drop settlement must remain visually stable until the stage command completes");
assert.equal(pipelinePage.includes("h-28 shrink-0 rounded-xl border-2 border-dashed"), false, "Kanban must not limit the drop affordance to a small placeholder slot");
const compactHealthSurface = pipelineHealth.slice(0, pipelineHealth.indexOf("export function DealForecastHistoryPanel"));
assert.equal(compactHealthSurface.includes("font-extrabold"), false, "Opportunity health badges must use a restrained weight hierarchy");
assert.equal(compactHealthSurface.includes("font-bold"), false, "Opportunity health badges must not use heavy bold typography");

// Quote presentation remains owner-driven, compact and workflow-safe.
const viQuoteStatus = between(between(vi, "  quote: {", "  quoteBuilder: {"), "    status: {", "  },");
assert.ok(viQuoteStatus.includes('draft: "Nháp"'), "Quote DRAFT must display NHÁP");
assert.equal(viQuoteStatus.includes("Bản nháp"), false, "Quote DRAFT must not display BẢN NHÁP");
assert.ok(dealDetail.includes("getQuoteStatusBadgeVariant(quote.status)"), "Quote status must use the shared status badge owner");
assert.ok(dealDetail.includes('className="whitespace-nowrap text-[9px] font-semibold uppercase tracking-wide"'));
assert.ok(vi.includes('continueDraft: "Tiếp tục soạn"'));
assert.ok(dealDetail.includes('data-deal-quote-workspace="responsive-cards"'), "Opportunity quote list must use the responsive card workspace");
const responsiveQuoteWorkspace = dealDetail.slice(
  dealDetail.indexOf('data-deal-quote-workspace="responsive-cards"'),
  dealDetail.indexOf('/* Activities Workspace & Timeline */'),
);
assert.equal(responsiveQuoteWorkspace.includes("overflow-x-auto"), false, "Opportunity quote workspace must not use horizontal scrolling");
for (const marker of ['actionIntent="navigate"', 'actionIntent="create"', 'actionIntent="retry"', 'actionIntent="confirm"', 'actionIntent="destructive"']) {
  assert.ok(dealDetail.includes(marker), `Opportunity quote actions must retain ${marker}`);
}
assert.ok(dealDetail.includes("QuoteApprovalStatus"), "Opportunity Quote actions must distinguish approval state from customer-facing Quote status");
assert.ok(dealDetail.includes("approvalRequired") && dealDetail.includes("approvalStatus"), "Opportunity Quote actions must respect approval policy state");
assert.ok(dealDetail.includes("action=gmail"), "Approved or approval-free Quotes must expose Gmail delivery");
assert.ok(dealDetail.includes("action=pdf"), "Opportunity Quotes must expose PDF export");
assert.ok(dealDetail.includes("Gửi duyệt") && dealDetail.includes("navigate(`/quotes/${quote.id}`)"), "Approval-required Quotes must route to the canonical approval owner instead of mutating status locally");

// Opportunity detail keeps a readable hierarchy, responsive composition and valid Tailwind color tokens.
for (const marker of [
  'data-deal-detail-layout="responsive"',
  'data-deal-detail-summary="balanced"',
  'data-deal-detail-ai-assessment="balanced"',
  'data-deal-detail-stage-map="responsive"',
  'data-deal-detail-actions="balanced"',
  'data-deal-detail-related-records="balanced"',
  'data-deal-detail-activity="balanced"',
]) {
  assert.ok(dealDetail.includes(marker), `Opportunity detail must retain ${marker}`);
}
assert.equal(dealDetail.includes("font-black"), false, "Opportunity detail must not use black typography");
assert.equal(dealDetail.includes("font-extrabold"), false, "Opportunity detail must not overuse extra-bold typography");
assert.doesNotMatch(
  dealDetail,
  /(?:text|bg|border)-(?:slate|indigo|sky|rose|amber|emerald|red|blue|violet|purple|teal|orange|yellow)-(?:150|250|350|450|550|650|750|850|805)\b/,
  "Opportunity detail must use valid Tailwind color steps",
);
assert.ok(dealDetail.includes('xl:grid-cols-12') && dealDetail.includes('xl:col-span-8') && dealDetail.includes('xl:col-span-4'), "Opportunity detail must avoid a cramped two-column layout below the XL breakpoint");
assert.ok(dealDetail.includes('min-w-[560px]') && dealDetail.includes('overflow-x-auto pb-1 crm-scroll-x'), "Opportunity stage map must preserve readable labels on narrow surfaces");

console.log("Opportunity presentation contracts: OK");
