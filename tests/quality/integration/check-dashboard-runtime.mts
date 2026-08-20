// @ts-nocheck -- Runtime render contract for the Dashboard route.
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: "http://localhost/#/w/unicore-vietnam/crm/dashboard",
  pretendToBeVisual: true,
});
const { window } = dom;

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperties(globalThis, {
  window: { value: window, configurable: true },
  document: { value: window.document, configurable: true },
  navigator: { value: window.navigator, configurable: true },
  localStorage: { value: window.localStorage, configurable: true },
  HTMLElement: { value: window.HTMLElement, configurable: true },
  SVGElement: { value: window.SVGElement, configurable: true },
  Element: { value: window.Element, configurable: true },
  Node: { value: window.Node, configurable: true },
  Event: { value: window.Event, configurable: true },
  MouseEvent: { value: window.MouseEvent, configurable: true },
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
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() { return false; },
  }),
});
Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", { value: () => undefined, configurable: true });

const capturedErrors: string[] = [];
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => capturedErrors.push(args.map(String).join(" "));

const { signIn } = await import("../../../src/platform/identity-auth/index");
const auth = signIn({ email: "admin@unicorecrm.local", password: "admin123" });
assert.equal(auth.ok, true, "Administrative demo sign-in must create an AAL1 session.");

const { initializeApplicationComposition } = await import("../../../src/app/composition");
await initializeApplicationComposition({ mode: "demo" });

const React = await import("react");
const { act } = React;
const { createRoot } = await import("react-dom/client");
const { MemoryRouter } = await import("react-router-dom");
const { I18nProvider } = await import("../../../src/i18n/index");
const { DashboardPage } = await import("../../../src/workspaces/crm/presentation/pages/DashboardPage");

const rootNode = window.document.getElementById("root");
assert.ok(rootNode, "Dashboard runtime root must exist.");
const root = createRoot(rootNode);

try {
  await act(async () => {
    root.render(
      React.createElement(
        I18nProvider,
        null,
        React.createElement(
          MemoryRouter,
          { initialEntries: ["/w/unicore-vietnam/crm/dashboard"] },
          React.createElement(DashboardPage),
        ),
      ),
    );
  });

  const text = window.document.body.textContent || "";
  assert.match(text, /Dashboard/, "Dashboard must use the product name instead of the retired Workbench label.");
  assert.match(text, /Dữ liệu trực tiếp|Live data/, "Dashboard must disclose live repository updates.");
  assert.ok(window.document.querySelector('[data-dashboard-visual="operational-board"]'), "Dashboard must render the light operational-board experience.");
  assert.ok(window.document.querySelector('[data-dashboard-kpi-layout="snapshot-ribbon"]'), "Dashboard KPI values must use a single snapshot ribbon instead of report-like chart cards.");
  for (const guidanceId of ["dashboard.metric.completed-revenue", "dashboard.metric.open-pipeline", "dashboard.metric.overdue-tasks", "dashboard.metric.open-support"]) {
    assert.ok(window.document.querySelector(`[data-guidance-id="${guidanceId}"]`), `${guidanceId} must render.`);
  }
  const weekButton = [...window.document.querySelectorAll("button")].find((button) => ["Tuần", "Week"].includes(button.textContent?.trim() || ""));
  assert.ok(weekButton, "Dashboard fixed-period selector must expose this week.");
  await act(async () => weekButton.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })));
  assert.equal(capturedErrors.some((message) => message.includes("Maximum update depth exceeded")), false, "Dashboard must not enter a render loop when switching periods.");
} finally {
  await act(async () => root.unmount());
  console.error = originalConsoleError;
}

console.log("Dashboard runtime contracts: PASS");
