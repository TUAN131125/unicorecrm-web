// @ts-nocheck -- Runtime jsdom interaction contract.
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: "http://localhost/",
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
  HTMLElement: { value: window.HTMLElement, configurable: true },
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

let responsiveContainerWidth = 520;
Object.defineProperty(window.HTMLElement.prototype, "getBoundingClientRect", {
  configurable: true,
  value() {
    const element = this as HTMLElement;
    const measureKind = element.getAttribute?.("data-responsive-tab-measure");
    const width = element.getAttribute?.("data-responsive-tabs")
      ? responsiveContainerWidth
      : measureKind === "item"
        ? 108
        : measureKind === "overflow"
          ? 92
          : 0;
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: width,
      bottom: 40,
      width,
      height: 40,
      toJSON() { return {}; },
    };
  },
});

const React = await import("react");
const { act } = React;
const { createRoot } = await import("react-dom/client");
const { Tabs, ResponsiveTabs } = await import("../../../src/shared/components/ui/Tabs");
const { OperationDetailTabs } = await import("../../../src/components/crm/operations/OperationDetailTabs");

const Harness = () => {
  const [basic, setBasic] = React.useState("one");
  const [responsive, setResponsive] = React.useState("overview");
  const [operation, setOperation] = React.useState("SUMMARY");
  const [panelOpen, setPanelOpen] = React.useState(false);
  const [reflowTab, setReflowTab] = React.useState("first");
  return React.createElement(
    "div",
    null,
    React.createElement(Tabs, {
      items: [{ id: "one", label: "One" }, { id: "two", label: "Two" }],
      activeId: basic,
      onChange: setBasic,
    }),
    React.createElement("div", { id: "basic-content" }, basic),
    React.createElement(ResponsiveTabs, {
      items: [{ id: "overview", label: "Overview" }, { id: "activity", label: "Activity" }],
      activeId: responsive,
      onChange: setResponsive,
      overflowMode: "scroll",
      motionId: "runtime-responsive-tabs",
    }),
    React.createElement("div", { id: "responsive-content" }, responsive),
    React.createElement("button", { id: "panel-layout-toggle", type: "button", onClick: () => setPanelOpen((current) => !current) }, "Toggle panel layout"),
    React.createElement(ResponsiveTabs, {
      items: [
        { id: "first", label: "First" },
        { id: "second", label: "Second" },
        { id: "third", label: "Third" },
        { id: "fourth", label: "Fourth" },
      ],
      activeId: reflowTab,
      onChange: setReflowTab,
      overflowMode: "dropdown",
      overflowLabel: "More",
      motionId: "runtime-panel-reflow-tabs",
      reflowKey: panelOpen,
    }),
    React.createElement(OperationDetailTabs, {
      items: [{ key: "SUMMARY", label: "Summary" }, { key: "AUDIT", label: "Audit" }],
      activeKey: operation,
      onChange: setOperation,
    }),
    React.createElement("div", { id: "operation-content" }, operation),
  );
};

const rootNode = window.document.getElementById("root");
assert.ok(rootNode, "Runtime tab test root must exist.");
const root = createRoot(rootNode);
await act(async () => {
  root.render(React.createElement(Harness));
});

const clickByText = async (text: string) => {
  const button = [...window.document.querySelectorAll("button")].find((item) => item.textContent?.trim() === text);
  assert.ok(button, `Expected tab button ${text}.`);
  await act(async () => {
    button.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  });
};

await clickByText("Two");
assert.equal(window.document.getElementById("basic-content")?.textContent, "two", "Basic Tabs must switch immediately.");

await clickByText("Activity");
assert.equal(window.document.getElementById("responsive-content")?.textContent, "activity", "ResponsiveTabs must switch immediately.");

await clickByText("Audit");
assert.equal(window.document.getElementById("operation-content")?.textContent, "AUDIT", "OperationDetailTabs must switch immediately.");

const reflowRails = [...window.document.querySelectorAll('[data-responsive-tabs-visible-rail="true"]')];
const reflowRail = reflowRails.at(-1);
assert.ok(reflowRail, "Panel reflow tab rail must render.");
assert.match(reflowRail.className, /flex-nowrap/, "Responsive tab rail must never wrap while a side panel changes width.");
assert.equal([...reflowRail.querySelectorAll("button")].length, 4, "Wide panel workspace must show all tabs before the panel opens.");
assert.equal([...window.document.querySelectorAll("button")].some((button) => button.textContent?.trim() === "More"), false, "Wide panel workspace must not render overflow prematurely.");

responsiveContainerWidth = 260;
const panelToggle = window.document.getElementById("panel-layout-toggle");
assert.ok(panelToggle, "Panel layout toggle must exist.");
await act(async () => {
  panelToggle.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
});
assert.equal([...reflowRail.querySelectorAll("button")].length, 1, "Panel opening must collapse tabs into overflow in the same commit.");
assert.equal([...window.document.querySelectorAll("button")].some((button) => button.textContent?.trim() === "More"), true, "Panel opening must expose the overflow trigger without a delayed wrapped frame.");

responsiveContainerWidth = 520;
await act(async () => {
  panelToggle.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
});
assert.equal([...reflowRail.querySelectorAll("button")].length, 4, "Panel closing must restore tabs before paint.");
assert.equal([...window.document.querySelectorAll("button")].some((button) => button.textContent?.trim() === "More"), false, "Overflow trigger must disappear after panel width is restored.");

await act(async () => root.unmount());
console.log("Tab interaction runtime contracts: PASS");
