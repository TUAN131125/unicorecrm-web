import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import type { OrganizationAccount } from "../../src/modules/organizations/domain/model/organizationAccount.types";
import type { AccessGovernanceRuntimeBinding } from "../../src/platform/access-control/application/accessGovernanceBinding";

const dom = new JSDOM("<html><body></body></html>", { url: "http://localhost" });
for (const [name, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, localStorage: dom.window.localStorage })) Object.defineProperty(globalThis, name, { value, configurable: true });
const auth = await import("../../src/platform/identity-auth");
assert.equal(auth.signIn({ email: "admin@unicorecrm.local", password: "admin123" }).ok, true);
const { initializeApplicationComposition } = await import("../../src/app/composition");
await initializeApplicationComposition({ mode: "demo" });
const workspace = await import("../../src/platform/workspace-context");
const ac = await import("../../src/platform/access-control");
await ac.loadAccessGovernance(workspace.getWorkspaceContextSnapshot().workspaceId);
const original = ac.getAccessGovernanceRuntimeBinding();
const baseline = ac.resolveEffectiveAccess();
let revision = 1;
let caps = new Set(["organizations.read"]);
let actor = "reader";
const listeners = new Set<() => void>();
const binding: AccessGovernanceRuntimeBinding = {
  ...original,
  getRuntime: () => original.getRuntime(),
  getState: () => ({ ...original.getState(), authorityRevision: revision }),
  getEffectiveAccess: () => ({ ...baseline, accountId: actor, capabilities: caps, can: c => caps.has(c), canPerform: (m,a) => caps.has(`${m}.${a}`) }),
  subscribe: fn => { listeners.add(fn); return () => { listeners.delete(fn); }; },
  load: (...args) => original.load(...args), refresh: (...args) => original.refresh(...args),
  applyMutation: (...args) => original.applyMutation(...args), clear: () => original.clear(),
};
ac.configureAccessGovernanceRuntime(binding);
function authority(capabilities: string[], account = actor) { caps = new Set(capabilities); actor = account; revision++; for (const listener of listeners) listener(); }
const { configureOrganizationApplication } = await import("../../src/modules/organizations/application/composition/organizationApplicationServices");
const { ConnectedCollectionProjection } = await import("../../src/app/composition/connected/connectedProjectionRepositories");
const { ApplicationError } = await import("../../src/shared/domain");
const { runBackendProjection } = await import("../../src/shared/application");
const projection = new ConnectedCollectionProjection<OrganizationAccount>("organizations", x => x.id);
const repository = { list: () => projection.list(), findById: (id: string) => projection.getById(id), replace: (records: OrganizationAccount[]) => projection.replace(records), subscribe: (fn: (records: OrganizationAccount[]) => void) => projection.subscribe(fn) };
const record = (id = "org-A", fields: Partial<OrganizationAccount> = {}): OrganizationAccount => ({ id, workspaceId: workspace.getWorkspaceContextSnapshot().workspaceId, displayName: id, status: "active", contactRefs: [], createdAt: "2026-10-18T00:00:00Z", resourceVersion: 3, ...fields });
let result = record();
let failure: InstanceType<typeof ApplicationError> | undefined;
let deferred: ((value: OrganizationAccount) => void) | undefined;
let hold = false;
let wrongScope = false;
let gets = 0;
let writes = 0;
configureOrganizationApplication({ repository, api: { mode: "connected", queries: {
  list: async () => ({ items: [structuredClone(result)], pageInfo: { hasNextPage: false }, loadedAt: "2026-10-18T00:00:00Z", authority: "backend" }),
  get: async (id) => { gets++; if (failure) throw failure; if (hold) return new Promise(resolve => { deferred = resolve; }); return { ...structuredClone(result), id, ...(wrongScope ? { workspaceId: "forged-workspace" } : {}) }; },
  getOverview: async () => ({ organization: structuredClone(result), contactIds: [], metrics: { representativeCount: 0 }, linkedRecords: [], allowedActions: [], projectionVersion: 1, generatedAt: "2026-10-18T00:00:00Z" }),
}, commands: { create: async () => { writes++; return result; }, update: async () => { writes++; return result; }, archive: async () => { writes++; return result; } } } });
const queries = await import("../../src/modules/organizations/application/vertical-slice/organizationAuthoritativeQueries");
const { saveOrganizationAccountSnapshot } = await import("../../src/modules/organizations/public/api");
let checks = 0;
function check(value: unknown, label: string) { assert.ok(value, label); checks++; console.log(`PASS ${label}`); }
for (const extra of [[], ["organizations.update"], ["organizations.create"], ["organizations.create", "organizations.update"]]) {
  authority(["organizations.read", ...extra]);
  const detail = queries.getOrganizationAccountDetailResource("org-A");
  await detail.load();
  check(detail.getSnapshot().state === "READY", `cold detail without unnecessary write authority: ${extra.join(",") || "reader"}`);
  check(repository.findById("org-A")?.resourceVersion === 3, "backend version preserved");
  const before = gets;
  await detail.load(); check(gets === before, "cache hit does not refetch");
  await detail.refresh(); check(gets === before + 1, "warm refresh");
}
authority(["organizations.read"]);
await queries.getOrganizationAccountCollectionResource().load();
check(queries.getOrganizationAccountCollectionResource().getSnapshot().state === "READY", "list before detail works");
await queries.getOrganizationAccountDetailResource("org-A").load();
check(repository.list().length === 1, "list then detail keeps one identity");
assert.throws(() => saveOrganizationAccountSnapshot(record("forbidden")), /Access denied/);
check(!repository.findById("forbidden"), "reader local business write still denied");
result = record("org-A", { legalName: "Optional", primaryContactId: "representative", contactRefs: [{ type: "CONTACT", id: "representative" }], notes: "restricted later" });
await queries.getOrganizationAccountDetailResource("org-A").refresh();
check(repository.findById("org-A")?.primaryContactId === "representative", "optional reference preserved");
await queries.getOrganizationAccountCollectionResource().refresh();
await queries.getOrganizationOverviewResource("org-A").load();
const previous = queries.getOrganizationAccountDetailResource("org-A");
authority(["organizations.read"]);
check(previous.getSnapshot().data === undefined && repository.list().length === 0, "authority change immediately retires resource and projection");
result = record();
await previous.load();
check(previous.getSnapshot().state === "READY", "memoized public handle can refetch after authority retirement");
check(repository.findById("org-A")?.notes === undefined, "restricted field never restored from stale snapshot");
result = record("org-A", { notes: "old field" });
await queries.getOrganizationAccountDetailResource("org-A").refresh();
result = record();
await queries.getOrganizationAccountDetailResource("org-A").refresh();
check(repository.findById("org-A")?.notes === undefined, "fresh DTO replaces rather than merges optional fields");
await queries.getOrganizationAccountCollectionResource().refresh();
await queries.getOrganizationOverviewResource("org-A").load();
result = record("org-A", { notes: "previously visible" });
await queries.getOrganizationAccountCollectionResource().refresh();
await queries.getOrganizationOverviewResource("org-A").load();
result = record();
await queries.getOrganizationAccountDetailResource("org-A").refresh();
check(queries.getOrganizationAccountCollectionResource().getSnapshot().data?.items[0]?.notes === undefined, "detail redaction reconciles cached collection fields");
check(queries.getOrganizationOverviewResource("org-A").getSnapshot().data === undefined, "detail redaction retires overview sibling");
await queries.getOrganizationOverviewResource("org-A").load();
for (const status of [401,403,404,500]) {
  failure = new ApplicationError({ code: `HTTP_${status}`, status, message: "private diagnostic" });
  const detail = queries.getOrganizationAccountDetailResource("org-A");
  await detail.refresh();
  check(detail.getSnapshot().state === "ERROR" && detail.getSnapshot().error?.status === status, `${status} remains error, not empty success`);
  if (status !== 500) {
    check(!repository.findById("org-A") && detail.getSnapshot().data === undefined, `${status} evicts inaccessible cached content`);
    check(!queries.getOrganizationAccountCollectionResource().getSnapshot().data?.items.some(item => item.id === "org-A") && queries.getOrganizationOverviewResource("org-A").getSnapshot().data === undefined, `${status} evicts sibling cache content`);
  }
  failure = undefined;
  await detail.refresh(); check(detail.getSnapshot().state === "READY", "retry after error succeeds");
}
hold = true;
const late = queries.getOrganizationAccountDetailResource("late");
const pending = late.load();
assert.ok(deferred);
const resolveLate = deferred;
authority(["organizations.read"], "other-session-account");
resolveLate(record("late", { notes: "must not project" }));
await pending;
check(!repository.findById("late") && late.getSnapshot().data === undefined, "late response from retired actor cannot project");
hold = false;
await queries.getOrganizationAccountDetailResource("org-B").load();
check(!queries.getOrganizationAccountDetailResource("org-B").getSnapshot().data?.notes, "different record gets its own DTO");
const overview = queries.getOrganizationOverviewResource("org-A");
await overview.load(); check(overview.getSnapshot().state === "READY", "overview uses same read projection path");
wrongScope = true;
const mismatched = queries.getOrganizationAccountDetailResource("wrong-scope");
await mismatched.load();
check(mismatched.getSnapshot().state === "ERROR" && !repository.findById("wrong-scope"), "mismatched Workspace DTO rejected before projection");
wrongScope = false;
const React = await import("react");
const { createRoot } = await import("react-dom/client");
const { useAuthoritativeResource } = await import("../../src/shared/operations/useAuthoritativeResource");
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true, configurable: true });
const host = document.createElement("div"); document.body.append(host);
const mounted = createRoot(host);
function MemoizedDirectory() {
  const directory = React.useMemo(() => queries.getOrganizationAccountCollectionResource(), []);
  const query = useAuthoritativeResource(directory);
  return React.createElement("div", null, query.state + ":" + (query.data?.items[0]?.displayName ?? ""));
}
result = record("org-A", { displayName: "Before authority" });
await React.act(async () => { queries.getOrganizationAccountCollectionResource().reset(); mounted.render(React.createElement(MemoizedDirectory)); });
check(host.textContent === "READY:Before authority", "mounted memoized collection consumer loads");
result = record("org-A", { displayName: "After authority" });
await React.act(async () => { authority(["organizations.read"]); });
check(host.textContent === "READY:After authority", "mounted memoized consumer refetches without remount on authority change");
await React.act(async () => mounted.unmount());
hold = true;
const lateRecord = record("rapid-A");
const rapidA = queries.getOrganizationAccountDetailResource("rapid-A").load();
assert.ok(deferred); const resolveRapid = deferred;
hold = false;
await queries.getOrganizationAccountDetailResource("rapid-B").load();
resolveRapid(lateRecord); await rapidA;
check(queries.getOrganizationAccountDetailResource("rapid-B").getSnapshot().data?.id === "rapid-B", "late A response cannot overwrite B detail state");
const beforeSwitch = queries.getOrganizationAccountDetailResource("org-A");
hold = true;
const oldWorkspaceDto = record("old-workspace-response");
const oldWorkspacePending = queries.getOrganizationAccountDetailResource("old-workspace-response").load();
assert.ok(deferred); const resolveOldWorkspace = deferred;
const otherWorkspace = workspace.listWorkspaceMemberships().find(item => item.workspaceId !== workspace.getWorkspaceContextSnapshot().workspaceId);
assert.ok(otherWorkspace, "official demo fixtures include another workspace");
await workspace.switchWorkspaceContext(otherWorkspace.workspaceKey);
hold = false;
resolveOldWorkspace(oldWorkspaceDto); await oldWorkspacePending;
check(!repository.findById("old-workspace-response"), "late response from previous Workspace discarded");
check(beforeSwitch.getSnapshot().data === undefined && repository.list().length === 0, "Workspace transition evicts previous record cache");
result = record("org-A", { displayName: "Other Workspace A" });
await queries.getOrganizationAccountDetailResource("org-A").load();
check(repository.findById("org-A")?.workspaceId === otherWorkspace.workspaceId, "same record ID cannot reuse previous Workspace DTO");
const beforeLogout = queries.getOrganizationAccountDetailResource("org-A");
auth.signOut();
check(beforeLogout.getSnapshot().data === undefined && repository.list().length === 0, "logout retires cached restricted data synchronously");
check(writes === 0, "all read scenarios issue zero business mutations");
console.log(`Organization read hydration: ${checks} checks PASS (frontend fixture authority only; not Backend HTTP authorization).`);
dom.window.close();
