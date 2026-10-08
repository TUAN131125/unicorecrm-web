import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import type { HttpClient, HttpRequest } from "@/platform/api/client/HttpClient";
import type { LeadDocument } from "@/platform/api/generated/commercialApi";

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: "http://localhost", pretendToBeVisual: true });
const { window } = dom;
for (const key of ["window", "document", "navigator", "localStorage", "HTMLElement", "SVGElement", "Element", "Node", "Event", "CustomEvent", "EventTarget", "MutationObserver"] as const) {
  Object.defineProperty(globalThis, key, { value: key === "window" ? window : window[key], configurable: true });
}
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true, configurable: true });
const { signIn } = await import("@/platform/identity-auth");
assert.equal(signIn({ email: "admin@unicorecrm.local", password: "admin123" }).ok, true);
const { initializeApplicationComposition } = await import("@/app/composition");
await initializeApplicationComposition({ mode: "demo" });
const React = await import("react");
const { act } = React;
const { createRoot } = await import("react-dom/client");
const { I18nProvider } = await import("@/i18n");
const { ApplicationError } = await import("@/shared/domain");
const { createLeadConnectedApiRuntime } = await import("@/modules/leads/infrastructure/http/createLeadConnectedApiRuntime");
const { configureLeadApplication, getLeadApplicationServices } = await import("@/modules/leads/application/composition/leadApplicationServices");
const { mapLeadDocumentToApplication } = await import("@/modules/leads/infrastructure/http/LeadApiMapper");
const { useLeadQueueClaim } = await import("@/modules/leads/presentation/hooks/useLeadQueueClaim");
const { useLeadSelection } = await import("@/modules/leads/presentation/hooks/useLeadSelection");
const { LeadClaimButton } = await import("@/modules/leads/presentation/components/LeadClaimButton");
const { LEAD_OPERATION, isLeadOperationAvailable } = await import("@/modules/leads/application/leadOperationAvailability");
const shared = await import("@/shared/application");
const { useLeadOwnerAssign } = await import("@/modules/leads/presentation/hooks/useLeadOwnerAssign");
const { LeadOwnerAssignDialog, LeadOwnerAssignAction } = await import("@/modules/leads/presentation/components/LeadOwnerAssignAction");
const document: LeadDocument = { id: "lead_assign_ui", displayName: "Assign Lead", ownerId: null, version: 5, createdAt: "2026-09-30T00:00:00Z", updatedAt: "2026-09-30T00:00:00Z", leadWorkState: "NEW", score: 0, interestedProducts: [], activityProjection: "NOT_INCLUDED" };
const requests: HttpRequest[] = [];
let mode: "SUCCESS" | "PENDING" | "NETWORK" | "VERSION" | "DENIED" | "HIDDEN" | "INVALID" = "SUCCESS";
let release: (() => void) | undefined;
let version = 5;
const client: HttpClient = { async request<TResponse, TBody = unknown>(input: HttpRequest<TBody>): Promise<TResponse> {
  requests.push(input);
  if (input.operationId === "getLead") return { ...document, id: input.path.split("/")[2] ?? document.id, version } as TResponse;
  if (input.operationId === "listLeads") return { items: [], pageInfo: { hasNextPage: false, totalCount: 0 } } as TResponse;
  if (mode === "PENDING") await new Promise<void>(resolve => { release = resolve; });
  if (mode === "NETWORK") throw new ApplicationError({ code: "NETWORK_ERROR", category: "NETWORK", message: "ambiguous", retryable: true });
  if (mode === "VERSION") throw new ApplicationError({ code: "VERSION_CONFLICT", category: "CONFLICT", message: "stale", status: 412 });
  if (mode === "DENIED") throw new ApplicationError({ code: "ACCESS_DENIED", category: "AUTHORIZATION", message: "denied", status: 403 });
  if (mode === "HIDDEN") throw new ApplicationError({ code: "RESOURCE_NOT_FOUND", category: "NOT_FOUND", message: "hidden", status: 404 });
  if (mode === "INVALID") throw new ApplicationError({ code: "LEAD_OWNER_NOT_ASSIGNABLE", category: "VALIDATION", message: "invalid target", status: 422 });
  const ownerId = (input.body as { ownerId: string }).ownerId;
  const targetId = input.path.split("/")[2] ?? document.id;
  const expectedVersion = input.expectedVersion;
  assert.ok(typeof expectedVersion === "number", "Assignment transport carries a numeric opening version");
  assert.ok(Number.isSafeInteger(expectedVersion) && expectedVersion >= 0, "Assignment opening version is a valid resource version");
  const committedVersion = expectedVersion + 1;
  return { commandId: "assign_cmd", correlationId: "assign_corr", aggregateId: targetId, aggregateType: "LEAD", version: committedVersion, occurredAt: document.updatedAt, outcome: "COMMITTED", warnings: [], emittedEventIds: ["assign_event"], auditEvidenceIds: ["assign_audit"], result: { ...document, id: targetId, ownerId, version: committedVersion } } as TResponse;
}};
const base = getLeadApplicationServices();
let records = [mapLeadDocumentToApplication(document)];
const services = { ...base, repository: { list: () => [...records], getById: (id: string) => records.find(record => record.id === id), replace: (next: typeof records) => { records = next; }, subscribe: () => () => {} } };
const api = createLeadConnectedApiRuntime(client);
configureLeadApplication({ ...services, api });
assert.equal(isLeadOperationAvailable(LEAD_OPERATION.ASSIGN_OWNER), true);
assert.equal(isLeadOperationAvailable(LEAD_OPERATION.CLAIM), true);
const before = requests.length;
await assert.rejects(() => api.commands.assignLeadOwnerBatch({ ownerId: "member_target", reason: "r", items: [{ leadId: document.id, expectedVersion: 5 }] }, { idempotencyKey: "batch" }));
assert.equal(requests.length, before, "Future operations send zero HTTP");
let current!: ReturnType<typeof useLeadOwnerAssign>;
let selection = [document.id, "lead_other"];
let queue = [document.id, "lead_other"];
let refreshCount = 0;
const root = createRoot(window.document.getElementById("root")!);
function Fixture() {
  current = useLeadOwnerAssign(mapLeadDocumentToApplication(document), id => { selection = selection.filter(value => value !== id); }, async () => { refreshCount++; queue = queue.filter(id => id !== document.id); });
  return null;
}
async function mount() { await act(async () => { root.render(React.createElement(I18nProvider, null, React.createElement(Fixture, { key: String(Math.random()) }))); }); }
await mount();
let count = requests.length;
await act(async () => { assert.equal(await current.submit("member_target", "   "), false); });
assert.equal(requests.length, count, "Blank reason sends zero request");
mode = "PENDING";
let submission: Promise<boolean>;
await act(async () => { submission = current.submit("member_target", "Coverage"); await Promise.resolve(); });
assert.equal(current.pending, true);
assert.equal(records[0].ownerId, undefined, "No optimistic ownership");
count = requests.length;
await act(async () => { assert.equal(await current.submit("member_target", "Coverage"), false); });
assert.equal(requests.length, count, "Double submit sends exactly one request");
await act(async () => { release?.(); await submission; });
assert.equal(records[0].ownerId, "member_target", "Server projection is authoritative");
assert.deepEqual(selection, ["lead_other"]);
assert.deepEqual(queue, ["lead_other"]);
assert.equal(refreshCount, 1);
const first = requests.find(input => input.operationId === "assignLeadOwner")!;
assert.deepEqual(first.body, { ownerId: "member_target", reason: "Coverage" });
assert.equal(first.path, `/leads/${document.id}/assign`);
assert.equal(first.expectedVersion, 5);
assert.ok(first.idempotencyKey);
await mount(); mode = "NETWORK";
await act(async () => { assert.equal(await current.submit("member_target", "Coverage"), false); });
const ambiguous = requests.at(-1)!;
assert.equal(current.ambiguous, true);
await act(async () => { await current.submit("member_target", "Coverage"); });
assert.equal(requests.at(-1)!.idempotencyKey, ambiguous.idempotencyKey);
assert.equal(requests.at(-1)!.expectedVersion, 5);
function VisibilityFixture({ open }: { open: boolean }) {
  current = useLeadOwnerAssign(mapLeadDocumentToApplication(document));
  return open ? React.createElement("span", null, "dialog") : null;
}
await act(async () => { root.render(React.createElement(VisibilityFixture, { open: true })); });
mode = "NETWORK";
await act(async () => { await current.submit("member_target", "Coverage"); });
const closedAttempt = requests.at(-1)!;
await act(async () => { root.render(React.createElement(VisibilityFixture, { open: false })); });
await act(async () => { root.render(React.createElement(VisibilityFixture, { open: true })); });
await act(async () => { await current.submit("member_target", "Coverage"); });
assert.equal(requests.at(-1)!.idempotencyKey, closedAttempt.idempotencyKey, "Close/reopen keeps ambiguous key");
assert.equal(requests.at(-1)!.expectedVersion, closedAttempt.expectedVersion, "Close/reopen keeps ambiguous version");
await mount(); mode = "VERSION"; version = 6;
count = requests.filter(input => input.operationId === "assignLeadOwner").length;
await act(async () => { await current.submit("member_target", "Coverage"); });
assert.equal(requests.filter(input => input.operationId === "assignLeadOwner").length, count + 1, "412 never automatically retries");
assert.equal(current.observed.resourceVersion, 6);
assert.equal(current.blocked, false);
const stale = requests.filter(input => input.operationId === "assignLeadOwner").at(-1)!;
mode = "SUCCESS";
await act(async () => { await current.submit("member_target", "Coverage"); });
const fresh = requests.filter(input => input.operationId === "assignLeadOwner").at(-1)!;
assert.equal(fresh.expectedVersion, 6);
assert.notEqual(fresh.idempotencyKey, stale.idempotencyKey);
for (const errorMode of ["DENIED", "HIDDEN", "INVALID"] as const) {
  await mount(); mode = errorMode;
  await act(async () => { assert.equal(await current.submit("member_target", "Coverage"), false); });
  assert.ok(current.error, `Typed ${errorMode} error retained for user presentation`);
}
const action = readFileSync("src/modules/leads/presentation/components/LeadOwnerAssignAction.tsx", "utf8");
assert.match(action, /allowedCommands.includes\("lead.assign-owner"\)/);
assert.match(action, /assignableOwners/);
assert.match(action, /getScopedTaskCollectionResource\(\{ filters: \{ recordModuleKey: "leads", recordId: lead.id \} \}\)/);
assert.match(action, /isOpen=\{open\}/);
assert.match(action, /task.status === "OPEN"/);
assert.match(action, /Open Tasks keep their assignee/);
assert.doesNotMatch(action, /reassignTask|createTask|updateTask|localStorage/);
const panel = readFileSync("src/modules/leads/presentation/components/LeadWorkPanel.tsx", "utf8");
assert.match(panel, /<RelationshipWorkPanelShell/);
const workPanelShell = readFileSync("src/components/crm/relationship-panel/RelationshipWorkPanelShell.tsx", "utf8");
assert.match(workPanelShell, /xl:w-\[350px\]/);
assert.match(workPanelShell, /min-w-0/);
assert.match(panel, /LeadOwnerAssignAction lead=\{lead\}/);
assert.match(panel, /onAssigned=\{onAssigned\}/);
const list = readFileSync("src/modules/leads/presentation/pages/LeadListPage.tsx", "utf8");
assert.match(list, /selection.toggleSelection\(leadId, false\)/);
assert.match(list, /showToast\(locale === "vi" \? "Đã phân công Lead\." : "Lead owner assigned\."\)/);
assert.match(list, /refresh=\{serverPagination.refresh\}/);
const profile = readFileSync("src/modules/leads/presentation/components/LeadDetailModals.tsx", "utf8");
assert.match(profile, /canAssignOwner=\{false\}/);
const { configureEffectiveRecordAccessAuthority, resetEffectiveRecordAccessAuthority } = await import("@/platform/access-control");
let holdAuthority = false;
let denyAuthority = false;
const authorityIds: string[] = [];
let releaseAuthority: (() => void) | undefined;
configureEffectiveRecordAccessAuthority({ source: "backend", async evaluate(request) {
  authorityIds.push(request.recordId ?? "");
  if (holdAuthority) await new Promise<void>(resolve => { releaseAuthority = resolve; });
  return { workspaceId: request.workspaceId, resourceKey: "leads", recordId: request.recordId, canRead: true, canUpdate: false, canDelete: false, canExport: false, canApprove: false, allowedCommands: denyAuthority ? [] : ["lead.assign-owner"], fieldAccess: { ownerId: "READ_WRITE" }, decisionReasons: [], evaluatedAt: document.updatedAt, authority: "backend" };
}});
const { configureTaskApplication } = await import("@/modules/tasks/application/composition/taskApplicationServices");
const { InMemoryTaskActivityRepository } = await import("@/modules/tasks/infrastructure/InMemoryTaskActivityRepository");
const { createTaskConnectedApiRuntime } = await import("@/modules/tasks/infrastructure/http/createTaskConnectedApiRuntime");
const taskRequests: HttpRequest[] = [];
const linkedTasks = ["OPEN", "COMPLETED", "CANCELLED"].map((status, index) => ({ id: `task_assign_${index}`, title: status, status, priority: "NORMAL", assigneeId: "member_previous", dueAt: "2099-01-01T00:00:00Z", createdAt: document.createdAt, updatedAt: document.updatedAt, recordRef: { moduleKey: "leads", recordId: document.id, label: document.displayName } }));
const taskClient: HttpClient = { async request<TResponse, TBody = unknown>(input: HttpRequest<TBody>): Promise<TResponse> {
  taskRequests.push(input);
  assert.equal(input.operationId, "listTasks", "Assign dialog only reads Tasks");
  return { items: linkedTasks, pageInfo: { hasNextPage: false } } as TResponse;
}};
configureTaskApplication({ repository: new InMemoryTaskActivityRepository({ tasks: [], activities: [] }), api: createTaskConnectedApiRuntime(taskClient) });
let releaseTasks: (() => void) | undefined;
const slowTaskClient: HttpClient = { async request<TResponse, TBody = unknown>(input: HttpRequest<TBody>): Promise<TResponse> {
  await new Promise<void>(resolve => { releaseTasks = resolve; });
  return taskClient.request<TResponse, TBody>(input);
}};
configureTaskApplication({ repository: new InMemoryTaskActivityRepository({ tasks: [], activities: [] }), api: createTaskConnectedApiRuntime(slowTaskClient) });
const taskBefore = JSON.stringify(linkedTasks);
await act(async () => { root.render(React.createElement(I18nProvider, null, React.createElement(LeadOwnerAssignDialog, { lead: mapLeadDocumentToApplication(document), onClose() {} }))); });
await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
await act(async () => { window.document.querySelector<HTMLButtonElement>("button[aria-haspopup=listbox]")!.click(); });
const targetOption = window.document.querySelector<HTMLButtonElement>("button[role=option]");
assert.ok(targetOption, "Assignable member candidates are rendered");
await act(async () => { targetOption.click(); });
const reasonControl = window.document.querySelector<HTMLTextAreaElement>("textarea")!;
await act(async () => {
  Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")!.set!.call(reasonControl, "Coverage");
  reasonControl.dispatchEvent(new window.Event("input", { bubbles: true }));
});
assert.equal(window.document.querySelector<HTMLButtonElement>("button[type=submit]")?.disabled, false, "TASK-UX-01: Task loading cannot block an authorized complete draft");
assert.match(window.document.body.textContent ?? "", /Công việc hiện có không được chuyển|Existing Tasks are not transferred/);
await act(async () => { releaseTasks?.(); await new Promise(resolve => setTimeout(resolve, 10)); });
assert.ok(window.document.querySelector("button[aria-haspopup=listbox]"), "Target selection rendered through shared searchable owner Select");
assert.ok(window.document.querySelector("textarea[required]"), "Reason required");
assert.equal(window.document.querySelector<HTMLButtonElement>("button[type=submit]")?.disabled, false, "Completed draft can confirm after Task observation; OPEN Tasks remain informational");
assert.match(window.document.body.textContent ?? "", /Các công việc đang mở giữ nguyên người thực hiện|Open Tasks keep their assignee/);
assert.equal(taskRequests[0].query?.recordModuleKey, "leads");
assert.equal(taskRequests[0].query?.recordId, document.id);
assert.equal(JSON.stringify(linkedTasks), taskBefore, "Task warning never mutates any status/assignee");
configureTaskApplication({ repository: new InMemoryTaskActivityRepository({ tasks: [], activities: [] }), api: createTaskConnectedApiRuntime(taskClient) });
// This fixture explicitly grants coarse Assign authority; production role policy is unchanged.
const { configureAccessGovernanceRuntime, getAccessGovernanceRuntimeBinding } = await import("@/platform/access-control/application/accessGovernanceBinding");
const { resolveLocalEffectiveAccess } = await import("@/platform/access-control/runtime/accessControlRuntime");
const governance = getAccessGovernanceRuntimeBinding();
configureAccessGovernanceRuntime({
  getRuntime: () => governance.getRuntime(), getState: () => governance.getState(),
  load: (workspaceId, signal) => governance.load(workspaceId, signal),
  refresh: (workspaceId, signal) => governance.refresh(workspaceId, signal),
  applyMutation: (workspaceId, result, signal) => governance.applyMutation(workspaceId, result, signal),
  subscribe: listener => governance.subscribe(listener), clear: () => governance.clear(),
  getEffectiveAccess(workspaceId) {
  const access = governance.getEffectiveAccess(workspaceId) ?? resolveLocalEffectiveAccess(workspaceId);
  return { ...access, can: capability => capability === "leads.assign" || access.can(capability) };
} });
const actionLead = mapLeadDocumentToApplication(document);
const renderAction = async (lead = actionLead) => { await act(async () => { root.render(React.createElement(I18nProvider, null, React.createElement(LeadOwnerAssignAction, { lead }))); }); };
const openAction = async () => { const button = [...window.document.querySelectorAll<HTMLButtonElement>("button")].find(node => /Phân công|Assign owner/.test(node.textContent ?? "")); assert.ok(button); await act(async () => { button.click(); }); };
count = authorityIds.length;
await renderAction();
assert.equal(authorityIds.length, count, "Closed Work Panel trigger performs zero record-access evaluations");
await openAction();
await act(async () => { window.document.querySelector<HTMLButtonElement>("button[aria-haspopup=listbox]")!.click(); });
await act(async () => { window.document.querySelector<HTMLButtonElement>("button[role=option]")!.click(); });
await act(async () => {
  const textarea = window.document.querySelector<HTMLTextAreaElement>("textarea")!;
  Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")!.set!.call(textarea, "Coverage");
  textarea.dispatchEvent(new window.Event("input", { bubbles: true }));
});
mode = "NETWORK";
await act(async () => { window.document.querySelector("form")!.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
const authorityRetry = requests.filter(input => input.operationId === "assignLeadOwner").at(-1)!;
holdAuthority = true;
const evaluationsBeforeSameVersionRefresh = authorityIds.length;
await renderAction({ ...actionLead, name: "Refreshed same version" });
assert.equal(authorityIds.length, evaluationsBeforeSameVersionRefresh, "An open dialog retains its selected snapshot; an unrelated same-version prop refresh does not evaluate a different record.");
assert.equal(window.document.querySelector<HTMLTextAreaElement>("textarea")?.value, "Coverage", "Same-version refresh preserves the ambiguous draft.");
holdAuthority = false;
async function confirmCloseIfPrompted() {
  const confirm = [...window.document.querySelectorAll<HTMLButtonElement>("button")].find(node => /^(Đóng|Close|Bỏ thay đổi|Discard changes)$/.test(node.textContent ?? ""));
  if (confirm) await act(async () => { confirm.click(); });
}
const cancel = [...window.document.querySelectorAll<HTMLButtonElement>("button")].find(node => /^(Hủy|Cancel)$/.test(node.textContent ?? ""));
assert.ok(cancel);
await act(async () => { cancel.click(); });
assert.match(window.document.body.textContent ?? "", /Bỏ thay đổi chưa lưu|Discard unsaved changes/);
await confirmCloseIfPrompted();
await openAction();
await act(async () => { window.document.querySelector("form")!.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
const actualRetry = requests.filter(input => input.operationId === "assignLeadOwner").at(-1)!;
assert.equal(actualRetry.idempotencyKey, authorityRetry.idempotencyKey, "Actual action preserves ambiguous key through authority refresh + close/reopen");
assert.equal(actualRetry.expectedVersion, authorityRetry.expectedVersion);
// Real desktop/mobile composition: 50 rows, one selected snapshot, one retained dialog.
const { LeadListResults } = await import("@/modules/leads/presentation/components/LeadListResults");
const { LeadActionMenu } = await import("@/modules/leads/presentation/components/LeadActionMenu");
const pageLeads = Array.from({ length: 50 }, (_, index) => mapLeadDocumentToApplication({ ...document, id: `lead_scale_${index}`, displayName: `Scale ${index}` }));
let authoritativePage = pageLeads;
let activeTarget: string | undefined;
const listAssigned: string[] = [];
function ListFixture() {
  const [leadToAssign, setLeadToAssign] = React.useState<(typeof pageLeads)[number] | null>(null);
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [rowMenu, setRowMenu] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!leadToAssign) return;
    const observed = authoritativePage.find(lead => lead.id === leadToAssign.id);
    if (observed && (observed.resourceVersion ?? -1) > (leadToAssign.resourceVersion ?? -1)) setLeadToAssign(observed);
  }, [leadToAssign, authoritativePage]);
  activeTarget = leadToAssign?.id;
  return React.createElement(React.Fragment, null,
    React.createElement(LeadListResults, {
      leads: pageLeads, viewMode: "table", activeView: "unassigned", selectedLeadIds: [],
      visibleColumns: ["name"], columnWidths: {}, openRowActionId: rowMenu, campaigns: [],
      memberById: new Map(), productById: new Map(), canArchive: false, canCreate: false,
      page: 1, pageCount: 1, pageSize: 50, totalItems: 50, rangeStart: 1, rangeEnd: 50,
      onPageChange() {}, onPageSizeChange() {}, onOpenCreate() {}, onSelectAll() {}, onSelectRow() {},
      onColumnResize() {}, onColumnReset() {}, setOpenRowActionId: setRowMenu, getReturnToUrl: () => "/leads",
      onMoveLead() {}, onCall() {}, onArchive() {}, onViewDetails() {}, canClaim: true, onClaim() {},
      onAssign: lead => { setLeadToAssign(current => current?.id === lead.id && (current.resourceVersion ?? -1) > (lead.resourceVersion ?? -1) ? current : lead); setAssignOpen(true); },
    }),
    leadToAssign && React.createElement(LeadOwnerAssignDialog, { key: leadToAssign.id, lead: leadToAssign,
      onAssigned: id => { listAssigned.push(id); },
      isOpen: assignOpen, onClose: () => setAssignOpen(false) }));
}
const mountList = async () => { await act(async () => { root.render(React.createElement(I18nProvider, null, React.createElement(ListFixture))); }); };
await act(async () => { root.render(null); });
authorityIds.length = 0;
await mountList();
assert.equal(window.document.querySelectorAll("tbody tr").length, 50);
assert.equal(authorityIds.length, 0, "50-row list causes zero record-specific Assign evaluations");
assert.equal(window.document.querySelectorAll("form textarea").length, 0, "No hidden per-row Assign forms");
assert.equal(window.document.querySelectorAll('[role="dialog"]').length, 0, "Zero Assign dialogs before interaction");
assert.equal(window.document.querySelectorAll(".row-more-btn").length, 50);
assert.equal(window.document.querySelectorAll('[data-guidance-id="leads.owner.assign"]').length, 0, "No inline Assign row buttons");
const assignEntry = () => [...window.document.querySelectorAll<HTMLButtonElement>('[data-guidance-id="leads.owner.assign"]')][0];
const clickCancel = async () => {
  const button = [...window.document.querySelectorAll<HTMLButtonElement>("button")].find(node => /^(Hủy|Cancel)$/.test(node.textContent ?? ""));
  assert.ok(button); await act(async () => { button.click(); });
  await confirmCloseIfPrompted();
};
const completeDraft = async () => {
  await act(async () => { window.document.querySelector<HTMLButtonElement>("button[aria-haspopup=listbox]")!.click(); });
  await act(async () => { window.document.querySelector<HTMLButtonElement>("button[role=option]")!.click(); });
  await act(async () => {
    const textarea = window.document.querySelector<HTMLTextAreaElement>("textarea")!;
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")!.set!.call(textarea, "Coverage");
    textarea.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
};
holdAuthority = true;
await act(async () => { window.document.querySelector<HTMLButtonElement>(".row-more-btn")!.click(); });
assert.ok(assignEntry(), "Desktop More menu exposes Assign");
await act(async () => { assignEntry()!.click(); });
assert.equal(activeTarget, pageLeads[0].id);
assert.deepEqual(authorityIds, [pageLeads[0].id], "Opening one row evaluates only that Lead once");
assert.equal(window.document.querySelectorAll("form textarea").length, 1, "Exactly one list Assign form");
assert.equal(window.document.querySelectorAll('[role="dialog"]').length, 1, "Exactly one list Assign dialog");
await completeDraft();
assert.equal(window.document.querySelector<HTMLButtonElement>("button[type=submit]")?.disabled, true, "Authority LOADING blocks Confirm");
count = requests.filter(input => input.operationId === "assignLeadOwner").length;
await act(async () => { window.document.querySelector("form")!.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
assert.equal(requests.filter(input => input.operationId === "assignLeadOwner").length, count);
holdAuthority = false;
await act(async () => { releaseAuthority?.(); });
mode = "NETWORK";
await act(async () => { window.document.querySelector("form")!.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
const listAttempt = requests.filter(input => input.operationId === "assignLeadOwner").at(-1)!;
await clickCancel();
assert.equal(window.document.querySelectorAll("form textarea").length, 0);
count = authorityIds.length;
await mountList();
assert.equal(authorityIds.length, count, "Closed list dialog performs no additional evaluations");
await act(async () => { window.document.querySelector<HTMLButtonElement>(".row-more-btn")!.click(); });
await act(async () => { assignEntry()!.click(); });
await act(async () => { window.document.querySelector("form")!.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
const sameTargetRetry = requests.filter(input => input.operationId === "assignLeadOwner").at(-1)!;
assert.equal(sameTargetRetry.idempotencyKey, listAttempt.idempotencyKey, "Centralized close/reopen retains ambiguous intent");
assert.equal(sameTargetRetry.expectedVersion, listAttempt.expectedVersion);
await clickCancel();
// A newer authoritative version ends the old intent according to frozen O3 recovery.
pageLeads[0] = { ...pageLeads[0], resourceVersion: 6 };
await mountList();
await act(async () => { window.document.querySelector<HTMLButtonElement>(".row-more-btn")!.click(); });
await act(async () => { assignEntry()!.click(); });
await act(async () => { window.document.querySelector("form")!.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
const observedVersionAttempt = requests.filter(input => input.operationId === "assignLeadOwner").at(-1)!;
assert.equal(observedVersionAttempt.expectedVersion, 6, "New authoritative version creates a new intent");
assert.notEqual(observedVersionAttempt.idempotencyKey, listAttempt.idempotencyKey);
authoritativePage = [];
await mountList();
await act(async () => { window.document.querySelector("form")!.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
const absentPageRetry = requests.filter(input => input.operationId === "assignLeadOwner").at(-1)!;
assert.equal(absentPageRetry.idempotencyKey, observedVersionAttempt.idempotencyKey, "Absence from a different page must not erase Assign intent");
assert.equal(absentPageRetry.expectedVersion, 6);
authoritativePage = [{ ...pageLeads[0], resourceVersion: 7 }];
count = requests.filter(input => input.operationId === "assignLeadOwner").length;
await mountList();
assert.equal(requests.filter(input => input.operationId === "assignLeadOwner").length, count, "New authoritative observation cannot automatically resubmit");
await act(async () => { window.document.querySelector("form")!.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
const openDialogObservedRetry = requests.filter(input => input.operationId === "assignLeadOwner").at(-1)!;
assert.equal(openDialogObservedRetry.expectedVersion, 6, "While-open observation must not silently rebase the opening intent to version 7");
assert.equal(openDialogObservedRetry.idempotencyKey, observedVersionAttempt.idempotencyKey, "New page observations cannot replace an ambiguous opening intent");
authoritativePage = [];
await mountList();
await act(async () => { window.document.querySelector("form")!.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
const latestAbsentPageRetry = requests.filter(input => input.operationId === "assignLeadOwner").at(-1)!;
assert.equal(latestAbsentPageRetry.idempotencyKey, openDialogObservedRetry.idempotencyKey, "Absence after newer ambiguous submit keeps the latest intent");
assert.equal(latestAbsentPageRetry.expectedVersion, 6, "Page absence preserves the original opening version");

mode = "VERSION";
version = 7;
const retainedReason = window.document.querySelector<HTMLTextAreaElement>("form textarea")!.value;
const retainedOwner = window.document.querySelector<HTMLSelectElement>("form select")!.value;
count = requests.filter(input => input.operationId === "assignLeadOwner").length;
await act(async () => { window.document.querySelector("form")!.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
assert.equal(requests.filter(input => input.operationId === "assignLeadOwner").length, count + 1, "Conflict recovery must not automatically resubmit");
const staleOpeningAttempt = requests.filter(input => input.operationId === "assignLeadOwner").at(-1)!;
assert.equal(staleOpeningAttempt.expectedVersion, 6, "The server receives the stale opening version and rejects it with 412");
assert.equal(staleOpeningAttempt.idempotencyKey, observedVersionAttempt.idempotencyKey);
assert.equal(window.document.querySelectorAll("form textarea").length, 1, "Conflict retains the dialog");
assert.equal(window.document.querySelector<HTMLTextAreaElement>("form textarea")!.value, retainedReason, "Conflict retains the complete reason");
assert.equal(window.document.querySelector<HTMLSelectElement>("form select")!.value, retainedOwner, "Conflict retains the chosen owner");
assert.ok(window.document.querySelector('[role="alert"]'), "Conflict is visible to the user");
await clickCancel();
pageLeads[0] = { ...pageLeads[0], resourceVersion: 7 };
authoritativePage = pageLeads;
await mountList();
await act(async () => { window.document.querySelector<HTMLButtonElement>(".row-more-btn")!.click(); });
await act(async () => { assignEntry()!.click(); });
await completeDraft();
mode = "SUCCESS";
await act(async () => { window.document.querySelector("form")!.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
const reopenedAttempt = requests.filter(input => input.operationId === "assignLeadOwner").at(-1)!;
assert.equal(reopenedAttempt.expectedVersion, 7, "Explicit reopen uses the new authoritative version");
assert.notEqual(reopenedAttempt.idempotencyKey, staleOpeningAttempt.idempotencyKey, "The reopened confirmation is a fresh intent");
assert.equal((reopenedAttempt.body as { ownerId: string }).ownerId, retainedOwner, "Explicit confirmation sends the chosen owner");
assert.deepEqual(listAssigned, [pageLeads[0].id], "Only the authoritative successful confirmation acknowledges assignment");

authoritativePage = pageLeads;

assert.equal(window.document.querySelectorAll("form textarea").length, 0, "Authoritative reopened success closes the assignment dialog");
const mobileMore = window.document.querySelectorAll<SVGElement>("svg.lucide-sparkles")[1]?.closest("button");
assert.ok(mobileMore, "Mobile More trigger exists");
await act(async () => { mobileMore.click(); });
assert.ok(assignEntry(), "Mobile More menu exposes same Assign entry");
await act(async () => { assignEntry()!.click(); });
assert.equal(activeTarget, pageLeads[1].id, "Mobile opens centralized dialog for correct Lead");
assert.equal(window.document.querySelectorAll("form textarea").length, 1);
assert.equal(window.document.querySelector<HTMLTextAreaElement>("textarea")?.value, "", "Different Lead does not inherit previous draft");
await completeDraft();
await act(async () => { window.document.querySelector("form")!.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
const otherTargetAttempt = requests.filter(input => input.operationId === "assignLeadOwner").at(-1)!;
assert.equal(otherTargetAttempt.path, `/leads/${pageLeads[1].id}/assign`);
assert.notEqual(otherTargetAttempt.idempotencyKey, listAttempt.idempotencyKey, "Intent cannot leak between Leads");
// Exact authority denial overrides coarse menu eligibility.
denyAuthority = true;
await act(async () => { window.document.querySelectorAll<HTMLButtonElement>(".row-more-btn")[2].click(); });
await act(async () => { assignEntry()!.click(); });
await completeDraft();
assert.equal(window.document.querySelector<HTMLButtonElement>("button[type=submit]")?.disabled, true);
assert.match(window.document.body.textContent ?? "", /Bạn không có quyền phân công|You cannot assign/);
count = requests.filter(input => input.operationId === "assignLeadOwner").length;
await act(async () => { window.document.querySelector("form")!.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
assert.equal(requests.filter(input => input.operationId === "assignLeadOwner").length, count, "Denied record sends zero Assign transport");
denyAuthority = false;
// Reuse shared dirty-close infrastructure without discarding an ambiguous server intent.
let dirtyClosed = 0;
let successFeedback = 0;
await act(async () => { root.render(React.createElement(I18nProvider, null, React.createElement(LeadOwnerAssignDialog, {
  key: "dirty-close", lead: pageLeads[4], onClose() { dirtyClosed++; }, onAssigned() { successFeedback++; },
}))); });
await completeDraft();
const draftReason = window.document.querySelector<HTMLTextAreaElement>("textarea")!.value;
const cancelDraft = () => [...window.document.querySelectorAll<HTMLButtonElement>("button")].find(node => /^(Hủy|Cancel)$/.test(node.textContent ?? ""))!;
await act(async () => { cancelDraft().click(); });
assert.match(window.document.body.textContent ?? "", /Bỏ thay đổi chưa lưu|Discard unsaved changes/);
assert.equal(dirtyClosed, 0, "Dirty Cancel requires confirmation");
const keepEditing = [...window.document.querySelectorAll<HTMLButtonElement>("button")].find(node => /^(Tiếp tục chỉnh sửa|Keep editing)$/.test(node.textContent ?? ""))!;
await act(async () => { keepEditing.click(); });
assert.equal(window.document.querySelector<HTMLTextAreaElement>("textarea")!.value, draftReason, "Keep editing preserves draft");
await act(async () => { cancelDraft().click(); });
await confirmCloseIfPrompted();
assert.equal(dirtyClosed, 1);
assert.equal(window.document.querySelector<HTMLTextAreaElement>("textarea")!.value, "", "Discard clears only unsaved draft");
await completeDraft();
mode = "DENIED";
await act(async () => { window.document.querySelector("form")!.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
assert.equal(dirtyClosed, 1, "Failed save must not close form");
assert.equal(successFeedback, 0, "Failed save must not announce success");
assert.ok(window.document.querySelector('[role="alert"]'), "Server error remains visible");
mode = "SUCCESS";
await act(async () => { window.document.querySelector("form")!.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
assert.equal(successFeedback, 1, "Authoritative success notifies surrounding existing feedback infrastructure exactly once");
assert.equal(dirtyClosed, 2, "Successful save closes without dirty prompt");
assert.doesNotMatch(window.document.body.textContent ?? "", /Bỏ thay đổi chưa lưu|Discard unsaved changes/);
const detailView = readFileSync("src/modules/leads/presentation/views/LeadDetailView.tsx", "utf8");
assert.match(detailView, /onAssigned=\{\(\) => showToast/);
assert.match(action, /useLeadAuxiliaryLifecycle/);
assert.match(readFileSync("src/modules/leads/presentation/hooks/useLeadAuxiliaryLifecycle.tsx", "utf8"), /registerUnsavedWork/);
// A Task read failure is informational, even with a fully completed Assign draft.
const failingTaskClient: HttpClient = { async request(input) { taskRequests.push(input); assert.equal(input.operationId, "listTasks", "Failed Task observation is still read-only"); throw new ApplicationError({ code: "NETWORK_ERROR", category: "NETWORK", message: "unavailable", retryable: true }); } };
configureTaskApplication({ repository: new InMemoryTaskActivityRepository({ tasks: [], activities: [] }), api: createTaskConnectedApiRuntime(failingTaskClient) });
await act(async () => { root.render(React.createElement(I18nProvider, null, React.createElement(LeadOwnerAssignDialog, { key: "task-failure", lead: pageLeads[3], onClose() {} }))); });
await completeDraft();
assert.equal(window.document.querySelector<HTMLButtonElement>("button[type=submit]")?.disabled, false, "TASK-UX-02: Task failure cannot block Assign");
assert.match(window.document.body.textContent ?? "", /Chưa tải được công việc|Tasks could not be loaded/);
assert.match(window.document.body.textContent ?? "", /Công việc hiện có không được chuyển|Existing Tasks are not transferred/);
mode = "SUCCESS";
count = requests.filter(input => input.operationId === "assignLeadOwner").length;
await act(async () => { window.document.querySelector("form")!.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
assert.equal(requests.filter(input => input.operationId === "assignLeadOwner").length, count + 1, "Assign succeeds despite failed Task observation");
assert.equal(JSON.stringify(linkedTasks), taskBefore, "OPEN/COMPLETED/CANCELLED fixture snapshots unchanged");
assert.ok(taskRequests.every(request => request.operationId === "listTasks"), "Zero Task mutation requests");
// Archived rows cannot offer Assign through the shared menu.
await act(async () => { root.render(React.createElement(I18nProvider, null, React.createElement(LeadActionMenu, { lead: { ...pageLeads[0], archivedAt: document.updatedAt }, onClose() {}, onAssign() { throw new Error("Archived Assign must not be offered"); } }))); });
assert.equal(assignEntry(), undefined);
const tableSource = readFileSync("src/modules/leads/presentation/components/LeadTable.tsx", "utf8");
assert.doesNotMatch(tableSource, /LeadOwnerAssignAction|LeadOwnerAssignDialog|useEffectiveRecordAccess/);
assert.match(tableSource, /onAssign=\{onAssign\}/);
assert.match(tableSource, /columnWidths.actions \|\| 120/);
assert.equal((list.match(/<LeadOwnerAssignDialog/g) ?? []).length, 1);
assert.match(list, /key=\{leadToAssign.id\}/);
assert.match(list, /setLeadToAssign\(\(current\)/);
assert.match(list, /serverPagination.items.find\(\(lead\) => lead.id === leadToAssign.id\)/);
assert.match(list, /setLeadToAssign\(observed\)/);
assert.doesNotMatch(action.slice(action.indexOf("export function LeadOwnerAssignAction"), action.indexOf("export function LeadOwnerAssignDialog")), /useEffectiveRecordAccess/);
assert.match(action, /enabled: isOpen/);
assert.doesNotMatch(action, /tasks.state !== "READY"/);
configureAccessGovernanceRuntime(governance);
resetEffectiveRecordAccessAuthority();
await act(async () => { root.unmount(); });
console.log("Lead owner assign: PASS (transport, reason, pending, authoritative projection, selection/queue refresh, stable ambiguity retry, explicit 412 recovery, typed failures, task-neutral UI, future containment)");
