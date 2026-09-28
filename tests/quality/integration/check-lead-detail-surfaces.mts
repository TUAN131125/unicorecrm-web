import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import type { Task, Activity } from "@/modules/tasks";
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
const { configureTaskApplication } = await import("@/modules/tasks/application/composition/taskApplicationServices");
const { InMemoryTaskActivityRepository } = await import("@/modules/tasks/infrastructure/InMemoryTaskActivityRepository");
const { createTaskConnectedApiRuntime } = await import("@/modules/tasks/infrastructure/http/createTaskConnectedApiRuntime");
const shared = await import("@/shared/application");
const { ApplicationError } = await import("@/shared/domain");
const { useLeadDetailController } = await import("@/modules/leads/presentation/hooks/useLeadDetailController");
const { LeadDetailView } = await import("@/modules/leads/presentation/views/LeadDetailView");
const leads = await import("@/modules/leads");
const { configureLeadApplication, getLeadApplicationServices } = await import("@/modules/leads/application/composition/leadApplicationServices");
let lead: Lead = { id: "lead-work-x", name: "Work resource Lead", title: "", companyName: "Company", phone: "0901234567", email: "lead@example.test", source: "WEB", score: 0, ownerId: "u1", leadWorkState: "NEW", interestedProducts: [], activities: [], activitiesAuthority: "NOT_INCLUDED", resourceVersion: 3, createdAt: "2026-07-01T00:00:00Z" };
leads.saveLeadSnapshot(lead);

const requests: HttpRequest[] = [];
const records: Task[] = [];
const activities: Activity[] = [];
let rejectActivity = false;
let releaseActivity: (() => void) | undefined;
let holdActivity = false;
const client: HttpClient = {
  async request<TResponse, TBody = unknown>(request: HttpRequest<TBody>): Promise<TResponse> {
    requests.push(request);
    if (request.operationId === "listTasks") return { items: records, pageInfo: { hasNextPage: false } } as TResponse;
    if (request.operationId === "listActivities") return { items: activities, pageInfo: { hasNextPage: false } } as TResponse;
    const evidence = { commandId: "surface-command", correlationId: "surface-correlation", version: 1, occurredAt: lead.createdAt, outcome: "COMMITTED", emittedEventIds: [], auditEvidenceIds: [], warnings: [] };
    if (request.operationId === "createTask") {
      const body = request.body as Partial<Task>;
      const task: Task = { id: "surface-task", title: "Surface task", assigneeId: "u1", dueAt: "2099-01-01T00:00:00Z", priority: "NORMAL", status: "OPEN", createdAt: lead.createdAt, updatedAt: lead.createdAt, ...body };
      records.push(task);
      return { ...evidence, aggregateId: task.id, aggregateType: "Task", result: { task } } as TResponse;
    }
    if (request.operationId === "logActivity") {
      if (holdActivity) await new Promise<void>(resolve => { releaseActivity = resolve; });
      if (rejectActivity) throw new ApplicationError({ code: "SAVE_FAILED", message: "private diagnostics", category: "CONFLICT", retryable: false });
      const activity = { id: `surface-activity-${activities.length}`, actorId: "u1", occurredAt: lead.createdAt, ...request.body as Partial<Activity> } as Activity;
      activities.push(activity);
      return { ...evidence, aggregateId: activity.id, aggregateType: "Activity", result: { activity } } as TResponse;
    }
    throw new Error(`Unexpected operation ${request.operationId}`);
  },
};
configureTaskApplication({ repository: new InMemoryTaskActivityRepository({ tasks: [], activities: [] }), api: createTaskConnectedApiRuntime(client) });
shared.declareUnavailableBusinessOperation("handoverLeadWithTasks");
let failureCode: string | null = "VERSION_CONFLICT";
const leadServices = getLeadApplicationServices();
configureLeadApplication({ ...leadServices, api: { ...leadServices.api, commands: { ...leadServices.api.commands, async replaceLeadProfile(...args) {
  if (failureCode) throw new ApplicationError({ code: failureCode, message: "private server diagnostics", category: "CONFLICT", retryable: false });
  const result = await leadServices.api.commands.replaceLeadProfile(...args);
  lead = { ...lead, ...result.lead };
  return result;
} } } });
let controller: ReturnType<typeof useLeadDetailController>;
function Probe() {
  controller = useLeadDetailController({ authoritativeLead: lead });
  assert.ok(controller);
  return React.createElement(LeadDetailView, { controller });
}
const rootElement = document.getElementById("root");
assert.ok(rootElement);
const root = createRoot(rootElement);
const render = async (key = "mount") => act(async () => root.render(React.createElement(I18nProvider, null,
  React.createElement(MemoryRouter, { key, initialEntries: [`/leads/${lead.id}`] },
    React.createElement(PlatformStateProvider, null, React.createElement(GuidanceProvider, null,
      React.createElement(Routes, null,
        React.createElement(Route, { path: "/leads/:leadId", element: React.createElement(Probe) }),
        React.createElement(Route, { path: "/leads/:leadId/qualify", element: React.createElement("p", null, "Qualification destination") })
      )))))));
const current = () => { assert.ok(controller); return controller; };
const drawer = () => { const element = document.querySelector<HTMLElement>('[data-surface="drawer"]'); assert.ok(element, "Expected Drawer"); assert.equal(document.querySelectorAll('[data-surface="drawer"]').length, 1); return element; };
const modal = () => {
  assert.equal(document.querySelector('[data-surface="drawer"]'), null, "Bounded transaction must not open Drawer");
  const element = document.querySelector<HTMLElement>('[data-dialog-variant="form"]'); assert.ok(element, "Expected centered Form Modal");
  assert.equal(document.querySelectorAll('[data-dialog-variant="form"]').length, 1, "Only one work form");
  return element;
};
const click = async (name: string, scope: ParentNode = document) => {
  const button = [...scope.querySelectorAll<HTMLButtonElement>("button")].find(item => (item.getAttribute("aria-label") || item.textContent?.trim()) === name);
  assert.ok(button, `Missing button: ${name}`);
  await act(async () => button.click());
};
const change = async (selector: string, value: string) => {
  const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector); assert.ok(input, selector);
  const prototype = input.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  await act(async () => { Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(input, value); input.dispatchEvent(new window.Event("input", { bubbles: true })); });
};
const submit = async () => { const form = document.querySelector('[role="dialog"] form'); assert.ok(form); await act(async () => form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }))); };
const close = async () => document.querySelector('[data-surface="drawer"]') ? click("Đóng bảng điều khiển", drawer()) : click("Đóng hộp thoại", modal());
const rail = () => { const element = rootElement.querySelector("aside"); assert.ok(element); return element; };
const settle = async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 80)); }); };
try {
  await render(); await settle();
  assert.equal(current().canHandover, false);
  assert.doesNotMatch(rail().textContent ?? "", /Bàn giao/);
  const beforeOpen = requests.length;
  await act(async () => { const button = document.querySelector<HTMLButtonElement>("#edit-direct-btn"); assert.ok(button); button.click(); }); await settle();
  assert.match(drawer().textContent ?? "", /Chỉnh sửa Chi tiết/);
  assert.ok(drawer().className.includes("xl:w-[65vw]"));
  assert.ok(drawer().className.includes("lg:max-w-[960px]"));
  assert.equal(document.querySelector('[data-dialog-variant="form"]'), null, "Edit must not mount centered modal");
  for (const id of ["lead-name", "lead-phone", "lead-email", "lead-company-name", "lead-source", "lead-owner"]) assert.ok(drawer().querySelector(`#${id}`), `Existing field ${id}`);
  assert.equal(requests.length, beforeOpen, "Opening Edit adds no unrelated HTTP");
  await change("#lead-name", "Retained surface draft");
  for (const code of ["VERSION_CONFLICT", "SAVE_FAILED"]) {
    failureCode = code; await submit();
    assert.equal(document.querySelector<HTMLInputElement>("#lead-name")?.value, "Retained surface draft");
    assert.ok(drawer().querySelector("#lead-form-error-summary")?.textContent);
    assert.doesNotMatch(drawer().textContent ?? "", /private server diagnostics/);
    await close();
    assert.ok(document.querySelector('[data-dialog-variant="form"]'), "Dirty failure opens discard confirmation above live Drawer");
    await click("Tiếp tục chỉnh sửa"); assert.ok(drawer());
  }
  await close(); await click("Bỏ thay đổi"); assert.equal(document.querySelector('[data-surface="drawer"]'), null);
  await act(async () => { const button = document.querySelector<HTMLButtonElement>("#edit-direct-btn"); assert.ok(button); button.click(); }); await settle(); await change("#lead-name", "Saved surface draft"); failureCode = null; await submit();
  assert.equal(document.querySelector('[data-surface="drawer"]'), null, "Successful edit closes Drawer");
  await click("Thêm công việc", rail()); assert.match(modal().textContent ?? "", /Tạo công việc/);
  await act(async () => current().handleActivityQuickAction("email"));
  assert.match(modal().textContent ?? "", /Tạo công việc/, "A second trigger cannot replace a live form");
  await act(async () => { const picker = document.querySelector<HTMLButtonElement>("#task-create-assigneeId"); assert.ok(picker); picker.click(); });
  assert.ok(modal().querySelector('[data-floating-overlay="menu"]'), "Picker portal belongs to the Modal focus/layer scope");
  await act(async () => window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  assert.equal(modal().querySelector('[data-floating-overlay="menu"]'), null, "Escape dismisses picker before Modal");
  await change("#task-create-title", "Surface task"); await submit();
  assert.equal(document.querySelector('[data-surface="drawer"]'), null);
  const createRequest = requests.find(item => item.operationId === "createTask"); assert.ok(createRequest);
  assert.deepEqual((createRequest.body as { recordRef: unknown }).recordRef, { moduleKey: "leads", recordId: lead.id, label: lead.name });
  await click("Ghi nhận cuộc gọi", rail()); assert.match(modal().textContent ?? "", /Ghi nhận cuộc gọi/); await close();
  await click("Ghi nhận Email ngoài CRM", rail());
  assert.match(modal().textContent ?? "", /Ghi nhận Email ngoài CRM/); assert.match(modal().textContent ?? "", /Lưu hoạt động/);
  assert.doesNotMatch(modal().textContent ?? "", /Gửi Email|Soạn.*Email/);
  await change('#lead-quick-email-form input:not([type="email"])', "External email");
  await change("#lead-quick-email-form textarea", "Already sent outside CRM");
  rejectActivity = true; await submit(); assert.ok(modal().querySelector('[role="alert"]'));
  assert.doesNotMatch(modal().textContent ?? "", /private diagnostics/);
  await close(); await click("Tiếp tục chỉnh sửa"); rejectActivity = false;
  holdActivity = true;
  const logCount = requests.filter(item => item.operationId === "logActivity").length;
  await submit(); await submit(); await close();
  assert.ok(modal());
  assert.equal(requests.filter(item => item.operationId === "logActivity").length, logCount + 1, "Pending submission cannot duplicate or close");
  holdActivity = false; assert.ok(releaseActivity); await act(async () => releaseActivity?.());
  assert.equal(activities.at(-1)?.type, "EMAIL"); assert.equal(document.querySelector('[data-surface="drawer"]'), null);
  await click("Thao tác khác", rail()); assert.ok(document.querySelector('[role="menu"]'));
  await click("Đặt lịch hẹn", document.querySelector('[role="menu"]') ?? document);
  assert.equal(document.querySelector('[role="menu"]'), null); assert.match(modal().textContent ?? "", /Ghi nhận lịch hẹn/);
  await change("#lead-quick-meeting-form input", "Surface meeting"); await submit(); assert.equal(activities.at(-1)?.type, "MEETING");
  await click("Thao tác khác", rail()); await click("Ghi nhận SMS ngoài CRM", document.querySelector('[role="menu"]') ?? document);
  assert.match(modal().textContent ?? "", /Ghi nhận SMS ngoài CRM/); assert.doesNotMatch(modal().textContent ?? "", /Gửi tin nhắn/);
  await change("#lead-quick-sms-form textarea", "External SMS"); await submit(); assert.equal(activities.at(-1)?.type, "SYSTEM");
  await act(async () => { const button = document.querySelector<HTMLButtonElement>("#header-more-actions-btn"); assert.ok(button); button.click(); }); await click("Lưu trữ Lead", document.querySelector('[role="menu"]') ?? document);
  assert.equal(document.querySelector('[data-surface="drawer"]'), null); assert.ok(document.querySelector('[data-dialog-variant="form"]'));
  await act(async () => current().setShowArchiveConfirm(false));
  shared.resetBusinessOperationAvailability(); await render("handover"); await settle();
  assert.equal(current().canHandover, true); await click("Bàn giao", rail()); assert.match(modal().textContent ?? "", /Bàn giao Lead & công việc/);
  assert.match(modal().textContent ?? "", /Các công việc đang mở liên kết với Lead/);
  const owner = modal().querySelector("select"); assert.ok(owner);
  const nextOwner = [...owner.options].find(option => option.value !== lead.ownerId); assert.ok(nextOwner);
  await act(async () => { owner.value = nextOwner.value; owner.dispatchEvent(new window.Event("change", { bubbles: true })); });
  await change("#lead-handover-form textarea", "Retain handover reason");
  current().leadActions.handover = async () => { throw new ApplicationError({ code: "SAVE_FAILED", message: "private handover diagnostics", category: "CONFLICT", retryable: false }); };
  await submit(); assert.ok(modal().querySelector('[role="alert"]'));
  assert.equal(modal().querySelector("textarea")?.value, "Retain handover reason");
  assert.equal(modal().querySelector("select")?.value, nextOwner.value);
  assert.doesNotMatch(modal().textContent ?? "", /private handover diagnostics/);
  await close(); await click("Bỏ thay đổi");

  // Disqualification is explicitly exempt from VERIFYING in domain closeLead.
  const { closeLead } = await import("@/modules/leads/domain/rules/leadLifecycle");
  const openHeader = async () => act(async () => { const button = document.querySelector<HTMLButtonElement>("#header-more-actions-btn"); assert.ok(button); button.click(); });
  for (const state of ["NEW", "CONTACTING", "VERIFYING"] as const) {
    lead = { ...lead, leadWorkState: state }; await render(`disqualify-${state}`); await settle();
    assert.equal(closeLead(lead, { outcome: "DISQUALIFIED" }).leadWorkState, "CLOSED");
    await openHeader(); await click("Không đạt", document.querySelector('[role="menu"]') ?? document);
    assert.match(modal().textContent ?? "", /Xác nhận không đạt/);
    assert.ok(modal().querySelector("select")); assert.ok(modal().querySelector("textarea"));
    await close();
  }
  lead = { ...lead, leadWorkState: "CLOSED", qualificationOutcome: "DISQUALIFIED" }; await render("closed-disqualify"); await settle();
  await openHeader(); assert.doesNotMatch(document.querySelector('[role="menu"]')?.textContent ?? "", /Không đạt/);
  lead = { ...lead, leadWorkState: "NEW", qualificationOutcome: undefined, tags: ["VIP"] }; await render("tags"); await settle();
  await openHeader(); await click("Quản lý nhãn", document.querySelector('[role="menu"]') ?? document);
  const tags = document.querySelector<HTMLElement>('[data-floating-overlay="menu"][role="dialog"]'); assert.ok(tags, "Tags use anchored portal");
  assert.equal(document.querySelector('[data-dialog-variant="form"]'), null); assert.equal(document.querySelector('[data-surface="drawer"]'), null);
  assert.match(tags.textContent ?? "", /Nhãn mới|VIP/); assert.ok(tags.querySelector('[aria-label="Gỡ nhãn VIP"]'));
  await change('[data-floating-overlay="menu"][role="dialog"] input', "Hot"); await click("Thêm", tags); await settle();
  assert.ok(lead.tags?.includes("Hot"));
  await click("Gỡ nhãn Hot", tags); await settle(); assert.equal(lead.tags?.includes("Hot"), false);
  await act(async () => window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  assert.equal(document.querySelector('[data-floating-overlay="menu"][role="dialog"]'), null);
  lead = { ...lead, leadWorkState: "VERIFYING" }; await render("qualify"); await settle();
  await click("Thao tác khác", rail()); await click("Chốt kết quả", document.querySelector('[role="menu"]') ?? document);
  assert.match(rootElement.textContent ?? "", /Qualification destination/); assert.equal(document.querySelector('[data-surface="drawer"]'), null);
  // Shared consumers keep centered defaults unless they explicitly opt in.
  await act(async () => root.render(React.createElement(I18nProvider, null,
    React.createElement(tasks.EmailActivityCreateModal, { isOpen: true, onClose() {}, onSubmit() {} }))));
  assert.equal(document.querySelector('[data-surface="drawer"]'), null);
  assert.ok(document.querySelector('[data-dialog-variant="form"]'));
  assert.match(document.querySelector('[role="dialog"]')?.textContent ?? "", /Gửi Email/);
  console.log("Lead detail surfaces: PASS (wide Edit, bounded modals, anchored tags, distinct early disqualification, contracts, recovery, qualification)");
} finally { await act(async () => root.unmount()); window.close(); await new Promise(resolve => setTimeout(resolve, 3100)); }
