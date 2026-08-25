// @ts-nocheck -- Runtime contract for RC-01 server-assigned Task identity.
//
// Invariant: the Task aggregate id is server-assigned. `CreateTaskRequest` in
// `docs/api/openapi.json` is a closed schema without `id`, and the authoritative id only
// arrives in `TaskMutationResult.task.id`. A deterministic client-side value may key
// idempotency and dedupe, but must never be sent as a Deal Task foreign reference
// (`CreateDealRequest.nextActionTaskId`, `UpdateDealNextActionRequest.taskId`).
//
// This gate drives the real connected command paths through a recording HTTP client and
// asserts on the request bodies that actually reach the backend, so it fails on the wire
// shape rather than on source text.
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: "http://localhost/#/w/unicore-vietnam/crm/deals",
  pretendToBeVisual: true,
});
const { window } = dom;

Object.defineProperties(globalThis, {
  window: { value: window, configurable: true },
  document: { value: window.document, configurable: true },
  navigator: { value: window.navigator, configurable: true },
  localStorage: { value: window.localStorage, configurable: true },
  HTMLElement: { value: window.HTMLElement, configurable: true },
  Element: { value: window.Element, configurable: true },
  Node: { value: window.Node, configurable: true },
  Event: { value: window.Event, configurable: true },
});

const { signIn } = await import("../../../src/platform/identity-auth/index");
assert.equal(
  signIn({ email: "admin@unicorecrm.local", password: "admin123" }).ok,
  true,
  "Task identity contracts need an authenticated session so capability checks are exercised.",
);

const SERVER_TASK_ID = "task_srv_7f3c91";
const DEAL_ID = "deal_identity_probe";
const DUE_AT = "2026-09-01T09:00:00.000Z";

interface Recorded {
  operationId: string;
  method: string;
  path: string;
  body: Record<string, unknown> | undefined;
  idempotencyKey: string | undefined;
}

const requests: Recorded[] = [];

function dealEnvelope(nextActionRef?: { type: string; id?: string }) {
  return {
    commandId: "cmd_deal_1",
    correlationId: "corr_deal_1",
    aggregateId: DEAL_ID,
    aggregateType: "deal",
    version: 3,
    occurredAt: "2026-08-22T00:00:00.000Z",
    outcome: "COMMITTED",
    result: {
      deal: {
        id: DEAL_ID,
        name: "Identity probe",
        buyerRef: { type: "CONTACT", id: "contact_1" },
        stageCode: "DISCOVERY",
        stageCategory: "OPEN",
        amount: { amount: "1000.00", currency: "VND" },
        opportunityScore: "40.00",
        ownerId: "owner_1",
        expectedCloseDate: "2026-09-30",
        interestedProductIds: [],
        lineItems: [],
        resourceVersion: 3,
        createdAt: "2026-08-22T00:00:00.000Z",
        updatedAt: "2026-08-22T00:00:00.000Z",
        nextActionAt: DUE_AT,
        nextActionSummary: "Call the buyer",
        ...(nextActionRef === undefined ? {} : { nextActionRef }),
      },
    },
  };
}

function taskEnvelope() {
  return {
    commandId: "cmd_task_1",
    correlationId: "corr_task_1",
    aggregateId: SERVER_TASK_ID,
    aggregateType: "task",
    version: 1,
    occurredAt: "2026-08-22T00:00:00.000Z",
    outcome: "COMMITTED",
    result: {
      task: {
        id: SERVER_TASK_ID,
        title: "Call the buyer",
        status: "OPEN",
        priority: "HIGH",
        assigneeId: "owner_1",
        dueAt: DUE_AT,
        recordRef: { moduleKey: "deals", recordId: DEAL_ID, label: "Identity probe" },
        sourceRef: { type: "DEAL_NEXT_ACTION", id: DEAL_ID },
        createdAt: "2026-08-22T00:00:00.000Z",
        updatedAt: "2026-08-22T00:00:00.000Z",
        resourceVersion: 1,
      },
    },
  };
}

/** Last recorded request for an operation. */
const lastRequest = (operationId: string): Recorded => {
  const found = [...requests].reverse().find((request) => request.operationId === operationId);
  assert.ok(found, `No ${operationId} request reached the backend boundary.`);
  return found;
};

const connectedClient = {
  async request(input: Recorded & { body?: Record<string, unknown> }) {
    requests.push({
      operationId: input.operationId,
      method: input.method,
      path: input.path,
      body: input.body,
      idempotencyKey: input.idempotencyKey,
    });
    if (input.operationId === "createTask") return taskEnvelope();
    if (input.operationId === "createDealCommand" || input.operationId === "updateDealNextAction") {
      const ref = input.body && typeof input.body === "object"
        ? (input.body as { nextActionTaskId?: string; taskId?: string })
        : {};
      const taskId = ref.nextActionTaskId ?? ref.taskId;
      return dealEnvelope(taskId ? { type: "TASK", id: taskId } : { type: "MANUAL" });
    }
    throw new Error(`Unexpected connected operation in the Task identity contract: ${input.operationId}`);
  },
};

const { initializeApplicationComposition } = await import("../../../src/app/composition");
await initializeApplicationComposition({ mode: "connected", http: { client: connectedClient } });

const { createDealCommand, updateDealNextActionCommand } = await import("../../../src/modules/deals/public/deals");
const { createTaskCommand } = await import("../../../src/modules/tasks/public/api");
const {
  getDealNextActionTaskIntentKey,
  ensureDealNextActionTask,
  WORK_ACTIVATION_OPERATION,
} = await import("../../../src/workflows/work-activation/index");
const {
  getUnavailableBusinessOperations,
  declareUnavailableBusinessOperation,
  resetBusinessOperationAvailability,
} = await import("../../../src/shared/application/index");

const intentKey = getDealNextActionTaskIntentKey(DEAL_ID, DUE_AT);
assert.match(intentKey, /^task_deal_/u, "The deterministic intent key keeps its shape; only its role changed.");

// ---------------------------------------------------------------------------
// A. Deal create must not carry a client-generated Task foreign reference.
// ---------------------------------------------------------------------------

const createdDeal = await createDealCommand({
  id: DEAL_ID,
  name: "Identity probe",
  buyerRef: { type: "CONTACT", id: "contact_1" },
  stage: "DISCOVERY",
  amount: 1000,
  currency: "VND",
  opportunityScore: 40,
  ownerId: "owner_1",
  expectedCloseDate: "2026-09-30",
  createdAt: "2026-08-22T00:00:00.000Z",
  updatedAt: "2026-08-22T00:00:00.000Z",
  interestedProducts: [],
  lineItems: [],
  nextActionAt: DUE_AT,
  nextActionSummary: "Call the buyer",
});

const createRequest = lastRequest("createDealCommand");
assert.equal(
  Object.prototype.hasOwnProperty.call(createRequest.body ?? {}, "nextActionTaskId"),
  false,
  "A Deal created before its next-action Task must not send a Task foreign reference.",
);
assert.equal((createRequest.body as { nextActionAt?: string }).nextActionAt, DUE_AT, "The next-action schedule itself must still be sent.");
assert.equal((createRequest.body as { nextActionSummary?: string }).nextActionSummary, "Call the buyer");

// ---------------------------------------------------------------------------
// B. Deal next-action update must not carry a client-generated Task id.
// ---------------------------------------------------------------------------

await updateDealNextActionCommand(DEAL_ID, { nextActionAt: DUE_AT, nextActionSummary: "Call the buyer" }, { expectedVersion: 3 });
const updateRequest = lastRequest("updateDealNextAction");
assert.equal(
  Object.prototype.hasOwnProperty.call(updateRequest.body ?? {}, "taskId"),
  false,
  "deal.update-next-action must omit taskId when no authoritative Task id is known.",
);

// ---------------------------------------------------------------------------
// C + E. task.create sends no id; the authoritative id comes from the response.
// D. The Task references the already-created Deal by its real id.
// ---------------------------------------------------------------------------

const taskOutcome = await createTaskCommand({
  id: intentKey,
  title: "Call the buyer",
  priority: "HIGH",
  assigneeId: "owner_1",
  dueAt: DUE_AT,
  recordRef: { moduleKey: "deals", recordId: createdDeal.data.id, label: createdDeal.data.name },
  sourceRef: { type: "DEAL_NEXT_ACTION", id: createdDeal.data.id },
  dedupeKey: `deal-next-action:${createdDeal.data.id}:${DUE_AT}`,
  actorId: "owner_1",
}, { idempotencyKey: `task.create:${intentKey}` });

const taskRequest = lastRequest("createTask");
assert.equal(
  Object.prototype.hasOwnProperty.call(taskRequest.body ?? {}, "id"),
  false,
  "CreateTaskRequest is a closed schema without `id`; the client must never send one.",
);
assert.equal(taskOutcome.data.id, SERVER_TASK_ID, "The authoritative Task id must come from the backend response.");
assert.notEqual(taskOutcome.data.id, intentKey, "The deterministic intent key must never become the Task aggregate id.");
assert.equal(
  (taskRequest.body as { recordRef?: { recordId?: string } }).recordRef?.recordId,
  DEAL_ID,
  "The Task must reference the already-committed Deal by its authoritative id.",
);
assert.equal(
  (taskRequest.body as { dedupeKey?: string }).dedupeKey,
  `deal-next-action:${DEAL_ID}:${DUE_AT}`,
  "The dedupe key must survive: replay safety is the legitimate use of a deterministic value.",
);
assert.equal(
  taskRequest.idempotencyKey,
  `task.create:${intentKey}`,
  "The deterministic value remains valid as an idempotency key.",
);

// The workflow activation path sends the same shape.
//
// WF-21 is coordinator-forbidden, so connected mode refuses this path outright (M8 owns
// that containment and proves it in `quality.wf21-work-activation-ownership`). This gate
// is about Task *identity*, not ownership, so the WF-21 declaration is lifted for the
// probe and restored immediately: the request shape must stay correct for whichever
// runtime is eventually allowed to activate work.
const declarationsBeforeActivationProbe = [...getUnavailableBusinessOperations()];
resetBusinessOperationAvailability();
for (const operation of declarationsBeforeActivationProbe) {
  if (operation !== WORK_ACTIVATION_OPERATION) declareUnavailableBusinessOperation(operation);
}
requests.length = 0;
await ensureDealNextActionTask(createdDeal.data);
const activationRequest = lastRequest("createTask");
assert.equal(
  Object.prototype.hasOwnProperty.call(activationRequest.body ?? {}, "id"),
  false,
  "ensureDealNextActionTask must not send a client Task id either.",
);
assert.equal(
  activationRequest.idempotencyKey,
  `task.create:${getDealNextActionTaskIntentKey(DEAL_ID, DUE_AT)}`,
  "Activation keeps deterministic replay through the idempotency key.",
);
resetBusinessOperationAvailability();
for (const operation of declarationsBeforeActivationProbe) declareUnavailableBusinessOperation(operation);

// ---------------------------------------------------------------------------
// G. An authoritative Task reference is preserved, not erased.
// ---------------------------------------------------------------------------

requests.length = 0;
await updateDealNextActionCommand(
  DEAL_ID,
  { nextActionAt: DUE_AT, nextActionSummary: "Call the buyer", taskId: SERVER_TASK_ID },
  { expectedVersion: 3 },
);
assert.equal(
  (lastRequest("updateDealNextAction").body as { taskId?: string }).taskId,
  SERVER_TASK_ID,
  "A Task id obtained from the authoritative Task response must still be sendable.",
);

requests.length = 0;
await createDealCommand({
  ...createdDeal.data,
  id: DEAL_ID,
  nextActionRef: { type: "TASK", id: SERVER_TASK_ID },
});
assert.equal(
  (lastRequest("createDealCommand").body as { nextActionTaskId?: string }).nextActionTaskId,
  SERVER_TASK_ID,
  "A Deal carrying a backend-issued Task reference must keep sending it.",
);

// ---------------------------------------------------------------------------
// F. Demo mode keeps its own local Task identity ownership.
// ---------------------------------------------------------------------------

const { resetApplicationComposition } = await import("../../../src/app/composition");
if (typeof resetApplicationComposition === "function") resetApplicationComposition();
await initializeApplicationComposition({ mode: "demo" });
// This section probes identity assignment, not authorization. The runtime capability
// guard only engages in a browser session and its role assignments are bootstrapped by
// the app shell rather than the composition root, so the browser global is dropped here.
Object.defineProperty(globalThis, "window", { value: undefined, configurable: true });

const { createTaskSnapshot, getTaskSnapshot } = await import("../../../src/modules/tasks/public/api");
const demoTask = createTaskSnapshot({
  id: "task_demo_identity_probe",
  title: "Demo owned identity",
  assigneeId: "owner_1",
  dueAt: DUE_AT,
  actorId: "owner_1",
});
assert.equal(demoTask.id, "task_demo_identity_probe", "The demo snapshot creator genuinely owns the Task identity it is given.");
assert.equal(
  getTaskSnapshot("task_demo_identity_probe")?.id,
  "task_demo_identity_probe",
  "A demo-owned Task identity resolves to a real Task, which is why demo references stay legitimate.",
);

const demoTaskOutcome = await createTaskCommand({
  id: intentKey,
  title: "Demo async create",
  assigneeId: "owner_1",
  dueAt: DUE_AT,
  actorId: "owner_1",
});
assert.notEqual(
  demoTaskOutcome.data.id,
  intentKey,
  "Even in demo mode the async Task command assigns its own id, so the intent key is never a Task reference.",
);
assert.match(
  demoTaskOutcome.data.id,
  /^task_demo_/u,
  "The demo runtime is the identity authority for tasks it creates asynchronously.",
);

console.log("Server-assigned Task identity contracts: PASS");
