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
let commandReads = 0;
configureLeadApplication({ ...base, repository, api: { ...base.api, mode: "connected", queries: { ...base.api.queries,
  async get(id) {
    assert.equal(id, rich.id);
    commandReads++;
    return observed;
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
    await mount(mode);
    assert.ok(listCalls > 0);
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
    if (mode === "table") {
      assert.equal(repository.getById(rich.id)?.resourceVersion, 8, "Paged reads do not merge a global cache");
    }
  }
  await act(async () => repository.replace([{ ...rich, resourceVersion: 9 }]));
  await act(async () => runBackendProjection("leads", () => saveLead(repository, { ...rich, resourceVersion: 8 })));
  assert.equal(repository.getById(rich.id)?.resourceVersion, 9, "Late mutation cannot downgrade business state");
  await act(async () => runBackendProjection("leads", () => saveLead(repository, { ...rich, resourceVersion: 8 }, "AUTHORITATIVE_READ")));
  assert.equal(repository.getById(rich.id)?.resourceVersion, 9, "Late read cannot downgrade cached business state");
  assert.equal(commandReads, 0, "Rendering never performs command-specific GETs");
  const { advanceLeadWorkStateViaApi } = await import("@/modules/leads/application/commands/leadApiCommands");
  let mutations = 0;
  observed = { ...rich, resourceVersion: 9 };
  configureLeadApplication({ ...getLeadApplicationServices(), api: { ...getLeadApplicationServices().api,
    commands: { ...base.api.commands, async advanceLeadWorkState(id, input, options) {
      mutations++;
      assert.equal(id, rich.id);
      assert.equal(options.expectedVersion, 9, "A command without a cached page reads its target version");
      return { lead: { ...observed, leadWorkState: input.targetWorkState, resourceVersion: 10 }, evidence: {
        authority: "backend", commandId: "targeted-read-command", correlationId: "targeted-read-correlation",
        aggregateId: id, aggregateType: "LEAD", version: 10, occurredAt: rich.createdAt,
        outcome: "COMMITTED", warnings: [], auditEvidenceIds: [], emittedEventIds: [],
      } };
    } },
  } });
  await act(async () => {
    repository.replace([]);
    await advanceLeadWorkStateViaApi(rich.id, { targetWorkState: "CONTACTING" });
  });
  assert.equal(commandReads, 1);
  assert.equal(mutations, 1);
  assert.equal(repository.getById(rich.id)?.resourceVersion, 10, "Stale refresh cannot downgrade the committed business version");
  console.log("Lead List/Table and Kanban actual-surface disclosure regression PASS");
} finally {
  await act(async () => root.unmount());
  getLeadCollectionResource().reset();
  configureLeadApplication(base);
  dom.window.close();
}
