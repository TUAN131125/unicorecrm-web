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
Object.defineProperties(globalThis, {
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
function completePendingResponse() { assert.ok(release); release(); }
let version = 5;
let responseVersion: number | undefined;
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
  const targetId = input.path?.split("/").at(-1) ?? document.id;
  const completedVersion = responseVersion ?? version + 1;
  return { commandId: "ho_cmd", correlationId: "ho_corr", aggregateId: targetId, aggregateType: "LEAD", version: completedVersion, occurredAt: document.updatedAt, outcome: "COMMITTED", result: { reassignedTaskIds: ["server-discovered-hidden-task"], handoverTaskId: "takeover", handoverTaskVersion: 0, handoverTaskDueAt: serverDueAt, resolvedHandoverAcceptanceSlaHours: 72, ...resultOverride } } as TResponse;
}};
const base = getLeadApplicationServices();
let records = [mapLeadDocumentToApplication(document)];
const repository = { list: () => [...records], getById: (id: string) => records.find(record => record.id === id), replace: (next: typeof records) => { records = next; }, subscribe: () => () => {} };

const api = createLeadConnectedApiRuntime(client);
configureLeadApplication({ ...base, repository, api });
assert.equal(isLeadOperationAvailable(LEAD_OPERATION.CLAIM), true);
assert.equal(isLeadOperationAvailable(LEAD_OPERATION.ASSIGN_OWNER), true);
assert.equal(isLeadOperationAvailable(LEAD_OPERATION.ASSIGN_OWNER_BATCH), false);
const input = { nextOwnerId: "member_target", reason: "Coverage" };
const options = { idempotencyKey: "contract", expectedVersion: 5 };
const result = await api.commands.handoverLeadWithTasks(document.id, input, options);
assert.equal(result.handoverTaskDueAt, serverDueAt);
assert.equal(result.handoverTaskVersion, 0);
assert.equal(result.resolvedHandoverAcceptanceSlaHours, 72);
assert.deepEqual(requests.filter(request => request.operationId === "handoverLeadWithTasks").at(-1)?.body, input);
assert.equal(requests.filter(request => request.operationId === "handoverLeadWithTasks").at(-1)?.path, `/workflows/lead-handover/${document.id}`);
assert.equal(requests.filter(request => request.operationId === "handoverLeadWithTasks").at(-1)?.method, "POST");
assert.equal(requests.filter(request => request.operationId === "handoverLeadWithTasks").at(-1)?.idempotencyKey, options.idempotencyKey);
assert.equal(requests.filter(request => request.operationId === "handoverLeadWithTasks").at(-1)?.expectedVersion, 5);
const move = { ...input, reason: "Move coverage" };
assert.deepEqual((await api.commands.handoverLeadWithTasks(document.id, move, options)).reassignedTaskIds, ["server-discovered-hidden-task"]);
for (const override of [{ handoverTaskVersion: -1 }, { handoverTaskVersion: "0" }, { handoverTaskDueAt: "invalid" }, { resolvedHandoverAcceptanceSlaHours: 0 }, { reassignedTaskIds: ["duplicate", "duplicate"] }]) {
  resultOverride = override as Partial<LeadHandoverResult>;
  await assert.rejects(() => api.commands.handoverLeadWithTasks(document.id, input, options), { code: "CONNECTED_CONTRACT_VIOLATION" });
}
resultOverride = {};
let count = requests.length;
await assert.rejects(() => api.commands.handoverLeadWithTasks(document.id, { ...input, reason: "x".repeat(1001) }, options));
assert.equal(requests.length, count);
// A command receipt never projects a Lead; normal query projections own the cache.
const { handoverLeadWithTasksViaApi } = await import("@/modules/leads/application/commands/leadApiCommands");
const { saveLead, updateLeadCollection } = await import("@/modules/leads/application/commands/leadRepositoryCommands");
const invalidations: string[] = [];
const stopLeadInvalidation = shared.subscribeModuleQueryInvalidation("leads", event => { invalidations.push(`leads:${event.commandType}`); });
const stopTaskInvalidation = shared.subscribeModuleQueryInvalidation("tasks", event => { invalidations.push(`tasks:${event.commandType}`); });
mode = "PENDING"; responseVersion = 8; release = undefined;
records = [{ ...mapLeadDocumentToApplication(document), resourceVersion: 7 }];
const delayed = handoverLeadWithTasksViaApi(document.id, input, { idempotencyKey: "delayed-result", expectedVersion: 7 });
for (let turn = 0; !release && turn < 20; turn++) await Promise.resolve();
assert.ok(release);
const newerProjection = { ...mapLeadDocumentToApplication(document), name: "Newer authoritative read", resourceVersion: 9 };
records = [newerProjection];
completePendingResponse();
const receipt = await delayed;
assert.equal(receipt.evidence.version, 8);
assert.equal("lead" in receipt, false, "Receipt contains no protected Lead read model");
assert.deepEqual(records, [newerProjection], "Receipt cannot modify the Lead cache");
assert.deepEqual(invalidations, ["leads:lead.handover", "tasks:lead.handover"]);
mode = "SUCCESS";
const incoming = { ...mapLeadDocumentToApplication(document), resourceVersion: 8 };
shared.runBackendProjection("leads", () => saveLead(repository, incoming));
assert.deepEqual(records, [newerProjection], "Shared projection cannot regress v9 to v8");
records = [{ ...incoming, resourceVersion: 7 }];
shared.runBackendProjection("leads", () => saveLead(repository, incoming));
assert.equal(records[0]?.resourceVersion, 8);
const rich = { ...incoming, name: "Richer equal-version read", notes: "Protected rich data" };
records = [rich];
shared.runBackendProjection("leads", () => saveLead(repository, incoming));
assert.deepEqual(records, [rich]);
shared.runBackendProjection("leads", () => updateLeadCollection(repository, [{ ...incoming, resourceVersion: 6 }]));
assert.deepEqual(records, [rich], "Collection projections use the same guard");
// READ disclosure is authoritative even when the business version is unchanged.
shared.runBackendProjection("leads", () => saveLead(repository, incoming, "AUTHORITATIVE_READ"));
assert.deepEqual(records, [incoming], "Equal-version read removes richer cached fields");
records = [newerProjection];
shared.runBackendProjection("leads", () => saveLead(repository, incoming, "AUTHORITATIVE_READ"));
assert.deepEqual(records, [newerProjection], "Older read cannot downgrade business version");
shared.runBackendProjection("leads", () => updateLeadCollection(repository, [{ ...newerProjection, email: "", phone: "" }], "AUTHORITATIVE_READ"));
assert.equal(records[0]?.email, "", "Collection read replaces equal-version disclosure");
const { InMemoryLeadRepository } = await import("@/modules/leads/infrastructure/InMemoryLeadRepository");
const { BrowserEventBus } = await import("@/platform/events");
const stored = new InMemoryLeadRepository([newerProjection], new BrowserEventBus());
shared.runBackendProjection("leads", () => saveLead(stored, incoming));
assert.equal(stored.getById(document.id)?.resourceVersion, 9, "Application boundary owns mutation freshness");
shared.runBackendProjection("leads", () => saveLead(stored, { ...incoming, resourceVersion: undefined }));
assert.equal(stored.getById(document.id)?.resourceVersion, 9);
// Read authorization may hide v9 from list()/getById(), but the storage
// callback still applies the single application policy to the raw projection.
const hiddenStored = new InMemoryLeadRepository([newerProjection], new BrowserEventBus());
const hiddenRepository = {
  list: () => [], getById: () => undefined,
  replace: (next: typeof records) => hiddenStored.replace(next),
  replaceProjection: (updater: (stored: typeof records) => typeof records) => hiddenStored.replaceProjection(updater),
  subscribe: () => () => {},
};
shared.runBackendProjection("leads", () => saveLead(hiddenRepository, incoming));
assert.equal(hiddenStored.getById(document.id)?.resourceVersion, 9, "Scoped read denial cannot bypass mutation freshness");
shared.runBackendProjection("leads", () => updateLeadCollection(hiddenRepository, [incoming], "AUTHORITATIVE_READ"));
assert.equal(hiddenStored.getById(document.id)?.resourceVersion, 9, "Scoped read denial cannot bypass read business freshness");
const otherHidden = { ...newerProjection, id: "unrelated-hidden-projection", resourceVersion: 12 };
hiddenStored.replace([newerProjection, otherHidden]);
const { evictLeadProjection } = await import("@/modules/leads/public/leads");
configureLeadApplication({ ...base, repository: hiddenRepository, api });
const transportBeforeEviction = requests.length;
evictLeadProjection(document.id);
assert.equal(hiddenStored.getById(document.id), undefined);
assert.deepEqual(hiddenStored.getById(otherHidden.id), otherHidden, "Eviction preserves unrelated hidden projections");
assert.equal(requests.length, transportBeforeEviction, "Projection eviction creates no business transport");
configureLeadApplication({ ...base, repository, api });
stored.replace([]);
assert.deepEqual(stored.list(), [], "Storage accepts explicit projection eviction");
shared.runBackendProjection("leads", () => updateLeadCollection(repository, []));
assert.deepEqual(records, [], "Scope eviction still removes records");
const { assignLeadOwnerBatchViaApi } = await import("@/modules/leads/application/commands/leadApiCommands");
const beforeUnavailable = requests.length;
await assert.rejects(() => assignLeadOwnerBatchViaApi([document.id], { ownerId: "member_target", reason: "Closed future operation" }), { code: "LEAD_CONNECTED_OPERATION_NOT_IMPLEMENTED" });
assert.equal(requests.length, beforeUnavailable, "Unavailable Bulk Assign cannot trigger a missing-target GET");
await handoverLeadWithTasksViaApi(document.id, input, { idempotencyKey: "receipt-only", expectedVersion: 7 });
assert.deepEqual(records, [], "Receipt does not reconstruct a missing Lead");
assert.equal(invalidations.length, 4);
stopLeadInvalidation(); stopTaskInvalidation();
responseVersion = undefined; records = [mapLeadDocumentToApplication(document)];
let current!: ReturnType<typeof useLeadHandover>;
const rootElement = window.document.getElementById("root");
assert.ok(rootElement);
const root = createRoot(rootElement);
let observed = mapLeadDocumentToApplication(document);
let hideObserved = false;
function Fixture() { current = useLeadHandover({ leadId: observed.id, observedLead: hideObserved ? undefined : observed }); return null; }
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
observed = { ...observed, ownerId: input.nextOwnerId, resourceVersion: 99 };
await rerender();
assert.equal(current.isAmbiguousRetry(input), true);
await act(async () => { await assert.rejects(() => current.submit(input)); });
assert.equal(requests.filter(request => request.operationId === "handoverLeadWithTasks").at(-1)?.expectedVersion, stable?.expectedVersion);
count = requests.length;
await act(async () => { await assert.rejects(() => current.submit(move), { code: "IDEMPOTENCY_KEY_REUSED" }); await current.recover(); });
assert.equal(requests.length, count, "Ambiguous intent cannot refresh into a fresh command");
hideObserved = true;
await rerender();
assert.equal(current.isAmbiguousRetry(input), true, "Route identity retains exact retry without a read model");
mode = "DENIED";
await act(async () => { await assert.rejects(() => current.submit(input), { status: 403 }); });
assert.equal(current.ambiguous, true);
assert.equal(current.resolutionAccessDenied, true);
assert.equal(current.blocked, false, "Disclosure denial is distinct from version reconciliation");
const deniedReplay = requests.filter(request => request.operationId === "handoverLeadWithTasks").at(-1);
assert.equal(deniedReplay?.idempotencyKey, stable?.idempotencyKey);
assert.equal(deniedReplay?.expectedVersion, stable?.expectedVersion);
assert.deepEqual(deniedReplay?.body, stable?.body);
mode = "SUCCESS";
await act(async () => { assert.equal((await current.submit(input))?.handoverTaskDueAt, serverDueAt); });
assert.equal(current.resolutionAccessDenied, false);
assert.equal(current.ambiguous, false);
assert.equal(requests.filter(request => request.operationId === "handoverLeadWithTasks").at(-1)?.idempotencyKey, stable?.idempotencyKey);
hideObserved = false;
// A newer authoritative prop must win over the previous successful result for a new intent.
observed = { ...mapLeadDocumentToApplication(document), resourceVersion: 112 };
await rerender();
await act(async () => { await current.submit(move); });
assert.equal(requests.filter(request => request.operationId === "handoverLeadWithTasks").at(-1)?.expectedVersion, 112);
observed = mapLeadDocumentToApplication(document);
await mount(); mode = "DENIED";
await act(async () => { await assert.rejects(() => current.submit(input), { status: 403 }); });
assert.equal(current.ambiguous, false, "Fresh unauthorized command is definitive");
assert.equal(current.resolutionAccessDenied, false);
const newDenied = requests.filter(request => request.operationId === "handoverLeadWithTasks").at(-1);
mode = "SUCCESS";
await act(async () => { await current.submit(input); });
assert.notEqual(requests.filter(request => request.operationId === "handoverLeadWithTasks").at(-1)?.idempotencyKey, newDenied?.idempotencyKey);
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
assert.equal(leadBAttempt?.path, "/workflows/lead-handover/lead_b");
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
// Exercise the existing canonical Handover dialog and its retained attempt.
const { useLeadDetailDialogs } = await import("@/modules/leads/presentation/hooks/useLeadDetailDialogs");
const { LeadDetailModals } = await import("@/modules/leads/presentation/components/LeadDetailModals");
const { useLeadActions } = await import("@/modules/leads/presentation/hooks/useLeadActions");
const { I18nProvider, useI18n } = await import("@/i18n");
let dialogs!: ReturnType<typeof useLeadDetailDialogs>;
let canAdmit = true;
observed = mapLeadDocumentToApplication(document);
function DialogFixture() {
  dialogs = useLeadDetailDialogs(hideObserved ? undefined : observed, observed.id);
  current = useLeadHandover({ leadId: observed.id, observedLead: hideObserved ? undefined : observed });
  const { t } = useI18n();
  const actions = useLeadActions();
  return React.createElement(LeadDetailModals, { screen: {
    dialogs, lead: observed, locale: "en", t, sources: [], campaigns: [], products: [], members: [],
    showToast() {}, navigate() {}, leadActions: actions, archiveListPath: "/leads",
    handleConfirmDisqualify() {}, handleSaveEditFromForm() {}, handleSavePhoneCall() {}, handleSaveMeeting() {}, handleLogExternalEmail() {}, handleLogExternalSms() {},
    handover: current, canHandover: canAdmit, handoverMembers: [{ memberId: input.nextOwnerId, displayName: "Target" }],
    async handleConfirmHandover(nextOwnerId, reason) { if (await current.submit({ nextOwnerId, reason })) { dialogs.setShowHandoverModal(false); dialogs.setHandoverOwnerId(""); dialogs.setHandoverReason(""); } },
  } });
}
await act(async () => root.render(React.createElement(I18nProvider, null, React.createElement(DialogFixture))));
await act(async () => {
  dialogs.setShowHandoverModal(true); dialogs.setHandoverOwnerId(input.nextOwnerId);
  dialogs.setHandoverReason(input.reason);
});
assert.equal(window.document.querySelector<HTMLTextAreaElement>("textarea")?.maxLength, 1000);
assert.equal(window.document.querySelectorAll("select").length, 1, "Only the next owner is selectable");
canAdmit = false;
await act(async () => root.render(React.createElement(I18nProvider, null, React.createElement(DialogFixture))));
assert.equal(window.document.querySelector<HTMLButtonElement>('button[form="lead-handover-form"]')?.disabled, true, "Revoked Handover admission disables an open draft");
canAdmit = true;
await act(async () => root.render(React.createElement(I18nProvider, null, React.createElement(DialogFixture))));
const formElement = window.document.getElementById("lead-handover-form");
assert.ok(formElement);
const submitButton = window.document.querySelector<HTMLButtonElement>('button[form="lead-handover-form"]');
assert.equal(submitButton?.disabled, false);
mode = "VERSION";
await act(async () => { formElement.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
assert.equal(dialogs.showHandoverModal, true);
assert.equal(dialogs.handoverOwnerId, input.nextOwnerId);
assert.equal(dialogs.handoverReason, input.reason);
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
hideObserved = true;
await act(async () => root.render(React.createElement(I18nProvider, null, React.createElement(DialogFixture))));
assert.equal(dialogs.handoverOwnerId, input.nextOwnerId, "Read eviction preserves owner draft");
assert.equal(dialogs.handoverReason, input.reason, "Read eviction preserves reason draft");
assert.equal(current.isAmbiguousRetry(input), true, "Read eviction preserves original intent");
hideObserved = false;
observed = { ...observed, ownerId: input.nextOwnerId, resourceVersion: 99 };
await act(async () => root.render(React.createElement(I18nProvider, null, React.createElement(DialogFixture))));
assert.equal(window.document.querySelector<HTMLButtonElement>('button[form="lead-handover-form"]')?.disabled, false, "Retained ambiguous intent can replay after target ownership is observed");
await act(async () => { window.document.getElementById("lead-handover-form")?.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
assert.equal(requests.filter(request => request.operationId === "handoverLeadWithTasks").at(-1)?.idempotencyKey, dialogAttempt?.idempotencyKey);
assert.deepEqual(requests.filter(request => request.operationId === "handoverLeadWithTasks").at(-1)?.body, dialogAttempt?.body);
assert.equal(requests.filter(request => request.operationId === "handoverLeadWithTasks").at(-1)?.expectedVersion, dialogAttempt?.expectedVersion);
mode = "DENIED";
await act(async () => { window.document.getElementById("lead-handover-form")?.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
assert.equal(current.resolutionAccessDenied, true);
assert.equal(current.ambiguous, true);
assert.match(window.document.body.textContent ?? "", /original request is retained/i);
assert.equal(window.document.querySelector<HTMLTextAreaElement>("textarea")?.disabled, true);
assert.equal((window.document.querySelector<HTMLButtonElement>('#lead-handover-form button[aria-haspopup="listbox"]') ?? window.document.querySelector<HTMLSelectElement>("#lead-handover-form select"))?.disabled, true);
assert.equal(window.document.querySelector<HTMLButtonElement>('button[form="lead-handover-form"]')?.disabled, false, "Manual exact receipt retry stays available");
// The presentation draft must follow actual Lead identity, without remounting the dialog fixture.
const dialogCount = requests.length;
observed = { ...mapLeadDocumentToApplication(document), id: "lead_b", resourceVersion: 21 };
await act(async () => root.render(React.createElement(I18nProvider, null, React.createElement(DialogFixture))));
assert.equal(dialogs.showHandoverModal, false);
assert.equal(dialogs.handoverOwnerId, "");
assert.equal(dialogs.handoverReason, "");
assert.equal(current.ambiguous, false);
assert.equal(requests.length, dialogCount);
await act(async () => {
  dialogs.setShowHandoverModal(true); dialogs.setHandoverOwnerId(input.nextOwnerId);
  dialogs.setHandoverReason(input.reason);
});
await act(async () => { window.document.getElementById("lead-handover-form")?.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
const nextDialogAttempt = requests.filter(request => request.operationId === "handoverLeadWithTasks").at(-1);
assert.equal(nextDialogAttempt?.path, "/workflows/lead-handover/lead_b");
assert.equal(nextDialogAttempt?.expectedVersion, 21);
assert.notEqual(nextDialogAttempt?.idempotencyKey, dialogAttempt?.idempotencyKey);
mode = "SUCCESS";
await act(async () => { window.document.getElementById("lead-handover-form")?.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
assert.equal(dialogs.showHandoverModal, false);
assert.equal(dialogs.handoverOwnerId, "");
assert.equal(dialogs.handoverReason, "");
await act(async () => root.unmount());

// Use the real composed controller and modal: OWN access disappears after A -> B.
{
  const { MemoryRouter, Routes, Route } = await import("react-router-dom");
  const { PlatformStateProvider } = await import("@/app/providers");
  const { useLeadDetailController } = await import("@/modules/leads/presentation/hooks/useLeadDetailController");
  const { CAPABILITIES, loadAccessGovernance } = await import("@/platform/access-control");
  const { getWorkspaceContextSnapshot } = await import("@/platform/workspace-context");
  const { getRecordOwnershipContext } = await import("@/platform/record-ownership");
  const { configureAccessGovernanceRuntime, getAccessGovernanceRuntimeBinding } = await import("@/platform/access-control/application/accessGovernanceBinding");
  await loadAccessGovernance(getWorkspaceContextSnapshot().workspaceId);
  const context = getRecordOwnershipContext("leads", CAPABILITIES.LEADS_ASSIGN);
  assert.ok(context);
  const recipient = context.assignableOwners.find(member => member.memberId !== context.memberId);
  assert.ok(recipient);
  const governance = getAccessGovernanceRuntimeBinding();
  configureAccessGovernanceRuntime({
    getRuntime: () => governance.getRuntime(), getState: () => governance.getState(),
    load: (...args) => governance.load(...args), refresh: (...args) => governance.refresh(...args),
    applyMutation: (...args) => governance.applyMutation(...args),
    subscribe: listener => governance.subscribe(listener), clear: () => governance.clear(),
    getEffectiveAccess(id) {
    const access = governance.getEffectiveAccess(id);
    return access ? { ...access, canAccessRecord(resource, record) {
      const owned = record as { ownerId?: string };
      return (resource !== "leads" || owned.ownerId === context.memberId) && access.canAccessRecord(resource, record);
    } } : undefined;
  } });
  const retainedInput = { nextOwnerId: recipient.memberId, reason: "OWN transfer retry" };
  observed = { ...mapLeadDocumentToApplication(document), ownerId: recipient.memberId };
  let composed: ReturnType<typeof useLeadDetailController>;
  function ComposedFixture() {
    composed = useLeadDetailController({ authoritativeLead: observed });
    assert.ok(composed);
    return React.createElement(LeadDetailModals, { screen: { ...composed,
      sources: composed.referenceData.sources, campaigns: composed.referenceData.campaigns,
      products: composed.referenceData.products, archiveListPath: "/leads",
    } });
  }
  const composedRoot = createRoot(rootElement);
  const renderComposed = async () => act(async () => composedRoot.render(React.createElement(I18nProvider, null,
    React.createElement(MemoryRouter, { initialEntries: [`/leads/${document.id}`] },
      React.createElement(PlatformStateProvider, null, React.createElement(Routes, null,
        React.createElement(Route, { path: "/leads/:leadId", element: React.createElement(ComposedFixture) })))))));
  const composedState = () => { assert.ok(composed); return composed; };
  const retryButton = () => window.document.querySelector<HTMLButtonElement>('button[form="lead-handover-form"]');
  await renderComposed();
  assert.equal(composedState().canHandover, false, "No retained intent: out-of-OWN Lead cannot start a Handover");
  const beforeDenied = requests.length;
  await act(async () => { await composedState().handleConfirmHandover(retainedInput.nextOwnerId, retainedInput.reason); });
  assert.equal(requests.length, beforeDenied, "Ordinary hidden Lead admission sends no mutation");
  observed = { ...observed, ownerId: context.memberId }; await renderComposed();
  assert.equal(composedState().canHandover, true);
  await act(async () => {
    composedState().setShowHandoverModal(true);
    composedState().setHandoverOwnerId(retainedInput.nextOwnerId);
    composedState().setHandoverReason(retainedInput.reason);
  });
  mode = "NETWORK";
  await act(async () => { window.document.getElementById("lead-handover-form")?.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
  const retainedRequest = requests.filter(request => request.operationId === "handoverLeadWithTasks").at(-1);
  assert.ok(retainedRequest);
  assert.equal(composedState().handover.ambiguous, true);
  observed = { ...observed, ownerId: recipient.memberId, resourceVersion: 6 };
  await renderComposed();
  assert.equal(composedState().access.canAccessRecord("leads", observed), false);
  assert.equal(retryButton()?.disabled, false, "Exact retry remains enabled after current OWN access disappears");
  assert.equal((window.document.querySelector<HTMLButtonElement>('#lead-handover-form button[aria-haspopup="listbox"]') ?? window.document.querySelector<HTMLSelectElement>("#lead-handover-form select"))?.disabled, true);
  assert.equal(window.document.querySelector<HTMLTextAreaElement>("textarea")?.disabled, true);
  const beforeAltered = requests.length;
  await act(async () => {
    await composedState().handleConfirmHandover(context.memberId, retainedInput.reason);
    await composedState().handleConfirmHandover(retainedInput.nextOwnerId, "Changed intent");
  });
  assert.equal(requests.length, beforeAltered, "Altered owner/reason cannot reuse an ambiguous intent");
  await act(async () => {
    composedState().setHandoverReason("Changed intent");
  });
  assert.equal(retryButton()?.disabled, true, "A nonmatching draft has no retry affordance");
  await act(async () => { composedState().setHandoverReason(retainedInput.reason); });
  assert.equal(retryButton()?.disabled, false);
  await act(async () => { composedState().setShowHandoverModal(false); });
  assert.equal(composedState().canHandover, true, "Only the retained exact intent can reopen after close");
  await act(async () => { composedState().setShowHandoverModal(true); });
  mode = "SUCCESS";
  await act(async () => { window.document.getElementById("lead-handover-form")?.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
  const retriedRequest = requests.filter(request => request.operationId === "handoverLeadWithTasks").at(-1);
  assert.equal(retriedRequest?.idempotencyKey, retainedRequest.idempotencyKey);
  assert.equal(retriedRequest?.expectedVersion, retainedRequest.expectedVersion);
  assert.deepEqual(retriedRequest?.body, retainedRequest.body);
  assert.equal(composedState().handover.ambiguous, false);
  assert.equal(composedState().handover.blocked, false);
  assert.equal(composedState().showHandoverModal, false);
  assert.equal(composedState().handoverOwnerId, "");
  assert.equal(composedState().handoverReason, "");
  assert.equal(composedState().canHandover, false, "Success does not grant a new out-of-scope command");
  await act(async () => composedRoot.unmount());
  // Let the controller's existing success toast timer settle before handle auditing.
  await new Promise(resolve => setTimeout(resolve, 3100));
  configureAccessGovernanceRuntime(governance);
}

const controller = source("src/modules/leads/presentation/hooks/useLeadDetailController.tsx");
assert.match(controller, /Boolean\(lead\?\.ownerId\).*access.can\(CAPABILITIES.LEADS_ASSIGN\)/);
assert.match(controller, /access.can\(CAPABILITIES.TASKS_CREATE\)/);
assert.ok(controller.includes('setHandoverOwnerId("");'));
assert.ok(controller.includes('setHandoverReason("");'));
assert.ok(controller.includes('handoverAccess.data?.fieldAccess.ownerId === "READ_WRITE"'));
assert.ok(controller.includes('requestedCommands: ["lead.assign-owner"]'));
assert.match(controller, /access.can\(CAPABILITIES.TASKS_ASSIGN\)/);
assert.ok(!controller.includes("openLeadTasks.length > 0 && !access.can(CAPABILITIES.TASKS_ASSIGN)"));
const modal = source("src/modules/leads/presentation/components/LeadDetailModals.tsx");
for (const token of ["maxLength={1000}", "handover.blocked", "handover.recover", "handover.ambiguous"]) assert.ok(modal.includes(token), token);
const commands = source("src/modules/leads/application/commands/leadApiCommands.ts");
for (const stale of ["taskTargets", 'priority: "HIGH"', "24 * 60 * 60"]) assert.ok(!commands.includes(stale), stale);
const spec = JSON.parse(source("docs/api/openapi.json"));
assert.equal(spec.paths["/leads/{leadId}/handover"], undefined);
const operation = spec.paths["/workflows/lead-handover/{leadId}"].post;
assert.equal(operation["x-required-capability"], "leads.assign");
assert.deepEqual(operation["x-additional-required-capabilities"], ["tasks.assign", "tasks.create"]);
for (const header of ["IfMatchHeader", "IdempotencyKeyHeader", "RequestIdHeader", "CorrelationIdHeader"]) assert.ok(operation.parameters.some((parameter: { $ref?: string }) => parameter.$ref?.endsWith(header)));
assert.deepEqual(spec.components.schemas.HandoverLeadWithTasksRequest.required, ["nextOwnerId", "reason"]);
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
const ownerContext = getRecordOwnershipContext("leads", CAPABILITIES.LEADS_ASSIGN);
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
const { configureAccessGovernanceRuntime, getAccessGovernanceRuntimeBinding } = await import("@/platform/access-control/application/accessGovernanceBinding");
const governance = getAccessGovernanceRuntimeBinding();
let ownScope = true;
let leadOwnerWritable = true;
configureAccessGovernanceRuntime({ ...governance, getEffectiveAccess(id) {
  const access = governance.getEffectiveAccess(id);
  return access ? { ...access, getFieldAccess(resource, field) {
    return resource === "leads" && field === "ownerId" && !leadOwnerWritable ? "READ_ONLY" : access.getFieldAccess(resource, field);
  }, canAccessRecord(resource, record) {
    const owned = record as { id?: string; ownerId?: string; assigneeId?: string };
    return (!ownScope || !owned.id || (resource === "leads" ? owned.ownerId : owned.assigneeId) === ownerContext.memberId) && access.canAccessRecord(resource, record);
  } } : undefined;
} });
const { createWorkspaceScopedRepository } = await import("@/platform/workspace-scope/createWorkspaceScopedRepository");
const scopedLeadRepository = createWorkspaceScopedRepository({ resourceKey: "leads", createRepository: () => repository });
const demo = createLeadDemoApiRuntime(scopedLeadRepository);
const demoInput = { ...move, nextOwnerId: target.memberId };
// Real demo conflict must follow the hook's explicit 412 reconciliation path.
const demoBeforeConflict = structuredClone(tasks.getRetainedTaskActivitySnapshot());
await assert.rejects(() => demo.commands.handoverLeadWithTasks(document.id, demoInput,
  { idempotencyKey: "demo-stale-version", expectedVersion: 4 }), {
  code: "VERSION_CONFLICT", category: "CONFLICT", status: 412, retryable: false,
  details: { expectedVersion: 4, currentVersion: 5 },
});
assert.deepEqual(tasks.getRetainedTaskActivitySnapshot(), demoBeforeConflict);
const demoAttempts: Array<{ idempotencyKey: string; expectedVersion: number }> = [];
configureLeadApplication({ ...base, repository: scopedLeadRepository, api: { ...demo, commands: {
  ...demo.commands, async handoverLeadWithTasks(leadId, value, attempt) {
    demoAttempts.push({ idempotencyKey: attempt.idempotencyKey, expectedVersion: attempt.expectedVersion });
    return demo.commands.handoverLeadWithTasks(leadId, value, attempt);
  },
} } });
observed = { ...mapLeadDocumentToApplication(document), ownerId: ownerContext.memberId, resourceVersion: 4 };
const demoRoot = createRoot(rootElement);
await act(async () => demoRoot.render(React.createElement(Fixture)));
await act(async () => { await assert.rejects(() => current.submit(demoInput), { code: "VERSION_CONFLICT", status: 412 }); });
assert.equal(current.blocked, true);
assert.equal(current.ambiguous, false, "Definitive demo version rejection is not ambiguous");
await act(async () => { await current.submit(demoInput); });
assert.equal(demoAttempts.length, 1, "No automatic stale attempt retry");
await act(async () => { await current.recover(); });
assert.equal(current.blocked, false, "Authoritative demo refresh is available after 412");
assert.equal(current.ambiguous, false);
// Observe the next explicit attempt without committing, so the snapshot tests below retain their fixture.
configureLeadApplication({ ...base, repository: scopedLeadRepository, api: { ...demo, commands: {
  ...demo.commands, async handoverLeadWithTasks(_leadId, _value, attempt) {
    demoAttempts.push({ idempotencyKey: attempt.idempotencyKey, expectedVersion: attempt.expectedVersion });
    throw new ApplicationError({ code: "ACCESS_DENIED", category: "AUTHORIZATION", status: 403, message: "Test explicit submission" });
  },
} } });
await act(async () => { await assert.rejects(() => current.submit(demoInput), { code: "ACCESS_DENIED" }); });
assert.equal(demoAttempts.at(-1)?.expectedVersion, 5);
assert.notEqual(demoAttempts.at(-1)?.idempotencyKey, demoAttempts[0]?.idempotencyKey);
await act(async () => demoRoot.unmount());
configureLeadApplication(base);
leadOwnerWritable = false;
const beforeOwnerDenied = structuredClone(tasks.getRetainedTaskActivitySnapshot());
await assert.rejects(() => demo.commands.handoverLeadWithTasks(document.id, demoInput, options), { code: "ACCESS_DENIED" });
assert.deepEqual(tasks.getRetainedTaskActivitySnapshot(), beforeOwnerDenied);
assert.equal(records[0]?.ownerId, ownerContext.memberId);
leadOwnerWritable = true;
const moved = await demo.commands.handoverLeadWithTasks(document.id, demoInput, options);
assert.equal(scopedLeadRepository.getById(document.id), null, "actual scoped repository hides Lead after transfer");
assert.deepEqual(moved.reassignedTaskIds, ["eligible"]);
assert.equal(tasks.getTaskSnapshot("eligible"), null, "post-transfer OWN reads remain hidden after admitted command succeeds");
ownScope = false; // Fixture inspection of committed state, not mutation authority.
assert.equal(tasks.getTaskSnapshot("eligible")?.assigneeId, target.memberId);
for (const id of ["completed", "cancelled", "archived", "other"]) assert.equal(tasks.getTaskSnapshot(id)?.assigneeId, ownerContext.memberId);
const takeover = tasks.getTaskSnapshot(moved.handoverTaskId);
assert.equal(takeover?.priority, "NORMAL");
assert.equal(takeover?.title, demoInput.reason.slice(0, 300));
assert.equal(takeover?.description, undefined);
assert.equal(takeover?.sourceRef?.evidence, demoInput.reason);
assert.equal(Date.parse(moved.handoverTaskDueAt) - Date.parse(moved.evidence.occurredAt), 48 * 60 * 60 * 1000);
config.updateWorkspaceConfig(value => ({ ...value, workflow: { ...value.workflow, handoverAcceptanceSlaHours: 12 } }));
ownScope = true;
leadOwnerWritable = false; // Replay reads proof and performs no owner write.
assert.deepEqual(await demo.commands.handoverLeadWithTasks(document.id, demoInput, options), moved);
leadOwnerWritable = true;
ownScope = false;
assert.equal(tasks.getRetainedTaskActivitySnapshot().tasks.filter(task => task.sourceRef?.type === "LEAD_HANDOVER").length, 1);
ownScope = true;
await assert.rejects(() => demo.commands.handoverLeadWithTasks(document.id, { ...demoInput, reason: "Changed" }, options), { code: "IDEMPOTENCY_KEY_REUSED" });
ownScope = false;
const repeated = await demo.commands.handoverLeadWithTasks(document.id, { ...input, nextOwnerId: ownerContext.memberId }, { expectedVersion: 6, idempotencyKey: "repeat-next" });
assert.deepEqual(repeated.reassignedTaskIds, ["eligible", moved.handoverTaskId].sort());
assert.equal(tasks.getTaskSnapshot("eligible")?.assigneeId, ownerContext.memberId);
assert.equal(repeated.resolvedHandoverAcceptanceSlaHours, 12);
for (const invalid of [0, 169]) {
  config.updateWorkspaceConfig(value => ({ ...value, workflow: { ...value.workflow, handoverAcceptanceSlaHours: invalid } }));
  await assert.rejects(() => demo.commands.handoverLeadWithTasks(document.id, demoInput, { expectedVersion: 7, idempotencyKey: `invalid-${invalid}` }));
}
// Completed replay requires current resource capabilities, without transferred record-scope admission.
const { getRoleTemplate } = await import("@/platform/access-control");
assert.ok(getRoleTemplate("sales-manager")?.capabilities.includes(CAPABILITIES.LEADS_ASSIGN));
assert.ok(getRoleTemplate("workspace-administrator")?.capabilities.includes(CAPABILITIES.LEADS_ASSIGN));
assert.equal(getRoleTemplate("sales-representative")?.capabilities.includes(CAPABILITIES.LEADS_ASSIGN), false);
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
deniedCapability = CAPABILITIES.LEADS_ASSIGN;
await assert.rejects(() => demo.commands.handoverLeadWithTasks(document.id, demoInput, options));
deniedCapability = "";
deniedLeadScope = true;
deniedTaskId = moved.handoverTaskId;
assert.deepEqual(await demo.commands.handoverLeadWithTasks(document.id, demoInput, options), moved, "Completed replay does not reauthorize transferred ownership");
deniedLeadScope = false;
deniedTaskId = "";
for (const capability of [CAPABILITIES.TASKS_CREATE, CAPABILITIES.TASKS_ASSIGN]) {
  deniedCapability = capability;
  const before = structuredClone(tasks.getRetainedTaskActivitySnapshot());
  await assert.rejects(() => demo.commands.handoverLeadWithTasks(document.id, demoInput, { expectedVersion: 7, idempotencyKey: `denied-${capability}` }));
  assert.deepEqual(tasks.getRetainedTaskActivitySnapshot(), before);
}
deniedCapability = "";
for (const resource of ["leads", "tasks"]) {
  deniedLeadScope = resource === "leads";
  deniedTaskId = resource === "tasks" ? "eligible" : "";
  const beforeTasks = structuredClone(tasks.getRetainedTaskActivitySnapshot());
  const beforeLeads = structuredClone(records);
  await assert.rejects(() => demo.commands.handoverLeadWithTasks(document.id, demoInput, { expectedVersion: 7, idempotencyKey: `scope-${resource}` }));
  assert.deepEqual(tasks.getRetainedTaskActivitySnapshot(), beforeTasks);
  assert.deepEqual(records, beforeLeads);
}
deniedLeadScope = false;
deniedTaskId = "";
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
const backToOriginal = { ...move, nextOwnerId: target.memberId };
const failureOptions = { expectedVersion: 7, idempotencyKey: "rollback-retry" };
await assert.rejects(() => failingDemo.commands.handoverLeadWithTasks(document.id, backToOriginal, failureOptions), /Injected demo Lead commit failure/);
assert.deepEqual(tasks.getRetainedTaskActivitySnapshot(), beforeFailureTasks);
assert.deepEqual(records, beforeFailureLeads);
const afterFailureRetry = await failingDemo.commands.handoverLeadWithTasks(document.id, backToOriginal, failureOptions);
assert.equal("lead" in afterFailureRetry, false);
assert.equal(records.find(record => record.id === document.id)?.ownerId, target.memberId);
assert.deepEqual(await failingDemo.commands.handoverLeadWithTasks(document.id, backToOriginal, failureOptions), afterFailureRetry);
assert.ok(ambiguous?.idempotencyKey);

// Actor-scoped identical keys must produce distinct durable takeover identities.
const { resolveEffectiveAccess } = await import("@/platform/access-control");
const admittedActorAccess = resolveEffectiveAccess();
const actorTasksBefore = structuredClone(tasks.getRetainedTaskActivitySnapshot());
const actorLeadsBefore = structuredClone(records);
records = [{ ...records[0], id: document.id, ownerId: ownerContext.memberId, resourceVersion: 20 }];
tasks.replaceTaskActivitySnapshot({ tasks: [], activities: [] });
const actorDemo = createLeadDemoApiRuntime(repository);
const actorFirst = await actorDemo.commands.handoverLeadWithTasks(document.id,
  { nextOwnerId: "u2", reason: "First actor" }, { expectedVersion: 20, idempotencyKey: "same-cross-actor-key" });
assert.equal(signIn({ email: "sales.manager@unicorecrm.local", password: "welcome123" }).ok, true);
configureAccessGovernanceRuntime({ ...governance, getEffectiveAccess: () => admittedActorAccess });
assert.equal(getRecordOwnershipContext("leads", CAPABILITIES.LEADS_ASSIGN)?.memberId, "u2");
const actorSecond = await actorDemo.commands.handoverLeadWithTasks(document.id,
  { nextOwnerId: ownerContext.memberId, reason: "Second actor" }, { expectedVersion: 21, idempotencyKey: "same-cross-actor-key" });
assert.notEqual(actorSecond.handoverTaskId, actorFirst.handoverTaskId);
assert.equal(tasks.getRetainedTaskActivitySnapshot().tasks.filter(task => task.sourceRef?.type === "LEAD_HANDOVER").length, 2);
assert.equal(signIn({ email: "admin@unicorecrm.local", password: "admin123" }).ok, true);
configureAccessGovernanceRuntime(governance);
records = actorLeadsBefore;
tasks.replaceTaskActivitySnapshot(actorTasksBefore);

const { resetEffectiveRecordAccessAuthority, useEffectiveRecordAccess } = await import("@/platform/access-control");
resetEffectiveRecordAccessAuthority();
let localAuthority: ReturnType<typeof useEffectiveRecordAccess> | undefined;
const localRoot = createRoot(rootElement);
function LocalAssignAuthorityProbe() {
  localAuthority = useEffectiveRecordAccess({ resourceKey: "leads", recordId: document.id,
    record: records[0], requestedCommands: ["lead.assign-owner"], requestedFields: ["ownerId"] });
  return null;
}
await act(async () => { localRoot.render(React.createElement(LocalAssignAuthorityProbe)); });
assert.equal(localAuthority?.connected, false);
assert.equal(localAuthority?.data?.allowedCommands.includes("lead.assign-owner"), true,
  "real demo command preflight maps canonical assign-owner to leads.assign");
assert.equal(localAuthority?.data?.fieldAccess.ownerId, "READ_WRITE");
await act(async () => localRoot.unmount());
window.close();
console.log("Lead handover: PASS (canonical contract, response validation, retry intent, explicit 412 refresh, canonical UI/preflight, authoritative demo Task set, frozen SLA/replay)");
