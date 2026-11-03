import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost", pretendToBeVisual: true });
for (const key of ["window", "document", "navigator", "localStorage", "HTMLElement", "SVGElement", "Element", "Node", "Event", "CustomEvent", "EventTarget", "MutationObserver"] as const)
  Object.defineProperty(globalThis, key, { value: key === "window" ? dom.window : dom.window[key], configurable: true });
Object.defineProperties(globalThis, {
  IS_REACT_ACT_ENVIRONMENT: { value: true, configurable: true },
  requestAnimationFrame: { value: dom.window.requestAnimationFrame.bind(dom.window), configurable: true },
  cancelAnimationFrame: { value: dom.window.cancelAnimationFrame.bind(dom.window), configurable: true },
});
Object.defineProperty(dom.window, "matchMedia", { value: () => ({ matches: true, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }) });
const { signIn } = await import("@/platform/identity-auth");
assert.equal(signIn({ email: "admin@unicorecrm.local", password: "admin123" }).ok, true);
const { initializeApplicationComposition } = await import("@/app/composition");
await initializeApplicationComposition({ mode: "demo" });
const React = await import("react"), { act } = React;
const { createRoot } = await import("react-dom/client");
const { I18nProvider } = await import("@/i18n");
const { EffectiveRecordAccessBoundary, useEffectiveRecordAccessDecision } = await import("@/platform/access-control/react/EffectiveRecordAccessBoundary");
const { EffectiveFieldAccessScope } = await import("@/platform/access-control/react/EffectiveFieldAccessScope");
const { configureEffectiveRecordAccessAuthority } = await import("@/platform/access-control/application/effectiveRecordAccessBinding");
const { ApplicationError } = await import("@/shared/domain");
let mode: "allowed" | "denied" | "error" = "allowed";
let revision = 0;
let command: string | undefined;
let fourSecondTimers = 0;
const timeout = window.setTimeout.bind(window);
window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => { if (delay === 4_000) fourSecondTimers++; return timeout(handler, delay, ...args); }) as typeof window.setTimeout;
configureEffectiveRecordAccessAuthority({ source: "backend", async evaluate(request) {
  if (mode === "error") throw new ApplicationError({ code: "NETWORK_REQUEST_FAILED", category: "NETWORK", message: "Internal SQL handler diagnostic" });
  return { workspaceId: request.workspaceId, resourceKey: request.resourceKey, recordId: request.recordId,
    authority: "backend", evaluatedAt: new Date().toISOString(), canRead: mode !== "denied", canUpdate: false,
    canDelete: false, canExport: false, canApprove: false, allowedCommands: [],
    fieldAccess: { secret: "HIDDEN", phone: "MASKED", status: "READ_ONLY" }, decisionReasons: [] };
} });
function Fields() {
  const access = useEffectiveRecordAccessDecision();
  return React.createElement("article", { id: "record", "data-update": String(access?.canUpdate) },
    React.createElement(EffectiveFieldAccessScope, { fieldKey: "secret", children: React.createElement("span", null, "HIDDEN_VALUE") }),
    React.createElement(EffectiveFieldAccessScope, { fieldKey: "phone", maskedFallback: React.createElement("span", null, "••••••"), children: React.createElement("span", null, "MASKED_VALUE") }),
    React.createElement(EffectiveFieldAccessScope, { fieldKey: "status", children: React.createElement("input", { id: "read-only-value", defaultValue: "Active" }) }));
}
const node = document.getElementById("root"); assert.ok(node);
const root = createRoot(node);
const fields = ["secret", "phone", "status"];
const render = async () => { await act(async () => {
  root.render(React.createElement(I18nProvider, null, React.createElement(EffectiveRecordAccessBoundary, {
    key: revision, resourceKey: "customers", recordId: "test-record", requestedFields: fields, requiredCommand: command,
    children: React.createElement(Fields),
  })));
}); await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); }); };
try {
  await render();
  assert.ok(document.querySelector("#record"));
  assert.equal(document.querySelector("#record")?.getAttribute("data-update"), "false");
  assert.doesNotMatch(node.textContent ?? "", /HIDDEN_VALUE|MASKED_VALUE|Backend|trường được bảo vệ|protected fields/);
  assert.match(node.textContent ?? "", /••••••/);
  assert.ok(document.querySelector('[data-field-key="status"]')?.hasAttribute("disabled"));
  assert.equal(document.querySelector('[data-field-key="secret"]'), null);
  assert.equal(document.querySelector('[data-effective-access-notice], [data-guidance-id="access.record.indicator"], [data-transient-info-notice]'), null);
  await render(); assert.equal(fourSecondTimers, 0, "No access-notice timer is scheduled at entry or rerender.");
  command = "customer.update"; revision++; await render();
  assert.equal(document.querySelector("#record"), null); assert.match(node.textContent ?? "", /không có quyền thực hiện/);
  command = undefined; mode = "denied"; revision++; await render();
  assert.equal(document.querySelector("#record"), null); assert.match(node.textContent ?? "", /không có quyền xem/);
  mode = "error"; revision++; await render();
  assert.equal(document.querySelector("#record"), null); assert.match(node.textContent ?? "", /Không thể xác minh quyền truy cập/);
  assert.match(node.textContent ?? "", /Thử lại/); assert.doesNotMatch(node.textContent ?? "", /Internal SQL/);
  assert.equal(fourSecondTimers, 0);
  console.log("PASS no informational access DOM/timer from first render; actual boundary preserves READ_ONLY/HIDDEN/MASKED, command denial, record denial and verification Retry");
} finally { await act(async () => root.unmount()); dom.window.close(); }
