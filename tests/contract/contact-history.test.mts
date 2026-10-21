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
const initialWorkspaceId = ws.getWorkspaceContextSnapshot().workspaceId;
const listeners = new Set<() => void>();
const initialAccount = baselineAccess.accountId;
let actor = initialAccount, revision = 1, canRead = true, scope = "WORKSPACE", restrictive = false;
ac.configureAccessGovernanceRuntime({ ...binding,
  getState: () => ({ ...binding.getState(), workspaceId: binding.getState().workspaceId ?? initialWorkspaceId, authorityRevision: revision }),
  getEffectiveAccess: () => ({ ...baselineAccess, accountId: actor, can: capability => capability !== ac.CAPABILITIES.TASKS_READ || canRead,
    getDataScope: () => scope === "OWN" ? "OWN" : "WORKSPACE", getFieldAccess: () => restrictive ? "HIDDEN" : "READ_WRITE" }),
  subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
});
const { ApplicationError } = await import("@/shared/domain");
const { configureTaskApplication, getTaskApplicationServices } = await import("@/modules/tasks/application/composition/taskApplicationServices");
const original = getTaskApplicationServices();
const { I18nProvider } = await import("@/i18n");
const { ContactHistoryPanel } = await import("@/modules/contacts/presentation/detail/ContactHistoryPanel");
const { mergeContactHistory } = await import("@/modules/contacts/presentation/model/contactHistory");
const { getContactRelationshipAuthority } = await import("@/modules/contacts/presentation/model/contactRelationshipAuthority");
type Activity = import("@/modules/tasks").Activity;
type Page = import("@/shared/application").AuthoritativePage<Activity>;
const at = "2026-10-18T10:15:31Z";
const activity = (id: string, type: Activity["type"] = "NOTE"): Activity => ({ id, type, subject: "Same text", body: `content-${id}`, actorId: "member-test", occurredAt: at, recordRef: { moduleKey: "contacts", recordId: "contact-test" } });
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
    return page([activity("event-1"), { ...activity("foreign"), recordRef: { moduleKey: "contacts", recordId: "foreign" } }], true);
  },
} } });
const container = document.getElementById("root"); assert.ok(container);
const root = createRoot(container);
let testRecordId = "contact-test";
const render = async () => act(async () => root.render(React.createElement(I18nProvider, null, React.createElement(ContactHistoryPanel, { key: testRecordId, contactId: testRecordId, locale: "vi" }))));
const update = async (change: () => void) => act(async () => { change(); for (const listener of listeners) listener(); });
const click = async (label: string) => { const button = [...container.querySelectorAll("button")].find(node => node.textContent === label); assert.ok(button, label); await act(async () => button.click()); };
let checks = 0;
function check(name: string, fn: () => void) { fn(); checks++; console.log(`PASS ${name}`); }
try {
  await render();
  check("first page scoped and bounded, no automatic drain", () => { assert.equal(requests.length, 1); assert.equal(requests[0]?.limit, 50); assert.equal(requests[0]?.filters?.recordModuleKey, "contacts"); assert.equal(requests[0]?.filters?.recordId, "contact-test"); assert.equal(container.querySelectorAll('[data-history-id]').length, 1); });
  await click("Tải thêm");
  check("server continuation retains items and deduplicates identity", () => { assert.equal(requests[1]?.cursor, "continuation"); assert.equal(container.querySelectorAll('[data-history-id]').length, 2); });
  check("same-text distinct event identities and exact timestamps", () => { const merged = mergeContactHistory([], [activity("a"), activity("b")], "contact-test"); assert.equal(merged.length, 2); assert.equal(merged[0]?.id, "b"); assert.equal(container.querySelector("time")?.dateTime, at); });
  check("manual communication label and modal trigger", () => { assert.match(container.textContent ?? "", /ghi nhận thủ công/); assert.ok(container.querySelector('button[aria-haspopup="dialog"]')); assert.doesNotMatch(container.textContent ?? "", /secret diagnostic/); });
  const activityButton = container.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]'); assert.ok(activityButton);
  await act(async () => activityButton.click());
  check("Activity detail opens from its stable identity", () => assert.match(document.body.textContent ?? "", /content-event/));
  const closeDetail = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(button => button.getAttribute("aria-label") === "Đóng hộp thoại"); assert.ok(closeDetail);
  await act(async () => closeDetail.click());
  check("Activity detail closes", () => assert.equal(document.querySelector('[role="dialog"]'), null));
  await act(async () => activityButton.click());
  await update(() => { actor = "another-principal"; });
  check("Activity modal retires on principal change", () => assert.equal(document.querySelector('[role="dialog"]'), null));
  await update(() => { actor = initialAccount; });
  check("Activity modal does not reopen for the new authority", () => assert.equal(document.querySelector('[role="dialog"]'), null));
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
  const firstA = getContactRelationshipAuthority(); const late = resolveOld; assert.ok(late);
  check("pending query exposes loading", () => assert.match(container.textContent ?? "", /Đang tải lịch sử/));
  await update(() => { actor = "B"; mode = "data"; });
  await update(() => { actor = initialAccount; });
  check("A B A authority generation differs", () => assert.notEqual(getContactRelationshipAuthority(), firstA));
  await act(async () => late(page([activity("OLD-A-CANARY")])));
  check("late first-A response cannot restore content", () => { assert.doesNotMatch(container.textContent ?? "", /OLD-A-CANARY/); assert.equal(container.querySelector('[data-history-id="OLD-A-CANARY"]'), null); });
  await update(() => { mode = "delay"; revision++; });
  const lateRecord = resolveOld; assert.ok(lateRecord);
  testRecordId = "record-B"; mode = "data"; await render();
  testRecordId = "contact-test"; await render();
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
  const contactServices = await import("@/modules/contacts/application/composition/contactApplicationServices");
  const originalContacts = contactServices.getContactApplicationServices();
  const contactRecord: import("@/modules/contacts").Contact = { id: "read-scope-contact", name: "fresh-contact", fullName: "fresh-contact", status: "active", createdAt: at };
  let releaseContact: ((lead: import("@/modules/contacts").Contact) => void) | undefined;
  let delayContact = true;
  contactServices.configureContactApplication({ ...originalContacts, api: { ...originalContacts.api, mode: "connected", queries: { ...originalContacts.api.queries,
    async get() { return delayContact ? new Promise<import("@/modules/contacts").Contact>(resolve => { releaseContact = resolve; }) : contactRecord; },
  } } });
  try {
    const { getContactDetailResource } = await import("@/modules/contacts/application/vertical-slice/contactAuthoritativeQueries");
    const oldResource = getContactDetailResource(contactRecord.id); const oldRead = oldResource.load();
    assert.ok(releaseContact); const lateContact = releaseContact;
    await update(() => { actor = "another-principal"; });
    getContactDetailResource(contactRecord.id);
    await update(() => { actor = initialAccount; });
    delayContact = false;
    const freshResource = getContactDetailResource(contactRecord.id); await act(async () => { await freshResource.load(); });
    await act(async () => { lateContact({ ...contactRecord, name: "OLD-CONTACT-CANARY" }); await oldRead; });
    const contactPublic = await import("@/modules/contacts/public/contacts");
    check("Contact record query A B A does not restore old Work context", () => {
      assert.notEqual(oldResource, freshResource); assert.equal(freshResource.getSnapshot().data?.name, "fresh-contact");
      assert.equal(contactPublic.getContactsSnapshot().some(item => item.name === "OLD-CONTACT-CANARY"), false);
    });
  } finally { contactServices.configureContactApplication(originalContacts); }
  await update(() => { canRead = false; revision++; });
  check("revoked read retires all history", () => { assert.match(container.textContent ?? "", /không có quyền/); assert.equal(container.querySelectorAll('[data-history-id]').length, 0); });
  console.log(`Contact History: ${checks} checks PASS (isolated runtime port and authority fixtures; not Backend authorization proof).`);
} finally { await act(async () => root.unmount()); configureTaskApplication(original); ac.configureAccessGovernanceRuntime(binding); dom.window.close(); }
