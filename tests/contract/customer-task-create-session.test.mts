import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "http://localhost", pretendToBeVisual: true });
for (const key of ["window", "document", "navigator", "localStorage", "HTMLElement", "Element", "Node", "Event", "CustomEvent", "EventTarget", "MutationObserver"] as const)
  Object.defineProperty(globalThis, key, { value: key === "window" ? dom.window : dom.window[key], configurable: true });
Object.defineProperties(globalThis, {
  IS_REACT_ACT_ENVIRONMENT: { value: true, configurable: true },
  getComputedStyle: { value: dom.window.getComputedStyle.bind(dom.window), configurable: true },
  requestAnimationFrame: { value: dom.window.requestAnimationFrame.bind(dom.window), configurable: true },
  cancelAnimationFrame: { value: dom.window.cancelAnimationFrame.bind(dom.window), configurable: true },
  ResizeObserver: { value: class { observe() {} unobserve() {} disconnect() {} }, configurable: true },
});
Object.defineProperty(dom.window.HTMLElement.prototype, "scrollIntoView", { value() {}, configurable: true });
Object.defineProperty(dom.window, "matchMedia", { value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) });
const React = await import("react"), { act } = React;
const { createRoot } = await import("react-dom/client");
const auth = await import("@/platform/identity-auth");
assert.ok(auth.signIn({ email: "admin@unicorecrm.local", password: "admin123" }).ok);
const { initializeApplicationComposition } = await import("@/app/composition");
await initializeApplicationComposition({ mode: "demo" });
const ws = await import("@/platform/workspace-context"), ac = await import("@/platform/access-control");
await ac.loadAccessGovernance(ws.getWorkspaceContextSnapshot().workspaceId);
const services = await import("@/modules/tasks/application/composition/taskApplicationServices");
const original = services.getTaskApplicationServices();
const inputs: Array<Parameters<typeof original.api.commands.createTask>[0]> = [], keys: string[] = [];
const { ApplicationError } = await import("@/shared/domain");
let hold = true, reject = true, release: (() => void) | undefined;
services.configureTaskApplication({ ...original, api: { ...original.api, commands: { ...original.api.commands,
  async createTask(input, options) {
    inputs.push(input); keys.push(options.idempotencyKey);
    if (hold) await new Promise<void>(resolve => { release = resolve; });
    if (reject) throw new ApplicationError({ code: "NETWORK_ERROR", category: "NETWORK", message: "Private diagnostic", retryable: true });
    return original.api.commands.createTask(input, options);
  },
} } });
const { TaskCreateModal } = await import("@/modules/tasks");
const { I18nProvider } = await import("@/i18n"), { MemoryRouter } = await import("react-router-dom");
const { getDirtyUnsavedWork } = await import("@/platform/unsaved-work");
const host = document.getElementById("root"); assert.ok(host);
const root = createRoot(host);
let target = "customer-A", open = true, created = 0, closed = 0;
async function render() {
  await act(async () => root.render(React.createElement(I18nProvider, null, React.createElement(MemoryRouter, null,
    React.createElement(TaskCreateModal, { key: target, targetId: target, isOpen: open, formId: "session-task-form",
      context: { recordRef: { moduleKey: "customers", recordId: target }, sourceRef: { type: "CUSTOMER_360", id: target }, label: `Authorized ${target}` },
      defaults: { dueAt: "2027-01-02T17:00" },
      onClose() { closed++; open = false; void render(); }, onCreated() { created++; },
    })))));
}
async function changeTitle(value: string) {
  const input = document.querySelector<HTMLInputElement>("#task-create-title"); assert.ok(input);
  await act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")?.set?.call(input, value); input.dispatchEvent(new dom.window.Event("input", { bubbles: true })); });
}
async function submit(times = 1) {
  const form = document.getElementById("session-task-form"); assert.ok(form);
  await act(async () => { for (let i = 0; i < times; i++) form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })); });
}
try {
  await render(); await changeTitle("Customer A task");
  const stale = getDirtyUnsavedWork()[0]; assert.ok(stale);
  await submit(2); assert.equal(inputs.length, 1, "double submit sends one request");
  assert.equal(inputs[0]?.recordRef?.moduleKey, "customers"); assert.equal(inputs[0]?.recordRef?.recordId, "customer-A");
  assert.equal(inputs[0]?.relationshipRef, undefined); assert.equal(inputs[0]?.sourceRef?.type, "CUSTOMER_360");
  await act(async () => release?.());
  assert.equal(document.querySelector<HTMLInputElement>("#task-create-title")?.value, "Customer A task");
  assert.ok(document.querySelector('[role="alert"]')); assert.ok(!document.body.textContent?.includes("Private diagnostic"));
  hold = false; reject = false; await submit();
  assert.equal(inputs.length, 2); assert.deepEqual(inputs[0], inputs[1]); assert.equal(keys[0], keys[1], "unknown outcome retry preserves exact intent/key");
  assert.equal(created, 1); assert.equal(closed, 1);
  target = "customer-B"; open = true; await render();
  assert.equal(await stale.save(), false, "retired Customer registration cannot create another task");
  assert.equal(document.querySelector<HTMLInputElement>("#task-create-title")?.value, "");
  await changeTitle("Customer B draft"); const workspaceDraft = getDirtyUnsavedWork()[0]; assert.ok(workspaceDraft);
  const current = ws.getWorkspaceContextSnapshot();
  const alternate = ws.listWorkspaceMemberships().find(m => m.status === "active" && m.workspaceId !== current.workspaceId); assert.ok(alternate);
  await act(async () => { await ws.switchWorkspaceContext(alternate.workspaceKey); });
  assert.equal(await workspaceDraft.save(), false, "retired Workspace cannot save Customer draft");
  assert.equal(inputs.length, 2);
  console.log("PASS Customer Task modal: exact record/source, no relationshipRef, duplicate submit, unknown outcome same-key retry, draft retention, success callbacks, Customer and Workspace retirement. In-process protocol evidence only.");
} finally { await act(async () => root.unmount()); }
