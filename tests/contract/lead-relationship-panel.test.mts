import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import type { Task } from "@/modules/tasks";

import type { Lead } from "@/modules/leads";


const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: "http://localhost", pretendToBeVisual: true });
const { window } = dom;
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

const React = await import("react");
const { act } = React;
const { createRoot } = await import("react-dom/client");
const { signIn } = await import("@/platform/identity-auth");
assert.equal(signIn({ email: "admin@unicorecrm.local", password: "admin123" }).ok, true);
const { initializeApplicationComposition } = await import("@/app/composition");
await initializeApplicationComposition({ mode: "demo" });
const { LeadWorkPanel } = await import("@/modules/leads/presentation/components/LeadWorkPanel");
const { ApplicationError } = await import("@/shared/domain");
const { I18nProvider } = await import("@/i18n");
type Props = React.ComponentProps<typeof LeadWorkPanel>;
const lead: Lead = { id: "panel-lead", name: "Panel Lead", title: "", companyName: "Company", phone: "0901234567", email: "lead@example.test", source: "WEB", score: 0, ownerId: "u1", leadWorkState: "NEW", interestedProducts: [], activities: [], createdAt: "2026-07-01T00:00:00Z", painPoint: "A long but real customer need" };
const task: Task = { id: "next-task", title: "Follow up with customer", status: "OPEN", dueAt: "2020-01-01T00:00:00Z", assigneeId: "u1", priority: "HIGH", createdAt: lead.createdAt, updatedAt: lead.createdAt };
let retries = 0;
const calls: string[] = [];
const query = { state: "READY" as const, enabled: true, connected: true, loading: false, refreshing: false, stale: false, refresh: async () => { retries++; return undefined; }, cancel() {} };
function resources(items: Task[] = [task]): Props["workResources"] {
  const page = { pageInfo: { hasNextPage: false }, loadedAt: lead.createdAt, authority: "backend" as const };
  return { tasks: items, activities: [], openTasks: items, completedTasks: [], overdueTasks: items, nextTask: items[0], taskQuery: { ...query, data: { ...page, items } }, activityQuery: { ...query, data: { ...page, items: [] } } };
}
let props: Props = { lead, locale: "vi", isVisible: true, workResources: resources(), ownerName: "Nguyễn An", canHandover: false, canQualify: false,
  onHandover: () => calls.push("handover"), onQualify: () => calls.push("qualify"), onOpenWork: () => calls.push("open-work"), onOpenTask: (item) => calls.push(item.id), onQuickAction: (action) => calls.push(action) };
const container = document.getElementById("root");
assert.ok(container);
const root = createRoot(container);
const render = async () => act(async () => root.render(React.createElement(I18nProvider, null, React.createElement(LeadWorkPanel, props))));
const panel = () => { const element = container.querySelector("aside"); assert.ok(element); return element; };
const click = async (name: string) => {
  const button = [...document.querySelectorAll("button")].find((item) => (item.getAttribute("aria-label") || item.textContent?.trim()) === name);
  assert.ok(button, `Missing button ${name}`);
  await act(async () => button.click());
};
try {
  await render();
  const tabs = () => [...panel().querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  assert.equal(tabs()[0]?.getAttribute("aria-selected"), "true");
  await click("Ngữ cảnh nhanh");
  const before = calls.length;
  await act(async () => tabs()[0]?.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
  assert.equal(tabs()[1]?.getAttribute("aria-selected"), "true");
  assert.equal(document.activeElement, tabs()[1]);
  assert.equal(calls.length, before, "Mode change is presentation only");
  await act(async () => tabs()[1]?.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Home", bubbles: true })));
  assert.equal(tabs()[0]?.getAttribute("aria-selected"), "true");
  assert.match(panel().textContent ?? "", /A long but real customer need/, "Work context state survives mode switch");
  props = { ...props, lead: { ...lead, id: "another-lead" } };
  await render();
  assert.equal(tabs()[0]?.getAttribute("aria-selected"), "true");
  assert.equal(container.querySelector('[aria-label="Thu gọn bảng quan hệ"]'), null);
  console.log("Lead Relationship Work checkpoint: PASS (default, tab semantics, keyboard/focus, no mutation, state preservation, record reset, no collapse)");
} finally { await act(async () => root.unmount()); dom.window.close(); }
