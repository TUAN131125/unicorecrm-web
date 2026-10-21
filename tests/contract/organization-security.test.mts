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
let notePolicy: "READ_WRITE" | "READ_ONLY" | "HIDDEN" = "HIDDEN";
const written: Array<import("../../src/modules/organizations/application/ports/OrganizationApiRuntime").OrganizationUpdateCommand> = [];
const binding: AccessGovernanceRuntimeBinding = {
  ...original,
  getRuntime: () => original.getRuntime(),
  getState: () => ({ ...original.getState(), authorityRevision: revision }),
  getEffectiveAccess: () => ({ ...baseline, accountId: actor, capabilities: caps, getFieldAccess: (_resource, key) => key === "notes" ? notePolicy : "READ_WRITE", can: c => caps.has(c), canPerform: (m,a) => caps.has(`${m}.${a}`) }),
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
}, commands: { create: async () => { writes++; return result; }, update: async input => { written.push(input); writes++; return { ...result, resourceVersion: 4 }; }, archive: async () => { writes++; return result; } } } });

const React = await import("react");
const { createRoot } = await import("react-dom/client");
const { I18nProvider } = await import("../../src/i18n");
const { OrganizationEditModal } = await import("../../src/modules/organizations/presentation/detail/OrganizationEditModal");
const { createOrganizationViaApi, archiveOrganizationViaApi } = await import("../../src/modules/organizations/public/api");
for (const key of ["HTMLElement", "HTMLInputElement", "HTMLTextAreaElement", "Element", "Node", "Event", "CustomEvent", "MutationObserver"] as const) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true, configurable: true });
Object.defineProperty(dom.window, "matchMedia", { value: () => ({ matches: true, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }) });
Object.defineProperty(globalThis, "requestAnimationFrame", { value: (fn: FrameRequestCallback) => setTimeout(() => fn(0), 0), configurable: true });
Object.defineProperty(globalThis, "cancelAnimationFrame", { value: clearTimeout, configurable: true });
const host = document.createElement("div"); document.body.append(host);
const mounted = createRoot(host);
let count=0;
function check(value: unknown, label: string) { assert.ok(value,label);count++;console.log(`PASS ${label}`); }
async function render() {
 await React.act(async () => mounted.render(React.createElement(I18nProvider, null,
  React.createElement(OrganizationEditModal, { isOpen: true, onClose() {}, account: record("org-A", { displayName: "Organization form", notes: "Existing note", resourceVersion: 3 }), representatives: [], actorId: "reader", onSaved() {} }))));
}
authority(["organizations.read","organizations.update"]);
await render();
check(!document.getElementById("organization-edit-notes"), "Hidden notes control omitted from DOM");
const form = document.getElementById("organization-account-edit-form");assert.ok(form);
await React.act(async () => form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })));
check(written.length===1&&written[0]?.notes===undefined, "permitted form save omits Hidden input instead of writing blank default");
await React.act(async () => { notePolicy="READ_ONLY";authority(["organizations.read","organizations.update"]); });
await render();
const notes = document.getElementById("organization-edit-notes");assert.ok(notes);
check(notes.matches(":disabled"), "ReadOnly notes control disabled");
await React.act(async () => form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })));
check(written.length===2&&written.at(-1)?.notes===undefined, "ReadOnly value not resubmitted as writable input");
await React.act(async () => { notePolicy="READ_WRITE";authority(["organizations.read","organizations.update"]); });
await render();
check(!document.getElementById("organization-edit-notes")?.matches(":disabled"), "Writable notes control enabled");
await React.act(async () => mounted.unmount());
const { OrganizationAccountDetailPage } = await import("../../src/modules/organizations/detail-route");
const { MemoryRouter, Routes, Route } = await import("react-router-dom");
let evaluations=0;
ac.configureEffectiveRecordAccessAuthority({ source: "backend", async evaluate(request) {
 evaluations++;
 return {workspaceId:request.workspaceId,resourceKey:"organizations",recordId:request.recordId,canRead:true,
 canUpdate:caps.has("organizations.update"),canDelete:caps.has("organizations.delete"),canExport:false,canApprove:false,
 allowedCommands:[],fieldAccess:{},decisionReasons:[],evaluatedAt:"2026-10-18T00:00:00Z",authority:"backend"};
}});
const authorityRoot=createRoot(host);
await React.act(async () => {
 authority(["organizations.read","organizations.update"]);
 authorityRoot.render(React.createElement(I18nProvider,null,React.createElement(MemoryRouter,{initialEntries:["/organizations/org-A"]},
  React.createElement(Routes,null,React.createElement(Route,{path:"/organizations/:organizationId",element:React.createElement(OrganizationAccountDetailPage)})))));
});
const initialEvaluations=evaluations;
check(initialEvaluations>0&&host.querySelector('[data-effective-access="read-write"]'),"actual Organization route evaluates record write authority");
await React.act(async () => authority(["organizations.read"]));
check(evaluations>initialEvaluations&&host.querySelector('[data-effective-access="read-only"]'),"same-session authority revision retires and reevaluates record decision");
await React.act(async () => authorityRoot.unmount());
authority(["organizations.read","organizations.create"]);
await createOrganizationViaApi({displayName:"Creator without Update"});check(true,"authorized create response does not require local Update capability");
authority(["organizations.read","organizations.delete"]);
await archiveOrganizationViaApi({organizationId:"org-A",expectedVersion:3});check(true,"authorized archive response does not require local Update capability");
console.log(`Organization security UI: ${count} checks PASS (isolated frontend fixtures, not server authorization proof).`);
dom.window.close();
