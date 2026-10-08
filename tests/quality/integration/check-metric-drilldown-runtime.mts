// @ts-nocheck -- Runtime contract for period selection, cohort labeling and metric drill-down.
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: "http://localhost/#/w/unicore-vietnam/crm/reports?period=current_year",
  pretendToBeVisual: true,
});
const { window } = dom;
class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
Object.defineProperties(globalThis, {
  window: { value: window, configurable: true }, document: { value: window.document, configurable: true }, navigator: { value: window.navigator, configurable: true },
  localStorage: { value: window.localStorage, configurable: true }, HTMLElement: { value: window.HTMLElement, configurable: true }, SVGElement: { value: window.SVGElement, configurable: true },
  Element: { value: window.Element, configurable: true }, Node: { value: window.Node, configurable: true }, Event: { value: window.Event, configurable: true },
  MouseEvent: { value: window.MouseEvent, configurable: true }, MutationObserver: { value: window.MutationObserver, configurable: true }, ResizeObserver: { value: ResizeObserverStub, configurable: true },
  getComputedStyle: { value: window.getComputedStyle.bind(window), configurable: true }, requestAnimationFrame: { value: window.requestAnimationFrame.bind(window), configurable: true },
  cancelAnimationFrame: { value: window.cancelAnimationFrame.bind(window), configurable: true }, IS_REACT_ACT_ENVIRONMENT: { value: true, configurable: true }, Blob: { value: window.Blob, configurable: true }, URL: { value: window.URL, configurable: true },
});
Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: true, media: "", addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; } }) });
Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", { value: () => undefined, configurable: true });

const { signIn } = await import("../../../src/platform/identity-auth/index");
const adminSignIn = signIn({ email: "admin@unicorecrm.local", password: "admin123" });
assert.equal(adminSignIn.ok, true, "Administrative demo sign-in must create an AAL1 session.");
const { initializeApplicationComposition } = await import("../../../src/app/composition");
await initializeApplicationComposition({ mode: "demo" });
const { loadAccessGovernance } = await import("../../../src/platform/access-control/governance");
const { getWorkspaceContextSnapshot } = await import("../../../src/platform/workspace-context");
const workspaceContext = getWorkspaceContextSnapshot();
assert.equal(workspaceContext.workspaceKey, "unicore-vietnam", "The report fixture must use its routed workspace membership.");
await loadAccessGovernance(workspaceContext.workspaceId);
// Reports are deferred in server-admitted roles. Explicit test authorization lets
// this interaction fixture exercise the drawer without changing production roles.
const { getAccessGovernanceRuntimeBinding, configureAccessGovernanceRuntime } = await import("../../../src/platform/access-control/application/accessGovernanceBinding");
const governance = getAccessGovernanceRuntimeBinding();
let grantMetricRead = false;
configureAccessGovernanceRuntime({
  getRuntime: () => governance.getRuntime(), getState: () => governance.getState(),
  load: (id, signal) => governance.load(id, signal), refresh: (id, signal) => governance.refresh(id, signal),
  applyMutation: (id, result, signal) => governance.applyMutation(id, result, signal),
  subscribe: (listener) => governance.subscribe(listener), clear: () => governance.clear(),
  getEffectiveAccess(id) {
    const access = governance.getEffectiveAccess(id);
    assert.ok(access, "The interaction fixture must retain its real workspace authorization context.");
    return { ...access, can: (capability) => grantMetricRead && ["reports.read", "orders.read"].includes(capability) || access.can(capability) };
  },
});
const { resolveEffectiveAccess } = await import("../../../src/platform/access-control/runtime/accessControlRuntime");
assert.equal(resolveEffectiveAccess(workspaceContext.workspaceId).can("reports.read"), false, "Deferred Reports authority must remain denied by default.");
const React = await import("react");
const { act } = React;
const { createRoot } = await import("react-dom/client");
const { MemoryRouter } = await import("react-router-dom");
const { I18nProvider } = await import("../../../src/i18n/index");
const { ReportsPage } = await import("../../../src/workspaces/crm/presentation/pages/ReportsPage");
const rootNode = window.document.getElementById("root");
assert.ok(rootNode);
const root = createRoot(rootNode);

try {
  await act(async () => root.render(React.createElement(I18nProvider, null, React.createElement(MemoryRouter, { initialEntries: ["/w/unicore-vietnam/crm/reports?period=current_year"] }, React.createElement(ReportsPage)))));
  const text = window.document.body.textContent || "";
  assert.match(text, /Funnel chuyển đổi theo cohort|Cohort conversion funnel/);
  assert.match(text, /Ảnh chụp độc lập|Independent snapshots/);
  const period = window.document.querySelector('[data-guidance-id="reports.period.selector"]');
  assert.ok(period instanceof window.HTMLSelectElement, "Report period selector must render.");
  assert.equal(period.value, "current_year");

  const metricCard = window.document.querySelector('[data-guidance-id="reports.metric.completed-revenue"]');
  assert.ok(metricCard, "Completed revenue metric must be interactive.");
  await act(async () => metricCard.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })));
  assert.equal(window.document.querySelector('[data-guidance-id="reports.metric.drilldown"]'), null, "A metric click without Reports read authority must not disclose source records.");
  grantMetricRead = true;
  await act(async () => governance.refresh(workspaceContext.workspaceId));
  await act(async () => window.document.querySelector('[data-guidance-id="reports.metric.completed-revenue"]').dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })));
  const drawer = window.document.querySelector('[data-guidance-id="reports.metric.drilldown"]');
  assert.ok(drawer, "Metric click must open the drill-down drawer.");
  const drawerText = drawer.textContent || "";
  assert.match(drawerText, /Công thức|Formula/);
  assert.match(drawerText, /Nguồn dữ liệu|Data sources/);
  assert.match(drawerText, /Bản ghi nguồn|Source records/);

  await act(async () => window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  assert.equal(window.document.querySelector('[data-guidance-id="reports.metric.drilldown"]'), null, "Closing drill-down must restore the report context.");
} finally {
  await act(async () => root.unmount());
}

console.log("Metric drill-down runtime: PASS");
