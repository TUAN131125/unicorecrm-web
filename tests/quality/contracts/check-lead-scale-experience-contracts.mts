import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import type { Lead } from "@/modules/leads/domain/model/lead.types";
import { LeadWorkState } from "@/modules/leads/domain/model/leadLifecycle.canonical";
import { buildLeadDuplicateIndex } from "@/modules/leads/application/queries/leadDuplicateIndex";
import { buildLeadQueueGroups } from "@/modules/leads/application/queries/leadQueueQueries";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

const read = (relativePath: string) => readPresentationComposition(path.resolve(relativePath), "utf8");

const leads: Lead[] = Array.from({ length: 10_000 }, (_, index) => ({
  id: `lead-${index}`,
  name: `Lead ${index}`,
  title: "",
  companyName: `Company ${index}`,
  email: index === 9_998 || index === 9_999 ? "duplicate@example.com" : `lead-${index}@example.com`,
  phone: index === 9_996 || index === 9_997 ? "+84 901 234 567" : `090${String(index).padStart(7, "0")}`,
  source: "Website",
  score: index % 100,
  leadWorkState: LeadWorkState.NEW,
  ownerId: `member-${index % 12}`,
  interestedProducts: [],
  createdAt: "2026-07-14T00:00:00.000Z",
  activities: [],
}));

const startedAt = performance.now();
const duplicateIndex = buildLeadDuplicateIndex(leads);
const queueGroups = buildLeadQueueGroups(leads);
const elapsedMs = performance.now() - startedAt;

assert.equal(duplicateIndex.duplicateLeadIds.size, 4);
for (const id of ["lead-9996", "lead-9997", "lead-9998", "lead-9999"]) {
  assert.equal(duplicateIndex.duplicateLeadIds.has(id), true, `${id} must be indexed as a duplicate.`);
}
assert.equal(queueGroups.duplicate.length, 4);
assert.ok(elapsedMs < 500, `Lead duplicate grouping must remain linear enough for 10k records; measured ${elapsedMs.toFixed(1)}ms.`);

const leadUiFiles = [
  "src/components/LeadForm.tsx",
  "src/modules/leads/presentation/components/LeadTable.tsx",
  "src/modules/leads/presentation/components/LeadMobileCardList.tsx",
  "src/modules/leads/presentation/components/LeadKanbanBoard.tsx",
  "src/modules/leads/presentation/components/LeadFilterPopover.tsx",
  "src/modules/leads/presentation/pages/LeadDetailPage.tsx",
];
for (const relativePath of leadUiFiles) {
  const source = read(relativePath);
  for (const forbidden of ["MOCK_USERS", "MOCK_PRODUCTS", "MOCK_LEAD_SOURCES", "MOCK_LEAD_CAMPAIGNS"]) {
    assert.equal(source.includes(forbidden), false, `${relativePath} must not use ${forbidden}.`);
  }
}

const leadListPage = read("src/modules/leads/presentation/pages/LeadListPage.tsx");
for (const marker of [
  "useLeadReferenceData",
  "useLeadPagination",
  "<LeadListResults",
  "React.lazy",
  "Opened the device dialer",
]) {
  assert.ok(leadListPage.includes(marker), `Lead list scale/experience contract missing: ${marker}`);
}
for (const removedAction of ["update-address", "manage-share", "trash-bin", "AI Standardizing addresses", "Opening share options"]) {
  assert.equal(leadListPage.includes(removedAction), false, `Lead list must not expose placeholder action: ${removedAction}`);
}

const detailPage = read("src/modules/leads/presentation/pages/LeadDetailPage.tsx");
for (const marker of ["<LeadDetailMoreMenu", "React.lazy", "Email activity logged", "SMS activity logged"]) {
  assert.ok(detailPage.includes(marker), `Lead detail experience contract missing: ${marker}`);
}
for (const fakePhrase of ["virtual VoIP", "Đã lập lịch giả lập", "Cloning this Lead", "Exporting full lead profile", "Opening custom summary layout"]) {
  assert.equal(detailPage.includes(fakePhrase), false, `Lead detail must not claim an unavailable operation: ${fakePhrase}`);
}

const filterPopover = read("src/modules/leads/presentation/components/LeadFilterPopover.tsx");
const sharedFilterPopover = read("src/components/crm/list-archetype/ListFilterPopover.tsx");
assert.equal(filterPopover.includes("<Drawer"), false, "Lead filters must not return to the oversized side Drawer.");
for (const marker of ["<ListFilterPopover", "<ListFilterGrid", 'label={locale === "vi" ? "Sắp xếp" : "Sort"}']) {
  assert.ok(filterPopover.includes(marker), `Lead filter model missing: ${marker}`);
}
for (const marker of ['role="dialog"', "absolute inset-x-0", "sm:grid-cols-2", "xl:grid-cols-4"]) {
  assert.ok(sharedFilterPopover.includes(marker), `Shared responsive filter popover missing: ${marker}`);
}
assert.ok(filterPopover.includes("owners.map"), "Lead filters must consume runtime owner options.");
assert.ok(filterPopover.includes("sources.map"), "Lead filters must consume runtime source options.");

const referenceData = read("src/modules/leads/presentation/hooks/useLeadReferenceData.ts");
for (const marker of ["getProductCatalogSnapshot", "listWorkspaceMemberDirectoryFor", "Owner information unavailable"]) {
  assert.ok(referenceData.includes(marker), `Lead reference data contract missing: ${marker}`);
}
assert.equal(referenceData.includes("Member not found (${memberId})"), false, "Lead owner fallbacks must not expose raw member IDs.");

const leadRepositoryCommands = read("src/modules/leads/application/commands/leadRepositoryCommands.ts");
assert.ok(leadRepositoryCommands.includes('isBackendProjectionActive("leads")'), "Authoritative Lead reads must bypass local business-mutation semantics.");

for (const marker of ["getRetainedLeadsSnapshot", "replaceLeads([...byId.values()])", "void leadQuery.refresh()"] ) {
  assert.ok(leadListPage.includes(marker), `Lead List/Kanban reconciliation contract missing: ${marker}`);
}

for (const marker of [
  "isLeadOperationAvailable(LEAD_OPERATION.ARCHIVE)",
  "canArchiveLeadBatch",
  "<LeadArchiveConfirmationModal",
  "archiveSubmittingRef.current",
  "await leadActions.archive(dialogs.leadToDelete, reason)",
  "await leadActions.archiveMany(selection.selectedLeadIds, reason)",
]) {
  assert.ok(leadListPage.includes(marker), `Lead archive action contract missing: ${marker}`);
}
assert.ok(leadListPage.includes("canDisqualifyLeadBatch &&"), "Unsupported connected bulk actions must be hidden by operation availability.");

const connectedRuntime = read("src/modules/leads/infrastructure/http/createLeadConnectedApiRuntime.ts");
assert.ok(connectedRuntime.includes("adapter.archiveLead(leadId, input, options)"), "Connected archive must call the generated HTTP adapter.");
assert.ok(connectedRuntime.includes("adapter.archiveLeadBatch(input, options)"), "Connected bulk archive must call the generated HTTP adapter once.");
assert.ok(connectedRuntime.includes("declareUnavailableBusinessOperation(operationId)"), "Connected unavailable operations must be declared before presentation evaluates permission.");

const archiveModal = read("src/modules/leads/presentation/components/LeadArchiveConfirmationModal.tsx");
for (const marker of ["Lý do lưu trữ *", "selectedCount", "pending || !reason.trim()", "Hồ sơ và lịch sử vẫn được giữ lại"]) {
  assert.ok(archiveModal.includes(marker), `Bulk Archive modal contract missing: ${marker}`);
}
const disqualifyModal = read("src/modules/leads/presentation/components/LeadDisqualifyModal.tsx");
for (const marker of ["Xác nhận Lead không phù hợp", "submittingRef.current", "disabled={pending", "Promise<boolean>"]) {
  assert.ok(disqualifyModal.includes(marker), `Disqualify modal lifecycle contract missing: ${marker}`);
}
assert.ok(leadRepositoryCommands.includes('isBackendProjectionActive("leads")'), "Committed Lead projection must bypass local command and lifecycle guards.");

const rowMenu = read("src/modules/leads/presentation/components/LeadActionMenu.tsx");
const detailMenu = read("src/modules/leads/presentation/components/LeadDetailMoreMenu.tsx");
for (const menu of [rowMenu, detailMenu]) {
  assert.ok(menu.includes("Lưu trữ Lead"), "Lead menus must use soft-archive terminology.");
}
assert.ok(detailMenu.includes("canManageTags") && detailMenu.includes("canQualify"), "Detail actions must combine operation, authorization and lifecycle checks.");

const detailController = read("src/modules/leads/presentation/hooks/useLeadDetailController.tsx");
const detailFields = read("src/modules/leads/presentation/detail/buildLeadDetailFields.tsx");
const detailView = read("src/modules/leads/presentation/views/LeadDetailView.tsx");
for (const marker of ["authoritativeLead?.id === leadId", "archiveReason, setArchiveReason", "!lead?.archivedAt"]) {
  assert.ok(detailController.includes(marker), `Archived Lead detail controller contract missing: ${marker}`);
}
assert.ok(detailPage.includes("authoritativeLead: detailQuery.data"), "Archived Lead detail must render from the authoritative GET-by-id result instead of the active-list projection.");
for (const marker of ['id: "archivedAt"', 'id: "archiveReason"']) {
  assert.ok(detailFields.includes(marker), `Archived Lead detail metadata missing: ${marker}`);
}
for (const marker of ["lead.archivedAt &&", "canEdit && ownership?.memberId", "lead.leadWorkState === LeadWorkState.VERIFYING ? canQualify : canEdit"]) {
  assert.ok(detailView.includes(marker), `Archived Lead detail action guard missing: ${marker}`);
}

const rowActionPortal = read("src/shared/components/ui/Dialog.tsx");
for (const marker of ["createPortal", "openAbove", "window.innerWidth", "closeAndRestoreFocus", 'addEventListener("scroll"']) {
  assert.ok(rowActionPortal.includes(marker), `Dropdown portal behavior missing: ${marker}`);
}

const serverPaging = read("src/shared/operations/useServerPagedCollection.ts");
assert.ok(serverPaging.includes("page > authoritativePageCount"), "Archiving the last record on a page must return to a valid authoritative page.");

const tagModal = read("src/modules/leads/presentation/components/LeadManageTagsModal.tsx");
assert.ok(tagModal.includes("onApply"), "Bulk tag modal must commit through a real callback.");
assert.equal(tagModal.includes("VIP khách hàng"), false, "Bulk tag modal must not display fixture tags.");

const pagination = read("src/modules/leads/presentation/hooks/useLeadPagination.ts");
for (const marker of ["LEAD_PAGE_SIZE_OPTIONS", "pageItems", "rangeStart", "rangeEnd"]) {
  assert.ok(pagination.includes(marker), `Lead pagination contract missing: ${marker}`);
}

for (const relativePath of [
  "src/modules/leads/presentation/components/LeadTable.tsx",
  "src/modules/leads/presentation/components/LeadMobileCardList.tsx",
  "src/modules/leads/presentation/components/LeadKanbanBoard.tsx",
]) {
  const source = read(relativePath);
  assert.ok(source.includes("contentVisibility"), `${relativePath} must defer off-screen rendering.`);
  assert.ok(source.includes("containIntrinsicSize"), `${relativePath} must reserve off-screen layout space.`);
}

const e2e = read("tests/e2e/lead-scale-experience.spec.ts");
for (const marker of [
  "Lead list exposes accessible pagination and responsive filter popover",
  "Lead list remains usable at a mobile viewport",
  "Lead create modal accepts continuous typing",
  "AxeBuilder",
  "document.documentElement.scrollWidth",
]) {
  assert.ok(e2e.includes(marker), `Lead browser regression contract missing: ${marker}`);
}

console.log(`Lead scale and experience contracts: PASS (${elapsedMs.toFixed(1)}ms for 10k records)`);
