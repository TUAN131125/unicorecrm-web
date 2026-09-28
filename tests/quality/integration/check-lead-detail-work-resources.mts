import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import type { Task, Activity } from "@/modules/tasks";
import type { AuthoritativePage } from "@/shared/application";
import type { Lead } from "@/modules/leads";
import type { HttpClient, HttpRequest } from "@/platform/api/client/HttpClient";

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: "http://localhost", pretendToBeVisual: true });
const { window } = dom;
for (const key of ["window", "document", "navigator", "localStorage", "HTMLElement", "SVGElement", "Element", "Node", "Event", "CustomEvent", "EventTarget", "MutationObserver"] as const) {
  Object.defineProperty(globalThis, key, { value: key === "window" ? window : window[key], configurable: true });
}
Object.defineProperties(globalThis, {
  IS_REACT_ACT_ENVIRONMENT: { value: true, configurable: true },
  getComputedStyle: { value: window.getComputedStyle.bind(window), configurable: true },
  requestAnimationFrame: { value: window.requestAnimationFrame.bind(window), configurable: true },
  cancelAnimationFrame: { value: window.cancelAnimationFrame.bind(window), configurable: true },
  ResizeObserver: { value: class { observe() {} unobserve() {} disconnect() {} }, configurable: true },
});
Object.defineProperty(window, "matchMedia", { value: () => ({ matches: true, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }) });
const { signIn } = await import("@/platform/identity-auth");
assert.equal(signIn({ email: "admin@unicorecrm.local", password: "admin123" }).ok, true);
const { initializeApplicationComposition } = await import("@/app/composition");
await initializeApplicationComposition({ mode: "demo" });
const workspace = await import("@/platform/workspace-context");
const { loadAccessGovernance } = await import("@/platform/access-control");
await loadAccessGovernance(workspace.getWorkspaceContextSnapshot().workspaceId);
const React = await import("react");
const { act } = React;
const { createRoot } = await import("react-dom/client");
const { MemoryRouter, Routes, Route } = await import("react-router-dom");
const { I18nProvider } = await import("@/i18n");
const { PlatformStateProvider } = await import("@/app/providers");
const { GuidanceProvider } = await import("@/guidance/presentation/GuidanceProvider");
const tasks = await import("@/modules/tasks");
const { configureTaskApplication, getTaskApplicationServices } = await import("@/modules/tasks/application/composition/taskApplicationServices");
const { InMemoryTaskActivityRepository } = await import("@/modules/tasks/infrastructure/InMemoryTaskActivityRepository");
const { createTaskConnectedApiRuntime } = await import("@/modules/tasks/infrastructure/http/createTaskConnectedApiRuntime");
const { getTaskCollectionResource, getTaskDetailResource } = await import("@/modules/tasks/application/vertical-slice/taskAuthoritativeQueries");
const shared = await import("@/shared/application");
const { ApplicationError } = await import("@/shared/domain");
const { useLeadDetailController } = await import("@/modules/leads/presentation/hooks/useLeadDetailController");
const { useLeadFormController } = await import("@/modules/leads/presentation/hooks/useLeadFormController");
const { LeadFormView } = await import("@/modules/leads/presentation/components/LeadFormView");
const { LeadDetailView } = await import("@/modules/leads/presentation/views/LeadDetailView");
const leads = await import("@/modules/leads");
const { configureLeadApplication, getLeadApplicationServices } = await import("@/modules/leads/application/composition/leadApplicationServices");
const lead: Lead = { id: "lead-work-x", name: "Work resource Lead", title: "", companyName: "Company", phone: "0901234567", email: "lead@example.test", source: "WEB", score: 0, ownerId: "u1", leadWorkState: "NEW", interestedProducts: [], activities: [], activitiesAuthority: "NOT_INCLUDED", resourceVersion: 3, createdAt: "2026-07-01T00:00:00Z" };
leads.saveLeadSnapshot(lead);
const makeTask = (id: string, status: Task["status"], recordId = lead.id, dueAt = "2020-01-01T00:00:00Z"): Task => ({ id, title: id, status, dueAt, assigneeId: "u1", priority: "NORMAL", recordRef: { moduleKey: "leads", recordId }, createdAt: lead.createdAt, updatedAt: lead.createdAt, resourceVersion: 1 });
let records = [makeTask("open-b", "OPEN"), makeTask("open-a", "OPEN"), makeTask("future", "OPEN", lead.id, "2099-01-01T00:00:00Z"), makeTask("done", "COMPLETED"), makeTask("cancelled", "CANCELLED"), makeTask("unrelated", "OPEN", "lead-y")];
const activities: Activity[] = ["NOTE", "CALL", "MEETING"].map((type) => ({ id: type, type: type as Activity["type"], subject: `Authority ${type}`, body: "Status: Completed is historical text", actorId: "u1", occurredAt: lead.createdAt, recordRef: { moduleKey: "leads", recordId: lead.id } }));
const requests: HttpRequest[] = [];
let rejectTasks = false;
let rejectActivities = false;
const client: HttpClient = {
  async request<TResponse, TBody = unknown>(request: HttpRequest<TBody>): Promise<TResponse> {
    requests.push(request);
    const query = request.query ?? {};
    if (request.operationId === "listTasks") {
      if (rejectTasks) throw new ApplicationError({ code: "NETWORK_ERROR", message: "fixture failure", category: "NETWORK", retryable: true });
      const filtered = records.filter((task) => !query.recordId || task.recordRef?.recordId === query.recordId);
      // Exercise cursor traversal as well as record filters on every page.
      const offset = query.cursor ? Number(query.cursor) : 0;
      return { items: filtered.slice(offset, offset + 2), pageInfo: { hasNextPage: offset + 2 < filtered.length, ...(offset + 2 < filtered.length ? { nextCursor: String(offset + 2) } : {}), totalCount: filtered.length } } as TResponse;
    }
    if (request.operationId === "listActivities" && rejectActivities) throw new ApplicationError({ code: "NETWORK_ERROR", message: "fixture activity failure", category: "NETWORK", retryable: true });
    if (request.operationId === "getTask") return records.find((task) => request.path.endsWith(task.id)) as TResponse;
    if (request.operationId === "listActivities") return { items: activities.filter((item) => !query.recordId || item.recordRef?.recordId === query.recordId), pageInfo: { hasNextPage: false } } as TResponse;
    if (request.operationId === "logActivity") {
      const activity: Activity = { ...activities[0], id: "new-note", subject: "New note" };
      activities.push(activity);
      return { commandId: "log", correlationId: "correlation", aggregateId: activity.id, aggregateType: "Activity", version: 1, occurredAt: lead.createdAt, outcome: "COMMITTED", result: { activity }, emittedEventIds: [], auditEvidenceIds: [], warnings: [] } as TResponse;
    }
    if (request.operationId === "completeTask") {
      const task = records.find((item) => request.path.includes(item.id));
      assert.ok(task);
      task.status = "COMPLETED";
      task.resourceVersion = 2;
      return { commandId: "complete", correlationId: "correlation", aggregateId: task.id, aggregateType: "Task", version: 2, occurredAt: lead.createdAt, outcome: "COMMITTED", result: { task }, emittedEventIds: [], auditEvidenceIds: [], warnings: [] } as TResponse;
    }
    throw new Error(`Unexpected operation ${request.operationId}`);
  },
};
configureTaskApplication({ repository: new InMemoryTaskActivityRepository({ tasks: [], activities: [] }), api: createTaskConnectedApiRuntime(client) });
tasks.replaceTaskActivitySnapshot({ tasks: [records[5]], activities: [] });
const resource = tasks.getScopedTaskCollectionResource({ filters: { recordModuleKey: "leads", recordId: lead.id } });
assert.equal(resource, tasks.getScopedTaskCollectionResource({ filters: { recordId: lead.id, recordModuleKey: "leads" } }), "Equivalent queries share a deterministic key");
const otherResource = tasks.getScopedTaskCollectionResource({ filters: { recordModuleKey: "leads", recordId: "lead-y" } });
assert.notEqual(resource, otherResource);
const activityResource = tasks.getActivityCollectionResource({ filters: { recordModuleKey: "leads", recordId: lead.id } });
const otherActivities = tasks.getActivityCollectionResource({ filters: { recordModuleKey: "leads", recordId: "lead-y" } });
assert.throws(() => tasks.getScopedTaskCollectionResource({ filters: { status: "OPEN" } }), /TASK_SCOPED_IDENTITY_QUERY_REQUIRED/);
assert.throws(() => tasks.getScopedTaskCollectionResource({ filters: { recordModuleKey: "leads", recordId: lead.id, status: "OPEN" } }), /TASK_SCOPED_IDENTITY_QUERY_REQUIRED/);
const countRequests = (operationId: string, recordId?: string) => requests.filter((request) => request.operationId === operationId && (recordId === undefined || request.query?.recordId === recordId)).length;
assert.equal(getTaskCollectionResource(), getTaskCollectionResource(), "Existing collection API is unchanged");
shared.declareUnavailableBusinessOperation("recordLeadConsent");
shared.declareUnavailableBusinessOperation("handoverLeadWithTasks");
let failureCode = "VERSION_CONFLICT";
const leadServices = getLeadApplicationServices();
configureLeadApplication({ ...leadServices, api: { ...leadServices.api, commands: { ...leadServices.api.commands, async replaceLeadProfile() { throw new ApplicationError({ code: failureCode, message: "private server diagnostics", userMessage: "Please review the conflicting changes.", category: "CONFLICT", retryable: false }); } } } });
let controller: ReturnType<typeof useLeadDetailController>;
let form: ReturnType<typeof useLeadFormController>;
let editing = false;
let dirty = false;
function FormProbe() {
  assert.ok(controller);
  form = useLeadFormController({ initialLead: lead, isEdit: true, onSubmit: controller.handleSaveEditFromForm, onCancel() {}, onDirtyChange: (value) => { dirty = value; } });
  return React.createElement(LeadFormView, { controller: form });
}
function Probe() {
  controller = useLeadDetailController({ authoritativeLead: lead });
  assert.ok(controller);
  return editing ? React.createElement(FormProbe) : React.createElement(LeadDetailView, { controller });
}
const rootElement = window.document.getElementById("root");
assert.ok(rootElement);
const root = createRoot(rootElement);
const render = async (key = "mount") => act(async () => root.render(React.createElement(I18nProvider, null,
  React.createElement(MemoryRouter, { key, initialEntries: [`/leads/${lead.id}`] },
    React.createElement(PlatformStateProvider, null, React.createElement(GuidanceProvider, null,
      React.createElement(Routes, null, React.createElement(Route, { path: "/leads/:leadId", element: React.createElement(Probe) }))))))));
const current = () => { assert.ok(controller); return controller; };
const currentForm = () => { assert.ok(form); return form; };
try {
  await render();
  assert.equal(current().workResources.taskQuery.state, "READY");
  assert.deepEqual(current().openLeadTasks.map((task) => task.id), ["open-a", "open-b", "future"]);
  assert.deepEqual(current().completedLeadTasks.map((task) => task.id), ["cancelled", "done"]);
  assert.deepEqual(current().workResources.overdueTasks.map((task) => task.id), ["open-a", "open-b"]);
  assert.equal(current().workResources.nextTask?.id, "open-a");
  assert.equal(current().leadNotes.length, 1);
  assert.equal(current().canRecordConsent, false);
  assert.equal(current().canHandover, false);
  assert.doesNotMatch(rootElement.textContent ?? "", /Ghi nhận đồng thuận|Record consent/);
  assert.ok(tasks.getTaskActivitySnapshot().tasks.some((task) => task.id === "unrelated"), "Scoped projection preserves other records");
  for (const request of requests.filter((request) => ["listTasks", "listActivities"].includes(request.operationId ?? ""))) {
    assert.equal(request.query?.recordModuleKey, "leads");
    assert.equal(request.query?.recordId, lead.id);
  }
  await act(async () => current().setActiveTab("open_activities"));
  assert.doesNotMatch(rootElement.querySelector("main")?.textContent ?? "", /Authority CALL|Authority MEETING/);
  assert.match(rootElement.querySelector("main")?.textContent ?? "", /Thêm công việc|Add Task/);
  assert.doesNotMatch(rootElement.querySelector("main")?.textContent ?? "", /Thêm lịch hẹn|Add Meeting/);
  await act(async () => current().setActiveTab("notes"));
  assert.match(rootElement.querySelector("main")?.textContent ?? "", /Authority NOTE/);
  assert.equal(current().lead.activities.length, 0, "Lead GET remains NOT_INCLUDED");
  await act(async () => { resource.reset(); tasks.getActivityCollectionResource({ filters: { recordModuleKey: "leads", recordId: lead.id } }).reset(); });
  await render("reload");
  await act(async () => current().setActiveTab("notes"));
  assert.match(rootElement.querySelector("main")?.textContent ?? "", /Authority NOTE/, "Notes survive reload through Activity authority");
  const removed = records.find((task) => task.id === "open-b");
  assert.ok(removed);
  assert.ok(tasks.getTaskSnapshot(removed.id));
  records = records.filter((task) => task.id !== removed.id);
  await act(async () => { await resource.refresh(); });
  assert.equal(tasks.getTaskSnapshot(removed.id), undefined, "Backend omission removes stale same-scope Task");
  assert.ok(tasks.getTaskSnapshot("unrelated"), "Other scope survives scoped replacement");
  records.push(removed);
  await act(async () => { await resource.refresh(); await otherResource.refresh(); await otherActivities.refresh(); await getTaskDetailResource("unrelated").refresh(); await getTaskDetailResource("open-a").refresh(); await getTaskCollectionResource().refresh(); });
  const otherBefore = countRequests("listTasks", "lead-y");
  const unrelatedDetailCount = () => requests.filter((request) => request.operationId === "getTask" && request.path.endsWith("unrelated")).length;
  const detailBefore = unrelatedDetailCount();
  const ownDetailBefore = requests.filter((request) => request.operationId === "getTask" && request.path.endsWith("open-a")).length;
  const activityBefore = countRequests("listActivities");
  const relevantBefore = countRequests("listTasks", lead.id);
  await act(async () => { await tasks.completeTaskCommand("open-a", { actorId: "u1", outcome: "Done" }); });
  assert.ok(countRequests("listTasks", lead.id) > relevantBefore);
  assert.equal(countRequests("listTasks", "lead-y"), otherBefore, "Unrelated loaded Lead is not refreshed");
  assert.equal(unrelatedDetailCount(), detailBefore, "Unrelated Task detail is not refreshed");
  assert.equal(requests.filter((request) => request.operationId === "getTask" && request.path.endsWith("open-a")).length, ownDetailBefore + 1, "Matching detail refreshes");
  assert.equal(countRequests("listActivities"), activityBefore, "Task mutation does not refresh Activity collections");
  const taskBeforeLog = countRequests("listTasks");
  const otherActivityBefore = countRequests("listActivities", "lead-y");
  await act(async () => { await tasks.logActivityCommand({ id: "new-note", type: "NOTE", subject: "New note", actorId: "u1", recordRef: { moduleKey: "leads", recordId: lead.id } }); });
  assert.equal(countRequests("listTasks"), taskBeforeLog, "Activity log does not refresh Task collections");
  assert.equal(countRequests("listActivities", "lead-y"), otherActivityBefore);
  assert.ok(current().leadNotes.some((note) => note.id === "new-note"));
  // Exercise each Task event, including movement between two loaded identity scopes.
  for (const commandType of ["task.create", "task.cancel", "task.assign", "task.reschedule", "task.archive"]) {
    const before = countRequests("listTasks", lead.id);
    await act(async () => { await shared.invalidateModuleQueries({ moduleKeys: ["tasks"], commandType, aggregateId: "open-a", occurredAt: lead.createdAt }); });
    assert.ok(countRequests("listTasks", lead.id) > before, commandType);
    assert.equal(countRequests("listTasks", "lead-y"), otherBefore);
  }
  const moving = records.find((task) => task.id === "open-b");
  assert.ok(moving);
  moving.recordRef = { moduleKey: "leads", recordId: "lead-y" };
  await act(async () => {
    shared.runBackendProjection("tasks", () => tasks.replaceTaskActivitySnapshot({ ...tasks.getRetainedTaskActivitySnapshot(), tasks: tasks.getRetainedTaskActivitySnapshot().tasks.map((task) => task.id === moving.id ? moving : task) }));
    await shared.invalidateModuleQueries({ moduleKeys: ["tasks"], commandType: "task.assign", aggregateId: moving.id, occurredAt: lead.createdAt });
  });
  assert.equal(resource.getSnapshot().data?.items.some((task) => task.id === moving.id), false);
  assert.equal(otherResource.getSnapshot().data?.items.some((task) => task.id === moving.id), true);

  assert.equal(current().openLeadTasks.some((task) => task.id === "open-a"), false);
  assert.equal(current().completedLeadTasks.some((task) => task.id === "open-a"), true, "Command invalidates scoped resources");
  await act(async () => { rejectTasks = true; await resource.refresh(); current().setActiveTab("open_activities"); });
  assert.equal(current().workResources.taskQuery.state, "ERROR");
  assert.ok(rootElement.querySelector('[data-authoritative-query-notice="stale"]'), "Refresh failure is visible while retaining prior data");
  await act(async () => { rejectTasks = false; await resource.refresh(); });
  await act(async () => { rejectActivities = true; await activityResource.refresh(); current().setActiveTab("email"); });
  assert.ok(rootElement.querySelector('[data-authoritative-query-notice="stale"]'));
  assert.ok(current().leadNotes.length > 0, "Stale Activity data remains available");
  await act(async () => { activityResource.reset(); await activityResource.refresh(); });
  for (const [tab, title] of [["email", "Không thể tải lịch sử Email."], ["sms", "Không thể tải lịch sử SMS."], ["notes", "Không thể tải ghi chú"]] as const) {
    await act(async () => current().setActiveTab(tab));
    assert.match(rootElement.querySelector("main")?.textContent ?? "", new RegExp(title));
    assert.doesNotMatch(rootElement.querySelector("main")?.textContent ?? "", /Thư mục Email rỗng|Lịch sử SMS trống/);
    assert.match(rootElement.querySelector("aside")?.textContent ?? "", /Không thể tải hoạt động\./);
    assert.ok([...rootElement.querySelectorAll("button")].some((button) => button.textContent?.trim() === "Thử lại"), "Initial errors offer Retry, never Cancel");
  }
  await act(async () => current().setActiveTab("details"));
  assert.match(rootElement.textContent ?? "", /Work resource Lead/, "Lead profile survives Activity failure");
  await act(async () => current().setActiveTab("email"));
  const retry = [...rootElement.querySelectorAll<HTMLButtonElement>("main button")].find((button) => button.textContent?.trim() === "Thử lại");
  assert.ok(retry);
  await act(async () => { rejectActivities = false; retry.click(); });
  assert.equal(activityResource.getSnapshot().state, "READY", "Retry reloads the failed Activity resource");
  for (const channel of ["email", "sms"] as const) {
    await act(async () => { current().setActiveTab(channel); if (channel === "email") current().setShowEmailModal(true); else current().setShowSmsModal(true); });
    assert.match(window.document.body.textContent ?? "", new RegExp(`Ghi nhận ${channel === "email" ? "Email" : "SMS"} ngoài CRM`));
    assert.match(window.document.body.textContent ?? "", /Lưu hoạt động/);
    assert.doesNotMatch(window.document.body.textContent ?? "", /Soạn & Gửi Email|Gửi Email|Gửi tin nhắn SMS|Send Email|Send SMS/);
    await act(async () => { current().setShowEmailModal(false); current().setShowSmsModal(false); });
  }
  await act(async () => current().setShowEditModal(true));
  editing = true;
  await render("reload");
  await act(async () => currentForm().setName("Retained edit draft"));
  assert.equal(dirty, true);
  for (const code of ["VERSION_CONFLICT", "SAVE_FAILED"]) {
    failureCode = code;
    await act(async () => currentForm().handleFormSubmit({ preventDefault() {} } as React.FormEvent));
    assert.equal(current().showEditModal, true);
    assert.equal(currentForm().name, "Retained edit draft");
    assert.equal(dirty, true, "Rejected submit must not mark the draft saved");
    assert.ok(currentForm().formError);
    assert.ok(window.document.getElementById("lead-form-error-summary")?.textContent);
    assert.doesNotMatch(currentForm().formError ?? "", /private server diagnostics/);
  }
  const labels = await import("@/modules/leads/presentation/leadLifecyclePresentation");
  assert.equal(labels.getLeadWorkStateLabel("CLOSED", "vi"), "Đã đóng");
  for (const [key, label] of [["DISQUALIFIED", "Không đủ điều kiện"], ["NURTURE", "Chăm sóc tiếp"], ["DIRECT_SALE", "Bán trực tiếp"]] as const) assert.equal(labels.getQualificationOutcomeLabel(key, "vi"), label);
  for (const file of ["hooks/useLeadDetailController.tsx", "views/LeadDetailView.tsx", "components/LeadWorkActivityTabs.tsx", "components/LeadDetailActivityPanel.tsx"]) {
    const source = readFileSync(`src/modules/leads/presentation/${file}`, "utf8");
    assert.doesNotMatch(source, /lead\.activities|onCompleteActivity|Trạng thái: Hoàn thành|Status: Completed/);
  }
  await act(async () => root.unmount());
  const originalWorkspace = workspace.getWorkspaceContextSnapshot().workspaceKey;
  const nextWorkspace = workspace.listWorkspaceMemberships().find((item) => item.workspaceId !== workspace.getWorkspaceContextSnapshot().workspaceId);
  assert.ok(nextWorkspace, "Workspace reset requires a second membership");
  const taskServices = getTaskApplicationServices();
  let release: ((page: AuthoritativePage<Task>) => void) | undefined;
  const delayedPage = new Promise<AuthoritativePage<Task>>((resolve) => { release = resolve; });
  configureTaskApplication({ ...taskServices, api: { ...taskServices.api, queries: {
    get: taskServices.api.queries.get.bind(taskServices.api.queries),
    listActivities: taskServices.api.queries.listActivities.bind(taskServices.api.queries),
    list: async () => delayedPage,
  } } });
  const obsoleteRequest = resource.refresh();
  await workspace.switchWorkspaceContext(nextWorkspace.workspaceKey);
  assert.ok(release);
  release({ items: records, pageInfo: { hasNextPage: false }, loadedAt: lead.createdAt, authority: "backend" });
  await obsoleteRequest;
  assert.equal(resource.getSnapshot().state, "IDLE", "Unmounted resources reset across workspaces");
  assert.deepEqual(tasks.getTaskActivitySnapshot(), { tasks: [], activities: [] });
  assert.equal(otherResource.getSnapshot().state, "IDLE");
  assert.equal(activityResource.getSnapshot().state, "IDLE");
  assert.equal(otherActivities.getSnapshot().state, "IDLE");
  assert.equal(getTaskCollectionResource().getSnapshot().state, "IDLE");
  assert.equal(getTaskDetailResource("unrelated").getSnapshot().state, "IDLE");
  assert.equal(getTaskDetailResource("open-a").getSnapshot().state, "IDLE");
  shared.runBackendProjection("tasks", () => tasks.replaceTaskActivitySnapshot({ tasks: [records[0]], activities: [activities[0]] }));
  assert.equal(tasks.getRetainedTaskActivitySnapshot().tasks.length, 1);
  assert.equal(tasks.getRetainedTaskActivitySnapshot().activities.length, 1);
  await workspace.switchWorkspaceContext(originalWorkspace);
  assert.deepEqual(tasks.getRetainedTaskActivitySnapshot(), { tasks: [], activities: [] }, "All-IDLE resources never bypass repository reset");
  console.log("Lead detail work resources: PASS (scoped HTTP, pagination, lifecycle, notes reload, mutation refresh, draft recovery, consent, workspace reset)");
} finally {
  await act(async () => root.unmount());
  window.close();
}
