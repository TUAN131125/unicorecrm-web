// @ts-nocheck -- Cross-surface browser-like interaction contract.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

const read = (relativePath: string) => readPresentationComposition(path.resolve(relativePath), "utf8");

function verifyExistingSourceContracts() {
const overlay = read("src/shared/components/ui/useAccessibleOverlay.ts");
assert.ok(overlay.includes("const onCloseRef = React.useRef(onClose)"), "Overlay close callbacks must be stored in a stable ref.");
assert.ok(overlay.includes("onCloseRef.current = onClose"), "Overlay close ref must track the latest callback.");
assert.match(overlay, /React\.useEffect\(\(\) => \{[\s\S]*?if \(!isOpen[\s\S]*?\}, \[isOpen\]\);/, "Overlay lifecycle must only restart when open state changes.");
assert.equal(/\}, \[isOpen,\s*onClose\]\);/.test(overlay), false, "Typing must not restart an overlay because an inline onClose callback changed identity.");

const leadList = read("src/modules/leads/presentation/pages/LeadListPage.tsx");
assert.equal(leadList.includes("<OwnershipScopeSelector"), false, "Lead toolbar must not duplicate saved-view ownership scopes.");
for (const marker of [
  "filtersPanel={(\n          <LeadFilterPopover",
  'columnsLabel={locale === "vi" ? "Cột" : "Columns"}',
  'footer={<div id="lead-create-modal-footer" className="contents" />}',
  'footerPortalId="lead-create-modal-footer"',
  'data-guidance-id="leads.list.saved-view"',
  "sort={filters.sort}",
  "setSort={filters.setSort}",
]) assert.ok(leadList.includes(marker), `Lead list UI contract missing ${marker}`);
assert.equal(leadList.includes('"Mới tạo gần nhất"'), false, "Lead sort must live inside the table-width filter panel, not as an external toolbar control.");

const filterPopover = read("src/components/crm/list-archetype/ListFilterPopover.tsx");
assert.equal(filterPopover.includes("<Drawer"), false, "Canonical CRM filters must use a responsive toolbar dropdown, not a right-side drawer.");
for (const marker of [
  'role="dialog"',
  "absolute inset-x-0",
  "grid-cols-1",
  "sm:grid-cols-2",
  "xl:grid-cols-4",
  "max-h-[min(660px,calc(100vh-10rem))]",
  'data-list-filter-popover="v1"',
]) assert.ok(filterPopover.includes(marker), `Canonical filter popover missing ${marker}`);

const leadFilter = read("src/modules/leads/presentation/components/LeadFilterPopover.tsx");
for (const marker of [
  '<ListFilterPopover',
  'label={locale === "vi" ? "Sắp xếp" : "Sort"}',
  '"Mới tạo gần nhất"',
  'tx("common.done"',
  "owners.map",
  "sources.map",
]) assert.ok(leadFilter.includes(marker), `Lead filter model missing ${marker}`);
assert.equal(leadFilter.includes("leads.filterPanel.reset"), false, "Lead filter actions must not expose unresolved translation keys.");

const controlBar = read("src/components/crm/ListControlBar.tsx");
for (const marker of [
  "xl:grid-cols-[minmax(0,1fr)_auto]",
  "sm:flex-wrap",
  "filterPopoverRef",
  "ref={filterPopoverRef}",
  "filtersOpen && filtersPanel",
  'tx("common.clearSearch"',
  'tx("common.viewToggle"',
  "controlsPrefix",
  "compactControls",
  "controlsClassName",
]) assert.ok(controlBar.includes(marker), `List toolbar overlap/i18n contract missing ${marker}`);
assert.equal(controlBar.includes("{activeFilterCount}"), false, "Shared filter triggers must use active styling without a numeric badge.");

const dealList = read("src/modules/deals/presentation/pages/DealPipelinePage.tsx");
assert.ok(dealList.includes("<ListToolbar") && dealList.includes("<ListFilterPopover"), "Opportunity filters must reuse the Lead list toolbar dropdown.");
assert.ok(dealList.includes("controlsPrefix={") && dealList.includes("compactControls"), "Opportunity record scope and compact actions must share the main list toolbar.");
assert.equal(dealList.includes("fixed right-0 top-0 bottom-0"), false, "Opportunity filters must not use a right-side panel.");
const productList = read("src/modules/products/presentation/pages/ProductListPage.tsx");
assert.equal(productList.includes("`${activeFiltersCount} bộ lọc`"), false, "Product list must not render a redundant filter-count chip.");

const savedViews = read("src/modules/leads/presentation/components/LeadSavedViewSelector.tsx");
for (const marker of ["max-w-[220px]", "crm-text-wrap"]) {
  assert.ok(savedViews.includes(marker), `Saved-view responsive contract missing ${marker}`);
}

const leadTableHook = read("src/modules/leads/presentation/hooks/useLeadTable.ts");
for (const marker of [
  "const handleSaveColumns = useCallback((columns: readonly ColumnKeyType[])",
  "const resolved = applyVisibleColumns(columns)",
  "setLeadPreference(COLUMN_PREFERENCE_KEY, next.visibleColumns)",
  "removeLeadPreference(COLUMN_PREFERENCE_KEY)",
  "resolveEffectiveView({",
]) assert.ok(leadTableHook.includes(marker), `Lead column-application contract missing ${marker}`);
const leadPublicPreferences = read("src/modules/leads/public/leads.ts");
for (const marker of [
  "export function setLeadPreference",
  "leadPreferences.set(key, value)",
  "export function removeLeadPreference",
  "leadPreferences.remove(key)",
]) assert.ok(leadPublicPreferences.includes(marker), `Lead public preference boundary missing ${marker}`);

const columnDrawer = read("src/components/crm/ColumnSettingsDrawer.tsx");
assert.ok(columnDrawer.includes("onSave(tempColumns)"), "Column drawer must submit its edited selection to the consumer.");

const leadForm = read("src/components/LeadForm.tsx");
for (const obsoleteHelper of [
  'tf("progressive.quickDescription")',
  'tf("progressive.completeDescription")',
  'tf("zaloSyncHelper")',
  'tf("systemInfoNote")',
]) assert.equal(leadForm.includes(obsoleteHelper), false, `Lead form must not render layout-shifting helper copy: ${obsoleteHelper}`);
const dealModals = read("src/modules/deals/presentation/components/DealPipelineModals.tsx");
for (const obsoleteHelper of ["deals.quickCreate.ownerAssignable", "deals.quickCreate.ownerCurrent", "Changing the owner requires a handover reason."]) {
  assert.equal(dealModals.includes(obsoleteHelper), false, `Deal forms must not retain duplicated owner instruction copy: ${obsoleteHelper}`);
}
const fieldHelp = read("src/guidance/presentation/FieldHelp.tsx");
assert.ok(fieldHelp.includes("onClick={() => guidance.openFieldHelp(helpKey)}"), "Form guidance icons must open the requested guidance directly.");

const searchableSelect = read("src/shared/components/ui/SearchableSelect.tsx");
for (const marker of [
  'tx("common.selectPlaceholder"',
  'tx("common.searchPlaceholder"',
  'tx("common.noMatchingResult"',
  'tx("common.clearSearch"',
]) assert.ok(searchableSelect.includes(marker), `Shared searchable-select i18n contract missing ${marker}`);
const sharedFields = read("src/shared/components/ui/Input.tsx");
for (const marker of [
  'tx("common.searchFieldPlaceholder"',
  'tx("common.noMatchingResult"',
  "hasExplicitControlHeight",
  'compactHeight ? "py-0" : "py-2.5"',
  "leading-5",
]) assert.ok(sharedFields.includes(marker), `Shared field clipping/i18n protection missing ${marker}`);

const formCss = read("src/index.css");
assert.equal(formCss.includes("2.625rem"), false, "Legacy form-control height must not compete with the single sizing contract.");
assert.equal(formCss.includes("padding-inline: 1rem"), false, "Scoped form CSS must not override component-owned horizontal padding.");
assert.ok(formCss.includes("A single scoped layer owns control"), "Form CSS must document and retain the consolidated dimension layer.");

const leadDetail = read("src/modules/leads/presentation/pages/LeadDetailPage.tsx");
assert.ok(leadDetail.includes("useLeadDetailController"), "Lead detail route must delegate behavior to its controller.");
assert.ok(leadDetail.includes("<LeadDetailView controller={controller}"), "Lead detail route must delegate rendering to its view.");

const leadDetailView = read("src/modules/leads/presentation/views/LeadDetailView.tsx");
for (const marker of [
  '<IconButton\n              id="back-to-leads-btn"',
  '"Đã liên hệ"',
  '"Đạt chất lượng"',
  '"Chốt kết quả"',
  "RecordTabTransition",
  'motionId="lead-primary-tabs"',
]) assert.ok(leadDetailView.includes(marker), `Lead detail view/motion contract missing ${marker}`);
assert.equal(leadDetailView.includes("setShowQualifyModal"), false, "Lead quality transition must not open a redundant confirmation form.");
assert.equal(leadDetailView.includes("motion.main"), false, "Lead tab content must not combine Organization-style transition with a layout-animated main element.");

const leadDetailController = read("src/modules/leads/presentation/hooks/useLeadDetailController.tsx");
for (const marker of [
  "handleConfirmHandover",
  "taskTargets",
  "handover.submit",
  "createTaskCommand",
]) assert.ok(leadDetailController.includes(marker), `Lead detail workflow contract missing ${marker}`);
assert.equal(leadDetailController.includes("reassignTaskSnapshot"), false, "Lead handover must not reassign tasks through the local snapshot boundary.");

const detailModals = read("src/modules/leads/presentation/components/LeadDetailModals.tsx");
assert.equal(detailModals.includes("Xác nhận Lead đạt chất lượng"), false, "The redundant qualify confirmation dialog must stay removed.");
for (const marker of [
  'title={locale === "vi" ? "Bàn giao Lead & công việc"',
  "handleConfirmHandover(handoverOwnerId, handoverReason.trim(), handoverOpenTaskPolicy)",
  'className="h-11 min-w-20"',
]) assert.ok(detailModals.includes(marker), `Lead modal alignment/work integration contract missing ${marker}`);

for (const relativePath of [
  "src/modules/leads/presentation/components/LeadDetailModals.tsx",
  "src/modules/leads/presentation/components/LeadManageTagsModal.tsx",
  "src/modules/contacts/presentation/detail/ContactEditModal.tsx",
]) {
  const source = read(relativePath);
  assert.equal(/crm-form-action-bar[^\n"]*border-t(?=[\s"])(?![^\n"]*border-(?:slate|gray|zinc|neutral|rose|red|amber|emerald|indigo|violet|blue))/.test(source), false, `${relativePath} must not render a default dark divider.`);
}

const leadPagination = read("src/modules/leads/presentation/components/LeadPaginationBar.tsx");
for (const marker of ["h-10 min-w-[118px]", "flex-wrap", "h-10 w-10 shrink-0"]) {
  assert.ok(leadPagination.includes(marker), `Lead pagination clipping contract missing ${marker}`);
}

const sharedPagination = read("src/components/crm/list-archetype/ListPaginationBar.tsx");
for (const marker of [
  'data-list-pagination="canonical"',
  "LIST_PAGE_SIZE_OPTIONS",
  "h-10 min-w-[118px]",
  "h-10 w-10 shrink-0",
  "sm:flex-row",
]) assert.ok(sharedPagination.includes(marker), `Shared list pagination contract missing ${marker}`);
const sharedPaginationHook = read("src/components/crm/list-archetype/useListPagination.ts");
for (const marker of [
  "export const LIST_PAGE_SIZE_OPTIONS = [25, 50, 100] as const",
  "const pageCount = Math.max(1, Math.ceil(items.length / pageSize))",
  "return items.slice(start, start + pageSize)",
  "setPage(1)",
]) assert.ok(sharedPaginationHook.includes(marker), `Shared list pagination state contract missing ${marker}`);

for (const relativePath of [
  "src/modules/customers/presentation/pages/CustomerListPage.tsx",
  "src/modules/contacts/presentation/views/ContactListView.tsx",
  "src/modules/organizations/presentation/pages/OrganizationAccountListPage.tsx",
  "src/modules/orders/presentation/views/OrderListView.tsx",
  "src/modules/invoices/presentation/pages/InvoiceListPage.tsx",
  "src/modules/invoices/presentation/pages/ReceivablesPage.tsx",
  "src/modules/payments/presentation/pages/PaymentOperationsPage.tsx",
  "src/modules/quotes/presentation/pages/QuoteListPage.tsx",
  "src/modules/returns/presentation/pages/ReturnListPage.tsx",
  "src/modules/shipping/presentation/pages/ShippingBookingListPage.tsx",
  "src/modules/support/presentation/pages/SupportCaseListPage.tsx",
  "src/modules/tasks/presentation/pages/TaskListPage.tsx",
]) {
  const source = read(relativePath);
  assert.ok(source.includes("useListPagination"), `${relativePath} must paginate filtered records through the shared list state.`);
  assert.ok(source.includes("ListPaginationBar"), `${relativePath} must render the canonical responsive pagination bar.`);
  assert.ok(source.includes(".pageItems"), `${relativePath} must render the active page instead of the full filtered collection.`);
}

for (const relativePath of [
  "src/modules/leads/presentation/pages/LeadDetailPage.tsx",
  "src/modules/contacts/presentation/pages/ContactDetailPage.tsx",
  "src/modules/customers/presentation/pages/Customer360Page.tsx",
]) {
  const source = read(relativePath);
  assert.ok(source.includes("RecordTabTransition"), `${relativePath} must use the Organization-detail tab content transition.`);
  assert.ok(source.includes("transitionKey={activeTab}"), `${relativePath} must key the single transition by active tab.`);
  assert.equal(source.includes("motion.main"), false, `${relativePath} must not run a competing layout animation on the main tab container.`);
}

}

// Run browser-like regressions in a fresh process: the gate preloads composition,
// which otherwise imports React DOM before JSDOM installs browser globals.
if (!process.argv.includes("--contact-runtime-only")) {
  const runtime = spawnSync(process.execPath, ["--import", "tsx", fileURLToPath(import.meta.url), "--contact-runtime-only"], { encoding: "utf8" });
  process.stdout.write(runtime.stdout);
  process.stderr.write(runtime.stderr);
  assert.equal(runtime.status, 0, "Contact interaction runtime regression failed.");
  verifyExistingSourceContracts();
} else {
// Runtime regression: a controlled field inside a Modal whose parent creates a new
// onClose callback every render must retain focus and accept continuous typing.
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: "http://localhost/",
  pretendToBeVisual: true,
});
const { window } = dom;
class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
Object.defineProperties(globalThis, {
  window: { value: window, configurable: true },
  document: { value: window.document, configurable: true },
  navigator: { value: window.navigator, configurable: true },
  localStorage: { value: window.localStorage, configurable: true },
  HTMLElement: { value: window.HTMLElement, configurable: true },
  HTMLInputElement: { value: window.HTMLInputElement, configurable: true },
  Element: { value: window.Element, configurable: true },
  Node: { value: window.Node, configurable: true },
  Event: { value: window.Event, configurable: true },
  InputEvent: { value: window.InputEvent, configurable: true },
  KeyboardEvent: { value: window.KeyboardEvent, configurable: true },
  MutationObserver: { value: window.MutationObserver, configurable: true },
  ResizeObserver: { value: ResizeObserverStub, configurable: true },
  getComputedStyle: { value: window.getComputedStyle.bind(window), configurable: true },
  requestAnimationFrame: { value: window.requestAnimationFrame.bind(window), configurable: true },
  cancelAnimationFrame: { value: window.cancelAnimationFrame.bind(window), configurable: true },
  IS_REACT_ACT_ENVIRONMENT: { value: true, configurable: true },
});
Object.defineProperty(window, "matchMedia", {
  configurable: true,
  value: () => ({
    matches: true,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; },
  }),
});
Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", { value: () => undefined, configurable: true });

const React = await import("react");
const { act } = React;
const { createRoot } = await import("react-dom/client");
const { I18nProvider } = await import("../../../src/i18n/index.tsx");
const { Modal } = await import("../../../src/shared/components/ui/Dialog.tsx");
const { Input } = await import("../../../src/shared/components/ui/Input.tsx");

function Harness() {
  const [value, setValue] = React.useState("");
  const [open, setOpen] = React.useState(true);
  return React.createElement(I18nProvider, null,
    React.createElement(Modal, {
      isOpen: open,
      onClose: () => setOpen(false),
      title: "Typing focus regression",
    }, React.createElement(Input, {
      id: "continuous-typing-field",
      label: "Name",
      value,
      onChange: (event) => setValue(event.target.value),
    })),
  );
}

const rootNode = window.document.getElementById("root");
assert.ok(rootNode);
const root = createRoot(rootNode);
await act(async () => { root.render(React.createElement(Harness)); });
const input = window.document.getElementById("continuous-typing-field");
assert.ok(input instanceof window.HTMLInputElement);
input.focus();
const setNativeValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
assert.ok(setNativeValue);
for (const next of ["N", "Ng", "Ngu", "Nguy", "Nguyen"]) {
  await act(async () => {
    setNativeValue.call(input, next);
    input.dispatchEvent(new window.InputEvent("input", { bubbles: true, inputType: "insertText", data: next.at(-1) || null }));
  });
  assert.equal(window.document.activeElement, input, `Input lost focus while typing ${next}.`);
}
assert.equal(input.value, "Nguyen");

// Repository-local workspace fixture also works when the pipeline preloads composition before JSDOM.
const workspace = await import("@/platform/workspace-context");
const { listAllDevelopmentMemberships } = await import("@/platform/workspace-membership");
const member = listAllDevelopmentMemberships().find((item) => item.accountId === "acct_admin");
assert.ok(member);
workspace.resetWorkspaceRuntimeParticipant();
workspace.configureConnectedWorkspaceBootstrapGateway({
  listMyWorkspaces: async () => [member],
  ensureInitialWorkspace: async () => "EXISTING_MEMBERSHIP",
  getWorkspaceBootstrap: async () => ({ workspace: member, contextVersion: 1, capabilities: [],
    configuration: { configurationVersion: 1, locale: "vi", timeZone: "Asia/Ho_Chi_Minh", baseCurrency: "VND", enabledModuleKeys: ["contacts"], availableProductSpaces: ["crm"] }, resolvedAt: "2026-01-01T00:00:00Z" }),
});
await workspace.loadWorkspaceMemberships();
await workspace.enterWorkspace(member.workspaceId);
const { ContactFormModal } = await import("../../../src/modules/contacts/presentation/components/ContactFormModal.tsx");
const { ContactMeetingModal } = await import("../../../src/modules/contacts/presentation/detail/actions/ContactMeetingModal.tsx");
let closes = 0;
let submissions = 0;
let rejectSubmit;
const fixtureContact = { id: "contact-safety-fixture", name: "Original", fullName: "Original", ownerId: "", status: "active", tags: [] };
const mountEdit = async (submit = async () => {}) => {
  await act(async () => root.render(React.createElement(I18nProvider, null, React.createElement(ContactFormModal, {
    key: String(closes), mode: "edit", guardChanges: true, contact: fixtureContact,
    isOpen: true, onClose: () => { closes++; }, onSubmit: submit,
  }))));
};
const escape = async () => { await act(async () => window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }))); };
const clickText = async (pattern) => {
  const button = [...window.document.querySelectorAll("button")].find((node) => pattern.test(node.textContent));
  assert.ok(button, String(pattern));
  await act(async () => button.click());
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 300)); });
};
const changeName = async (value) => {
  const field = window.document.getElementById("contact-edit-name");
  await act(async () => { setNativeValue.call(field, value); field.dispatchEvent(new window.Event("input", { bubbles: true })); });
};
await mountEdit();
await escape();
assert.equal(closes, 1, "Pristine edit closes without discard.");
assert.equal(window.document.querySelectorAll('[role="dialog"]').length, 1);
await mountEdit();
await changeName("Edited name");
await escape();
assert.equal(closes, 1);
assert.equal(window.document.querySelectorAll('[role="dialog"]').length, 2);
await clickText(/Tiếp tục chỉnh sửa|Keep editing/u);
assert.equal(window.document.querySelectorAll('[role="dialog"]').length, 1);
assert.equal(window.document.getElementById("contact-edit-name").value, "Edited name");
await escape();
await clickText(/^Bỏ thay đổi$|^Discard changes$/u);
assert.equal(closes, 2);
await mountEdit(() => { submissions++; return new Promise((_resolve, reject) => { rejectSubmit = reject; }); });
await changeName("Pending edit");
const form = window.document.getElementById("contact-edit-form");
await act(async () => { form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
await escape();
await act(async () => { form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
assert.equal(closes, 2);
assert.equal(submissions, 1);
assert.equal(window.document.querySelectorAll('[role="dialog"]').length, 1);
await act(async () => { rejectSubmit({ code: "VALIDATION_FAILED", category: "validation", fieldErrors: { fullName: ["Check name"] } }); });
assert.equal(window.document.getElementById("contact-edit-name").value, "Pending edit");
assert.ok(window.document.querySelector('[role="alert"]'));
assert.ok(window.document.body.textContent.includes("Check name"));
assert.equal(window.document.querySelector('button[type="submit"]').disabled, false);
await escape();
assert.equal(window.document.querySelectorAll('[role="dialog"]').length, 2, "Failure keeps edit dirty.");
await clickText(/Tiếp tục chỉnh sửa|Keep editing/u);
await act(async () => root.render(React.createElement(I18nProvider, null, React.createElement(ContactMeetingModal, {
  isOpen: true, onClose: () => { closes++; },
  onSave: async () => { throw { code: "VALIDATION_FAILED", category: "validation" }; },
}))));
const meetingTitle = window.document.querySelector('form input');
await act(async () => { setNativeValue.call(meetingTitle, "Meeting draft"); meetingTitle.dispatchEvent(new window.Event("input", { bubbles: true })); });
await act(async () => window.document.getElementById("contact-meeting-form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })));
assert.ok(window.document.querySelector('[role="alert"]'), "Meeting async rejection must reach canonical shell.");
assert.equal(meetingTitle.value, "Meeting draft");
assert.equal(closes, 2);
console.log("Contact Edit safety and actual Meeting Promise rejection: PASS");
// A2A exercises real presentation components with deferred commands; no business writes.
const { NoteActivityCreateModal } = await import("../../../src/modules/tasks/presentation/components/ActivityCreateModals.tsx");
const { LeadDetailModals } = await import("../../../src/modules/leads/presentation/components/LeadDetailModals.tsx");
const setField = async (field, value) => {
  const prototype = field instanceof window.HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value").set.call(field, value);
    field.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
};
let noteCloses = 0;
let noteCalls = 0;
let rejectNote;
const mountNote = async (key, onSubmit = async () => {}) => {
  await act(async () => root.render(React.createElement(I18nProvider, null, React.createElement(NoteActivityCreateModal, {
    key, guardChanges: true, isOpen: true, onClose: () => { noteCloses++; }, onSubmit,
    defaults: { title: "Opening note", body: "Opening body" },
  }))));
};
await mountNote("pristine");
await escape();
assert.equal(noteCloses, 1);
await mountNote("dirty", () => { noteCalls++; return new Promise((_resolve, reject) => { rejectNote = reject; }); });
await setField(window.document.querySelector('form input'), "Edited note");
await escape();
assert.equal(noteCloses, 1);
assert.equal(window.document.querySelectorAll('[role="dialog"]').length, 2);
await clickText(/Tiếp tục chỉnh sửa|Keep editing/u);
assert.equal(window.document.querySelector('form input').value, "Edited note");
const noteForm = window.document.getElementById("canonical-note-activity-form");
await act(async () => noteForm.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })));
await escape();
await act(async () => noteForm.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })));
assert.equal(noteCalls, 1);
assert.equal(noteCloses, 1);
assert.equal(window.document.querySelectorAll('[role="dialog"]').length, 1);
await act(async () => rejectNote({ code: "VALIDATION_FAILED", category: "validation" }));
assert.ok(window.document.querySelector('[role="alert"]'));
assert.equal(window.document.querySelector('form input').value, "Edited note");
assert.equal(window.document.querySelector('button[type="submit"]').disabled, false);
await escape();
await clickText(/^Bỏ thay đổi$|^Discard changes$/u);
assert.equal(noteCloses, 2);
console.log("A2A Note runtime N1-N5: PASS");

let disqualifyCloses = 0;
let disqualifyCalls = 0;
let resolveDisqualify;
let rejectDisqualify;
const noop = () => {};
function DisqualifyHarness() {
  const [open, setOpen] = React.useState(true);
  const [category, setCategory] = React.useState("Không có ngân sách");
  const [reason, setReason] = React.useState("Opening reason");
  const close = (value) => { if (!value) disqualifyCloses++; setOpen(value); };
  const dialogs = {
    showDisqualifyModal: open, setShowDisqualifyModal: close,
    disqualifyCategory: category, setDisqualifyCategory: setCategory,
    disqualifyReasonText: reason, setDisqualifyReasonText: setReason,
    callForm: {}, meetingForm: { location: "" }, emailForm: {}, smsForm: {},
    handoverOwnerId: "", handoverReason: "",
  };
  for (const name of ["Edit", "ArchiveConfirm", "Handover", "Tags", "Call", "Task", "Meeting", "Email", "Sms"]) {
    dialogs[`show${name}${name === "ArchiveConfirm" ? "" : "Modal"}`] = false;
    dialogs[`setShow${name}${name === "ArchiveConfirm" ? "" : "Modal"}`] = noop;
  }
  return React.createElement(I18nProvider, null,
    React.createElement("button", { onClick: () => setOpen(true) }, "Reopen fixture"),
    React.createElement("output", { id: "disqualify-fixture-state" }, JSON.stringify({ open, category, reason })),
    React.createElement(LeadDetailModals, { screen: {
      dialogs, lead: { id: "lead-safety-fixture", name: "Fixture", tags: [] }, locale: "vi", t: (key) => key,
      sources: [], campaigns: [], products: [], members: [], handoverMembers: [],
      showToast: noop, navigate: noop, leadActions: {}, archiveListPath: "/leads", canHandover: false,
      handover: { isAmbiguousRetry: () => false }, handleConfirmHandover: noop,
      handleSaveEditFromForm: noop, handleSavePhoneCall: noop, handleSaveMeeting: noop,
      handleLogExternalEmail: noop, handleLogExternalSms: noop,
      handleConfirmDisqualify: async () => {
        disqualifyCalls++;
        await new Promise((resolve, reject) => { resolveDisqualify = resolve; rejectDisqualify = reject; });
        close(false); setReason("");
      },
    } }),
  );
}
const mountDisqualify = async (key) => {
  await act(async () => root.render(React.createElement(DisqualifyHarness, { key })));
};
await mountDisqualify("pristine");
await escape();
assert.equal(disqualifyCloses, 1, "Non-default opening category/reason is pristine.");
await mountDisqualify("dirty");
await act(async () => {
  const category = window.document.querySelector("select");
  Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set.call(category, "Khác");
  category.dispatchEvent(new window.Event("change", { bubbles: true }));
});
await setField(window.document.querySelector("textarea"), "Changed reason");
await escape();
assert.equal(disqualifyCloses, 1);
assert.equal(window.document.querySelectorAll('[role="dialog"]').length, 2);
await clickText(/Tiếp tục chỉnh sửa|Keep editing/u);
assert.equal(window.document.querySelector("textarea").value, "Changed reason");
assert.equal(window.document.querySelector("select").value, "Khác");
await escape();
await clickText(/^Bỏ thay đổi$|^Discard changes$/u);
assert.equal(disqualifyCloses, 2);
assert.deepEqual(JSON.parse(window.document.getElementById("disqualify-fixture-state").textContent), { open: false, category: "Khác", reason: "" });
await clickText(/^Reopen fixture$/u);
await setField(window.document.querySelector("textarea"), "Pending reason");
await clickText(/^Xác nhận không đạt$/u);
await clickText(/^Xác nhận không đạt$/u);
await clickText(/^Bỏ qua$/u);
await escape();
await act(async () => {
  window.document.querySelector('div.absolute.inset-0[aria-hidden="true"]').click();
  window.document.querySelector('[role="dialog"] button[aria-label]').click();
});
assert.equal(disqualifyCalls, 1);
assert.equal(disqualifyCloses, 2);
assert.equal(window.document.querySelectorAll('[role="dialog"]').length, 1);
await act(async () => rejectDisqualify({ code: "VALIDATION_FAILED", category: "validation" }));
assert.ok(window.document.querySelector('[role="alert"]'));
assert.equal(window.document.querySelector("textarea").value, "Pending reason");
assert.equal(window.document.querySelector("select").value, "Khác");
await clickText(/^Xác nhận không đạt$/u);
assert.equal(disqualifyCalls, 2, "Rejected command permits retry.");
await act(async () => resolveDisqualify());
await act(async () => { await new Promise((resolve) => setTimeout(resolve, 300)); });
assert.equal(disqualifyCloses, 3);
assert.equal(window.document.querySelectorAll('[role="dialog"]').length, 0);
await clickText(/^Reopen fixture$/u);
assert.equal(window.document.querySelector("textarea").value, "");
assert.equal(window.document.querySelector('[role="alert"]'), null);
await escape();
assert.equal(disqualifyCloses, 4, "Successful save leaves fresh pristine opening state.");
console.log("A2A Disqualify runtime D1-D7: PASS");
await act(async () => root.unmount());

console.log("CRM UI interaction runtime: PASS");
console.log("- Continuous modal typing retains focus across controlled rerenders.");


}
