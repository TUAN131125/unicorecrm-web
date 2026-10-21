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
const ac = await import("@/platform/access-control");
const ws = await import("@/platform/workspace-context");
await ac.loadAccessGovernance(ws.getWorkspaceContextSnapshot().workspaceId);
const binding = ac.getAccessGovernanceRuntimeBinding();
const baselineAccess = ac.resolveEffectiveAccess();
const listeners = new Set<() => void>();
const initialAccount = baselineAccess.accountId;
let actor = initialAccount, revision = 1, canRead = true, scope = "WORKSPACE", restrictive = false;
ac.configureAccessGovernanceRuntime({ ...binding,
  getState: () => ({ ...binding.getState(), authorityRevision: revision }),
  getEffectiveAccess: () => ({ ...baselineAccess, accountId: actor, can: capability => capability !== ac.CAPABILITIES.TASKS_READ || canRead,
    getDataScope: () => scope === "OWN" ? "OWN" : "WORKSPACE", getFieldAccess: () => restrictive ? "HIDDEN" : "READ_WRITE" }),
  subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
});
const { ApplicationError } = await import("@/shared/domain");
const { configureTaskApplication, getTaskApplicationServices } = await import("@/modules/tasks/application/composition/taskApplicationServices");
const original = getTaskApplicationServices();
const { I18nProvider } = await import("@/i18n");
const { LeadHistoryPanel } = await import("@/modules/leads/presentation/components/LeadHistoryPanel");
const { mergeLeadHistory } = await import("@/modules/leads/presentation/model/leadHistory");
const { getLeadRelationshipAuthority } = await import("@/modules/leads/presentation/model/leadRelationshipAuthority");
type Activity = import("@/modules/tasks").Activity;
type Page = import("@/shared/application").AuthoritativePage<Activity>;
const at = "2026-10-18T10:15:31Z";
const activity = (id: string, type: Activity["type"] = "NOTE"): Activity => ({ id, type, subject: "Same text", body: `content-${id}`, actorId: "member-test", occurredAt: at, recordRef: { moduleKey: "leads", recordId: "lead-test" } });
let mode: "data" | "empty" | "deny" | "error" | "delay" = "data";
const requests: import("@/modules/tasks").ActivityListQuery[] = [];
let resolveOld: ((page: Page) => void) | undefined;
const page = (items: Activity[], next = false): Page => ({ items, authority: "backend", loadedAt: at, pageInfo: { hasNextPage: next, ...(next ? { nextCursor: "continuation" } : {}) } });
configureTaskApplication({ repository: original.repository, api: { ...original.api, mode: "connected", queries: { ...original.api.queries,
  async listActivities(query = {}) {
    requests.push(query);
    if (mode === "delay") return new Promise<Page>(resolve => { resolveOld = resolve; });
    if (mode === "deny") throw new ApplicationError({ code: "ACCESS_DENIED", message: "secret diagnostic", category: "AUTHORIZATION", status: 403 });
    if (mode === "error") throw new ApplicationError({ code: "NETWORK_ERROR", message: "secret diagnostic", category: "NETWORK" });
    if (mode === "empty") return page([]);
    if (query.filters?.type) return page([activity("filtered", query.filters.type)]);
    if (query.cursor) return page([activity("event-1"), activity("event-2", "MESSAGE")]);
    return page([activity("event-1"), { ...activity("foreign"), recordRef: { moduleKey: "leads", recordId: "foreign" } }], true);
  },
} } });
const container = document.getElementById("root"); assert.ok(container);
const root = createRoot(container);
let testRecordId = "lead-test";
const render = async () => act(async () => root.render(React.createElement(I18nProvider, null, React.createElement(LeadHistoryPanel, { key: testRecordId, leadId: testRecordId, locale: "vi" }))));
const update = async (change: () => void) => act(async () => { change(); for (const listener of listeners) listener(); });
const click = async (label: string) => { const button = [...container.querySelectorAll("button")].find(node => node.textContent === label); assert.ok(button, label); await act(async () => button.click()); };
let checks = 0;
function check(name: string, fn: () => void) { fn(); checks++; console.log(`PASS ${name}`); }
try {
  await render();
  check("first page scoped and bounded, no automatic drain", () => { assert.equal(requests.length, 1); assert.equal(requests[0]?.limit, 50); assert.equal(requests[0]?.filters?.recordModuleKey, "leads"); assert.equal(requests[0]?.filters?.recordId, "lead-test"); assert.equal(container.querySelectorAll('[data-history-id]').length, 1); });
  await click("Tải thêm");
  check("server continuation retains items and deduplicates identity", () => { assert.equal(requests[1]?.cursor, "continuation"); assert.equal(container.querySelectorAll('[data-history-id]').length, 2); });
  check("same-text distinct event identities and exact timestamps", () => { const merged = mergeLeadHistory([], [activity("a"), activity("b")], "lead-test"); assert.equal(merged.length, 2); assert.equal(merged[0]?.id, "b"); assert.equal(container.querySelector("time")?.dateTime, at); });
  check("manual communication label and native disclosure detail", () => { assert.match(container.textContent ?? "", /ghi nhận thủ công/); assert.ok(container.querySelector("details summary")); assert.doesNotMatch(container.textContent ?? "", /secret diagnostic/); });
  const select = container.querySelector("select");
  assert.ok(select, "History filter uses a labelled native select");
  await act(async () => { select.value = "EMAIL"; select.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
  check("filter sent to server with fresh cursor", () => { assert.equal(requests.at(-1)?.filters?.type, "EMAIL"); assert.equal(requests.at(-1)?.cursor, undefined); assert.equal(container.querySelectorAll('[data-history-id]').length, 1); });
  await update(() => { mode = "empty"; revision++; });
  check("authoritative successful empty distinguished", () => assert.match(container.textContent ?? "", /Không có hoạt động/));
  await update(() => { mode = "deny"; revision++; });
  check("403 denied not empty and no diagnostics", () => { assert.match(container.textContent ?? "", /không có quyền/); assert.doesNotMatch(container.textContent ?? "", /Không có hoạt động|secret diagnostic/); });
  const beforeUnavailable = requests.length;
  await update(() => { scope = "OWN"; revision++; });
  check("unsupported Activity scope unavailable without querying", () => { assert.match(container.textContent ?? "", /chưa hỗ trợ/); assert.equal(requests.length, beforeUnavailable); });
  await update(() => { scope = "WORKSPACE"; restrictive = true; revision++; });
  check("restrictive FLS unavailable without content", () => { assert.match(container.textContent ?? "", /chưa hỗ trợ/); assert.equal(container.querySelectorAll('[data-history-id]').length, 0); });
  await update(() => { restrictive = false; mode = "error"; revision++; });
  check("query error distinct from empty", () => assert.match(container.textContent ?? "", /Không thể tải lịch sử/));
  mode = "data"; await click("Thử lại");
  check("retry obtains authoritative content", () => assert.ok(container.querySelector('[data-history-id]')));
  mode = "error";
  const { invalidateModuleQueries } = await import("@/shared/application");
  await act(async () => invalidateModuleQueries({ moduleKeys: ["tasks"], commandType: "task.log-activity", aggregateId: "test", occurredAt: at }));
  check("same-authority network failure labelled stale with retained content", () => { assert.match(container.textContent ?? "", /chưa mới nhất/); assert.ok(container.querySelector('[data-history-id]')); });
  // Keep the same raw authority A before and after B, including the same revision.
  await update(() => { actor = initialAccount; mode = "delay"; revision++; });
  const firstA = getLeadRelationshipAuthority(); const late = resolveOld; assert.ok(late);
  check("pending query exposes loading", () => assert.match(container.textContent ?? "", /Đang tải lịch sử/));
  await update(() => { actor = "B"; mode = "data"; });
  await update(() => { actor = initialAccount; });
  check("A B A authority generation differs", () => assert.notEqual(getLeadRelationshipAuthority(), firstA));
  await act(async () => late(page([activity("OLD-A-CANARY")])));
  check("late first-A response cannot restore content", () => { assert.doesNotMatch(container.textContent ?? "", /OLD-A-CANARY/); assert.equal(container.querySelector('[data-history-id="OLD-A-CANARY"]'), null); });
  await update(() => { mode = "delay"; revision++; });
  const lateRecord = resolveOld; assert.ok(lateRecord);
  testRecordId = "record-B"; mode = "data"; await render();
  testRecordId = "lead-test"; await render();
  await act(async () => lateRecord(page([activity("OLD-RECORD-A")])));
  check("record A B A retires first record response", () => assert.equal(container.querySelector('[data-history-id="OLD-RECORD-A"]'), null));
  await update(() => { mode = "delay"; revision++; });
  const lateWorkspace = resolveOld; assert.ok(lateWorkspace);
  const originalWorkspace = ws.getWorkspaceContextSnapshot().workspaceKey;
  const second = ws.listWorkspaceMemberships().find(item => item.workspaceKey !== originalWorkspace); assert.ok(second);
  mode = "data";
  await act(async () => { await ws.switchWorkspaceContext(second.workspaceKey); });
  await act(async () => { await ws.switchWorkspaceContext(originalWorkspace); });
  await act(async () => lateWorkspace(page([activity("OLD-WORKSPACE-A")])));
  check("actual Workspace A B A retires late old content", () => assert.equal(container.querySelector('[data-history-id="OLD-WORKSPACE-A"]'), null));
  await update(() => { mode = "delay"; revision++; });
  const lateSession = resolveOld; assert.ok(lateSession);
  const auth = await import("@/platform/identity-auth");
  await act(async () => { auth.signOut(); });
  check("signed-out session cannot display protected history", () => { assert.equal(container.querySelectorAll('[data-history-id]').length, 0); assert.match(container.textContent ?? "", /không có quyền/); });
  mode = "data";
  await act(async () => { assert.equal(auth.signIn({ email: "admin@unicorecrm.local", password: "admin123" }).ok, true); });
  await act(async () => lateSession(page([activity("OLD-SESSION")])));
  check("new session cannot receive the retired session result", () => assert.equal(container.querySelector('[data-history-id="OLD-SESSION"]'), null));
  const leadServices = await import("@/modules/leads/application/composition/leadApplicationServices");
  const originalLeads = leadServices.getLeadApplicationServices();
  const leadRecord: import("@/modules/leads").Lead = { id: "read-scope-lead", name: "fresh-lead", title: "", companyName: "", phone: "", email: "", source: "TEST", score: 0, leadWorkState: "NEW", interestedProducts: [], activities: [], createdAt: at };
  let releaseLead: ((lead: import("@/modules/leads").Lead) => void) | undefined;
  let delayLead = true;
  leadServices.configureLeadApplication({ ...originalLeads, api: { ...originalLeads.api, mode: "connected", queries: { ...originalLeads.api.queries,
    async get() { return delayLead ? new Promise<import("@/modules/leads").Lead>(resolve => { releaseLead = resolve; }) : leadRecord; },
  } } });
  try {
    const { getLeadDetailResource } = await import("@/modules/leads/application/vertical-slice/leadAuthoritativeQueries");
    const oldResource = getLeadDetailResource(leadRecord.id); const oldRead = oldResource.load();
    assert.ok(releaseLead); const lateLead = releaseLead;
    await update(() => { actor = "another-principal"; });
    getLeadDetailResource(leadRecord.id);
    await update(() => { actor = initialAccount; });
    delayLead = false;
    const freshResource = getLeadDetailResource(leadRecord.id); await act(async () => { await freshResource.load(); });
    await act(async () => { lateLead({ ...leadRecord, name: "OLD-LEAD-CANARY" }); await oldRead; });
    const leadPublic = await import("@/modules/leads/public/leads");
    check("Lead record query A B A does not restore old Work context", () => {
      assert.notEqual(oldResource, freshResource); assert.equal(freshResource.getSnapshot().data?.name, "fresh-lead");
      assert.equal(leadPublic.getLeadsSnapshot().some(item => item.name === "OLD-LEAD-CANARY"), false);
    });
  } finally { leadServices.configureLeadApplication(originalLeads); }
  await update(() => { canRead = false; revision++; });
  check("revoked read retires all history", () => { assert.match(container.textContent ?? "", /không có quyền/); assert.equal(container.querySelectorAll('[data-history-id]').length, 0); });
  console.log(`Lead History: ${checks} checks PASS (isolated runtime port and authority fixtures; not Backend authorization proof).`);
} finally { await act(async () => root.unmount()); configureTaskApplication(original); ac.configureAccessGovernanceRuntime(binding); dom.window.close(); }
