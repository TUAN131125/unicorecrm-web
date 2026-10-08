import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
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

const { signIn } = await import("@/platform/identity-auth");
assert.equal(signIn({ email: "admin@unicorecrm.local", password: "admin123" }).ok, true);
const { initializeApplicationComposition } = await import("@/app/composition");
await initializeApplicationComposition({ mode: "demo" });
const workspace = await import("@/platform/workspace-context");
const { loadAccessGovernance } = await import("@/platform/access-control");
await loadAccessGovernance(workspace.getWorkspaceContextSnapshot().workspaceId);
const React = await import("react");
const { act } = React;
const { createRoot } = await import("react-dom/client");
const { MemoryRouter, Routes, Route } = await import("react-router-dom");
const { I18nProvider } = await import("@/i18n");
const { PlatformStateProvider } = await import("@/app/providers");
const { GuidanceProvider } = await import("@/guidance/presentation/GuidanceProvider");
const { invalidateModuleQueries } = await import("@/shared/application");
const { configureLeadApplication, getLeadApplicationServices } = await import("@/modules/leads/application/composition/leadApplicationServices");
const { getLeadCollectionResource } = await import("@/modules/leads/application/vertical-slice/leadAuthoritativeQueries");
const { LeadListPage } = await import("@/modules/leads/presentation/pages/LeadListPage");
const { InMemoryLeadRepository } = await import("@/modules/leads/infrastructure/InMemoryLeadRepository");
const { BrowserEventBus } = await import("@/platform/events");
const { saveLead } = await import("@/modules/leads/application/commands/leadRepositoryCommands");
const { runBackendProjection } = await import("@/shared/application");
const { formatPhone } = await import("@/shared/lib/format/phone");
const base = getLeadApplicationServices();
const rich: Lead = { id: "lead-list-confidentiality", name: "Visible Lead Sentinel", title: "", companyName: "Visible Company", phone: "0901234567", email: "secret@example.com", source: "WEB", score: 0, ownerId: "u1", leadWorkState: "NEW", interestedProducts: [], activities: [], resourceVersion: 8, createdAt: "2026-07-01T00:00:00Z" };
const repository = new InMemoryLeadRepository([rich], new BrowserEventBus());
let observed: Lead = rich;
let listCalls = 0;
let kanbanCalls = 0;
let commandReads = 0;
configureLeadApplication({ ...base, repository, api: { ...base.api, mode: "connected", queries: { ...base.api.queries,
  async get(id) {
    assert.equal(id, rich.id);
    commandReads++;
    return observed;
  },
  async kanbanColumn(column, query) {
    kanbanCalls++;
    assert.equal(query?.limit, 50);
    const items = column === observed.leadWorkState ? [observed] : [];
    return { items, pageInfo: { hasNextPage: false, totalCount: items.length }, loadedAt: new Date().toISOString(), authority: "backend" };
  },
  async list() {
    listCalls++;
    return { items: [observed], pageInfo: { hasNextPage: false, totalCount: 1 }, loadedAt: new Date().toISOString(), authority: "backend" };
  },
} } });
const rootElement = window.document.getElementById("root");
assert.ok(rootElement);
const root = createRoot(rootElement);
const mount = async (mode: "table" | "kanban") => {
  await act(async () => root.render(React.createElement(I18nProvider, null,
    React.createElement(MemoryRouter, { key: mode, initialEntries: [`/leads?view=${mode}`] },
      React.createElement(PlatformStateProvider, null, React.createElement(GuidanceProvider, null,
        React.createElement(Routes, null, React.createElement(Route, { path: "/leads", element: React.createElement(LeadListPage) }))))))));
};
const refresh = async () => act(async () => { await invalidateModuleQueries({ moduleKeys: ["leads"], commandType: "lead.read-test", aggregateId: rich.id, occurredAt: rich.createdAt }); });
const noSecrets = () => {
  for (const secret of [rich.email, rich.phone, formatPhone(rich.phone), `mailto:${rich.email}`, `tel:${rich.phone}`]) {
    assert.ok(!rootElement.innerHTML.includes(secret), `Current authoritative read must hide ${secret}`);
  }
  assert.ok(rootElement.textContent?.includes(observed.name), "Actual list still renders the readable Lead");
};
try {
  for (const mode of ["table", "kanban"] as const) {
    observed = rich;
    await act(async () => { repository.replace([rich]); getLeadCollectionResource().reset(); });
    const beforeList = listCalls;
    await mount(mode);
    if (mode === "table") assert.ok(listCalls > beforeList);
    else {
      assert.equal(listCalls, beforeList, "Connected Kanban never calls the full/table collection port");
      assert.equal(kanbanCalls, 4, "Connected Kanban independently loads each visible column");
    }
    assert.ok(rootElement.innerHTML.includes(rich.email), `${mode} initially renders email`);
    assert.ok(rootElement.innerHTML.includes(formatPhone(rich.phone)), `${mode} initially renders phone`);
    // Same business version, stricter server disclosure, deliberately stale rich cache.
    const { email: _email, phone: _phone, ...redacted } = rich;
    observed = redacted as Lead;
    await refresh();
    await act(async () => repository.replace([rich]));
    noSecrets();
    observed = { ...observed, name: "Newer server Lead Sentinel", resourceVersion: 9 };
    await refresh();
    noSecrets();
    assert.ok(rootElement.textContent?.includes("Newer server Lead Sentinel"));
    assert.equal(repository.getById(rich.id)?.resourceVersion, 8, "Table/column reads do not merge a global cache");
  }
  // Prime a previously loaded full resource, then prove a column mutation cannot revive it.
  await act(async () => { await getLeadCollectionResource().load(); });
  const beforeDormantInvalidation = listCalls;
  await refresh();
  assert.equal(listCalls, beforeDormantInvalidation, "A dormant full collection from a prior surface never refreshes behind Kanban");
  await act(async () => repository.replace([{ ...rich, resourceVersion: 9 }]));
  await act(async () => runBackendProjection("leads", () => saveLead(repository, { ...rich, resourceVersion: 8 })));
  assert.equal(repository.getById(rich.id)?.resourceVersion, 9, "Late mutation cannot downgrade business state");
  await act(async () => runBackendProjection("leads", () => saveLead(repository, { ...rich, resourceVersion: 8 }, "AUTHORITATIVE_READ")));
  assert.equal(repository.getById(rich.id)?.resourceVersion, 9, "Late read cannot downgrade cached business state");
  assert.equal(commandReads, 0, "Rendering never performs command-specific GETs");
  let mutations = 0;
  let releaseCommand: () => void = () => { throw new Error("Command has not started"); };
  const commandPending = new Promise<void>(resolve => { releaseCommand = resolve; });
  observed = { ...rich, resourceVersion: 9 };
  configureLeadApplication({ ...getLeadApplicationServices(), api: { ...getLeadApplicationServices().api,
    commands: { ...base.api.commands, async advanceLeadWorkState(id, input, options) {
      mutations++;
      assert.equal(id, rich.id);
      assert.equal(options.expectedVersion, 9, "A command without a cached page reads its target version");
      await commandPending;
      observed = { ...observed, leadWorkState: input.targetWorkState, resourceVersion: 10 };
      return { lead: observed, evidence: {
        authority: "backend", commandId: "targeted-read-command", correlationId: "targeted-read-correlation",
        aggregateId: id, aggregateType: "LEAD", version: 10, occurredAt: rich.createdAt,
        outcome: "COMMITTED", warnings: [], auditEvidenceIds: [], emittedEventIds: [],
      } };
    } },
  } });
  await act(async () => repository.replace([{ ...rich, resourceVersion: 8 }]));
  const card = rootElement.querySelector('[data-kanban-column="NEW"] [data-kanban-card="lead"]');
  assert.ok(card);
  const beforeMoveQueries = kanbanCalls;
  await act(async () => card.dispatchEvent(new window.KeyboardEvent("keydown", { bubbles: true, altKey: true, key: "ArrowRight" })));
  assert.equal(mutations, 1);
  assert.ok(rootElement.querySelector('[data-kanban-column="NEW"] [data-kanban-card="lead"]'), "Pending command never optimistically moves the card");
  assert.equal(kanbanCalls, beforeMoveQueries, "Column refresh waits for commit");
  await act(async () => { releaseCommand(); await commandPending; });
  assert.equal(kanbanCalls, beforeMoveQueries + 4, "Committed drag revalidates visible columns");
  assert.ok(rootElement.querySelector('[data-kanban-column="CONTACTING"] [data-kanban-card="lead"]'), "Only committed server state moves the card");
  assert.equal(commandReads, 0, "Drag carries displayed server version rather than reading the stale global cache");
  assert.equal(mutations, 1);
  assert.equal(repository.getById(rich.id)?.resourceVersion, 10, "Stale refresh cannot downgrade the committed business version");
  // Exercise actual per-column controls and partial failure, not just the window store.
  const windowCalls: string[] = [];
  let contactingUnavailable = true;
  const { ApplicationError } = await import("@/shared/domain");
  configureLeadApplication({ ...getLeadApplicationServices(), api: { ...getLeadApplicationServices().api,
    queries: { ...getLeadApplicationServices().api.queries, async kanbanColumn(column, query) {
      windowCalls.push(column);
      assert.equal(query?.limit, 50);
      if (column === "CONTACTING" && contactingUnavailable) throw new ApplicationError({ code: "NETWORK_ERROR", category: "NETWORK", message: "Failed", retryable: true });
      const start = query?.cursor ? 50 : 0;
      const end = column === "NEW" ? query?.cursor ? 65 : 50 : 0;
      const items = Array.from({ length: end - start }, (_, offset) => ({ ...rich, id: `window_${start + offset}`, name: `Window ${start + offset}` }));
      return { items, pageInfo: { hasNextPage: column === "NEW" && !query?.cursor,
        totalCount: column === "NEW" ? 65 : 0, ...(column === "NEW" && !query?.cursor ? { nextCursor: "new-window-cursor" } : {}) },
        loadedAt: new Date().toISOString(), authority: "backend" };
    } },
  } });
  await refresh();
  const newColumn = rootElement.querySelector('[data-kanban-column="NEW"]');
  const contactingColumn = rootElement.querySelector('[data-kanban-column="CONTACTING"]');
  assert.ok(newColumn && contactingColumn);
  assert.equal(newColumn.querySelectorAll('[data-kanban-card="lead"]').length, 50);
  assert.ok(contactingColumn.querySelector('[role="alert"]'), "One column's failure stays inside that column");
  const moreButton = [...newColumn.querySelectorAll("button")].find(button => /Load more|Tải thêm/u.test(button.textContent ?? ""));
  assert.ok(moreButton);
  const untouchedCalls = windowCalls.filter(column => column !== "NEW").length;
  await act(async () => moreButton.click());
  assert.equal(newColumn.querySelectorAll('[data-kanban-card="lead"]').length, 65);
  assert.ok(newColumn.textContent?.includes("65 / 65"), "Loaded/total counts are independent and authoritative");
  assert.equal(windowCalls.filter(column => column !== "NEW").length, untouchedCalls, "Load More never reloads another column");
  const retryButton = contactingColumn.querySelector('[role="alert"] button');
  assert.ok(retryButton);
  contactingUnavailable = false;
  const beforeRetry = windowCalls.length;
  await act(async () => retryButton.dispatchEvent(new window.MouseEvent("click", { bubbles: true })));
  assert.deepEqual(windowCalls.slice(beforeRetry), ["CONTACTING"], "Retry only requests the failed column");
  assert.equal(contactingColumn.querySelector('[role="alert"]'), null);
  console.log("Lead List/Table and Kanban actual-surface disclosure, drag, independent Load More/retry regression PASS");
} finally {
  await act(async () => root.unmount());
  getLeadCollectionResource().reset();
  configureLeadApplication(base);
  dom.window.close();
}
