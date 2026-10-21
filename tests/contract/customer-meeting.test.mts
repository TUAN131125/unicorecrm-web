import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import type { CreateTaskInput, TaskCommandOptions, TaskMutationResult } from "@/modules/tasks/application/ports/TaskApiRuntime";
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "http://localhost", pretendToBeVisual: true });
for (const key of ["window", "document", "navigator", "localStorage", "HTMLElement", "Element", "Node", "Event", "CustomEvent", "EventTarget", "MutationObserver"] as const) Object.defineProperty(globalThis, key, { value: key === "window" ? dom.window : dom.window[key], configurable: true });
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true, configurable: true });
Object.defineProperty(dom.window, "matchMedia", { value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) });
const React = await import("react"), { act } = React;
const { createRoot } = await import("react-dom/client");
const auth = await import("@/platform/identity-auth");
assert.ok(auth.signIn({ email: "admin@unicorecrm.local", password: "admin123" }).ok);
const { initializeApplicationComposition } = await import("@/app/composition"); await initializeApplicationComposition({ mode: "demo" });
const ac = await import("@/platform/access-control"), ws = await import("@/platform/workspace-context");
await ac.loadAccessGovernance(ws.getWorkspaceContextSnapshot().workspaceId);
const services = await import("@/modules/tasks/application/composition/taskApplicationServices");
const original = services.getTaskApplicationServices();
const { listWorkspaceMemberDirectory } = await import("@/platform/member-directory");
const self = listWorkspaceMemberDirectory()[0]; assert.ok(self);
let calls = 0, refreshes = 0, deferred = false;
let release: (() => void) | undefined;
const captured: Array<{ input: CreateTaskInput; options: TaskCommandOptions }> = [];
services.configureTaskApplication({ repository: original.repository, api: { ...original.api, mode: "connected", commands: { ...original.api.commands,
  async createTask(input, options): Promise<TaskMutationResult> {
    calls++; captured.push({ input, options });
    if (deferred) await new Promise<void>(resolve => { release = resolve; });
    const at = "2026-10-21T00:00:00Z", id = "task-fixture-" + calls;
    return { task: { ...input, priority: input.priority ?? "NORMAL", id, workspaceId: ws.getWorkspaceContextSnapshot().workspaceId, status: "OPEN", createdAt: at, updatedAt: at, resourceVersion: 0 }, evidence: { authority: "backend", commandId: id, correlationId: "fixture", aggregateId: id, aggregateType: "Task", version: 0, occurredAt: at, outcome: "COMMITTED", warnings: [], emittedEventIds: [], auditEvidenceIds: [] } };
  },
} } });
const { useCustomerMeeting } = await import("@/modules/customers/presentation/hooks/useCustomerMeeting");
const { I18nProvider } = await import("@/i18n");
let current: ReturnType<typeof useCustomerMeeting> | undefined;
const host = document.getElementById("root"); assert.ok(host); const root = createRoot(host);
function Probe({ status }: { status: string }) { current = useCustomerMeeting("customer-fixture", status, async () => { refreshes++; }); return null; }
async function render(status = "NEW") {
  const children = React.createElement(Probe, { status });
  const boundary = React.createElement(ac.EffectiveRecordAccessBoundary, { resourceKey: "customers", recordId: "customer-fixture", showNotice: false, children });
  await act(async () => root.render(React.createElement(I18nProvider, null, boundary)));
}
await render(); assert.ok(current?.canCreate);
await act(async () => current?.open()); assert.equal(current?.isOpen, true);
const draft = { title: "Meeting fixture", startAt: "2026-10-21T10:00", channel: "online" as const, owner: self.memberId, reminder: false };
assert.equal(await current?.save({ ...draft, owner: "untrusted-member" }), false); assert.equal(calls, 0);
await act(async () => { assert.equal(await current?.save(draft), true); });
assert.equal(calls, 1); assert.equal(refreshes, 1); assert.equal(captured[0]?.input.recordRef?.moduleKey, "customers"); assert.equal(captured[0]?.input.recordRef?.recordId, "customer-fixture"); assert.equal(captured[0]?.input.assigneeId, self.memberId);
await act(async () => current?.close()); await act(async () => current?.open()); deferred = true;
const pending = current?.save(draft); assert.equal(await current?.save(draft), false); assert.equal(calls, 2);
await act(async () => current?.close()); release?.(); await assert.rejects(Promise.resolve(pending), { name: "AbortError" }); assert.equal(refreshes, 1);
assert.notEqual(captured[0]?.options.idempotencyKey, captured[1]?.options.idempotencyKey);
await render("ARCHIVED"); assert.equal(current?.canCreate, false); await act(async () => current?.open()); assert.equal(current?.isOpen, false); assert.equal(await current?.save(draft), false); assert.equal(calls, 2);
await act(async () => root.unmount());
console.log("PASS isolated Customer Meeting: explicit assignee, canonical reference, stable intent, duplicate pending exclusion, close/abort retirement, archived denial and refresh only after owned commit");
