import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: "http://localhost", pretendToBeVisual: true });
const { window } = dom;
const browserErrors: unknown[] = [];
window.addEventListener("error", event => browserErrors.push(event.error));
Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", { value() {}, configurable: true });
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
const { Routes, Route } = await import("react-router-dom");
const { I18nProvider } = await import("@/i18n");
const { PlatformStateProvider } = await import("@/app/providers");
const { GuidanceProvider } = await import("@/guidance/presentation/GuidanceProvider");


const { MemoryRouter } = await import("react-router-dom");
const { TaskCreateModal } = await import("@/modules/tasks/presentation/components/TaskCreateModal");
const { NoteActivityCreateModal, MeetingActivityCreateModal, CallActivityCreateModal } = await import("@/modules/tasks/presentation/components/ActivityCreateModals");
const { getDirtyUnsavedWork, discardDirtyUnsavedWork, saveDirtyUnsavedWork, registerUnsavedWork } = await import("@/platform/unsaved-work");
const { configureTaskApplication, getTaskApplicationServices } = await import("@/modules/tasks/application/composition/taskApplicationServices");
const { ApplicationError } = await import("@/shared/domain");
const services = getTaskApplicationServices();
const taskInputs: Array<Parameters<typeof services.api.commands.createTask>[0]> = [];
const taskKeys: string[] = [];
let hold = false;
let fail = false;
let release: (() => void) | undefined;
let completeHold = false;
let completeFail = false;
let releaseComplete: (() => void) | undefined;
const completeTargets: Array<{ id: string; version: number }> = [];
configureTaskApplication({ ...services, api: { ...services.api, commands: { ...services.api.commands,
  async createTask(input, options) {
    taskInputs.push(input); taskKeys.push(options.idempotencyKey);
    if (hold) await new Promise<void>(resolve => { release = resolve; });
    if (fail) throw new ApplicationError({ code: "TASK_TEST_FAILURE", category: "CONFLICT", message: "Private diagnostic", retryable: false });
    return services.api.commands.createTask(input, options);
  },
  async completeTask(id, input, options) {
    completeTargets.push({ id, version: options.expectedVersion });
    if (completeHold) await new Promise<void>(resolve => { releaseComplete = resolve; });
    if (completeFail) throw new ApplicationError({ code: "COMPLETE_TEST_FAILURE", category: "CONFLICT", message: "Private diagnostic", retryable: false });
    return services.api.commands.completeTask(id, input, options);
  }
} } });
let target = "A";
let open = true;
let mode: "task" | "note" | "quote" | "order" | "shipping" | "taskdetail" | "delivery" | "meeting" | "call" | "tasklist" = "task";
const { useQuoteBuilderController } = await import("@/modules/quotes/presentation/hooks/useQuoteBuilderController");
const { useOrderFormController } = await import("@/modules/orders/presentation/hooks/useOrderFormController");
const { useShippingBookingCreateController } = await import("@/modules/shipping/presentation/create/useShippingBookingCreateController");
const { TaskListPage } = await import("@/modules/tasks/presentation/pages/TaskListPage");
const { TaskDetailPage } = await import("@/modules/tasks/presentation/pages/TaskDetailPage");
const { QuoteDeliveryConfirmationModal } = await import("@/modules/quotes/presentation/components/QuoteDeliveryConfirmationModal");
const { createTaskCommand } = await import("@/modules/tasks/public/api");
const { useNavigate } = await import("react-router-dom");
let quoteController: ReturnType<typeof useQuoteBuilderController> | undefined;
let orderController: ReturnType<typeof useOrderFormController> | undefined;
let shippingController: ReturnType<typeof useShippingBookingCreateController> | undefined;
let navigateContext: ((path: string) => void) | undefined;
function QuoteProbe() { quoteController = useQuoteBuilderController({ customers: [] }); navigateContext = useNavigate(); return React.createElement("p", null, quoteController.quoteTitle); }
function OrderProbe() { orderController = useOrderFormController({ contacts: [] }); navigateContext = useNavigate(); return React.createElement("p", null, orderController.notes); }
function ShippingProbe() {
  shippingController = useShippingBookingCreateController({ initialOrderId: target, confirmedOrders: [], pickupLocations: [], providers: [], existingBookingCount: 0,
    actorId: "u1", actorName: "Administrator", locale: "vi", onCancel() {}, onOpenOrder() {}, onCreate: async () => { throw new Error("NO_AUTHORITATIVE_ORDER"); }, onCreated() {}, products: [] });
  return React.createElement("p", null, shippingController.pickupNote);
}
let refresh = () => {};
const noteTargets: string[] = [];
const meetingOwners: string[] = [];
let deliveryHold = false;
let deliveryRelease: (() => void) | undefined;
const deliveryTargets: string[] = [];
let noteHold = false;
let noteRelease: (() => void) | undefined;
function TaskDetailProbe() { navigateContext = useNavigate(); return React.createElement(Routes, null, React.createElement(Route, { path: "/tasks/:taskId", element: React.createElement(TaskDetailPage) })); }
function Probe() {
  const [, rerender] = React.useReducer(value => value + 1, 0);
  refresh = rerender;
  const boundTarget = target;
  if (mode === "meeting") return React.createElement(MeetingActivityCreateModal, { isOpen: open, targetId: target, recordingOnly: true, formId: "proof-meeting", defaults: { title: "Meeting A", owner: "not-a-member" }, onClose: () => { open = false; refresh(); }, onSubmit: async draft => { meetingOwners.push(draft.owner ?? ""); } });
  if (mode === "call") return React.createElement(CallActivityCreateModal, { isOpen: open, targetId: target, recordingOnly: true, allowFollowUp: true, formId: "proof-call", defaults: { subject: "Call A" }, onClose: () => { open = false; refresh(); }, onSubmit: async () => {} });
  if (mode === "tasklist") return React.createElement(TaskListPage);
  if (mode === "taskdetail") return React.createElement(TaskDetailProbe);
  if (mode === "delivery") return React.createElement(QuoteDeliveryConfirmationModal, { isOpen: open, quoteNumber: target, locale: "vi", initialRecipient: "Recipient", onClose: () => { open = false; refresh(); }, onConfirm: async () => { deliveryTargets.push(boundTarget); if (deliveryHold) await new Promise<void>(resolve => { deliveryRelease = resolve; }); } });
  if (mode === "quote") return React.createElement(QuoteProbe);
  if (mode === "order") return React.createElement(OrderProbe);
  if (mode === "shipping") return React.createElement(ShippingProbe);
  return mode === "task" ? React.createElement(TaskCreateModal, {
    isOpen: open, targetId: target, formId: "proof-task-form", guardChanges: true,
    context: { recordRef: { moduleKey: "contacts", recordId: target }, label: target },
    defaults: { title: "", dueAt: "2027-01-02T17:00" },
    onClose: () => { open = false; refresh(); },
  }) : React.createElement(NoteActivityCreateModal, {
    isOpen: open, targetId: target, formId: "proof-note-form", recordingOnly: true,
    defaults: { title: `Note ${target}`, body: "", occurredAt: "2027-01-02T17:00" },
    onClose: () => { open = false; refresh(); },
    onSubmit: async () => { noteTargets.push(boundTarget); if (noteHold) await new Promise<void>(resolve => { noteRelease = resolve; }); },
  });
}
const element = document.getElementById("root"); assert.ok(element);
const root = createRoot(element);
const settle = async () => act(async () => { await new Promise(resolve => setTimeout(resolve, 130)); });
async function rerender() { await act(async () => refresh()); await settle(); }
async function change(selector: string, value: string) {
  const field = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector); assert.ok(field, selector);
  const prototype = field instanceof window.HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  await act(async () => { Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(field, value); field.dispatchEvent(new window.Event("input", { bubbles: true })); });
  await settle();
}
async function submit(id: string, times = 1) {
  const form = document.getElementById(id); assert.ok(form);
  await act(async () => { for (let i = 0; i < times; i++) form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); }); await settle();
}
async function click(label: string) {
  const button = [...document.querySelectorAll<HTMLButtonElement>("button")].find(item => item.textContent?.trim() === label); assert.ok(button, label);
  await act(async () => button.click()); await settle();
}
try {
  await act(async () => root.render(React.createElement(MemoryRouter, null, React.createElement(I18nProvider, null,
    React.createElement(PlatformStateProvider, null, React.createElement(GuidanceProvider, null, React.createElement(Probe))))))); await settle();
  assert.equal(getDirtyUnsavedWork().length, 0);
  await submit("proof-task-form"); assert.equal(taskInputs.length, 0); assert.equal(document.activeElement?.id, "task-create-title");
  await change("#task-create-title", "A task"); assert.equal(getDirtyUnsavedWork().length, 1);
  const staleEntry = getDirtyUnsavedWork()[0]; assert.ok(staleEntry);
  await change("#task-create-title", ""); assert.equal(getDirtyUnsavedWork().length, 0);
  await change("#task-create-title", "A task");
  await rerender(); assert.equal(document.querySelector<HTMLInputElement>("#task-create-title")?.value, "A task");
  target = "B"; await rerender();
  hold = true; fail = true; await submit("proof-task-form", 2);
  assert.equal(taskInputs.length, 1); assert.equal(taskInputs[0]?.recordRef?.recordId, "A");
  let otherDiscards = 0;
  const unregister = registerUnsavedWork({ id: "proof-other-dirty", title: "Other", isDirty: true, save: async () => false, discard() { otherDiscards++; } });
  assert.equal(discardDirtyUnsavedWork(), false); assert.equal(otherDiscards, 0); unregister();
  assert.equal(await saveDirtyUnsavedWork(), false);
  await act(async () => { release?.(); }); await settle();
  assert.equal(document.querySelector<HTMLInputElement>("#task-create-title")?.value, "A task");
  assert.ok(document.querySelector('[role="alert"]'));
  hold = false; fail = false;
  await act(async () => { assert.equal(await saveDirtyUnsavedWork(), true); }); await settle();
  assert.equal(taskInputs.length, 2); assert.equal(taskInputs[1]?.recordRef?.recordId, "A"); assert.equal(taskKeys[0], taskKeys[1]);
  assert.equal(open, false); assert.equal(getDirtyUnsavedWork().length, 0);
  open = true; await rerender(); assert.equal(document.querySelector<HTMLInputElement>("#task-create-title")?.value, "");
  assert.equal(await staleEntry.save(), false); assert.equal(staleEntry.canDiscard?.(), false); assert.equal(taskInputs.length, 2, "stale A registration cannot submit B");
  await change("#task-create-title", "B task"); await click("Hủy"); await click("Tiếp tục chỉnh sửa");
  assert.equal(open, true); assert.equal(document.querySelector<HTMLInputElement>("#task-create-title")?.value, "B task");
  await act(async () => { assert.equal(discardDirtyUnsavedWork(), true); }); await settle(); assert.equal(open, false);
  mode = "note"; target = "A"; open = true; await rerender();
  assert.equal(document.querySelector<HTMLInputElement>('#proof-note-form-pinned')?.disabled, true);
  await change("#proof-note-form textarea", "A note"); assert.equal(getDirtyUnsavedWork().length, 1);
  assert.equal(await saveDirtyUnsavedWork(), false, "activity save must not bypass form validation/policy");
  target = "B"; await rerender();
  assert.equal(document.querySelector<HTMLTextAreaElement>('#proof-note-form textarea')?.value, "A note");
  noteHold = true; await submit("proof-note-form", 2); assert.deepEqual(noteTargets, ["A"]);
  assert.equal(discardDirtyUnsavedWork(), false);
  await act(async () => { noteRelease?.(); }); await settle();
  assert.equal(getDirtyUnsavedWork().length, 0, "successful activity clears only its own draft baseline");
  await click("Hủy"); assert.equal(open, false);
  open = true; await rerender(); assert.equal(document.querySelector<HTMLTextAreaElement>('#proof-note-form textarea')?.value, "");
  mode = "quote"; await rerender(); assert.ok(quoteController);
  assert.equal(getDirtyUnsavedWork().length, 0, "canonical Quote initialization is clean");
  const quoteInitial = quoteController.quoteTitle;
  await act(async () => quoteController?.setQuoteTitle("Quote draft A")); await settle();
  assert.equal(getDirtyUnsavedWork().length, 1);
  await act(async () => navigateContext?.("/?customerId=B")); await settle();
  assert.equal(quoteController?.customerIdParam, null, "dirty Quote retains source context");
  assert.equal(quoteController?.quoteTitle, "Quote draft A");
  await act(async () => quoteController?.setQuoteTitle(quoteInitial)); await settle();
  assert.equal(getDirtyUnsavedWork().length, 0);
  await act(async () => navigateContext?.("/")); await settle();
  mode = "order"; await rerender(); assert.ok(orderController);
  assert.equal(getDirtyUnsavedWork().length, 0, "canonical Order initialization is clean");
  await act(async () => orderController?.setNotes("Order A draft")); await settle();
  assert.equal(getDirtyUnsavedWork().length, 1);
  await act(async () => navigateContext?.("/?organizationId=B")); await settle();
  assert.equal(orderController?.searchParams.get("organizationId"), null);
  assert.equal(orderController?.notes, "Order A draft");
  await act(async () => orderController?.setNotes("")); await settle();
  assert.equal(getDirtyUnsavedWork().length, 0);
  await act(async () => navigateContext?.("/")); await settle();
  mode = "shipping"; target = "A"; await rerender(); assert.ok(shippingController);
  assert.equal(getDirtyUnsavedWork().length, 0, "canonical shipping initialization is clean");
  await act(async () => shippingController?.setPickupNote("Shipping A draft")); await settle();
  assert.equal(getDirtyUnsavedWork().length, 1);
  await rerender(); assert.equal(shippingController?.pickupNote, "Shipping A draft", "reference array refresh preserves draft");
  target = "B"; await rerender(); assert.equal(shippingController?.initialOrderId, "A");
  await act(async () => { assert.equal(discardDirtyUnsavedWork(), true); }); await settle();
  assert.equal(shippingController?.initialOrderId, "B"); assert.equal(shippingController?.pickupNote, "");
  assert.equal(getDirtyUnsavedWork().length, 0);
  mode = "delivery"; target = "Quote A"; open = true; await rerender();
  await change("#quote-delivery-note", "A delivery evidence"); assert.equal(getDirtyUnsavedWork().length, 1);
  target = "Quote B"; await rerender(); assert.equal(document.querySelector<HTMLTextAreaElement>("#quote-delivery-note")?.value, "A delivery evidence");
  deliveryHold = true; await click("Xác nhận đã gửi");
  assert.deepEqual(deliveryTargets, ["Quote A"]); assert.equal(discardDirtyUnsavedWork(), false);
  await act(async () => { deliveryRelease?.(); }); await settle();
  assert.equal(getDirtyUnsavedWork().length, 0); await click("Chưa gửi");
  const actor = workspace.getWorkspaceContextSnapshot();
  const createdA = (await createTaskCommand({ id: "proof-detail-A", actorId: "u1", actorName: "Administrator", title: "Detail A", assigneeId: "u1", dueAt: "2027-01-02T17:00:00.000Z", sourceRef: { type: "MANUAL", id: "proof-detail-A" } })).data;
  const createdB = (await createTaskCommand({ id: "proof-detail-B", actorId: "u1", actorName: "Administrator", title: "Detail B", assigneeId: "u1", dueAt: "2027-01-02T17:00:00.000Z", sourceRef: { type: "MANUAL", id: "proof-detail-B" } })).data;
  assert.ok(actor.workspaceId);
  mode = "taskdetail"; await rerender(); await act(async () => navigateContext?.(`/tasks/${createdA.id}`)); await settle();
  await click("Hoàn thành"); await change("[role=dialog] textarea", "A completion draft");
  assert.equal(getDirtyUnsavedWork().length, 1);
  await act(async () => navigateContext?.(`/tasks/${createdB.id}`)); await settle();
  assert.equal(document.querySelector<HTMLTextAreaElement>("[role=dialog] textarea")?.value, "A completion draft");
  completeHold = true; completeFail = true; await click("Xác nhận");
  assert.deepEqual(completeTargets, [{ id: createdA.id, version: createdA.resourceVersion }]);
  assert.equal(discardDirtyUnsavedWork(), false); assert.equal(await saveDirtyUnsavedWork(), false);
  await act(async () => { releaseComplete?.(); }); await settle();
  assert.equal(document.querySelector<HTMLTextAreaElement>("[role=dialog] textarea")?.value, "A completion draft");
  await click("Hủy"); await click("Tiếp tục chỉnh sửa");
  assert.equal(document.querySelector<HTMLTextAreaElement>("[role=dialog] textarea")?.value, "A completion draft");
  await act(async () => { assert.equal(discardDirtyUnsavedWork(), true); }); await settle();
  assert.equal(document.querySelector("[role=dialog] textarea"), null);
  assert.ok(document.body.textContent?.includes("Detail B"));
  mode = "tasklist"; await rerender();
  const row = Array.from(document.querySelectorAll('tr')).find(item => item.textContent?.includes('Detail B'));
  assert.ok(row, 'list and detail project the same task');
  const completeButton = row.querySelector<HTMLButtonElement>('button[title="Hoàn thành"]');
  assert.ok(completeButton);
  await act(async () => { completeButton.click(); completeButton.click(); }); await settle();
  assert.deepEqual(completeTargets.at(-1), { id: createdB.id, version: createdB.resourceVersion });
  assert.equal(completeTargets.length, 2, 'list refuses duplicate admission synchronously, as detail does');
  await act(async () => { releaseComplete?.(); }); await settle();
  assert.ok(!document.body.textContent?.includes('Private diagnostic'), 'list uses the same normalized conflict presentation as detail');
  completeHold = false; completeFail = false;
  await act(async () => { completeButton.click(); }); await settle();
  assert.equal(completeTargets.length, 3, 'failed list command releases admission for retry');
  mode = "task"; target = "workspace-proof-A"; open = true; await rerender();
  await change("#task-create-title", "Workspace A draft");
  const originalWorkspace = workspace.getWorkspaceContextSnapshot();
  const alternateWorkspace = workspace.listWorkspaceMemberships().find(item => item.status === "active" && item.workspaceId !== originalWorkspace.workspaceId);
  assert.ok(alternateWorkspace, "real demo workspace transition fixture required");
  const callsBeforeWorkspaceSwitch = taskInputs.length;
  await act(async () => { await workspace.switchWorkspaceContext(alternateWorkspace.workspaceKey); }); await settle();
  assert.equal(await saveDirtyUnsavedWork(), false, "cannot save opening A draft in workspace B");
  assert.equal(taskInputs.length, callsBeforeWorkspaceSwitch);
  assert.equal(document.querySelector<HTMLInputElement>("#task-create-title")?.value, "Workspace A draft");
  await act(async () => { await workspace.switchWorkspaceContext(originalWorkspace.workspaceKey); }); await settle();
  await act(async () => { assert.equal(discardDirtyUnsavedWork(), true); }); await settle();
  mode = "meeting"; target = "meeting-A"; open = true; await rerender();
  assert.ok(document.querySelector("#proof-meeting-owner[aria-haspopup=listbox]"), "Task-backed assignee is a canonical member selector");
  assert.equal(document.querySelector<HTMLInputElement>("#proof-meeting-reminder")?.disabled, true);
  assert.equal(document.querySelector<HTMLInputElement>("#proof-meeting-reminder")?.checked, false);
  await click("Tạo công việc"); assert.deepEqual(meetingOwners, [], "unknown/free-text owner cannot silently fallback");
  const { listWorkspaceMemberDirectory } = await import("@/platform/member-directory");
  const member = listWorkspaceMemberDirectory()[0]; assert.ok(member);
  await act(async () => document.querySelector<HTMLButtonElement>("#proof-meeting-owner")?.click()); await settle();
  await click(member.displayName); await click("Tạo công việc");
  assert.deepEqual(meetingOwners, [member.memberId]);
  mode = "call"; open = true; await rerender();
  assert.equal(document.querySelector<HTMLInputElement>("#proof-call-follow-up-task")?.disabled, false);
  await act(async () => document.querySelector<HTMLButtonElement>("#proof-call-occurredAt")?.click()); await settle();
  assert.equal(document.querySelector("#proof-call-occurredAt")?.getAttribute("aria-expanded"), "false", "recording does not permit backdating");
  assert.equal(browserErrors.length, 0);
  console.log("B2 Task/Activity real form PASS: public Task port target/idempotency binding, refresh, dirty/revert, validation focus, local keep/discard, registry atomic pending veto, duplicate blocking, failure/retry, truthful Task save, explicit Activity SAFE_FAIL; real Quote/Order source protection and dirty/revert; Shipping refresh/discard/new source; Task detail bound target/version/failure; Quote delivery target/pending; stale entry and real workspace rejection; canonical Meeting member and optional Call follow-up.");
} finally { await act(async () => root.unmount()); configureTaskApplication(services); dom.window.close(); }
