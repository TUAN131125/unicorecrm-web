import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import type { Lead } from "@/modules/leads";

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: "http://localhost", pretendToBeVisual: true });
const { window } = dom;
const browserErrors: unknown[] = [];
window.addEventListener("error", event => browserErrors.push(event.error));
Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", { value() {}, configurable: true });
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
const { ApplicationError } = await import('@/shared/domain');
const leads = await import('@/modules/leads');
const { configureLeadApplication, getLeadApplicationServices } = await import('@/modules/leads/application/composition/leadApplicationServices');
const { LeadQualificationPage } = await import('@/workflows/lead-qualification/presentation/pages/LeadQualificationPage');
const { useNavigate, useLocation } = await import('react-router-dom');
const { getDirtyUnsavedWork, discardDirtyUnsavedWork } = await import('@/platform/unsaved-work');
const { AppShell } = await import('@/app/shell/layout/AppShell');
const { createMemoryRouter, RouterProvider } = await import('react-router-dom');
const { usePlatformState } = await import('@/platform/application-state');
const { registerUnsavedWork } = await import('@/platform/unsaved-work');
const A: Lead = { id: 'workspace-veto-A', name: 'Workspace veto A', title: '', companyName: 'Company A', phone: '0901234567', email: 'a@example.test', source: 'WEB', score: 0, ownerId: 'u1', leadWorkState: 'VERIFYING', interestedProducts: [], activities: [], resourceVersion: 3, createdAt: '2026-07-01T00:00:00Z' };
leads.replaceLeads([A]);
let rejectPending: ((error: unknown) => void) | undefined;
const commands: { id: string; version: number }[] = [];
const services = getLeadApplicationServices();
configureLeadApplication({ ...services, api: { ...services.api, commands: { ...services.api.commands, async disqualifyLead(id, _input, options) {
  commands.push({ id, version: options.expectedVersion });
  await new Promise<never>((_resolve, reject) => { rejectPending = reject; });
  throw new Error('unreachable');
} } } });
let unrelatedDiscardCount = 0;
const unregister = registerUnsavedWork({ id: 'workspace-unrelated-first', title: 'Unrelated draft first', isDirty: true, canDiscard: () => true, save: async () => true, discard: () => { unrelatedDiscardCount++; } });
let displayedWorkspace = ''; let unmounts = 0;
function Probe() {
  displayedWorkspace = usePlatformState().activeWorkspace.workspaceKey;
  React.useEffect(() => () => { unmounts++; }, []);
  return React.createElement(LeadQualificationPage);
}
const openingWorkspace = workspace.getWorkspaceContextSnapshot();
const nextWorkspace = workspace.listWorkspaceMemberships().find(item => item.status === 'active' && item.workspaceKey !== openingWorkspace.workspaceKey); assert.ok(nextWorkspace, 'two real demo memberships required');
const openingPath = `/w/${openingWorkspace.workspaceKey}/crm/leads/${A.id}/qualify`;
const router = createMemoryRouter([{ path: '/w/:workspaceKey/crm/leads/:leadId/qualify', element:
  React.createElement(I18nProvider, null, React.createElement(PlatformStateProvider, null, React.createElement(GuidanceProvider, null,
    React.createElement(AppShell, { children: React.createElement(Probe) })))) }], { initialEntries: [openingPath] });
const rootElement = document.getElementById('root'); assert.ok(rootElement); const root = createRoot(rootElement);
const settle = async () => act(async () => { await new Promise(resolve => setTimeout(resolve, 80)); });
async function click(text: string) { const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.trim() === text || item.textContent?.includes(text)); assert.ok(button, text); await act(async () => button.click()); await settle(); }
async function change(selector: string, value: string) { const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector); assert.ok(input); const prototype = input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype; await act(async () => { Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(input, value); input.dispatchEvent(new window.Event('input', { bubbles: true })); }); }
try {
  await act(async () => root.render(React.createElement(RouterProvider, { router }))); await settle();
  await click('Không đủ điều kiện'); await change('#qualification-disqualified-reason', 'Pending A draft'); await change('#qualification-disqualified-evidence', 'A evidence');
  const form = document.querySelector('form.crm-form-surface'); assert.ok(form); await act(async () => form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))); await settle();
  assert.deepEqual(commands, [{ id: A.id, version: 3 }]);
  const selector = [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.title.startsWith('Không gian làm việc:') || button.title.startsWith('Workspace:')); assert.ok(selector);
  await act(async () => selector.click()); await settle(); await click(nextWorkspace.name); await click('Bỏ thay đổi');
  assert.equal(workspace.getWorkspaceContextSnapshot().workspaceKey, openingWorkspace.workspaceKey); assert.equal(displayedWorkspace, openingWorkspace.workspaceKey);
  assert.equal(router.state.location.pathname, openingPath); assert.equal(unmounts, 0); assert.equal(unrelatedDiscardCount, 0);
  assert.equal(document.querySelector<HTMLInputElement>('#qualification-disqualified-reason')?.value, 'Pending A draft'); assert.equal(commands.length, 1);
  // The existing route blocker must likewise reset after preflight veto.
  await act(async () => { void router.navigate(`/w/${openingWorkspace.workspaceKey}/crm/leads/other-B/qualify`); }); await settle(); await click('Bỏ thay đổi');
  assert.equal(router.state.location.pathname, openingPath); assert.equal(unmounts, 0); assert.equal(unrelatedDiscardCount, 0); assert.equal(commands.length, 1);
  assert.ok(getDirtyUnsavedWork().some(entry => entry.id.includes(A.id) && entry.canDiscard?.() === false));
  await act(async () => rejectPending?.(new ApplicationError({ code: 'TEST_STOP', category: 'CONFLICT', message: 'Test intercepted', retryable: false }))); await settle();
  assert.deepEqual(browserErrors, []);
  console.log('Real AppShell workspace/route veto PASS: workspace and route unchanged; pending Qualification A mounted; unrelated first draft untouched.');
} finally { await act(async () => root.unmount()); unregister(); router.dispose(); window.close(); }
