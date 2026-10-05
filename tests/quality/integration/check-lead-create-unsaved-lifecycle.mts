import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

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
const { Routes, Route } = await import("react-router-dom");
const { I18nProvider } = await import("@/i18n");
const { PlatformStateProvider } = await import("@/app/providers");
const { GuidanceProvider } = await import("@/guidance/presentation/GuidanceProvider");


const { LeadListPage } = await import('@/modules/leads/presentation/pages/LeadListPage');
const { AppShell } = await import('@/app/shell/layout/AppShell');
const { createMemoryRouter, RouterProvider } = await import('react-router-dom');
const { getDirtyUnsavedWork, discardDirtyUnsavedWork, saveDirtyUnsavedWork, registerUnsavedWork } = await import('@/platform/unsaved-work');
const { configureLeadApplication, getLeadApplicationServices } = await import('@/modules/leads/application/composition/leadApplicationServices');
const { ApplicationError } = await import('@/shared/domain');
const { getLeadsSnapshot } = await import('@/modules/leads');
const services = getLeadApplicationServices();
let calls = 0;
let fail = false;
let hold = false;
let release: (() => void) | undefined;
configureLeadApplication({ ...services, api: { ...services.api, commands: { ...services.api.commands,
  async createLead(input, options) {
    calls++;
    if (hold) await new Promise<void>(resolve => { release = resolve; });
    if (fail) throw new ApplicationError({ code: 'CREATE_TEST_FAILURE', category: 'CONFLICT', message: 'Private diagnostic', retryable: false });
    return services.api.commands.createLead(input, options);
  }
} } });
const original = workspace.getWorkspaceContextSnapshot();
const other = workspace.listWorkspaceMemberships().find(item => item.status === 'active' && item.workspaceKey !== original.workspaceKey);
assert.ok(other, 'two memberships required');
const start = `/w/${original.workspaceKey}/crm/leads`;
const destination = `/w/${original.workspaceKey}/crm/contacts`;
const router = createMemoryRouter([{ path: '/w/:workspaceKey/crm/*', element:
  React.createElement(I18nProvider, null, React.createElement(PlatformStateProvider, null,
    React.createElement(GuidanceProvider, null, React.createElement(AppShell, { children:
      React.createElement(Routes, null,
        React.createElement(Route, { path: 'leads', element: React.createElement(LeadListPage) }),
        React.createElement(Route, { path: 'queue', element: React.createElement(LeadListPage, { queueOnly: true }) }),
        React.createElement(Route, { path: 'contacts', element: React.createElement('p', { id: 'proof-destination' }, 'Contacts destination') })) }))))
}], { initialEntries: [start] });
const element = document.getElementById('root'); assert.ok(element);
const root = createRoot(element);
const settle = async () => act(async () => { await new Promise(resolve => setTimeout(resolve, 170)); });
const input = (id: string) => document.querySelector<HTMLInputElement>(id);
async function click(text: string) {
  const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.trim() === text);
  assert.ok(button, `Missing ${text}. Buttons: ${[...document.querySelectorAll('button')].map(item => item.textContent).join('|')}`);
  await act(async () => button.click()); await settle();
}
async function change(selector: string, value: string) {
  const field = input(selector); assert.ok(field, selector);
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(field, value);
    field.dispatchEvent(new window.Event('input', { bubbles: true }));
  }); await settle();
}
async function submit(times = 1) {
  const form = document.querySelector('form.crm-form-surface'); assert.ok(form);
  await act(async () => { for (let i = 0; i < times; i++) form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); });
  await settle();
}
async function navigate(path: string) { await act(async () => { void router.navigate(path); }); await settle(); }
function entry() {
  const dirty = getDirtyUnsavedWork(); assert.equal(dirty.length, 1, 'exactly one dirty create interaction');
  const item = dirty[0]; assert.ok(item); assert.equal(item.id, 'lead-create:list'); return item;
}
const localPrompt = () => document.body.textContent?.includes('Bỏ thay đổi chưa lưu?');
const globalPrompt = () => document.body.textContent?.includes('Bạn có thay đổi chưa lưu');
async function fresh() {
  await click('Thêm Tiềm năng'); await settle();
  assert.equal(input('#lead-name')?.value, ''); assert.equal(input('#lead-phone')?.value, '');
  assert.equal(document.querySelector('#lead-form-error-summary'), null);
  assert.equal(getDirtyUnsavedWork().length, 0);
}
async function chooseWorkspace(name: string) {
  const selector = [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.title.startsWith('Không gian làm việc:') || button.title.startsWith('Workspace:'));
  assert.ok(selector); await act(async () => selector.click()); await settle(); await click(name);
}
try {
  await act(async () => root.render(React.createElement(RouterProvider, { router }))); await settle();
  await fresh();
  await change('#lead-name', 'Create draft A');
  const obsoleteEntry = entry();
  await change('#lead-name', ''); assert.equal(getDirtyUnsavedWork().length, 0, 'canonical revert is clean');
  await submit(); assert.equal(calls, 0); assert.equal(getDirtyUnsavedWork().length, 0, 'validation alone is not dirty');
  assert.equal(document.activeElement?.id, 'lead-name', 'first invalid focus preserved');
  await change('#lead-name', 'Create draft A');
  await click('Hủy'); assert.ok(localPrompt()); await click('Tiếp tục chỉnh sửa');
  assert.equal(input('#lead-name')?.value, 'Create draft A'); entry();
  const x = [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.getAttribute('aria-label') === 'Đóng hộp thoại');
  assert.ok(x); await act(async () => x.click()); await settle(); assert.ok(localPrompt()); await click('Tiếp tục chỉnh sửa');
  await submit(); assert.equal(calls, 0); entry(); assert.ok(input('#lead-name'), 'invalid draft stays open');
  await navigate(destination); assert.ok(globalPrompt()); assert.equal(router.state.location.pathname, start);
  await click('Tiếp tục chỉnh sửa'); assert.equal(router.state.location.pathname, start); assert.equal(input('#lead-name')?.value, 'Create draft A'); entry();
  // Safe-fail programmatic save is truthful: no command, no navigation, draft retained.
  assert.equal(await entry().save(), false); assert.equal(await saveDirtyUnsavedWork(), false); assert.equal(calls, 0);
  await navigate(destination); await click('Lưu và tiếp tục');
  assert.equal(router.state.location.pathname, start); assert.equal(input('#lead-name')?.value, 'Create draft A'); assert.equal(calls, 0); entry();
  await navigate(destination); await click('Bỏ thay đổi'); await settle();
  assert.equal(router.state.location.pathname, destination); assert.ok(document.querySelector('#proof-destination'));
  assert.equal(input('#lead-name'), null); assert.equal(getDirtyUnsavedWork().length, 0); assert.ok(!localPrompt(), 'no second local confirmation');
  await navigate(start); await fresh();
  assert.equal(obsoleteEntry.canDiscard?.(), false, 'discarded cycle cannot own reopened form');
  await act(async () => obsoleteEntry.discard()); await settle();
  assert.ok(input('#lead-name'), 'stale discard callback cannot close new cycle');
  await change('#lead-name', 'Pending create A'); await change('#lead-phone', '0901234567');
  hold = true; fail = true; await submit(2); assert.equal(calls, 1, 'synchronous double submit guard');
  assert.equal(entry().canDiscard?.(), false);
  let unrelatedDiscardCount = 0;
  let unregister: (() => void) | undefined;
  await act(async () => { unregister = registerUnsavedWork({ id: 'create-unrelated', title: 'Other draft', isDirty: true, discard: () => { unrelatedDiscardCount++; }, save: async () => false });
    assert.equal(discardDirtyUnsavedWork(), false); assert.equal(unrelatedDiscardCount, 0); unregister(); });
  await navigate(destination); assert.ok(globalPrompt()); await click('Bỏ thay đổi');
  assert.equal(router.state.location.pathname, start); assert.equal(input('#lead-name')?.value, 'Pending create A');
  await chooseWorkspace(other.name); assert.ok(globalPrompt()); await click('Bỏ thay đổi');
  assert.equal(workspace.getWorkspaceContextSnapshot().workspaceKey, original.workspaceKey);
  assert.equal(router.state.location.pathname, start); assert.equal(input('#lead-name')?.value, 'Pending create A');
  await submit(2); assert.equal(calls, 1); assert.equal(await entry().save(), false);
  assert.ok(release); await act(async () => release?.()); await settle(); hold = false;
  assert.equal(input('#lead-name')?.value, 'Pending create A'); assert.equal(input('#lead-phone')?.value, '0901234567');
  assert.ok(document.querySelector('#lead-form-error-summary')?.textContent, 'normalized application error visible');
  assert.equal(entry().canDiscard?.(), true, 'retry enabled after application failure');
  fail = false; await submit(2); await settle(); assert.equal(calls, 2, 'retry creates exactly once');
  assert.equal(getLeadsSnapshot().filter(lead => lead.name === 'Pending create A').length, 1, 'public application projection reconciles one actual demo creation');
  assert.ok(document.body.textContent?.includes('Đã tạo Lead'), 'existing success feedback retained');
  assert.equal(input('#lead-name'), null); assert.equal(getDirtyUnsavedWork().length, 0, 'success unregisters');
  await fresh(); await change('#lead-name', 'Local discard draft'); await click('Hủy'); assert.ok(localPrompt()); await click('Bỏ thay đổi'); await settle();
  assert.equal(input('#lead-name'), null); assert.equal(getDirtyUnsavedWork().length, 0);
  // URL action uses the same lifecycle and does not reopen after discard/re-render.
  await navigate(`${start}?action=create`); await settle();
  assert.equal(input('#lead-name')?.value, ''); await change('#lead-name', 'URL create'); entry();
  await act(async () => { assert.equal(discardDirtyUnsavedWork(), true); }); await settle();
  assert.equal(input('#lead-name'), null); assert.equal(getDirtyUnsavedWork().length, 0);
  // Exercise the real queueOnly variant returned by connected LeadQueuePage. DemoLeadQueuePage has no create surface.
  const queue = `/w/${original.workspaceKey}/crm/queue`;
  await navigate(queue); await fresh(); await change('#lead-name', 'Queue create'); entry();
  await act(async () => { assert.equal(discardDirtyUnsavedWork(), true); }); await settle();
  assert.equal(input('#lead-name'), null); assert.equal(getDirtyUnsavedWork().length, 0);
  await navigate(start); await fresh(); await change('#lead-name', 'Workspace create draft');
  await chooseWorkspace(other.name); assert.ok(globalPrompt()); await click('Tiếp tục chỉnh sửa');
  assert.equal(workspace.getWorkspaceContextSnapshot().workspaceKey, original.workspaceKey); assert.equal(router.state.location.pathname, start);
  assert.equal(input('#lead-name')?.value, 'Workspace create draft'); entry();
  await chooseWorkspace(other.name); assert.ok(globalPrompt()); await click('Bỏ thay đổi'); await settle();
  assert.equal(workspace.getWorkspaceContextSnapshot().workspaceKey, other.workspaceKey);
  assert.ok(router.state.location.pathname.startsWith(`/w/${other.workspaceKey}/`));
  assert.equal(input('#lead-name'), null); assert.equal(getDirtyUnsavedWork().length, 0); assert.ok(!localPrompt());
  assert.deepEqual(browserErrors, []);
  console.log('Lead create global unsaved lifecycle PASS: canonical/revert, validation/focus, local X/Cancel/keep/discard, route/workspace keep/discard, pending atomic veto/duplicate, application failure/retry/success, fresh reopen, safe-fail global Save, URL and queue entry paths.');
} finally { await act(async () => root.unmount()); router.dispose(); window.close(); }
