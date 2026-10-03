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
  props = { ...props, workResources: resources([task, { ...task, id: "second", title: "Second" }, { ...task, id: "third", title: "Third" }]) };
  await render();
  for (const label of ["Công việc Lead", "Cần xử lý", "Việc tiếp theo", "Phụ trách", "Nguyễn An", "Ngữ cảnh nhanh"]) assert.match(panel().textContent ?? "", new RegExp(label));
  assert.doesNotMatch(panel().textContent ?? "", /Lịch sử hoạt động|Activity History|Email chưa đọc|Zalo chưa đọc|Tin nhắn chưa đọc/);
  assert.ok(panel().className.includes("xl:w-[350px]"));
  assert.ok(!panel().className.includes("lg:"));
  assert.equal(panel().getAttribute("data-relationship-work-panel"), "v1");
  assert.equal(panel().querySelectorAll('section[aria-label="Cần xử lý"] button[title]').length, 2, "Attention caps Task rows at two");
  await click("Xem tất cả"); assert.equal(calls.pop(), "open-work");
  await click("Mở công việc"); assert.equal(calls.pop(), task.id);
  const contextButton = [...panel().querySelectorAll("button")].find((item) => item.textContent === "Ngữ cảnh nhanh");
  assert.equal(contextButton?.getAttribute("aria-expanded"), "false");
  await click("Ngữ cảnh nhanh");
  assert.match(panel().textContent ?? "", /A long but real customer need/);
  for (const [label, action] of [["Ghi nhận cuộc gọi", "call"], ["Ghi nhận Email ngoài CRM", "email"], ["Thêm công việc", "task"], ["Ghi chú nhanh", "note"]]) {
    const button = panel().querySelector(`[aria-label="${label}"]`);
    assert.equal(button?.getAttribute("title"), label);
    await click(label); assert.equal(calls.pop(), action);
  }
  assert.equal(panel().querySelectorAll('[aria-label*="Zalo"]').length, 0);
  await click("Thao tác khác");
  const menu = document.querySelector('[role="menu"]');
  assert.ok(menu, "More uses the anchored portal menu");
  assert.equal(document.querySelector('[role="dialog"]'), null);
  assert.match(menu.textContent ?? "", /Đặt lịch hẹn/);
  assert.match(menu.textContent ?? "", /Ghi nhận SMS ngoài CRM/);
  assert.doesNotMatch(menu.textContent ?? "", /Bàn giao|Chốt kết quả|Lưu trữ|Archive|Print|Manage Tags|Zalo/);
  await click("Ghi nhận SMS ngoài CRM"); assert.equal(calls.pop(), "sms");
  props = { ...props, lead: { ...lead, leadWorkState: "VERIFYING" }, canQualify: true, canHandover: true };
  await render(); await click("Bàn giao"); assert.equal(calls.pop(), "handover");
  await click("Thao tác khác"); await click("Chốt kết quả"); assert.equal(calls.pop(), "qualify");
  props = { ...props, canHandover: false, workResources: resources([]), ownerName: "—" };
  await render();
  assert.match(panel().textContent ?? "", /Chưa có công việc tiếp theo/);
  assert.match(panel().textContent ?? "", /Chưa xác định/);
  await click("+ Tạo công việc"); assert.equal(calls.pop(), "task");
  props = { ...props, lead: { ...lead, ownerId: undefined }, ownerName: "Chưa phân công" };
  await render();
  assert.match(panel().textContent ?? "", /Chưa phân công/);
  const error = new ApplicationError({ code: "NETWORK_ERROR", message: "private diagnostics", category: "NETWORK", retryable: true });
  props = { ...props, workResources: { ...resources([]), taskQuery: { ...query, state: "ERROR", error } } };
  await render();
  assert.match(panel().textContent ?? "", /Không thể tải công việc/);
  assert.doesNotMatch(panel().textContent ?? "", /Chưa có công việc tiếp theo|Không có việc quá hạn|private diagnostics/);
  assert.match(panel().textContent ?? "", /Phụ trách|Ngữ cảnh nhanh/);
  await click("Thử lại"); assert.equal(retries, 1);
  props = { ...props, workResources: resources() };
  props.workResources.taskQuery = { ...props.workResources.taskQuery, state: "ERROR", error, stale: true };
  await render();
  assert.match(panel().textContent ?? "", /Dữ liệu có thể chưa mới nhất/);
  assert.match(panel().textContent ?? "", /Follow up with customer/);
  props = { ...props, workResources: { ...resources([]), taskQuery: { ...query, state: "LOADING", loading: true } } };
  await render();
  assert.match(panel().textContent ?? "", /Đang tải công việc/);
  assert.match(panel().textContent ?? "", /Phụ trách/);
  props = { ...props, lead: { ...lead, nextFollowUpAt: "2020-01-01T00:00:00Z" }, workResources: resources([{ ...task, priority: "URGENT" }]) };
  await render();
  assert.match(panel().textContent ?? "", /Quá hạn liên hệ lại/);
  assert.match(panel().textContent ?? "", /Khẩn cấp/);
  await click("Thao tác khác");
  await act(async () => window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  assert.equal(document.querySelector('[role="menu"]'), null, "Menu closes with Escape");
  await click("Thao tác khác");
  props = { ...props, isVisible: false };
  await render();
  assert.equal(container.querySelector("aside"), null);
  props = { ...props, isVisible: true };
  await render();
  assert.equal(document.querySelector('[role="menu"]'), null, "Hidden panel cannot reopen a menu anchored to a detached button");
  for (const path of ["views/LeadDetailView.tsx", "hooks/useLeadDetailController.tsx", "hooks/useLeadDetailViewState.ts"]) {
    assert.doesNotMatch(readFileSync(`src/modules/leads/presentation/${path}`, "utf8"), /LeadDetailActivityPanel|timelineFilter|selectedActivity|isFilterExpanded/);
  }
  const source = readFileSync("src/modules/leads/presentation/components/LeadWorkPanel.tsx", "utf8");
  assert.match(source, /<RelationshipWorkPanelShell/u);
  assert.doesNotMatch(source, /fetch\(|useEffect\(|workResources\.activities|Activity History|Lịch sử hoạt động/);
  console.log("Lead work panel: PASS (authority inputs, compact attention, next work, owner, context, rail, anchored menu, failure isolation)");
  const { ContactInsightPanel } = await import("@/modules/contacts/presentation/detail/ContactInsightPanel");
  const contactProps = {
    isVisible: true, contact: { id: "contact-panel-fixture", name: "Fixture", fullName: "Fixture", createdAt: "2026-10-03T00:00:00Z", status: "active" as const }, tasks: [],
    onAddTask() {}, onAddAppointment() {}, onAddNote() {}, onCompleteTask() {}, showToast() {},
    recentActivities: [{ id: "activity-fixture", type: "note", title: "Keyboard activity", description: "Activity detail body", date: "2026-10-03", author: "Fixture" }],
  };
  const renderContact = async () => act(async () => root.render(React.createElement(I18nProvider, null, React.createElement(ContactInsightPanel, contactProps))));
  await renderContact();
  const card = container.querySelector("#activities-panel-scroll button");
  assert.ok(card instanceof window.HTMLButtonElement, "Activity must have native keyboard button semantics.");
  assert.equal(card.type, "button");
  assert.equal(card.tabIndex, 0);
  assert.equal(card.querySelector("button, a, input, select, textarea"), null);
  card.focus();
  assert.equal(document.activeElement, card);
  await act(async () => card.click());
  assert.match(document.querySelector('[role="dialog"]')?.textContent ?? "", /Activity detail body/u);
  await click("Đóng");
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 300)); });
  assert.equal(document.querySelector('[role="dialog"]'), null);
  await click("Bộ lọc hoạt động");
  await click("Gọi");
  assert.equal(container.querySelector("#activities-panel-scroll button"), null);
  contactProps.isVisible = false;
  await renderContact();
  assert.equal(container.querySelector("aside"), null);
  contactProps.isVisible = true;
  await renderContact();
  assert.ok(container.querySelector("#activities-panel-scroll button"), "Hiding resets local filter as prior unmount did.");
  console.log("Contact panel accessibility: PASS (native button, focus, activation, detail close, visibility/filter reset)");
  // Native button semantics own Enter/Space activation; JSDOM verifies focus and the actual click path.

} finally {
  await act(async () => root.unmount());
  window.close();
}
