import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
const dom = new JSDOM('<html><body><div id="root"></div><button id="anchor">Tags</button></body></html>', { url: "http://localhost", pretendToBeVisual: true });
const { window } = dom;
for (const key of ["window", "document", "navigator", "localStorage", "HTMLElement", "SVGElement", "Element", "Node", "Event", "CustomEvent", "EventTarget", "MutationObserver"] as const) Object.defineProperty(globalThis, key, { value: key === "window" ? window : window[key], configurable: true });
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
const React = await import("react");
const { act } = React;
const { createRoot } = await import("react-dom/client");
const { I18nProvider, useI18n } = await import("@/i18n");
const { useLeadDetailDialogs } = await import("@/modules/leads/presentation/hooks/useLeadDetailDialogs");
const { LeadDetailModals } = await import("@/modules/leads/presentation/components/LeadDetailModals");
const { useLeadActions } = await import("@/modules/leads/presentation/hooks/useLeadActions");
const { configureLeadApplication, getLeadApplicationServices } = await import("@/modules/leads/application/composition/leadApplicationServices");
const { ApplicationError } = await import("@/shared/domain");
import type { Lead } from "@/modules/leads/domain/model/lead.types";
import type { ReplaceLeadProfileResult } from "@/modules/leads/application/ports/LeadApiRuntime";
const services = getLeadApplicationServices();
let lead = { id: "lead_tags", name: "Tags fixture", ownerId: "member_admin", phone: "0900000000", resourceVersion: 5, tags: ["VIP", "Keep"], source: "Web" } as Lead;
const { resolveEffectiveAccess, loadAccessGovernance } = await import("@/platform/access-control");
const { getWorkspaceContextSnapshot } = await import("@/platform/workspace-context");
const { saveDirtyUnsavedWork, discardDirtyUnsavedWork } = await import("@/platform/unsaved-work");
await loadAccessGovernance(getWorkspaceContextSnapshot().workspaceId);
lead.ownerId = resolveEffectiveAccess().memberId;
let routeId = lead.id;
let calls = 0;
let submittedVersion: number | undefined;
let submittedTags: readonly string[] | undefined;
const attemptKeys: string[] = [];
let projections = 0;
let release: ((result: ReplaceLeadProfileResult) => void) | undefined;
let reject: ((error: unknown) => void) | undefined;
const toasts: string[] = [];
const failureToasts: string[] = [];
const runtime = services.api;
assert.ok(runtime);
configureLeadApplication({ ...services, repository: { list: () => [lead], getById: id => id === lead.id ? lead : undefined, replace: records => { projections++; if (records[0]) lead = records[0]; }, subscribe: () => () => {} }, api: { ...runtime, commands: { ...runtime.commands,
  replaceLeadProfile: async (_id, input, options) => { calls++; submittedVersion = options.expectedVersion; submittedTags = input.tags; attemptKeys.push(options.idempotencyKey); return new Promise((resolve, fail) => { release = resolve; reject = fail; }); },
} } });

let dialogs: ReturnType<typeof useLeadDetailDialogs> | undefined;
function Harness() {
  dialogs = useLeadDetailDialogs(lead, routeId);
  const actions = useLeadActions();
  const { t } = useI18n();
  return React.createElement(LeadDetailModals, { screen: {
    dialogs, lead: dialogs.boundLead ?? lead, locale: "en", t, sources: [], campaigns: [], products: [], members: [], handoverMembers: [],
    showToast: message => { if (message.startsWith("Removed tag")) toasts.push(message); else failureToasts.push(message); }, navigate() {}, leadActions: actions, archiveListPath: "/leads", canHandover: false,
    handover: { isAmbiguousRetry: () => false, pending: false, blocked: false, ambiguous: false, resolutionAccessDenied: false, submit: async () => undefined, recover: async () => {} },
    handleConfirmDisqualify() {}, handleConfirmHandover() {}, handleSaveEditFromForm() {}, handleSavePhoneCall() {}, handleSaveMeeting() {}, handleLogExternalEmail() {}, handleLogExternalSms() {},
  } });
}
const host = window.document.getElementById("root"); assert.ok(host);
const root = createRoot(host);
const render = async () => { await act(async () => root.render(React.createElement(I18nProvider, null, React.createElement(Harness)))); };
await render();
assert.ok(dialogs);
await act(async () => { dialogs?.setTagsAnchor(window.document.getElementById("anchor")); dialogs?.setShowTagsModal(true); });
const remove = window.document.querySelector<HTMLButtonElement>('button[aria-label="Remove tag VIP"]'); assert.ok(remove);
// Deferred actual click: this must fail against the fire-and-forget baseline.
await act(async () => remove.click());
assert.equal(toasts.length, 0, "No success acknowledgment before authoritative Promise resolution");
assert.equal(dialogs?.interactionPending, true);
await act(async () => remove.click());
assert.equal(calls, 1);
assert.ok(reject);
await act(async () => reject?.(new ApplicationError({ code: "VALIDATION_FAILED", category: "VALIDATION", status: 422, message: "Rejected" })));
assert.equal(toasts.length, 0);
assert.equal(dialogs?.interactionPending, false);
assert.ok(window.document.querySelector('[role="alert"]'));
assert.ok(window.document.querySelector('button[aria-label="Remove tag VIP"]'));
const clickRemove = async () => {
  const button = window.document.querySelector<HTMLButtonElement>('button[aria-label="Remove tag VIP"]'); assert.ok(button);
  await act(async () => button.click());
};
const receipt = (tags: string[], id = "lead_tags"): ReplaceLeadProfileResult => ({ lead: { ...lead, id, tags, resourceVersion: (submittedVersion ?? 5) + 1 },
  evidence: { authority: "test", aggregateId: id, aggregateType: "Lead", commandId: "command", correlationId: "correlation", version: (submittedVersion ?? 5) + 1,
    occurredAt: "2026-10-11T00:00:00Z", outcome: "COMMITTED", warnings: [], emittedEventIds: [], auditEvidenceIds: [] } });
const setDraft = async (value: string) => {
  const input = window.document.querySelector<HTMLInputElement>('input'); assert.ok(input);
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set; assert.ok(setter);
  await act(async () => { setter.call(input, value); input.dispatchEvent(new window.Event("input", { bubbles: true })); });
};
const reopen = async () => {
  await act(async () => dialogs?.setShowTagsModal(false));
  await act(async () => dialogs?.setShowTagsModal(true));
};
const fail = async (code: string, category: "CONFLICT" | "AUTHORIZATION" | "NOT_FOUND" | "NETWORK", status?: number) => {
  assert.ok(reject);
  await act(async () => reject?.(new ApplicationError({ code, category, ...(status === undefined ? {} : { status }), message: "Command rejected" })));
};
// Wrong target/unchanged tag never reach projection.
await clickRemove();
const beforeWrong = projections;
await act(async () => release?.(receipt(["Keep"], "lead_wrong")));
assert.equal(projections, beforeWrong); assert.equal(toasts.length, 0);
await reopen(); await clickRemove();
await act(async () => release?.(receipt(["VIP", "Keep"])));
assert.equal(projections, beforeWrong); assert.equal(toasts.length, 0);
await reopen();
// Opening N remains N despite latest repository resource changing to N+1.
lead = { ...lead, resourceVersion: 9, description: "Another client's newer profile" };
await render(); await clickRemove();
assert.equal(submittedVersion, 5);
await fail("VERSION_CONFLICT", "CONFLICT", 412);
const afterConflict = calls;
await clickRemove(); await act(async () => { void dialogs?.saveActiveForm(); });
assert.equal(calls, afterConflict, "Conflict cannot blind retry with a newly read version");
assert.equal(dialogs?.interactionPending, false);
assert.ok(window.document.querySelector('[role="alert"]'));
await reopen();
// Timeout/disconnect: no automatic fresh-attempt retry, including global Save.
await clickRemove(); await fail("NETWORK_ERROR", "NETWORK");
const afterNetwork = calls;
await clickRemove(); await act(async () => { void dialogs?.saveActiveForm(); });
assert.equal(calls, afterNetwork); assert.equal(toasts.length, 0);
await reopen();
// Explicit denial/not-found releases pending and preserves server tags.
for (const [code, category, status] of [["FORBIDDEN", "AUTHORIZATION", 403], ["NOT_FOUND", "NOT_FOUND", 404]] as const) {
  await clickRemove(); await fail(code, category, status);
  assert.equal(dialogs?.interactionPending, false); assert.equal(toasts.length, 0);
  assert.ok(failureToasts.length > 0);
  assert.equal(dialogs?.showTagsModal, false, "Denied/missing resource retires protected interaction");
  await reopen();
}
// Remove owns pending; Add/global Save, Escape/outside close cannot bypass it.
await setDraft("Draft preserved"); await clickRemove();
const afterRemove = calls;
await act(async () => { void dialogs?.saveActiveForm(); window.document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
await act(async () => {
  assert.equal(await saveDirtyUnsavedWork(), false);
  assert.equal(discardDirtyUnsavedWork(), false);
  const backdrop = window.document.querySelector<HTMLDivElement>('div.fixed.inset-0.bg-transparent'); assert.ok(backdrop);
  backdrop.click();
});
assert.equal(calls, afterRemove); assert.equal(dialogs?.showTagsModal, true);
assert.equal(window.document.querySelector<HTMLInputElement>('input')?.value, "Draft preserved");
assert.equal(window.document.querySelector<HTMLInputElement>('input')?.disabled, true);
await act(async () => release?.(receipt(["Keep"])));
assert.equal(toasts.length, 1); assert.equal(dialogs?.interactionPending, false);
assert.equal(window.document.querySelector('button[aria-label="Remove tag VIP"]'), null);
assert.equal(window.document.querySelector<HTMLInputElement>('input')?.value, "Draft preserved");
// Add binding remains distinct and uses the confirmed version after Remove.
let savePromise: Promise<boolean> | undefined;
await act(async () => { savePromise = dialogs?.saveActiveForm(); });
assert.ok(submittedTags?.includes("Draft preserved")); assert.equal(submittedTags?.includes("VIP"), false);
const duringAdd = calls;
await act(async () => { void dialogs?.saveActiveForm(); });
const removeKeep = window.document.querySelector<HTMLButtonElement>('button[aria-label="Remove tag Keep"]'); assert.ok(removeKeep);
await act(async () => removeKeep.click());
assert.equal(calls, duringAdd);
await fail("VALIDATION_FAILED", "CONFLICT", 422);
assert.equal(await savePromise, false);
assert.equal(window.document.querySelector<HTMLInputElement>('input')?.value, "Draft preserved");
await act(async () => { savePromise = saveDirtyUnsavedWork(); });
await act(async () => release?.(receipt(["Keep", "Draft preserved"])));
assert.equal(await savePromise, true); assert.equal(dialogs?.showTagsModal, false);
await reopen(); await setDraft("   ");
const emptyCalls = calls;
await act(async () => { savePromise = dialogs?.saveActiveForm(); });
assert.equal(await savePromise, false); assert.equal(calls, emptyCalls);
await setDraft("Keep");
await act(async () => { savePromise = dialogs?.saveActiveForm(); });
await fail("VERSION_CONFLICT", "CONFLICT", 412);
assert.equal(await savePromise, false);
const addConflictCalls = calls;
await act(async () => { savePromise = dialogs?.saveActiveForm(); });
assert.equal(await savePromise, false); assert.equal(calls, addConflictCalls);
assert.equal(window.document.querySelector<HTMLInputElement>('input')?.value, "Keep");
await reopen(); await setDraft("Keep");
await act(async () => { savePromise = dialogs?.saveActiveForm(); });
assert.equal(submittedTags?.filter(tag => tag === "Keep").length, 1, "Exact-case duplicate semantics preserved");
await act(async () => release?.(receipt(["Keep", "Draft preserved"])));
assert.equal(await savePromise, true);
// Route retirement suppresses old projection/toast/finally and new interaction closure.
lead = { ...lead, tags: ["VIP", "Keep"] }; await render(); await reopen(); await clickRemove();
const oldProjection = projections; const oldToasts = toasts.length;
routeId = "lead_B"; lead = { ...lead, id: routeId }; await render();
assert.equal(window.document.querySelector('[aria-label="Manage Lead Tags"]'), null);
await act(async () => dialogs?.setShowTagsModal(true));
await act(async () => release?.(receipt(["Keep"], "lead_tags")));
assert.equal(projections, oldProjection); assert.equal(toasts.length, oldToasts);
assert.equal(dialogs?.showTagsModal, true, "Old completion cannot close Lead B's interaction");
// Revise authority while pending; no stale UI or projection after response.
lead = { ...lead, tags: ["VIP", "Keep"] }; await render(); await reopen(); await clickRemove();
const { getAccessGovernanceRuntimeBinding } = await import("@/platform/access-control");
const state = getAccessGovernanceRuntimeBinding().getState();
const oldRevision = state.authorityRevision;
state.authorityRevision = (oldRevision ?? 0) + 1;
await render();
assert.equal(dialogs?.showTagsModal, false);
const authorityProjection = projections;
await act(async () => release?.(receipt(["Keep"], routeId)));
assert.equal(projections, authorityProjection); assert.equal(toasts.length, oldToasts);
state.authorityRevision = oldRevision;
await render(); await act(async () => dialogs?.setShowTagsModal(true));
// Full principal/membership key changes even when a revision is unchanged.
await clickRemove();
const originalBinding = getAccessGovernanceRuntimeBinding();
const originalAccess = originalBinding.getEffectiveAccess(getWorkspaceContextSnapshot().workspaceId); assert.ok(originalAccess);
const { configureAccessGovernanceRuntime } = await import("@/platform/access-control");
configureAccessGovernanceRuntime({ getRuntime: () => originalBinding.getRuntime(), getState: () => originalBinding.getState(),
  load: (...args) => originalBinding.load(...args), refresh: (...args) => originalBinding.refresh(...args),
  applyMutation: (...args) => originalBinding.applyMutation(...args), subscribe: listener => originalBinding.subscribe(listener), clear: () => originalBinding.clear(),
  getEffectiveAccess: () => ({ ...originalAccess, accountId: "principal_B", membershipId: "membership_B", memberId: "member_B" }) });
await render();
assert.equal(dialogs?.showTagsModal, false);
const principalProjection = projections;
await act(async () => release?.(receipt(["Keep"], routeId)));
assert.equal(projections, principalProjection); assert.equal(toasts.length, oldToasts);
configureAccessGovernanceRuntime(originalBinding);
await render(); await act(async () => dialogs?.setShowTagsModal(true));
// Workspace change: original dispatched command may commit remotely, but its
// response must not project into another workspace or complete its UI.
await clickRemove();
const { listWorkspaceMemberships, switchWorkspaceContext } = await import("@/platform/workspace-context");
const originalWorkspace = getWorkspaceContextSnapshot();
const otherWorkspace = listWorkspaceMemberships().find(item => item.status === "active" && item.workspaceId !== originalWorkspace.workspaceId); assert.ok(otherWorkspace);
await act(async () => { await switchWorkspaceContext(otherWorkspace.workspaceKey); });
await render();
assert.equal(dialogs?.showTagsModal, false);
const workspaceProjection = projections;
await act(async () => release?.(receipt(["Keep"], routeId)));
assert.equal(projections, workspaceProjection); assert.equal(toasts.length, oldToasts);
await act(async () => { await switchWorkspaceContext(originalWorkspace.workspaceKey); await loadAccessGovernance(originalWorkspace.workspaceId); });
await render(); await act(async () => dialogs?.setShowTagsModal(true));
const retiredButton = window.document.querySelector<HTMLButtonElement>('button[aria-label="Remove tag VIP"]'); assert.ok(retiredButton);
const beforeRetired = calls;
const liveState = getAccessGovernanceRuntimeBinding().getState();
liveState.authorityRevision = (liveState.authorityRevision ?? 0) + 1;
// Change trusted authority without rendering first: admission checks live APIs.
await act(async () => retiredButton.click());
assert.equal(calls, beforeRetired, "Old event closure cannot dispatch as a new authority");
await render();
assert.equal(dialogs?.showTagsModal, false);
// FLS write denial blocks the actual controls before transport.
const authorization = liveState.snapshot?.authorization; assert.ok(authorization);
const previousSecurity = authorization.fieldSecurity;
authorization.fieldSecurity = { ...previousSecurity, leads: { ...previousSecurity.leads, tags: "READ_ONLY" } };
liveState.authorityRevision = (liveState.authorityRevision ?? 0) + 1;
await render(); await act(async () => dialogs?.setShowTagsModal(true));
assert.equal(window.document.querySelector('button[aria-label="Remove tag VIP"]'), null);
const flsCalls = calls;
await act(async () => { void dialogs?.saveActiveForm(); });
assert.equal(calls, flsCalls);
await act(async () => dialogs?.setShowTagsModal(false));
authorization.fieldSecurity = previousSecurity;
liveState.authorityRevision = (liveState.authorityRevision ?? 0) + 1;
await render(); await act(async () => dialogs?.setShowTagsModal(true));
const availability = await import("@/shared/application");
const originalUnavailable = availability.getUnavailableBusinessOperations();
availability.declareUnavailableBusinessOperation("replaceLeadProfile");
const unavailableButton = window.document.querySelector<HTMLButtonElement>('button[aria-label="Remove tag VIP"]'); assert.ok(unavailableButton);
await act(async () => unavailableButton.click());
assert.equal(calls, flsCalls, "Live operation availability blocks an old rendered button");
await render();
assert.ok(window.document.querySelector('[aria-label="Manage Lead Tags"]'), "Unavailable Tags must retain an accessible recovery surface while owning interaction");
await act(async () => window.document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
assert.equal(dialogs?.activeForm, null, "Unavailable nonpending interaction can close");
availability.resetBusinessOperationAvailability();
originalUnavailable.forEach(operation => availability.declareUnavailableBusinessOperation(operation));
await render();
// Missing/withheld opening tags are not an authoritative empty collection.
const knownTagsLead = lead;
lead = { ...lead, tags: undefined };
const { replaceLeadTagsViaApi } = await import("@/modules/leads/application/commands/leadTagCommands");
await assert.rejects(replaceLeadTagsViaApi(lead, ["New"], { idempotencyKey: "unknown-tags", isCurrent: () => true }),
  (error: unknown) => error instanceof ApplicationError && error.code === "LEAD_TAGS_OPENING_REQUIRED");
await render(); await act(async () => dialogs?.setShowTagsModal(true));
await setDraft("New");
await act(async () => { void dialogs?.saveActiveForm(); });
assert.equal(calls, flsCalls, "Unknown opening tags cannot dispatch a full replacement");
assert.equal(dialogs?.interactionPending, false);
assert.ok(window.document.querySelector('[role="alert"]'));
await act(async () => dialogs?.setShowTagsModal(false)); lead = knownTagsLead;
await render();
// Missing opening version cannot use the repository's current version implicitly.
await act(async () => dialogs?.setShowTagsModal(false));
const validLead = lead;
lead = { ...lead, resourceVersion: undefined };
await render(); await act(async () => dialogs?.setShowTagsModal(true)); await clickRemove();
assert.equal(calls, flsCalls); assert.equal(dialogs?.interactionPending, false);
assert.ok(window.document.querySelector('[role="alert"]'));
await act(async () => dialogs?.setShowTagsModal(false)); lead = validLead;
await render(); await act(async () => dialogs?.setShowTagsModal(true)); await clickRemove();
await act(async () => { assert.equal(signIn({ email: "sales.rep@unicorecrm.local", password: "welcome123" }).ok, true); });
await render();
assert.equal(dialogs?.showTagsModal, false, "Auth principal change retires Tags even before governance refresh");
const authProjection = projections;
await act(async () => release?.(receipt(["Keep"], routeId)));
assert.equal(projections, authProjection);
await act(async () => { assert.equal(signIn({ email: "admin@unicorecrm.local", password: "admin123" }).ok, true); });
// A known empty authoritative array remains writable; omission does not.
await act(async () => dialogs?.setShowTagsModal(false));
lead = { ...lead, tags: [] };
await render(); await act(async () => dialogs?.setShowTagsModal(true)); await setDraft("First");
const knownEmptyCalls = calls;
await act(async () => { void dialogs?.saveActiveForm(); });
assert.equal(calls, knownEmptyCalls + 1); assert.deepEqual(submittedTags, ["First"]);
await act(async () => release?.(receipt(["First"], routeId)));
assert.equal(dialogs?.showTagsModal, false);
lead = { ...lead, tags: ["VIP", "Keep"] };
await render(); await act(async () => dialogs?.setShowTagsModal(true)); await clickRemove();
const unmountProjection = projections;
const unmountToast = toasts.length;
assert.equal(new Set(attemptKeys).size, attemptKeys.length, "Every admitted new intent gets a unique key; blocked intents dispatch none");
await act(async () => root.unmount());
const { signOut } = await import("@/platform/identity-auth");
signOut();
await act(async () => release?.(receipt(["Keep"], routeId)));
assert.equal(projections, unmountProjection); assert.equal(toasts.length, unmountToast);
configureLeadApplication(services);
window.close();
console.log("Lead tag Promise runtime: PASS (deferred/denied/conflict/network, duplicate, receipt/target, opening version, Add/Remove and Save/Escape, route/authority retirement)");
