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
let failureCode: string | null = null;
let holdSave = false;
let releaseSave: (() => void) | undefined;
const mutations: { id: string; version: number; name: string }[] = [];
const leadServices = getLeadApplicationServices();
configureLeadApplication({ ...leadServices, api: { ...leadServices.api, commands: { ...leadServices.api.commands, async replaceLeadProfile(...args) {
  mutations.push({ id: args[0], version: args[2].expectedVersion, name: args[1].displayName });
  if (holdSave) await new Promise<void>(resolve => { releaseSave = resolve; });
  if (failureCode) throw new ApplicationError({ code: failureCode, message: "private server diagnostics", category: "CONFLICT", retryable: false });
  const result = await leadServices.api.commands.replaceLeadProfile(...args);
  if (lead.id === result.lead.id) lead = { ...lead, ...result.lead };
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

const { getDirtyUnsavedWork, discardDirtyUnsavedWork } = await import('@/platform/unsaved-work');
const A = structuredClone(lead);
const B: Lead = { ...A, id: 'lead-target-B', name: 'Lead B', phone: '0987654321', resourceVersion: 9 };
leads.saveLeadSnapshot(B);
const openEdit = async () => { await act(async () => current().setShowEditModal(true)); await settle(); };
const switchTo = async (next: Lead) => { await act(async () => { lead = next; current().navigate('/leads/' + next.id); }); await settle(); };
try {
  await render(); await settle(); await openEdit();
  assert.equal(document.querySelector<HTMLInputElement>('#lead-name')?.value, A.name);
  await change('#lead-name', 'Draft A'); await settle();
  assert.ok(getDirtyUnsavedWork().some(entry => entry.id === 'lead-form:' + A.id));
  await switchTo(B);
  assert.equal(document.querySelector<HTMLInputElement>('#lead-name')?.value, 'Draft A');
  assert.equal(current().lead.id, A.id);
  assert.ok(document.querySelector('[data-surface="drawer"]'));
  await click('Tiếp tục chỉnh sửa'); await settle();
  assert.equal(document.querySelector<HTMLInputElement>('#lead-name')?.value, 'Draft A');
  await submit(); await settle();
  assert.equal(mutations[0]?.id, A.id); assert.equal(mutations[0]?.version, 3);
  assert.equal(document.querySelector('[data-surface="drawer"]'), null);
  assert.equal(current().lead.id, B.id);
  await openEdit(); assert.equal(document.querySelector<HTMLInputElement>('#lead-name')?.value, B.name);
  assert.equal(getDirtyUnsavedWork().some(entry => entry.id === 'lead-form:' + B.id), false);
  await switchTo(A); assert.equal(document.querySelector('[data-surface="drawer"]'), null);
  await openEdit();
  const openingName = document.querySelector<HTMLInputElement>('#lead-name')?.value ?? '';
  await change('#lead-name', 'Refresh-safe draft'); await settle();
  lead = { ...A, name: 'Background A', resourceVersion: 10 }; await render(); await settle();
  assert.equal(document.querySelector<HTMLInputElement>('#lead-name')?.value, 'Refresh-safe draft');
  assert.equal(current().dialogs.boundLead?.resourceVersion, A.resourceVersion);
  await change('#lead-name', openingName); await settle();
  assert.equal(getDirtyUnsavedWork().some(entry => entry.id === 'lead-form:' + A.id), false);
  await change('#lead-name', 'Discard A'); await switchTo(B);
  await click('Bỏ thay đổi'); await settle();
  assert.equal(document.querySelector('[data-surface="drawer"]'), null);
  await openEdit(); assert.equal(document.querySelector<HTMLInputElement>('#lead-name')?.value, B.name);
  await change('#lead-name', 'Pending B'); await settle(); holdSave = true;
  await submit(); await settle();
  const beforeDuplicate = mutations.length; await submit(); assert.equal(mutations.length, beforeDuplicate);
  await switchTo(A); assert.equal(current().lead.id, B.id);
  assert.equal(mutations.at(-1)?.id, B.id); assert.equal(mutations.at(-1)?.version, 9);
  await act(async () => discardDirtyUnsavedWork()); assert.equal(current().lead.id, B.id);
  assert.ok(releaseSave); holdSave = false; await act(async () => releaseSave?.()); await settle();
  assert.equal(current().lead.id, A.id); await openEdit();
  assert.equal(document.querySelector<HTMLInputElement>('#lead-name')?.value, A.name);
  await change('#lead-name', 'Normal dirty close'); await close(); await settle();
  await click('Tiếp tục chỉnh sửa'); await settle();
  assert.equal(document.querySelector<HTMLInputElement>('#lead-name')?.value, 'Normal dirty close');
  await close(); await click('Bỏ thay đổi'); await settle();
  await openEdit();
  await close(); await settle();
  // Sibling form keeps A identity across an attempted route change until explicit resolution.
  await act(async () => current().handleActivityQuickAction('email')); await settle();
  await switchTo(B); assert.equal(current().lead.id, A.id);
  await act(async () => discardDirtyUnsavedWork()); await settle(); assert.equal(current().lead.id, B.id);
  assert.equal(current().callForm.potential, B.name);
  assert.equal(current().callForm.phone, B.phone);
  assert.equal(current().meetingForm.performer, B.ownerId || '');
  await act(async () => current().setShowHandoverModal(true)); await settle();
  await switchTo(A); assert.equal(current().dialogs.boundLead?.id, B.id);
  await act(async () => discardDirtyUnsavedWork()); await settle();
  assert.equal(current().lead.id, A.id); await switchTo(B);
  for (const kind of ['call', 'task', 'meeting', 'email', 'sms'] as const) {
    await act(async () => current().handleActivityQuickAction(kind)); await settle();
    assert.equal(current().dialogs.boundLead?.id, B.id);
    await switchTo(A); assert.equal(current().lead.id, B.id, `${kind} retains opening target`);
    await act(async () => discardDirtyUnsavedWork()); await settle();
    assert.equal(current().lead.id, A.id);
    await switchTo(B);
  }
  console.log('Lead target identity lifecycle: PASS (dirty/clean switch, same-target refresh, revert, command target/version, in-flight/duplicate, discard/reopen, sibling binding and router registry).');
} finally { await act(async () => root.unmount()); window.close(); }
