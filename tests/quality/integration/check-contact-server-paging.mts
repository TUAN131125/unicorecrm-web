import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { composeContactServerListQuery } from "../../../src/modules/contacts/presentation/model/contactServerListQuery";
import { getDefaultContactFilters } from "../../../src/modules/contacts/presentation/model/contactSavedViewPreferences";

const defaults = { ...getDefaultContactFilters(), activeView: "allContacts", sortBy: "recentlyUpdated" };
const mine = composeContactServerListQuery({ ...defaults, activeView: "myContacts", searchTerm: "Ada", ownerFilter: "owner", doNotContactFilter: false });
assert.deepEqual(mine.query.filters, { ownerId: "owner", ownerScope: "my", doNotContact: false });
assert.equal(mine.query.search, "Ada");
assert.equal(composeContactServerListQuery({ ...defaults, activeView: "overdueFollowUp" }).query.filters.followUp, "overdue");
assert.equal(composeContactServerListQuery({ ...defaults, nextFollowUpAtFilter: "2026-10-06" }).query.filters.nextFollowUpDate, "2026-10-06");
for (const activeView of ["teamContacts", "inactiveLongTime", "duplicates", "nearClosing", "noOpportunityYet", "hasOpenOpportunity"]) {
  assert.equal(composeContactServerListQuery({ ...defaults, activeView }).unavailable, true, activeView);
}
assert.equal(composeContactServerListQuery({ ...defaults, priorityFilter: "HIGH" }).unavailable, true);
assert.equal(composeContactServerListQuery({ ...defaults, lastInteractionAtFilter: "2026-10-01" }).unavailable, true);
assert.equal(composeContactServerListQuery({ ...defaults, sortBy: "lastContacted" }).unavailable, true);

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "http://localhost" });
for (const key of ["window", "document", "navigator", "localStorage", "HTMLElement", "Element", "SVGElement", "Node", "MutationObserver", "Event", "CustomEvent", "EventTarget"] as const) {
  Object.defineProperty(globalThis, key, { configurable: true, value: key === "window" ? dom.window : dom.window[key] });
}
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
const React = await import("react");
const { createRoot } = await import("react-dom/client");
const { initializeApplicationComposition } = await import("../../../src/app/composition");
const auth = await import("../../../src/platform/identity-auth");
const signInResult = auth.signIn({ email: "admin@unicorecrm.local", password: "admin123" });
assert.equal(signInResult.ok, true);
if (!signInResult.ok) throw new Error("Fixture sign-in failed");
const session = signInResult.value;
// The gate may preload composition before jsdom. Bind the identity fixture through
// its public gateway instead of depending on a singleton's browser storage timing.
auth.configureConnectedAuthGateway({
  async bootstrap() { return { ok: true, value: session }; },
  async getCurrentSession() { return { ok: true, value: session }; },
  async signIn() { throw new Error("Unused fixture authentication"); },
  async verifyMfa() { throw new Error("Unused fixture MFA"); },
  async refreshSession() { return { ok: true, value: session }; },
  async signOut() { throw new Error("Unused fixture sign-out"); },
  async register() { throw new Error("Unused fixture registration"); },
  async verifyEmail() { throw new Error("Unused fixture verification"); },
  async requestEmailVerification() { throw new Error("Unused fixture verification request"); },
  async requestPasswordReset() { throw new Error("Unused fixture password request"); },
  async resetPassword() { throw new Error("Unused fixture password reset"); },
  async acceptInvitation() { throw new Error("Unused fixture invitation"); },
  getAccessToken() { return undefined; },
  clearCredentials() {},
});
await auth.bootstrapAuthSession();
await initializeApplicationComposition({ mode: "demo" });
assert.ok(auth.getAuthSessionSnapshot());
const { configureContactApplication, getContactApplicationServices } = await import("../../../src/modules/contacts/application/composition/contactApplicationServices");
const { useContactServerPagedCollection } = await import("../../../src/modules/contacts/presentation/hooks/useContactServerPagedCollection");
const { useContactListSummary } = await import("../../../src/modules/contacts/presentation/hooks/useContactListSummary");
const services = getContactApplicationServices();
const contact: import("../../../src/modules/contacts/domain/model/contact.types").Contact = { id: "fixture", name: "Ada", fullName: "Ada", createdAt: "2026-10-06", status: "active" };
const calls: Array<{ query: import("../../../src/shared/application").ModuleListQuery; signal: AbortSignal }> = [];
let summaryCalls = 0;
let failSummary = false;
let deferSummary = false;
let resolveSummary: ((value: { totalCount: number; statusCounts: Record<string, number> }) => void) | undefined;
let summarySignal: AbortSignal | undefined;
configureContactApplication({ ...services, api: { ...services.api, mode: "connected", queries: {
  ...services.api.queries,
  async list(query = {}, signal = new AbortController().signal) {
    calls.push({ query, signal });
    return { items: [{ ...contact, id: query.cursor ? "second" : "first" }], pageInfo: { totalCount: 26, hasNextPage: !query.cursor, ...(!query.cursor ? { nextCursor: "next" } : {}) }, loadedAt: "2026-10-06", authority: "backend" as const };
  },
  async summary(_query: unknown, signal?: AbortSignal) {
    summaryCalls += 1;
    summarySignal = signal;
    if (failSummary) throw new Error("private diagnostics must not be rendered");
    if (deferSummary) return new Promise<{ totalCount: number; statusCounts: Record<string, number> }>(resolve => { resolveSummary = resolve; });
    return { totalCount: 26, statusCounts: { active: 26 } };
  },
} } });
let pageState: ReturnType<typeof useContactServerPagedCollection> | undefined;
let summaryState: ReturnType<typeof useContactListSummary> | undefined;
const query = mine.query;
function Harness({ scope = "one", stats = false, enabled = true }) {
  pageState = useContactServerPagedCollection({ scopeKey: scope, query, enabled });
  summaryState = useContactListSummary(scope, query, stats);
  return null;
}
const container = document.getElementById("root");
assert.ok(container);
const root = createRoot(container);
await React.act(async () => root.render(React.createElement(Harness)));
assert.equal(calls.length, 1);
assert.equal(calls[0]?.query.limit, 25);
assert.equal(summaryCalls, 0, "Summary must not load before statistics opens");
assert.equal(pageState?.totalItems, 26);
await React.act(async () => pageState?.setPage(2));
assert.equal(calls[1]?.query.cursor, "next");
assert.equal(pageState?.items[0]?.id, "second");
await React.act(async () => root.render(React.createElement(Harness, { stats: true })));
assert.equal(summaryCalls, 1);
assert.equal(summaryState?.summary?.totalCount, 26);
await React.act(async () => root.render(React.createElement(Harness, { scope: "two", stats: true })));
assert.equal(pageState?.page, 1);
assert.equal(calls.at(-1)?.query.cursor, undefined);
failSummary = true;
await React.act(async () => summaryState?.refresh());
assert.ok(summaryState?.error);
assert.equal(summaryState?.summary, undefined, "Failed summaries must not retain old metrics");
failSummary = false;
deferSummary = true;
await React.act(async () => summaryState?.refresh());
assert.equal(summaryState?.loading, true);
const lastSummarySignal = summarySignal;
await React.act(async () => root.render(React.createElement(Harness, { scope: "two", enabled: false })));
assert.equal(lastSummarySignal?.aborted, true);
assert.equal(summaryState?.summary, undefined);
await React.act(async () => resolveSummary?.({ totalCount: 999, statusCounts: { active: 999 } }));
assert.equal(summaryState?.summary, undefined, "Closing statistics must ignore a late response");
await React.act(async () => root.unmount());
const currentServices = getContactApplicationServices();
const { summary: _summary, ...queriesWithoutSummary } = currentServices.api.queries;
configureContactApplication({ ...currentServices, api: { ...currentServices.api, queries: queriesWithoutSummary } });
const summaryCallsBeforeMissingPort = summaryCalls;
const missingRoot = createRoot(container);
await React.act(async () => missingRoot.render(React.createElement(Harness, { stats: true })));
assert.equal(summaryState?.unavailable, true, "A missing optional summary port must be explicitly unavailable");
assert.equal(summaryState?.summary, undefined, "A page must never become global statistics");
assert.equal(summaryCalls, summaryCallsBeforeMissingPort);
await React.act(async () => missingRoot.unmount());
// Exercise the connected controller with a configured shared authority registry.
// Its unbounded Contact resource and all browser writes must remain unused.
const application: typeof import("../../../src/shared/application") = await import("../../../src/shared/application");
const registry: Partial<import("../../../src/shared/application").ModuleDataAuthorityRegistry> = {};
for (const key of application.MODULE_DATA_AUTHORITY_KEYS) registry[key] = {
  key, source: "backend", contractVersion: "test",
  queries: { async list() { throw new Error("Unexpected shared collection query"); }, async get() { throw new Error("Unexpected shared detail query"); } },
  commands: { allowedOperations: new Set<string>(), async execute() { throw new Error("Unexpected command"); } },
};
application.assertCompleteModuleDataAuthorityRegistry(registry, "Contact controller test");
application.configureModuleDataAuthorityRegistry(registry);
const workspace = await import("../../../src/platform/workspace-context");
const { loadAccessGovernance } = await import("../../../src/platform/access-control");
await loadAccessGovernance(workspace.getWorkspaceContextSnapshot().workspaceId);
const { MemoryRouter } = await import("react-router-dom");
const { I18nProvider } = await import("../../../src/i18n");
const { useContactListController } = await import("../../../src/modules/contacts/presentation/hooks/useContactListController");
const { getContactCollectionResource } = await import("../../../src/modules/contacts/application/vertical-slice/contactAuthoritativeQueries");
let controller: ReturnType<typeof useContactListController> | undefined;
const getCurrentController = (): ReturnType<typeof useContactListController> | undefined => controller;
function ControllerHarness() {
  controller = useContactListController({ customers: [], deals: [], setDeals: () => { throw new Error("Unexpected local Deal write"); } });
  return null;
}
const controllerRoot = createRoot(container);
await React.act(async () => controllerRoot.render(React.createElement(I18nProvider, null,
  React.createElement(MemoryRouter, null, React.createElement(ControllerHarness)))));
assert.equal(controller?.canReadContacts, true);
assert.equal(controller?.contacts[0]?.id, "first");
assert.equal(getContactCollectionResource().getSnapshot().state, "IDLE", "Connected lists must never load the full-resource query");
assert.equal(controller?.serverSummary.unavailable, true);
await React.act(async () => controller?.setSearchTerm("does-not-match-the-returned-row"));
assert.equal(controller?.sortedContacts[0]?.id, "first", "Server rows must not be filtered again on the current page");
assert.equal(calls.at(-1)?.query.search, "does-not-match-the-returned-row");
for (const view of ["duplicates", "nearClosing", "teamContacts", "inactiveLongTime", "hasOpenOpportunity", "noOpportunityYet"]) {
  const callCount: number = calls.length;
  await React.act(async () => controller?.handleSelectSavedView(view));
  assert.equal(controller?.serverQueryUnavailable, true, view);
  assert.equal(controller?.contacts.length, 0);
  assert.equal(calls.length, callCount, "Unsupported views must not silently request a default server page");
}
await React.act(async () => controller?.handleSelectSavedView("myContacts"));
assert.equal(calls.at(-1)?.query.filters?.ownerScope, "my");
await React.act(async () => controller?.setPriorityFilter("HIGH"));
assert.equal(controller?.serverQueryUnavailable, true);
await React.act(async () => controller?.handleResetFilters());
const beforeInvalidation = calls.length;
await React.act(async () => application.invalidateModuleQueries({ moduleKeys: ["contacts"], commandType: "contact.update", aggregateId: "first", occurredAt: "2026-10-06" }));
assert.equal(calls.length, beforeInvalidation + 1, "Contact invalidation refreshes only the bounded page");
assert.equal(getContactCollectionResource().getSnapshot().state, "IDLE");
const beforeWrites = services.repository.list();
await React.act(async () => {
  controller?.handleSelectRow("first", true);
  controller?.handleBulkChangeOwner("owner", "test");
  controller?.handleBulkChangeStatus("inactive");
  controller?.handleBulkDelete();
  controller?.handleBulkArchive();
  controller?.handleBulkAddTags();
  controller?.handleBulkDoNotContact();
  controller?.handleCall({ ...contact, phone: "0123456789" });
  controller?.handleEmail({ ...contact, email: "ada@example.com" });
});
await React.act(async () => controller?.setSelectedContactForDeal(contact));
await React.act(async () => {
  const result = await controller?.handleCommitOpportunity({ dealName: "Blocked", dealAmount: 1, dealOwnerId: "owner", expectedCloseDate: "2026-10-07", selectedProductId: "", demandSummary: "", createFollowUpTask: true, followUpTaskTitle: "Blocked", followUpTaskDueAt: "2026-10-07" });
  assert.equal(result, false, "Connected opportunity creation must refuse before Deal, Task or Contact writes");
});
assert.deepEqual(services.repository.list(), beforeWrites, "Connected handlers must not modify browser Contact snapshots");
assert.equal(controller?.confirmModal.isOpen, false);
assert.equal(controller?.promptModal.isOpen, false);
assert.equal(controller?.contactOpportunityAvailable, false);
assert.ok(calls.every(call => call.query.limit !== undefined), "No unbounded Contact list request is allowed");

// Authorization changes must publish even when the optional directory is absent
// and its version stays zero. Keep contacts.read while narrowing record/field scope.
const governance = await import("../../../src/platform/access-control");
const previousGovernance = governance.getAccessGovernanceRuntime();
const previousAuthorization = governance.getAccessGovernanceState().snapshot?.authorization;
assert.ok(previousAuthorization);
await React.act(async () => controllerRoot.unmount());
let authorization: NonNullable<typeof previousAuthorization> = { ...previousAuthorization, dataScopes: { ...previousAuthorization.dataScopes, contacts: "WORKSPACE" } };
governance.configureDefaultAccessGovernanceRuntime({ ...previousGovernance, queries: {
  ...previousGovernance.queries,
  async getAuthorizationContext() { return authorization; },
  async getDirectory() { throw new Error("OPTIONAL_DIRECTORY_UNAVAILABLE"); },
} });
await React.act(async () => { await governance.loadAccessGovernance(workspace.getWorkspaceContextSnapshot().workspaceId); });
type ContactPage = import("../../../src/shared/application").AuthoritativePage<typeof contact>;
type Summary = { totalCount: number; statusCounts: Record<string, number> };
const pendingPages: Array<{ signal: AbortSignal; query: import("../../../src/shared/application").ModuleListQuery; resolve: (result: ContactPage) => void }> = [];
const pendingSummaries: Array<{ signal: AbortSignal; resolve: (result: Summary) => void }> = [];
const widePage: ContactPage = { items: [{ ...contact, id: "wider-scope", ownerId: "other-member", workEmail: "protected@example.test" }], pageInfo: { totalCount: 26, hasNextPage: true, nextCursor: "wide-cursor" }, loadedAt: "2026-10-08T00:00:00.000Z", authority: "backend" };
let holdAuthorityReads = false;
configureContactApplication({ ...services, api: { ...services.api, mode: "connected", queries: {
  ...services.api.queries,
  async list(request = {}, signal = new AbortController().signal) {
    if (!holdAuthorityReads) return request.cursor ? { ...widePage, pageInfo: { totalCount: 26, hasNextPage: false } } : widePage;
    return new Promise<ContactPage>(resolve => pendingPages.push({ signal, query: request, resolve }));
  },
  async summary(_request, signal = new AbortController().signal) {
    if (!holdAuthorityReads) return { totalCount: 26, statusCounts: { active: 26 } };
    return new Promise<Summary>(resolve => pendingSummaries.push({ signal, resolve }));
  },
} } });
const authorityRoot = createRoot(container);
await React.act(async () => authorityRoot.render(React.createElement(I18nProvider, null,
  React.createElement(MemoryRouter, null, React.createElement(ControllerHarness)))));
await React.act(async () => {
  controller?.setShowStatisticsPanel(true);
  await controller?.serverPagination.refresh();
});
assert.equal(controller?.contacts[0]?.workEmail, "protected@example.test");
assert.equal(controller?.serverSummary.summary?.totalCount, 26);
await React.act(async () => controller?.serverPagination.setPage(2));
assert.equal(controller?.serverPagination.page, 2, "Exercise authority narrowing with an existing second-page cursor");
holdAuthorityReads = true;
await React.act(async () => {
  void controller?.serverPagination.refresh();
  controller?.serverSummary.refresh();
});
const oldPageRequest = pendingPages.at(-1); const oldSummaryRequest = pendingSummaries.at(-1);
const oldRefresh = controller?.serverPagination.refresh;
assert.ok(oldPageRequest); assert.ok(oldSummaryRequest);
authorization = { ...authorization, dataScopes: { ...authorization.dataScopes, contacts: "OWN" }, fieldSecurity: { ...authorization.fieldSecurity, contacts: { ...authorization.fieldSecurity.contacts, workEmail: "HIDDEN" } } };
const oldPublication = governance.getAccessGovernanceState().authorityRevision;
await React.act(async () => { await governance.refreshAccessGovernance(workspace.getWorkspaceContextSnapshot().workspaceId); });
assert.equal(governance.getAccessGovernanceState().snapshot?.revision, 0, "Directory version must not be used as authorization generation");
assert.notEqual(governance.getAccessGovernanceState().authorityRevision, oldPublication);
assert.equal(controller?.canReadContacts, true, "This is narrowing, not total read denial");
assert.deepEqual(controller?.contacts, [], "Evict wider rows and protected fields before narrower reads complete");
assert.equal(controller?.serverPagination.page, 1, "Authority changes return to the first page");
assert.equal(controller?.serverPagination.totalItems, 0, "The old authorized count must not survive eviction");
assert.equal(controller?.serverSummary.summary, undefined, "Evict wider authorized totals");
assert.equal(oldPageRequest.signal.aborted, true); assert.equal(oldSummaryRequest.signal.aborted, true);
const requestsAfterNarrowing = pendingPages.length;
await React.act(async () => { await oldRefresh?.(); });
assert.equal(pendingPages.length, requestsAfterNarrowing, "A retained old-context refresh callback must not issue or project a wider request");
await React.act(async () => {
  oldPageRequest.resolve(widePage);
  oldSummaryRequest.resolve({ totalCount: 999, statusCounts: { active: 999 } });
});
assert.deepEqual(controller?.contacts, []); assert.equal(controller?.serverSummary.summary, undefined);
const currentPage = pendingPages.at(-1); const currentSummary = pendingSummaries.at(-1);
assert.ok(currentPage); assert.ok(currentSummary);
assert.equal(currentPage.query.cursor, undefined, "Old-authority cursors must be discarded");
await React.act(async () => {
  currentPage.resolve({ items: [{ ...contact, id: "own-scope", ownerId: authorization.memberId }], pageInfo: { totalCount: 1, hasNextPage: false }, loadedAt: "2026-10-08T00:00:00.000Z", authority: "backend" });
  currentSummary.resolve({ totalCount: 1, statusCounts: { active: 1 } });
});
assert.equal(getCurrentController()?.contacts[0]?.id, "own-scope");
assert.equal(getCurrentController()?.contacts[0]?.workEmail, undefined);
assert.equal(getCurrentController()?.serverSummary.summary?.totalCount, 1, "Use the fresh server total rather than a local projection");
await React.act(async () => authorityRoot.unmount());
console.log("Contact server paging, query composition, summary cancellation/unavailability and connected controller authority checks passed.");
