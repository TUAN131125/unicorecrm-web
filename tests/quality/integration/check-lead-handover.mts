import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import type { HttpClient, HttpRequest } from "@/platform/api/client/HttpClient";
import type { LeadDocument, LeadHandoverResult } from "@/platform/api/generated/commercialApi";

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: "http://localhost", pretendToBeVisual: true });
const { window } = dom;
for (const key of ["window", "document", "navigator", "localStorage", "HTMLElement", "SVGElement", "Element", "Node", "Event", "CustomEvent", "EventTarget", "MutationObserver"] as const) {
  Object.defineProperty(globalThis, key, { value: key === "window" ? window : window[key], configurable: true });
}
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true, configurable: true });
const { signIn } = await import("@/platform/identity-auth");
assert.equal(signIn({ email: "admin@unicorecrm.local", password: "admin123" }).ok, true);
const { initializeApplicationComposition } = await import("@/app/composition");
await initializeApplicationComposition({ mode: "demo" });
const React = await import("react");
const { act } = React;
const { createRoot } = await import("react-dom/client");
const { ApplicationError } = await import("@/shared/domain");
const { createLeadConnectedApiRuntime } = await import("@/modules/leads/infrastructure/http/createLeadConnectedApiRuntime");
const { configureLeadApplication, getLeadApplicationServices } = await import("@/modules/leads/application/composition/leadApplicationServices");
const { mapLeadDocumentToApplication } = await import("@/modules/leads/infrastructure/http/LeadApiMapper");
const { useLeadHandover } = await import("@/modules/leads/presentation/hooks/useLeadHandover");
const { LEAD_OPERATION, isLeadOperationAvailable } = await import("@/modules/leads/application/leadOperationAvailability");
const shared = await import("@/shared/application");
const source = (path: string) => readFileSync(path, "utf8");
const document: LeadDocument = { id: "lead_handover", displayName: "Handover Lead", ownerId: "member_old", version: 5, createdAt: "2026-09-30T00:00:00Z", updatedAt: "2026-09-30T00:00:00Z", leadWorkState: "NEW", score: 0, interestedProducts: [], activityProjection: "NOT_INCLUDED" };
const requests: HttpRequest[] = [];
let mode: "SUCCESS" | "NETWORK" | "VERSION" | "DENIED" | "PENDING" = "SUCCESS";
let release: (() => void) | undefined;
let version = 5;
let resultOverride: Partial<LeadHandoverResult> = {};
const serverDueAt = "2026-10-04T12:00:00+00:00";
const client: HttpClient = { async request<TResponse, TBody = unknown>(input: HttpRequest<TBody>): Promise<TResponse> {
  requests.push(input);
  if (input.operationId === "getLead") return { ...document, version } as TResponse;
  if (input.operationId === "listLeads") return { items: [], pageInfo: { hasNextPage: false, totalCount: 0 } } as TResponse;
  if (mode === "PENDING") await new Promise<void>(resolve => { release = resolve; });
  if (mode === "NETWORK") throw new ApplicationError({ code: "NETWORK_ERROR", category: "NETWORK", message: "ambiguous", retryable: true });
  if (mode === "VERSION") throw new ApplicationError({ code: "VERSION_CONFLICT", category: "CONFLICT", message: "stale", status: 412 });
  if (mode === "DENIED") throw new ApplicationError({ code: "ACCESS_DENIED", category: "AUTHORIZATION", message: "denied", status: 403 });
  const body = input.body as { newOwnerId: string; openTaskPolicy: "KEEP_CURRENT_ASSIGNEES" | "MOVE_LEAD_OPEN_TASKS_TO_NEW_OWNER" };
  return { commandId: "ho_cmd", correlationId: "ho_corr", aggregateId: document.id, aggregateType: "LEAD", version: version + 1, occurredAt: document.updatedAt, outcome: "COMMITTED", result: { lead: { ...document, ownerId: body.newOwnerId, version: version + 1 }, openTaskPolicy: body.openTaskPolicy, reassignedTaskIds: body.openTaskPolicy === "KEEP_CURRENT_ASSIGNEES" ? [] : ["server-discovered-hidden-task"], handoverTaskId: "takeover", handoverTaskVersion: 0, handoverTaskDueAt: serverDueAt, resolvedHandoverAcceptanceSlaHours: 72, ...resultOverride } } as TResponse;
}};
const base = getLeadApplicationServices();
let records = [mapLeadDocumentToApplication(document)];
const repository = { list: () => [...records], getById: (id: string) => records.find(record => record.id === id), replace: (next: typeof records) => { records = next; }, subscribe: () => () => {} };

const api = createLeadConnectedApiRuntime(client);
configureLeadApplication({ ...base, repository, api });
assert.equal(isLeadOperationAvailable(LEAD_OPERATION.CLAIM), true);
assert.equal(isLeadOperationAvailable(LEAD_OPERATION.ASSIGN_OWNER), true);
assert.equal(isLeadOperationAvailable(LEAD_OPERATION.ASSIGN_OWNER_BATCH), false);
const input = { newOwnerId: "member_target", reason: "Coverage", openTaskPolicy: "KEEP_CURRENT_ASSIGNEES" as const };
const options = { idempotencyKey: "contract", expectedVersion: 5 };
const result = await api.commands.handoverLeadWithTasks(document.id, input, options);
assert.equal(result.handoverTaskDueAt, serverDueAt);
assert.equal(result.handoverTaskVersion, 0);
assert.equal(result.resolvedHandoverAcceptanceSlaHours, 72);
assert.deepEqual(requests.filter(request => request.operationId === "handoverLeadWithTasks").at(-1)?.body, input);
assert.equal(requests.filter(request => request.operationId === "handoverLeadWithTasks").at(-1)?.path, `/leads/${document.id}/handover`);
assert.equal(requests.filter(request => request.operationId === "handoverLeadWithTasks").at(-1)?.method, "POST");
assert.equal(requests.filter(request => request.operationId === "handoverLeadWithTasks").at(-1)?.idempotencyKey, options.idempotencyKey);
assert.equal(requests.filter(request => request.operationId === "handoverLeadWithTasks").at(-1)?.expectedVersion, 5);
const move = { ...input, openTaskPolicy: "MOVE_LEAD_OPEN_TASKS_TO_NEW_OWNER" as const };
assert.deepEqual((await api.commands.handoverLeadWithTasks(document.id, move, options)).reassignedTaskIds, ["server-discovered-hidden-task"]);
for (const override of [{ handoverTaskVersion: -1 }, { handoverTaskVersion: "0" }, { handoverTaskDueAt: "invalid" }, { resolvedHandoverAcceptanceSlaHours: 0 }, { openTaskPolicy: "MOVE_LEAD_OPEN_TASKS_TO_NEW_OWNER" }, { reassignedTaskIds: ["unexpected"] }]) {
  resultOverride = override as Partial<LeadHandoverResult>;
  await assert.rejects(() => api.commands.handoverLeadWithTasks(document.id, input, options), { code: "CONNECTED_CONTRACT_VIOLATION" });
}
resultOverride = {};
let count = requests.length;
await assert.rejects(() => api.commands.handoverLeadWithTasks(document.id, { ...input, reason: "x".repeat(1001) }, options));
assert.equal(requests.length, count);
let current!: ReturnType<typeof useLeadHandover>;
const rootElement = window.document.getElementById("root");
assert.ok(rootElement);
const root = createRoot(rootElement);
let observed = mapLeadDocumentToApplication(document);
function Fixture() { current = useLeadHandover(observed); return null; }
let fixtureKey = crypto.randomUUID();
async function rerender() { await act(async () => root.render(React.createElement(Fixture, { key: fixtureKey }))); }
async function mount() { fixtureKey = crypto.randomUUID(); await rerender(); }
await mount(); mode = "NETWORK";
await act(async () => { await assert.rejects(() => current.submit(input)); });
const ambiguous = requests.filter(request => request.operationId === "handoverLeadWithTasks").at(-1);
assert.equal(current.ambiguous, true);
observed = mapLeadDocumentToApplication(document); await mount();
await act(async () => { await assert.rejects(() => current.submit(input)); });
const stable = requests.filter(request => request.operationId === "handoverLeadWithTasks").at(-1);
await act(async () => { await assert.rejects(() => current.submit(input)); });
assert.equal(requests.filter(request => request.operationId === "handoverLeadWithTasks").at(-1)?.idempotencyKey, stable?.idempotencyKey);
assert.equal(requests.filter(request => request.operationId === "handoverLeadWithTasks").at(-1)?.expectedVersion, stable?.expectedVersion);
assert.deepEqual(requests.filter(request => request.operationId === "handoverLeadWithTasks").at(-1)?.body, stable?.body);
observed = { ...observed, ownerId: input.newOwnerId, resourceVersion: 99 };
await rerender();
assert.equal(current.isAmbiguousRetry(input), true);
await act(async () => { await assert.rejects(() => current.submit(input)); });
assert.equal(requests.filter(request => request.operationId === "handoverLeadWithTasks").at(-1)?.expectedVersion, stable?.expectedVersion);
count = requests.length;
await act(async () => { await assert.rejects(() => current.submit(move), { code: "IDEMPOTENCY_KEY_REUSED" }); await current.recover(); });
assert.equal(requests.length, count, "Ambiguous intent cannot refresh into a fresh command");
mode = "SUCCESS";
await act(async () => { assert.equal((await current.submit(input))?.handoverTaskDueAt, serverDueAt); });
assert.equal(requests.filter(request => request.operationId === "handoverLeadWithTasks").at(-1)?.idempotencyKey, stable?.idempotencyKey);
// A newer authoritative prop must win over the previous successful result for a new intent.
observed = { ...mapLeadDocumentToApplication(document), resourceVersion: 112 };
await rerender();
await act(async () => { await current.submit(move); });
assert.equal(requests.filter(request => request.operationId === "handoverLeadWithTasks").at(-1)?.expectedVersion, 112);
observed = mapLeadDocumentToApplication(document);
await mount(); mode = "VERSION";
await act(async () => { await assert.rejects(() => current.submit(move)); });
assert.equal(current.blocked, true);
const conflicted = requests.filter(request => request.operationId === "handoverLeadWithTasks").at(-1);
count = requests.length;
await act(async () => { await current.submit(move); });
assert.equal(requests.length, count, "412 requires explicit refresh");
assert.deepEqual(conflicted?.body, move);
version = 8;
await act(async () => { await current.recover(); });
assert.equal(current.blocked, false);
mode = "SUCCESS";
await act(async () => { await current.submit(move); });
assert.equal(requests.filter(request => request.operationId === "handoverLeadWithTasks").at(-1)?.expectedVersion, 8);
assert.notEqual(requests.filter(request => request.operationId === "handoverLeadWithTasks").at(-1)?.idempotencyKey, conflicted?.idempotencyKey);
// Recovery at v8 cannot downgrade a later prop v15; blocked state clears only for a new record.
observed = { ...mapLeadDocumentToApplication(document), resourceVersion: 15 };
await rerender();
observed = { ...observed, resourceVersion: 12 };
await rerender();
await act(async () => { await current.submit(input); });
assert.equal(requests.filter(request => request.operationId === "handoverLeadWithTasks").at(-1)?.expectedVersion, 15);
observed = mapLeadDocumentToApplication(document); await mount(); mode = "NETWORK";
await act(async () => { await assert.rejects(() => current.submit(input)); });
const leadAAttempt = requests.filter(request => request.operationId === "handoverLeadWithTasks").at(-1);
observed = { ...observed, id: "lead_b", resourceVersion: 21 }; await rerender();
assert.equal(current.ambiguous, false); assert.equal(current.blocked, false); assert.equal(current.pending, false);
mode = "NETWORK";
await act(async () => { await assert.rejects(() => current.submit(input)); });
const leadBAttempt = requests.filter(request => request.operationId === "handoverLeadWithTasks").at(-1);
assert.equal(leadBAttempt?.path, "/leads/lead_b/handover");
assert.equal(leadBAttempt?.expectedVersion, 21);
assert.notEqual(leadBAttempt?.idempotencyKey, leadAAttempt?.idempotencyKey);
mode = "VERSION";
await act(async () => { await assert.rejects(() => current.submit(input)); });
assert.equal(current.blocked, true);
observed = mapLeadDocumentToApplication(document); await rerender();
assert.equal(current.blocked, false);
await mount(); mode = "PENDING";
let submission: Promise<unknown>;
await act(async () => { submission = current.submit(input); await Promise.resolve(); });
count = requests.length;
await act(async () => { await current.submit(input); });
assert.equal(requests.length, count, "Double submit cannot create another command");
await act(async () => { release?.(); await submission; });
observed = { ...observed, ownerId: undefined }; await mount(); count = requests.length;
await act(async () => { await current.submit(input); });
assert.equal(requests.length, count, "Unassigned Lead uses Assign or Claim");
// Exercise the existing Handover dialog, including KEEP with no Task Assign grant.
const { useLeadDetailDialogs } = await import("@/modules/leads/presentation/hooks/useLeadDetailDialogs");
const { LeadDetailModals } = await import("@/modules/leads/presentation/components/LeadDetailModals");
const { useLeadActions } = await import("@/modules/leads/presentation/hooks/useLeadActions");
const { I18nProvider, useI18n } = await import("@/i18n");
let dialogs!: ReturnType<typeof useLeadDetailDialogs>;
let canMove = false;
let canAdmit = true;
observed = mapLeadDocumentToApplication(document);
function DialogFixture() {
  dialogs = useLeadDetailDialogs(observed);
  current = useLeadHandover(observed);
  const { t } = useI18n();
  const actions = useLeadActions();
  return React.createElement(LeadDetailModals, { screen: {
    dialogs, lead: observed, locale: "en", t, sources: [], campaigns: [], products: [], members: [],
    showToast() {}, navigate() {}, leadActions: actions, archiveListPath: "/leads",
    handleConfirmDisqualify() {}, handleSaveEditFromForm() {}, handleSavePhoneCall() {}, handleSaveMeeting() {}, handleLogExternalEmail() {}, handleLogExternalSms() {},
    handover: current, canHandover: canAdmit, canMoveHandoverTasks: canMove, handoverMembers: [{ memberId: input.newOwnerId, displayName: "Target" }], handoverTaskPreview: 0,
    async handleConfirmHandover(newOwnerId, reason, openTaskPolicy) { if (await current.submit({ newOwnerId, reason, openTaskPolicy })) dialogs.setShowHandoverModal(false); },
  } });
}
await act(async () => root.render(React.createElement(I18nProvider, null, React.createElement(DialogFixture))));
await act(async () => {
  dialogs.setShowHandoverModal(true); dialogs.setHandoverOwnerId(input.newOwnerId);
  dialogs.setHandoverReason(input.reason); dialogs.setHandoverOpenTaskPolicy(input.openTaskPolicy);
});
assert.equal(window.document.querySelector<HTMLTextAreaElement>("textarea")?.maxLength, 1000);
assert.match(window.document.body.textContent ?? "", /Keep current assignees/);
assert.match(window.document.body.textContent ?? "", /preview only/);
canAdmit = false;
await act(async () => root.render(React.createElement(I18nProvider, null, React.createElement(DialogFixture))));
assert.equal(window.document.querySelector<HTMLButtonElement>('button[form="lead-handover-form"]')?.disabled, true, "Revoked Handover admission disables an open draft");
canAdmit = true;
await act(async () => root.render(React.createElement(I18nProvider, null, React.createElement(DialogFixture))));
const formElement = window.document.getElementById("lead-handover-form");
assert.ok(formElement);
const submitButton = window.document.querySelector<HTMLButtonElement>('button[form="lead-handover-form"]');
assert.equal(submitButton?.disabled, false, "KEEP remains available without tasks.assign");
await act(async () => dialogs.setHandoverOpenTaskPolicy("MOVE_LEAD_OPEN_TASKS_TO_NEW_OWNER"));
assert.equal(submitButton?.disabled, true, "MOVE requires tasks.assign even with zero loaded open Tasks");
await act(async () => dialogs.setHandoverOpenTaskPolicy("KEEP_CURRENT_ASSIGNEES"));
mode = "VERSION";
await act(async () => { formElement.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
assert.equal(dialogs.showHandoverModal, true);
assert.equal(dialogs.handoverOwnerId, input.newOwnerId);
assert.equal(dialogs.handoverReason, input.reason);
assert.equal(dialogs.handoverOpenTaskPolicy, input.openTaskPolicy);
assert.ok(window.document.querySelector('[role="alert"]'), "412 stays in the dialog error surface");
assert.match(window.document.body.textContent ?? "", /Refresh Lead to reconcile/);
assert.equal(submitButton?.disabled, true);
await act(async () => { await current.recover(); });
mode = "NETWORK";
await act(async () => { formElement.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
const dialogAttempt = requests.filter(request => request.operationId === "handoverLeadWithTasks").at(-1);
assert.equal(current.ambiguous, true);
await act(async () => dialogs.setShowHandoverModal(false));
await act(async () => dialogs.setShowHandoverModal(true));
assert.equal(current.ambiguous, true, "Closing/reopening the same Lead retains intent");
observed = { ...observed, ownerId: input.newOwnerId, resourceVersion: 99 };
await act(async () => root.render(React.createElement(I18nProvider, null, React.createElement(DialogFixture))));
assert.equal(window.document.querySelector<HTMLButtonElement>('button[form="lead-handover-form"]')?.disabled, false, "Retained ambiguous intent can replay after target ownership is observed");
await act(async () => { window.document.getElementById("lead-handover-form")?.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
assert.equal(requests.filter(request => request.operationId === "handoverLeadWithTasks").at(-1)?.idempotencyKey, dialogAttempt?.idempotencyKey);
assert.deepEqual(requests.filter(request => request.operationId === "handoverLeadWithTasks").at(-1)?.body, dialogAttempt?.body);
assert.equal(requests.filter(request => request.operationId === "handoverLeadWithTasks").at(-1)?.expectedVersion, dialogAttempt?.expectedVersion);
// The presentation draft must follow actual Lead identity, without remounting the dialog fixture.
const dialogCount = requests.length;
observed = { ...mapLeadDocumentToApplication(document), id: "lead_b", resourceVersion: 21 };
await act(async () => root.render(React.createElement(I18nProvider, null, React.createElement(DialogFixture))));
assert.equal(dialogs.showHandoverModal, false);
assert.equal(dialogs.handoverOwnerId, "");
assert.equal(dialogs.handoverReason, "");
assert.equal(dialogs.handoverOpenTaskPolicy, "");
assert.equal(current.ambiguous, false);
assert.equal(requests.length, dialogCount);
await act(async () => {
  dialogs.setShowHandoverModal(true); dialogs.setHandoverOwnerId(input.newOwnerId);
  dialogs.setHandoverReason(input.reason); dialogs.setHandoverOpenTaskPolicy(input.openTaskPolicy);
});
await act(async () => { window.document.getElementById("lead-handover-form")?.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
const nextDialogAttempt = requests.filter(request => request.operationId === "handoverLeadWithTasks").at(-1);
assert.equal(nextDialogAttempt?.path, "/leads/lead_b/handover");
assert.equal(nextDialogAttempt?.expectedVersion, 21);
assert.notEqual(nextDialogAttempt?.idempotencyKey, dialogAttempt?.idempotencyKey);
await act(async () => root.unmount());

const controller = source("src/modules/leads/presentation/hooks/useLeadDetailController.tsx");
assert.match(controller, /Boolean\(lead\?\.ownerId\).*access.can\(CAPABILITIES.LEADS_HANDOVER\)/);
assert.match(controller, /access.can\(CAPABILITIES.TASKS_CREATE\)/);
assert.ok(controller.includes('handover.ambiguous || handoverAccess.data?.fieldAccess.ownerId === "READ_WRITE"'));
assert.ok(controller.includes('requestedCommands: ["lead.handover"]'));
assert.match(controller, /MOVE_LEAD_OPEN_TASKS_TO_NEW_OWNER.*!canMoveHandoverTasks/);
assert.ok(!controller.includes("openLeadTasks.length > 0 && !access.can(CAPABILITIES.TASKS_ASSIGN)"));
const modal = source("src/modules/leads/presentation/components/LeadDetailModals.tsx");
for (const token of ["KEEP_CURRENT_ASSIGNEES", "MOVE_LEAD_OPEN_TASKS_TO_NEW_OWNER", "maxLength={1000}", "handover.blocked", "handover.recover", "handover.ambiguous"]) assert.ok(modal.includes(token), token);
const commands = source("src/modules/leads/application/commands/leadApiCommands.ts");
for (const stale of ["taskTargets", "nextOwnerId", 'priority: "HIGH"', "24 * 60 * 60"]) assert.ok(!commands.includes(stale), stale);
const spec = JSON.parse(source("docs/api/openapi.json"));
assert.equal(spec.paths["/workflows/lead-handover/{leadId}"], undefined);
const operation = spec.paths["/leads/{leadId}/handover"].post;
assert.equal(operation["x-required-capability"], "leads.handover");
assert.deepEqual(operation["x-additional-required-capabilities"], ["tasks.create"]);
for (const header of ["IfMatchHeader", "IdempotencyKeyHeader", "RequestIdHeader", "CorrelationIdHeader"]) assert.ok(operation.parameters.some((parameter: { $ref?: string }) => parameter.$ref?.endsWith(header)));
assert.deepEqual(spec.components.schemas.HandoverLeadWithTasksRequest.required, ["newOwnerId", "reason", "openTaskPolicy"]);
assert.equal(spec.components.schemas.HandoverLeadWithTasksRequest.properties.reason.maxLength, 1000);

// Demo discovers retained Tasks, preserves excluded records, and replays frozen SLA.
configureLeadApplication(base);
const { createLeadDemoApiRuntime } = await import("@/modules/leads/runtime/createLeadDemoApiRuntime");
const { getRecordOwnershipContext } = await import("@/platform/record-ownership");
const { CAPABILITIES, loadAccessGovernance } = await import("@/platform/access-control");
const { getWorkspaceContextSnapshot } = await import("@/platform/workspace-context");
const config = await import("@/platform/workspace-config");
const tasks = await import("@/modules/tasks");
await loadAccessGovernance(getWorkspaceContextSnapshot().workspaceId);
const ownerContext = getRecordOwnershipContext("leads", CAPABILITIES.LEADS_HANDOVER);
assert.ok(ownerContext);
const target = ownerContext.assignableOwners.find(member => member.memberId !== ownerContext.memberId);
assert.ok(target);
const workspaceId = getWorkspaceContextSnapshot().workspaceId;
records = [{ ...mapLeadDocumentToApplication(document), ownerId: ownerContext.memberId }];
const taskBase = { workspaceId, title: "Existing", assigneeId: ownerContext.memberId, dueAt: document.updatedAt, priority: "NORMAL" as const, createdAt: document.createdAt, updatedAt: document.updatedAt, recordRef: { moduleKey: "leads", recordId: document.id } };
tasks.replaceTaskActivitySnapshot({ tasks: [
  { ...taskBase, id: "eligible", status: "OPEN" },
  { ...taskBase, id: "completed", status: "COMPLETED" },
  { ...taskBase, id: "cancelled", status: "CANCELLED" },
  { ...taskBase, id: "archived", status: "OPEN", archivedAt: document.updatedAt },
  { ...taskBase, id: "other", status: "OPEN", recordRef: { moduleKey: "leads", recordId: "other" } },
], activities: [] });
config.updateWorkspaceConfig(value => ({ ...value, workflow: { ...value.workflow, handoverAcceptanceSlaHours: 48 } }));
const demo = createLeadDemoApiRuntime(repository);
const demoInput = { ...move, newOwnerId: target.memberId };
const moved = await demo.commands.handoverLeadWithTasks(document.id, demoInput, options);
assert.deepEqual(moved.reassignedTaskIds, ["eligible"]);
assert.equal(tasks.getTaskSnapshot("eligible")?.assigneeId, target.memberId);
for (const id of ["completed", "cancelled", "archived", "other"]) assert.equal(tasks.getTaskSnapshot(id)?.assigneeId, ownerContext.memberId);
const takeover = tasks.getTaskSnapshot(moved.handoverTaskId);
assert.equal(takeover?.priority, "NORMAL");
assert.equal(takeover?.sourceRef?.evidence, demoInput.reason);
assert.equal(Date.parse(moved.handoverTaskDueAt) - Date.parse(moved.evidence.occurredAt), 48 * 60 * 60 * 1000);
config.updateWorkspaceConfig(value => ({ ...value, workflow: { ...value.workflow, handoverAcceptanceSlaHours: 12 } }));
assert.deepEqual(await demo.commands.handoverLeadWithTasks(document.id, demoInput, options), moved);
assert.equal(tasks.getRetainedTaskActivitySnapshot().tasks.filter(task => task.sourceRef?.type === "LEAD_HANDOVER").length, 1);
await assert.rejects(() => demo.commands.handoverLeadWithTasks(document.id, { ...demoInput, reason: "Changed" }, options), { code: "IDEMPOTENCY_KEY_REUSED" });
const kept = await demo.commands.handoverLeadWithTasks(document.id, { ...input, newOwnerId: ownerContext.memberId }, { expectedVersion: 6, idempotencyKey: "keep-next" });
assert.deepEqual(kept.reassignedTaskIds, []);
assert.equal(tasks.getTaskSnapshot("eligible")?.assigneeId, target.memberId);
assert.equal(kept.resolvedHandoverAcceptanceSlaHours, 12);
for (const invalid of [0, 169]) {
  config.updateWorkspaceConfig(value => ({ ...value, workflow: { ...value.workflow, handoverAcceptanceSlaHours: invalid } }));
  await assert.rejects(() => demo.commands.handoverLeadWithTasks(document.id, demoInput, { expectedVersion: 7, idempotencyKey: `invalid-${invalid}` }));
}
// Completed replay checks current authority over stored Task proof, without new discovery/admission.
const { configureAccessGovernanceRuntime, getAccessGovernanceRuntimeBinding } = await import("@/platform/access-control/application/accessGovernanceBinding");
const { getRoleTemplate } = await import("@/platform/access-control");
assert.ok(getRoleTemplate("sales-manager")?.capabilities.includes(CAPABILITIES.LEADS_HANDOVER));
assert.ok(getRoleTemplate("workspace-administrator")?.capabilities.includes(CAPABILITIES.LEADS_HANDOVER));
assert.equal(getRoleTemplate("sales-representative")?.capabilities.includes(CAPABILITIES.LEADS_HANDOVER), false);
const governance = getAccessGovernanceRuntimeBinding();
let deniedCapability = "";
let deniedLeadScope = false;
let deniedTaskId = "";
configureAccessGovernanceRuntime({ ...governance, getEffectiveAccess(workspaceId) {
  const access = governance.getEffectiveAccess(workspaceId);
  return access ? { ...access,
    can: capability => capability !== deniedCapability && access.can(capability),
    canAccessRecord: (resource, record) => !(deniedLeadScope && resource === "leads")
      && !(resource === "tasks" && deniedTaskId === (record as { id?: string }).id) && access.canAccessRecord(resource, record),
  } : undefined;
} });
config.updateWorkspaceConfig(value => ({ ...value, workflow: { ...value.workflow, handoverAcceptanceSlaHours: 12 } }));
deniedCapability = CAPABILITIES.TASKS_CREATE;
await assert.rejects(() => demo.commands.handoverLeadWithTasks(document.id, demoInput, options));
deniedCapability = CAPABILITIES.TASKS_ASSIGN;
await assert.rejects(() => demo.commands.handoverLeadWithTasks(document.id, demoInput, options));
deniedCapability = CAPABILITIES.LEADS_HANDOVER;
await assert.rejects(() => demo.commands.handoverLeadWithTasks(document.id, demoInput, options));
deniedCapability = ""; deniedLeadScope = true;
await assert.rejects(() => demo.commands.handoverLeadWithTasks(document.id, demoInput, options));
deniedLeadScope = false;
for (const id of [moved.handoverTaskId, ...moved.reassignedTaskIds]) {
  deniedTaskId = id;
  const before = structuredClone(tasks.getRetainedTaskActivitySnapshot());
  await assert.rejects(() => demo.commands.handoverLeadWithTasks(document.id, demoInput, options));
  assert.deepEqual(tasks.getRetainedTaskActivitySnapshot(), before);
}
deniedTaskId = "";
assert.deepEqual(await demo.commands.handoverLeadWithTasks(document.id, demoInput, options), moved);
for (const capability of [CAPABILITIES.TASKS_CREATE, CAPABILITIES.TASKS_ASSIGN]) {
  deniedCapability = capability;
  const before = structuredClone(tasks.getRetainedTaskActivitySnapshot());
  await assert.rejects(() => demo.commands.handoverLeadWithTasks(document.id, demoInput, { expectedVersion: 7, idempotencyKey: `denied-${capability}` }));
  assert.deepEqual(tasks.getRetainedTaskActivitySnapshot(), before);
}
deniedCapability = CAPABILITIES.TASKS_ASSIGN;
const keepWithoutAssign = await demo.commands.handoverLeadWithTasks(document.id, { ...demoInput, openTaskPolicy: "KEEP_CURRENT_ASSIGNEES" }, { expectedVersion: 7, idempotencyKey: "keep-without-assign" });
assert.deepEqual(keepWithoutAssign.reassignedTaskIds, []);
assert.deepEqual(await demo.commands.handoverLeadWithTasks(document.id, { ...demoInput, openTaskPolicy: "KEEP_CURRENT_ASSIGNEES" }, { expectedVersion: 7, idempotencyKey: "keep-without-assign" }), keepWithoutAssign);
deniedCapability = "";
configureAccessGovernanceRuntime(governance);
// Existing snapshot rollback restores Tasks and Lead after an injected Lead commit failure.
const beforeFailureTasks = structuredClone(tasks.getRetainedTaskActivitySnapshot());
const beforeFailureLeads = structuredClone(records);
let failCommit = true;
const failingRepository = { ...repository, replace(next: typeof records) {
  if (failCommit) { failCommit = false; throw new Error("Injected demo Lead commit failure"); }
  repository.replace(next);
} };
const failingDemo = createLeadDemoApiRuntime(failingRepository);
const backToOriginal = { ...move, newOwnerId: ownerContext.memberId };
const failureOptions = { expectedVersion: 8, idempotencyKey: "rollback-retry" };
await assert.rejects(() => failingDemo.commands.handoverLeadWithTasks(document.id, backToOriginal, failureOptions), /Injected demo Lead commit failure/);
assert.deepEqual(tasks.getRetainedTaskActivitySnapshot(), beforeFailureTasks);
assert.deepEqual(records, beforeFailureLeads);
const afterFailureRetry = await failingDemo.commands.handoverLeadWithTasks(document.id, backToOriginal, failureOptions);
assert.equal(afterFailureRetry.lead.ownerId, ownerContext.memberId);
assert.deepEqual(await failingDemo.commands.handoverLeadWithTasks(document.id, backToOriginal, failureOptions), afterFailureRetry);
assert.ok(ambiguous?.idempotencyKey);

window.close();
console.log("Lead handover: PASS (canonical contract, response validation, retry intent, explicit 412 refresh, policy UI/preflight, authoritative demo Task set, frozen SLA/replay)");
