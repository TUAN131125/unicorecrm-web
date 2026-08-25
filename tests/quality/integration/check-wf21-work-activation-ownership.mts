// @ts-nocheck -- Runtime contract for M8 / WF-21 Work Activation ownership.
//
// Invariant (MA-06): WF-21 declares `connectedFrontendCoordinatorAllowed: false` and is
// canonically BLOCKED. Work Activation is the Deal <-> Task coordination — establishing a
// Deal's next action AND materialising it as a Task. No backend operation commits both.
//
// `deal.create`, `deal.update-next-action` and `task.create` are each
// PRODUCTION_CONTRACT_READY, so there is no incidental protection: only WF-21's own
// ownership can contain the sequence.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";

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
  "WF-21 ownership contracts need an authenticated session.",
);

// ---------------------------------------------------------------------------
// A. Canonical ownership is read from source.
// ---------------------------------------------------------------------------

const ownership = JSON.parse(
  fs.readFileSync(path.join(repositoryRoot, "docs/backend-readiness/workflow-ownership.json"), "utf8"),
);
const wf21 = ownership.workflows.find((workflow) => workflow.workflowId === "WF-21");
assert.ok(wf21, "WF-21 must exist in canonical workflow ownership.");
assert.equal(wf21.name, "work-activation");
assert.equal(wf21.connectedFrontendCoordinatorAllowed, false, "WF-21 must forbid a connected frontend coordinator.");
assert.equal(wf21.contractReadiness, "BLOCKED", "WF-21 must still be BLOCKED.");
assert.equal(wf21.compensationOwner, "BACKEND", "WF-21 compensation must remain backend-owned.");

// No backend work-activation workflow operation exists. `/deals/{dealId}/next-action` is
// the Deal module's own `deal.update-next-action` command, not a Deal+Task workflow.
const openApi = JSON.parse(fs.readFileSync(path.join(repositoryRoot, "docs/api/openapi.json"), "utf8"));
const workflowActivationOperations = Object.keys(openApi.paths ?? {}).filter((route) => (
  /^\/workflows\//u.test(route) && /(work-activation|next-action|activation)/iu.test(route)
));
assert.deepEqual(
  workflowActivationOperations,
  [],
  "WF-21 has no backend workflow operation. If one lands, the boundary must route to it rather than keep failing "
    + "closed.",
);

// C. The commands the coordinator sequences are individually authoritative — which is
// precisely why WF-21 availability may not be derived from them.
const registry = JSON.parse(
  fs.readFileSync(path.join(repositoryRoot, "docs/backend-readiness/command-registry.json"), "utf8"),
);
for (const commandType of ["deal.create", "deal.update-next-action", "task.create"]) {
  const command = registry.commands.find((entry) => entry.commandType === commandType);
  assert.ok(command, `${commandType} must exist in the canonical registry.`);
  assert.equal(
    command.status,
    "PRODUCTION_CONTRACT_READY",
    `${commandType} must be production-ready; WF-21 containment cannot depend on it being blocked.`,
  );
}
// F. Task identity stays server-assigned (M3).
const taskCreate = registry.commands.find((entry) => entry.commandType === "task.create");
assert.equal(taskCreate.aggregateIdPolicy, "SERVER_ASSIGNED", "Task ids must remain server-assigned.");

interface Recorded { operationId: string; method: string; path: string; body: unknown }
const requests: Recorded[] = [];

const connectedClient = {
  async request(input: Recorded) {
    requests.push({ operationId: input.operationId, method: input.method, path: input.path, body: input.body });
    throw new Error(`UNEXPECTED_CONNECTED_OPERATION:${input.operationId}`);
  },
};

const { initializeApplicationComposition } = await import("../../../src/app/composition");
await initializeApplicationComposition({ mode: "connected", http: { client: connectedClient } });

const {
  getUnavailableBusinessOperations,
  declareUnavailableBusinessOperation,
  resetBusinessOperationAvailability,
} = await import("../../../src/shared/application/index");
const {
  WORK_ACTIVATION_OPERATION,
  isWorkActivationUnavailable,
  ensureDealNextActionTask,
  getDealNextActionTaskIntentKey,
} = await import("../../../src/workflows/work-activation/index");

// ---------------------------------------------------------------------------
// B. Enforcement is owned by WF-21's own declaration.
// ---------------------------------------------------------------------------

assert.ok(
  getUnavailableBusinessOperations().includes(WORK_ACTIVATION_OPERATION),
  "The connected composition must declare WF-21 unavailable.",
);
assert.equal(isWorkActivationUnavailable(), true, "WF-21 must report itself unavailable in connected mode.");

// ---------------------------------------------------------------------------
// C. MANDATORY M8 SCENARIO.
//
//    deal.create AVAILABLE, deal.update-next-action AVAILABLE, task.create AVAILABLE,
//    WF-21 UNAVAILABLE  ->  Work Activation still refuses.
// ---------------------------------------------------------------------------

const connectedDeclarations = [...getUnavailableBusinessOperations()];

resetBusinessOperationAvailability();
declareUnavailableBusinessOperation(WORK_ACTIVATION_OPERATION);
assert.equal(
  isWorkActivationUnavailable(),
  true,
  "With Deal and Task commands all AVAILABLE and only WF-21 UNAVAILABLE, WF-21 must still refuse.",
);

resetBusinessOperationAvailability();
for (const unrelated of ["Deal record create", "Deal next action update", "Task record create"]) {
  declareUnavailableBusinessOperation(unrelated);
}
assert.equal(
  isWorkActivationUnavailable(),
  false,
  "The WF-21 predicate must read WF-21's own declaration, never a Deal or Task declaration.",
);

resetBusinessOperationAvailability();
for (const operation of connectedDeclarations) declareUnavailableBusinessOperation(operation);
assert.equal(isWorkActivationUnavailable(), true, "Connected WF-21 availability must be restored.");

// ---------------------------------------------------------------------------
// D. Connected zero-mutation guarantee.
// ---------------------------------------------------------------------------

const { getDealsSnapshot } = await import("../../../src/modules/deals/public/deals");
const { getTaskActivitySnapshot } = await import("../../../src/modules/tasks/public/api");

const dealsBefore = JSON.stringify(getDealsSnapshot());
const tasksBefore = JSON.stringify(getTaskActivitySnapshot());
const requestsBefore = requests.length;

const activationDeal = {
  id: "deal_wf21_probe",
  name: "WF-21 probe",
  stage: "DISCOVERY",
  ownerId: "current-user",
  buyerRef: { type: "CONTACT", id: "contact_wf21_probe" },
  nextActionAt: "2026-09-01T00:00:00.000Z",
  nextActionSummary: "Follow up",
  createdAt: "2026-08-23T00:00:00.000Z",
};

await assert.rejects(
  () => ensureDealNextActionTask(activationDeal),
  (error: Error & { code?: string }) => {
    assert.equal(
      error.code,
      "CONNECTED_WORKFLOW_COORDINATOR_FORBIDDEN",
      "WF-21 must fail closed with its own stable code, not an incidental downstream error.",
    );
    return true;
  },
  "The WF-21 activation boundary must refuse in connected mode.",
);

assert.equal(JSON.stringify(getDealsSnapshot()), dealsBefore, "A refused WF-21 must not write Deal state.");
assert.equal(JSON.stringify(getTaskActivitySnapshot()), tasksBefore, "A refused WF-21 must not write Task state.");
assert.equal(requests.length, requestsBefore, "A refused WF-21 must make no HTTP call — no Deal and no Task.");

// A Deal with no next action is not Work Activation at all: the boundary is a no-op and
// must not be refused, so plain Deal handling stays unaffected.
assert.equal(
  await ensureDealNextActionTask({ ...activationDeal, nextActionAt: undefined }),
  undefined,
  "A Deal without a next action must remain a no-op rather than a WF-21 refusal.",
);
assert.equal(requests.length, requestsBefore, "The no-op path must make no HTTP call.");

// ---------------------------------------------------------------------------
// G + H. No Task-first reorder and no Deal-relinking workaround was introduced.
// ---------------------------------------------------------------------------

const wf21Source = fs.readFileSync(path.join(repositoryRoot, "src/workflows/work-activation/index.ts"), "utf8");
const wf21Code = wf21Source.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/^[^\n"'`]*\/\/.*$/gmu, "");
assert.doesNotMatch(
  wf21Code,
  /updateDealNextActionCommand|nextActionTaskId|nextActionRef\s*[:=]/u,
  "WF-21 must not relink a created Task back onto the Deal: that would be a third frontend-coordinated commit.",
);
// F. The deterministic key stays an intent/dedupe key, never an aggregate id.
assert.equal(
  getDealNextActionTaskIntentKey("deal_1", "2026-09-01T00:00:00.000Z"),
  "task_deal_deal_1_2026-09-01",
  "The intent key derivation must be unchanged.",
);
assert.match(wf21Source, /NOT a Task identifier/u, "The intent-key identity rule must stay documented.");

// ---------------------------------------------------------------------------
// Single-command activation is not WF-21 and must stay available.
// ---------------------------------------------------------------------------

const { activateAiSuggestedTask } = await import("../../../src/workflows/work-activation/index");
assert.equal(
  typeof activateAiSuggestedTask,
  "function",
  "AI suggestion activation issues one authoritative task.create and must not be gated by WF-21 containment.",
);

// ---------------------------------------------------------------------------
// E. Demo keeps its demo-owned activation; connected never falls back to it.
// ---------------------------------------------------------------------------

await initializeApplicationComposition({ mode: "demo" });
const demoWorkflow = await import("../../../src/workflows/work-activation/index");
assert.equal(
  demoWorkflow.isWorkActivationUnavailable(),
  false,
  "Demo mode declares nothing unavailable, so demo-owned Work Activation stays usable.",
);
assert.doesNotThrow(
  () => demoWorkflow.assertWorkActivationAvailable("demo probe"),
  "Demo WF-21 must not be refused by the connected containment.",
);
assert.equal(requests.length, requestsBefore, "Demo WF-21 must not reach the connected transport.");

console.log(
  "quality.wf21-work-activation-ownership: WF-21 BLOCKED, coordinator forbidden, refusal owned by WF-21 while "
    + "deal.create/deal.update-next-action/task.create are all READY, zero Deal/Task/HTTP mutations, plain Deal "
    + "path and single-command AI activation unaffected, demo activation intact.",
);
