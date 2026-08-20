// @ts-nocheck -- Query-backed tabs must not remount the entire route screen.
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: "http://localhost/w/unicore-vietnam/crm/contacts/contact-1?tab=detailInfo",
  pretendToBeVisual: true,
});
const { window } = dom;

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
  requestAnimationFrame: { value: window.requestAnimationFrame.bind(window), configurable: true },
  cancelAnimationFrame: { value: window.cancelAnimationFrame.bind(window), configurable: true },
  IS_REACT_ACT_ENVIRONMENT: { value: true, configurable: true },
});

const React = await import("react");
const { act } = React;
const { createRoot } = await import("react-dom/client");
const { MemoryRouter, useLocation, useNavigate } = await import("react-router-dom");
const { RouteScreenBoundary } = await import("../../../src/app/router/runtime/RouteScreenBoundary");

let mountCount = 0;
const QueryTabHarness = () => {
  const location = useLocation();
  const navigate = useNavigate();
  React.useEffect(() => {
    mountCount += 1;
  }, []);
  return React.createElement(
    "div",
    null,
    React.createElement("div", { id: "query-value" }, new URLSearchParams(location.search).get("tab")),
    React.createElement(
      "button",
      {
        type: "button",
        onClick: () => navigate({ search: "?tab=notes" }, { replace: true }),
      },
      "Notes",
    ),
  );
};

const rootNode = window.document.getElementById("root");
assert.ok(rootNode, "Query stability root must exist.");
const root = createRoot(rootNode);

await act(async () => {
  root.render(
    React.createElement(
      MemoryRouter,
      { initialEntries: ["/w/unicore-vietnam/crm/contacts/contact-1?tab=detailInfo"] },
      React.createElement(
        RouteScreenBoundary,
        { routeId: "ContactDetailPage" },
        React.createElement(QueryTabHarness),
      ),
    ),
  );
});
assert.equal(mountCount, 1, "The route screen must mount once initially.");

const button = window.document.querySelector("button");
assert.ok(button, "Query-backed tab trigger must exist.");
await act(async () => {
  button.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
});

assert.equal(window.document.getElementById("query-value")?.textContent, "notes", "The query-backed tab must update.");
assert.equal(mountCount, 1, "Changing only the tab query must not remount the route screen.");

await act(async () => root.unmount());
console.log("Route query stability runtime contracts: PASS");
