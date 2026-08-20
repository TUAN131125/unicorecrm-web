// @ts-nocheck -- Runtime render contract for the Reports route.
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: "http://localhost/#/w/unicore-vietnam/crm/reports",
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
  Blob: { value: window.Blob, configurable: true },
  URL: { value: window.URL, configurable: true },
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
Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
  value: () => undefined,
  configurable: true,
});

const capturedErrors: string[] = [];
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  capturedErrors.push(args.map(String).join(" "));
};

const { signIn } = await import("../../../src/platform/identity-auth/index");
const auth = signIn({ email: "admin@unicorecrm.local", password: "admin123" });
assert.equal(auth.ok, true, "Administrative demo sign-in must create an AAL1 session.");

const { initializeApplicationComposition } = await import("../../../src/app/composition");
await initializeApplicationComposition({ mode: "demo" });
const { loadAccessGovernance } = await import("../../../src/platform/access-control/governance");
await loadAccessGovernance("ws1");

const React = await import("react");
const { act } = React;
const { createRoot } = await import("react-dom/client");
const { MemoryRouter } = await import("react-router-dom");
const { I18nProvider } = await import("../../../src/i18n/index");
const { ReportsPage } = await import("../../../src/workspaces/crm/presentation/pages/ReportsPage");

const rootNode = window.document.getElementById("root");
assert.ok(rootNode, "Reports runtime root must exist.");
const root = createRoot(rootNode);

try {
  await act(async () => {
    root.render(
      React.createElement(
        I18nProvider,
        null,
        React.createElement(
          MemoryRouter,
          { initialEntries: ["/w/unicore-vietnam/crm/reports"] },
          React.createElement(ReportsPage),
        ),
      ),
    );
  });

  const text = window.document.body.textContent || "";
  assert.match(text, /Báo cáo|Reports/, "Reports page must render its primary heading.");
  assert.match(text, /Doanh thu hoàn tất|Completed revenue/, "Reports page must render live KPI content.");
  assert.ok(window.document.querySelector('[data-guidance-id="reports.analysis.table"]'), "Reports must render the multi-dimensional analysis table.");
  assert.ok([...window.document.querySelectorAll('option')].some((option) => option.value === "custom"), "Reports must expose a custom date-range option.");
  assert.equal(
    capturedErrors.some((message) => message.includes("Maximum update depth exceeded")),
    false,
    "Reports must not enter an access-control snapshot render loop.",
  );

  const salesTab = [...window.document.querySelectorAll("button")].find((button) =>
    ["Bán hàng", "Sales"].includes(button.textContent?.trim() || ""),
  );
  assert.ok(salesTab, "Reports sales section tab must exist.");
  await act(async () => {
    salesTab.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  assert.match(window.document.body.textContent || "", /Cơ hội theo giai đoạn|Deals by stage/, "Reports sections must remain interactive.");
} finally {
  await act(async () => root.unmount());
  console.error = originalConsoleError;
}

console.log("Reports runtime contracts: PASS");
