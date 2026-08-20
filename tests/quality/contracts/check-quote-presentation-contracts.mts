import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import path from "node:path";
import { QuoteApprovalStatus, QuoteStatus, type Quote } from "../../../src/modules/quotes/domain/model/quote.types";
import {
  resolveQuoteActionIds,
  type QuoteActionPermissions,
} from "../../../src/modules/quotes/presentation/model/quoteActionPolicy";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

const root = repositoryRoot;
const source = (relativePath: string) => readPresentationComposition(path.join(root, relativePath), "utf8");
const count = (text: string, needle: string) => text.split(needle).length - 1;
const between = (text: string, start: string, end: string) => {
  const startIndex = text.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing contract start: ${start}`);
  const endIndex = text.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `Missing contract end: ${end}`);
  return text.slice(startIndex, endIndex);
};

const allPermissions: QuoteActionPermissions = {
  canView: true,
  canUpdate: true,
  canApprove: true,
  canCreate: true,
  canDelete: true,
  canCreateOrder: true,
};

const expectedActions: Record<QuoteStatus, string[]> = {
  [QuoteStatus.DRAFT]: ["view", "export-pdf", "edit", "send", "confirm-sent", "duplicate", "optimize-price", "delete"],
  [QuoteStatus.REVIEW]: ["view", "export-pdf", "edit", "send", "confirm-sent", "duplicate", "optimize-price", "delete"],
  [QuoteStatus.SENT]: ["view", "export-pdf", "confirm-sent", "accept", "reject", "expire", "revise", "duplicate", "optimize-price"],
  [QuoteStatus.ACCEPTED]: ["view", "export-pdf", "create-order", "revise", "duplicate", "optimize-price"],
  [QuoteStatus.REJECTED]: ["view", "export-pdf", "revise", "duplicate", "optimize-price"],
  [QuoteStatus.EXPIRED]: ["view", "export-pdf", "revise", "duplicate", "optimize-price"],
};

for (const status of Object.values(QuoteStatus)) {
  assert.deepEqual(
    resolveQuoteActionIds(createQuote(status), allPermissions),
    expectedActions[status],
    `${status} must resolve the canonical presentation action set`,
  );
}

assert.deepEqual(
  resolveQuoteActionIds(createQuote(QuoteStatus.SENT), { ...allPermissions, canUpdate: false }),
  ["view", "export-pdf", "revise", "duplicate", "optimize-price"],
  "Customer-response transitions must disappear without quotes.update",
);
assert.deepEqual(
  resolveQuoteActionIds(createQuote(QuoteStatus.DRAFT), { ...allPermissions, canUpdate: false }),
  ["view", "export-pdf", "duplicate", "optimize-price", "delete"],
  "Mutable workflow actions must disappear without quotes.update",
);
assert.deepEqual(
  resolveQuoteActionIds(createQuote(QuoteStatus.ACCEPTED), { ...allPermissions, canCreate: false, canCreateOrder: false }),
  ["view", "export-pdf", "optimize-price"],
  "Revision, duplicate and create-order must respect their capabilities",
);
assert.equal(
  resolveQuoteActionIds(createQuote(QuoteStatus.SENT), allPermissions).includes("delete"),
  false,
  "Issued Quote versions must never expose delete",
);
assert.equal(
  resolveQuoteActionIds(createQuote(QuoteStatus.ACCEPTED, { validUntil: "2000-01-01" }), allPermissions).includes("create-order"),
  false,
  "Expired accepted Quotes must not expose create-order",
);

const approvalRequiredDraft = createQuote(QuoteStatus.DRAFT, {
  approvalRequired: true,
  approvalStatus: QuoteApprovalStatus.PENDING,
});
assert.deepEqual(
  resolveQuoteActionIds(approvalRequiredDraft, allPermissions),
  ["view", "export-pdf", "edit", "request-approval", "duplicate", "optimize-price", "delete"],
  "Approval-required draft must request approval instead of sending",
);
assert.deepEqual(
  resolveQuoteActionIds(createQuote(QuoteStatus.DRAFT, {
    approvalRequired: true,
    approvalStatus: QuoteApprovalStatus.PENDING,
    approvalRequestedAt: "2026-07-10T10:00:00.000Z",
  }), allPermissions),
  ["view", "export-pdf", "edit", "approve", "request-changes", "duplicate", "optimize-price", "delete"],
  "Pending approval must expose approver decisions instead of customer send",
);
assert.deepEqual(
  resolveQuoteActionIds(createQuote(QuoteStatus.DRAFT, {
    approvalRequired: true,
    approvalStatus: QuoteApprovalStatus.APPROVED,
    approvalRequestedAt: "2026-07-10T10:00:00.000Z",
  }), allPermissions),
  ["view", "export-pdf", "edit", "send", "confirm-sent", "duplicate", "optimize-price", "delete"],
  "Approved content may be sent to the customer",
);

const listPage = source("src/modules/quotes/presentation/pages/QuoteListPage.tsx");
const actionPolicy = source("src/modules/quotes/presentation/model/quoteActionPolicy.ts");
const actionMenu = source("src/modules/quotes/presentation/components/QuoteActionMenu.tsx");
const actionDropdown = source("src/components/crm/ActionDropdown.tsx");
const actionTrigger = source("src/components/crm/ActionDropdownTrigger.tsx");
const deleteDialog = source("src/modules/quotes/presentation/components/QuoteDeleteConfirmDialog.tsx");
const detailPage = source("src/modules/quotes/presentation/pages/QuoteDetailPage.tsx");
const dealDetail = source("src/modules/deals/presentation/pages/DealDetailPage.tsx");
const detailHeader = source("src/components/crm/detail-archetype/RecordDetailHeader.tsx");
const detailHeaderContract = source("src/components/crm/detail-archetype/recordDetailHeaderContract.ts");
const builderPage = source("src/modules/quotes/presentation/pages/QuoteBuilderPage.tsx");
const builderPreview = source("src/modules/quotes/presentation/components/QuoteBuilderPreview.tsx");
const statusBadge = source("src/modules/quotes/presentation/components/QuoteStatusBadge.tsx");
const filterPanels = source("src/modules/quotes/presentation/components/QuoteFilterPopover.tsx");
const sharedTable = source("src/shared/components/ui/Table.tsx");
const vi = source("src/i18n/translations/vi.ts");
const en = source("src/i18n/translations/en.ts");

// Table and Card render one shared action owner and never maintain separate status matrices.
assert.ok(listPage.includes("<QuoteActionMenu"));
assert.ok(listPage.includes("resolveQuoteActionIds(activeQuote, getQuoteActionPermissions(activeQuote))"));
assert.equal(listPage.includes("getQuoteCardDropdownItems"), false);
assert.equal(listPage.includes("getRowMoreDropdownItems"), false);
assert.equal(listPage.includes("getQuoteDropdownSections"), false);
assert.ok(actionPolicy.includes("QuoteApprovalStatus"));
assert.ok(actionPolicy.includes("approvalRequired"));
assert.ok(actionPolicy.includes("isQuoteVersionImmutable"));
assert.ok(actionPolicy.includes("QuoteActionPermissions"));

// Each table/card record surface owns exactly one ellipsis trigger template; the table action column is compact.
assert.equal(count(listPage, "<ActionDropdownTrigger"), 2, "Card and Table should each render one overflow trigger template");
const tableActionCell = between(listPage, '<TableCell className={`sticky right-0 z-10', "</TableCell>");
assert.ok(tableActionCell.includes("<ActionDropdownTrigger"));
for (const directAction of ["<Eye", "<Edit3", "<Copy"]) {
  assert.equal(tableActionCell.includes(directAction), false, `Quote table action cell must not render ${directAction}`);
}
assert.ok(listPage.includes('sticky right-0 z-20') && listPage.includes('sticky right-0 z-10'), "Quote action column must stay pinned during horizontal scrolling");
assert.ok(listPage.includes("font-semibold tabular-nums text-slate-800"), "Quote money must use the shared readable numeric typography");
assert.ok(actionTrigger.includes("aria-label={title}"), "Icon-only overflow trigger must expose an accessible name");

// View details is first and remains available in the shared menu.
assert.ok(actionPolicy.indexOf('actions.push("view")') < actionPolicy.indexOf('actions.push("edit")'));
assert.ok(actionMenu.includes('id: "view"'));
assert.ok(actionMenu.includes('label: vi ? "Xem chi tiết"'));
assert.ok(actionMenu.includes("handlers.onView(quote)"));
assert.ok(listPage.includes("navigate(`/quotes/${quote.id}`)"));

// Wide data stays inside the table-scoped horizontal scroll surface.
assert.ok(listPage.includes('data-quote-table-scroll="scoped"'));
assert.ok(listPage.includes('className="min-w-[1240px] w-full text-[11px]"'));
assert.ok(sharedTable.includes('overflow-x-auto'), "Shared Table must own the horizontal scroll surface");
assert.equal(listPage.includes('id="quote-list-page" className="relative overflow-x-auto"'), false);

// Floating menu ownership prevents table/card clipping and returns focus on close.
assert.ok(actionDropdown.includes("createPortal"));
assert.ok(actionDropdown.includes("document.body"));
assert.ok(actionDropdown.includes("openAbove"));
assert.ok(actionDropdown.includes('window.addEventListener("scroll", updatePosition, true)'));
assert.ok(actionDropdown.includes("anchorEl?.focus()"));
assert.ok(actionDropdown.includes('e.key === "Escape"'));

// Delete uses the shared confirmation dialog, never browser-native confirm.
assert.equal(listPage.includes("window.confirm"), false);
assert.equal(detailPage.includes("window.confirm"), false);
assert.ok(listPage.includes("<QuoteDeleteConfirmDialog"));
assert.ok(detailPage.includes("<QuoteDeleteConfirmDialog"));
assert.ok(deleteDialog.includes("<ConfirmDialog"));
assert.ok(deleteDialog.includes('variant="danger"'));

// Statistics appears once in the header; Settings remains in the toolbar; filter label is owner-driven.
assert.equal(count(listPage, "setIsStatsOpen(true)"), 1, "Quote page must expose one Statistics action");
assert.ok(listPage.includes("showStats={false}"));
assert.ok(listPage.includes("showColumns={true}"));
assert.ok(vi.includes('title: "Bộ lọc"'));
assert.ok(en.includes('title: "Filters"'));
assert.equal(vi.includes('title: "Bộ lọc báo giá"'), false);
assert.equal(filterPanels.includes(">DRAFT<"), false);
assert.ok(filterPanels.includes('t("quote.status.draft")'));

// Card information architecture and shared action/status contracts.
for (const cardContract of [
  'data-quote-card-grid="v1"',
  'data-quote-card="v1"',
  "{quote.quoteNumber} · v{quote.version}",
  "<QuoteStatusBadge status={quote.status}",
  "{quote.title}",
  "{quote.customerName",
  "{quote.dealName}",
  "{quote.validUntil || \"—\"}",
  "formatCurrency(quote.grandTotal, quote.currency || baseCurrency, locale)",
  "<ActionDropdownTrigger",
]) {
  assert.ok(listPage.includes(cardContract), `Quote Card must include ${cardContract}`);
}

// Builder keeps every business data region while using the shared page/form presentation family.
for (const builderContract of [
  'id="quote-builder-header"',
  "<PageHeader",
  "referencedDeal",
  "referencedCustomer",
  'id="referenced-deal-selector"',
  "quoteTitle",
  "quoteNumber",
  "quoteLines",
  "adjustments",
  "quoteNotes",
  "handleSaveQuote",
  "<QuoteBuilderPreview",
  'data-quote-builder-actions="v1"',
  'data-quote-approval-assessment="v1"',
  "recipientEmail",
  "paymentTiming",
  "handleSendGmail",
  "handleOpenDeliveryConfirmation",
  "handleExportPdf",
]) {
  assert.ok(builderPage.includes(builderContract), `Quote Builder must retain ${builderContract}`);
}
assert.ok(builderPage.includes("xl:grid-cols-12"));
assert.ok(builderPreview.includes('data-quote-live-preview="v1"'));
assert.ok(builderPreview.includes('data-quote-pdf-source="true"'));
assert.ok(builderPreview.includes('data-quote-builder-preview="full-width"'));
assert.ok(builderPage.includes('xl:col-span-12'), "Quote authoring and A4 preview must use full-width grid spans");
assert.ok(builderPreview.includes("onConfirmSent"), "Preview must expose a channel-neutral sent confirmation action");
assert.ok(builderPreview.includes("showPreviewLauncher"), "Shared quotation document must support a detail-owned preview trigger");
assert.ok(builderPreview.includes("onPreviewOpenChange"), "Shared quotation document preview must support controlled open state");
const pdfExportService = source("src/modules/quotes/presentation/services/quotePdfExport.ts");
const gmailDeliveryService = source("src/modules/quotes/presentation/services/quoteGmailDelivery.ts");
assert.ok(pdfExportService.includes('import("html2canvas")') && pdfExportService.includes('import("jspdf")'));
assert.ok(gmailDeliveryService.includes("navigator.share") && gmailDeliveryService.includes("mail.google.com/mail"));

// Opportunity and Quote Detail use the exact same component family, not copied class lookalikes.
assert.ok(detailHeader.includes('data-record-detail-header="v1"'));
assert.ok(dealDetail.includes("<RecordDetailHeader"));
assert.ok(detailPage.includes("<RecordDetailHeader"));
assert.ok(dealDetail.includes('id="deal-detail-header"'));
assert.ok(detailPage.includes('id="quote-detail-header"'));
assert.ok(detailPage.includes("resolveQuoteHeaderActionIds"));
assert.ok(detailPage.includes("recordDetailHeaderActionButtonClassName"));
assert.ok(detailPage.includes("recordDetailHeaderActionIconButtonClassName"));
assert.ok(detailPage.includes('data-quote-detail-preview-trigger="a4"'), "Quote Detail must expose a direct View quotation action");
assert.match(detailPage, /\bEye,/, "Quote Detail must import the preview icon used by the direct action");
assert.ok(detailPage.includes('showPreviewLauncher={false}'), "Quote Detail must reuse the canonical A4 document without duplicating the builder launcher");
assert.ok(detailPage.includes('previewOpen={isDocumentPreviewOpen}'), "Quote Detail must control the canonical A4 preview modal");
assert.ok(detailPage.includes('quoteLines={quote.lineItems ?? []}'), "Quote Detail preview must tolerate legacy Quotes without line items");
assert.equal(detailPage.includes('data-quote-detail-pdf-host={quote.id} className="pointer-events-none'), false, "The controlled Quote preview modal must not be nested under an invisible host");
assert.ok(detailHeaderContract.includes('recordDetailHeaderActionButtonClassName = "h-9 whitespace-nowrap rounded-xl"'));
assert.ok(detailHeaderContract.includes('recordDetailHeaderActionIconButtonClassName = "h-9 w-9 rounded-xl"'));

// Detail keeps quote-specific actions but derives their availability from the shared policy.
for (const actionId of ["edit", "request-approval", "approve", "request-changes", "send", "confirm-sent", "accept", "reject", "expire", "create-order", "revise", "duplicate", "export-pdf", "delete"]) {
  assert.ok(detailPage.includes(`case "${actionId}"`), `Quote Detail must retain ${actionId}`);
}
assert.ok(detailPage.includes("<RecordHeaderActionMenu"), "Quote Detail must consolidate secondary actions into the shared three-dot menu");
assert.ok(detailPage.includes("primaryHeaderActionId"), "Quote Detail must retain at most one visible primary header action");
const quoteAcceptanceWorkflow = source("src/workflows/quote-acceptance/index.ts");
assert.ok(detailPage.includes("acceptQuoteAndCloseDealCommand"), "Accepted Quote must use the canonical Quote acceptance workflow command");
assert.ok(quoteAcceptanceWorkflow.includes("closeDealWon"), "Quote acceptance workflow must retain Deal closing evidence behavior");
assert.ok(quoteAcceptanceWorkflow.includes("replaceQuotes") && quoteAcceptanceWorkflow.includes("replaceDeals"), "Demo Quote acceptance must retain transactional rollback evidence");
assert.ok(dealDetail.includes("QuoteApprovalStatus"), "Opportunity Quote actions must distinguish internal approval from customer status");
assert.ok(dealDetail.includes("action=gmail"), "Opportunity Quote actions must expose Gmail delivery");
assert.ok(dealDetail.includes("action=pdf"), "Opportunity Quote actions must expose PDF export");
assert.ok(dealDetail.includes("action=confirm"), "Opportunity Quote actions must expose channel-neutral delivery confirmation");

// Shared status presentation is used consistently and DRAFT remains compact.
assert.ok(statusBadge.includes("getQuoteStatusBadgeVariant(status)"));
assert.ok(statusBadge.includes('className={`whitespace-nowrap'));
assert.ok(listPage.includes("<QuoteStatusBadge status={quote.status}"));
assert.ok(detailPage.includes("<QuoteStatusBadge status={quote.status}"));
assert.ok(detailPage.includes("<QuoteApprovalBadge quote={quote}"));
assert.ok(vi.includes('quote: {\n    status: {\n      draft: "Nháp"'));
assert.equal(vi.includes('quote: {\n    status: {\n      draft: "Bản nháp"'), false);

// Detail body keeps the requested main + activity layout and readable data surfaces.
for (const detailContract of [
  'xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]',
  "Thông tin chung",
  "Liên kết kinh doanh",
  'data-quote-detail-line-items-scroll="scoped"',
  "timelineEvents.map",
  "break-words",
]) {
  assert.ok(detailPage.includes(detailContract), `Quote Detail must include ${detailContract}`);
}

console.log("Quote presentation contracts: OK");

function createQuote(
  status: QuoteStatus,
  approval: Partial<Pick<Quote, "approvalRequired" | "approvalStatus" | "approvalRequestedAt" | "validUntil" | "expiryDate">> = {},
): Pick<Quote, "status" | "approvalRequired" | "approvalStatus" | "approvalRequestedAt" | "validUntil" | "expiryDate"> {
  return { status, approvalRequired: false, ...approval };
}
