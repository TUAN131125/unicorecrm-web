import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "http://localhost", pretendToBeVisual: true });
for (const key of ["window", "document", "navigator", "localStorage", "HTMLElement", "Element", "Node", "Event", "CustomEvent", "EventTarget", "MutationObserver"] as const)
  Object.defineProperty(globalThis, key, { value: key === "window" ? dom.window : dom.window[key], configurable: true });
Object.defineProperties(globalThis, { IS_REACT_ACT_ENVIRONMENT: { value: true, configurable: true }, getComputedStyle: { value: dom.window.getComputedStyle.bind(dom.window), configurable: true } });
Object.defineProperty(dom.window, "matchMedia", { value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) });
const React = await import("react"), { act } = React;
const { createRoot } = await import("react-dom/client");
const auth = await import("@/platform/identity-auth");
assert.ok(auth.signIn({ email: "admin@unicorecrm.local", password: "admin123" }).ok);
const { initializeApplicationComposition } = await import("@/app/composition");
await initializeApplicationComposition({ mode: "demo" });
const studio = await import("@/workspaces/studio/public/studioCore");
await studio.loadStudioCoreRuntime();
for (const step of ["business-profile", "locale-currency", "workspace-blueprint"] as const) await studio.completeStudioQuickSetupStateStep(step);
const { StudioIndexRoute } = await import("@/workspaces/studio/presentation/pages/StudioIndexRoute");
const { MemoryRouter, Routes, Route } = await import("react-router-dom");
const { getWorkspaceContextSnapshot } = await import("@/platform/workspace-context");
const { toWorkspacePath, ROUTE_KEYS } = await import("@/platform/navigation");
const key = getWorkspaceContextSnapshot().workspaceKey;
const root = createRoot(document.querySelector("#root") as HTMLElement);
await act(async () => { root.render(React.createElement(MemoryRouter, { initialEntries: ["/"] },
  React.createElement(Routes, null,
    React.createElement(Route, { path: "/", element: React.createElement(StudioIndexRoute) }),
    React.createElement(Route, { path: toWorkspacePath(key, "studio", ROUTE_KEYS.SETTINGS_BUSINESS_INFORMATION), element: React.createElement("div", null, "business") }),
    React.createElement(Route, { path: toWorkspacePath(key, "studio", ROUTE_KEYS.SETTINGS_QUICK_SETUP), element: React.createElement("div", null, "quick") })))); });
assert.equal(document.getElementById("root")?.textContent, "business", "Completed authoritative Quick Setup must not auto-open from Studio index");
await act(async () => root.unmount());
console.log("PASS Studio index respects completed authoritative Quick Setup state");
