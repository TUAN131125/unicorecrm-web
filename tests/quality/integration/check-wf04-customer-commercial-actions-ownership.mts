// @ts-nocheck -- Runtime contract for M7 / WF-04 Customer Commercial Actions ownership.
//
// Invariant (MA-06): WF-04 declares `connectedFrontendCoordinatorAllowed: false` and is
// canonically BLOCKED with no backend workflow operation. Connected mode must refuse
// Customer -> commercial opportunity before the first authoritative command.
//
// WF-04 is the sharpest case of the MA-06 rule: `deal.create` and `task.create` are BOTH
// `PRODUCTION_CONTRACT_READY`, so every individual command the coordinator issues is
// authoritative. Nothing derived from Customer, Deal or Task availability can contain it —
// only WF-04's own ownership can.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: "http://localhost/#/w/unicore-vietnam/crm/customers",
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
  "WF-04 ownership contracts need an authenticated session.",
);

// ---------------------------------------------------------------------------
// A. Canonical ownership is read from source and is the authority for this test.
// ---------------------------------------------------------------------------

const ownership = JSON.parse(
  fs.readFileSync(path.join(repositoryRoot, "docs/backend-readiness/workflow-ownership.json"), "utf8"),
);
const wf04 = ownership.workflows.find((workflow) => workflow.workflowId === "WF-04");
assert.ok(wf04, "WF-04 must exist in canonical workflow ownership.");
assert.equal(wf04.name, "customer-commercial-actions");
assert.equal(wf04.connectedFrontendCoordinatorAllowed, false, "WF-04 must forbid a connected frontend coordinator.");
assert.equal(wf04.contractReadiness, "BLOCKED", "WF-04 must still be BLOCKED.");
assert.equal(wf04.compensationOwner, "BACKEND", "WF-04 compensation must remain backend-owned.");

// No backend WF-04 operation exists, so fail-closed is the only correct connected result.
const openApi = JSON.parse(fs.readFileSync(path.join(repositoryRoot, "docs/api/openapi.json"), "utf8"));
const wf04Operations = Object.keys(openApi.paths ?? {}).filter((route) => (
  /customer/iu.test(route) && /(commercial|opportunit)/iu.test(route)
));
assert.deepEqual(
  wf04Operations,
  [],
  "WF-04 has no backend operation. If one lands, the workflow must be rewired to route to it rather than keep "
    + "failing closed.",
);

// D (part 1). The commands the coordinator sequences are individually authoritative, which
// is exactly why availability may not be derived from them.
const registry = JSON.parse(
  fs.readFileSync(path.join(repositoryRoot, "docs/backend-readiness/command-registry.json"), "utf8"),
);
for (const commandType of ["deal.create", "task.create"]) {
  const command = registry.commands.find((entry) => entry.commandType === commandType);
  assert.equal(
    command.status,
    "PRODUCTION_CONTRACT_READY",
    `${commandType} must be production-ready; WF-04 containment cannot depend on it being blocked.`,
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
  CUSTOMER_COMMERCIAL_ACTIONS_OPERATION,
  isCustomerCommercialActionsUnavailable,
  createDealForCustomer,
} = await import("../../../src/workflows/customer-commercial-actions/index");

// ---------------------------------------------------------------------------
// B. connectedFrontendCoordinatorAllowed:false is enforced by WF-04's own declaration.
// ---------------------------------------------------------------------------

assert.ok(
  getUnavailableBusinessOperations().includes(CUSTOMER_COMMERCIAL_ACTIONS_OPERATION),
  "The connected composition must declare WF-04 unavailable.",
);
assert.equal(isCustomerCommercialActionsUnavailable(), true, "WF-04 must report itself unavailable in connected mode.");

// ---------------------------------------------------------------------------
// D. MANDATORY M7 SCENARIO.
//
//    Customer writes available, Deal.create available, Task.create available,
//    WF-04 unavailable  ->  the action still refuses.
//
//    Unlike WF-01, there is no incidental protection to fall back on here: all three
//    underlying capabilities are genuinely available in connected mode.
// ---------------------------------------------------------------------------

const connectedDeclarations = [...getUnavailableBusinessOperations()];

resetBusinessOperationAvailability();
declareUnavailableBusinessOperation(CUSTOMER_COMMERCIAL_ACTIONS_OPERATION);
assert.equal(
  isCustomerCommercialActionsUnavailable(),
  true,
  "With Customer, Deal and Task writes all AVAILABLE and only WF-04 UNAVAILABLE, WF-04 must still refuse.",
);

// The converse: WF-04 availability must not be satisfiable by any other declaration.
resetBusinessOperationAvailability();
for (const unrelated of ["Customer record save", "Deal record create", "Task record create"]) {
  declareUnavailableBusinessOperation(unrelated);
}
assert.equal(
  isCustomerCommercialActionsUnavailable(),
  false,
  "The WF-04 predicate must read WF-04's own declaration, never Customer/Deal/Task declarations.",
);

resetBusinessOperationAvailability();
for (const operation of connectedDeclarations) declareUnavailableBusinessOperation(operation);
assert.equal(isCustomerCommercialActionsUnavailable(), true, "Connected WF-04 availability must be restored.");

// ---------------------------------------------------------------------------
// C. Connected zero-mutation guarantee.
// ---------------------------------------------------------------------------

const { getCustomersSnapshot } = await import("../../../src/modules/customers/public/api");
const { getDealsSnapshot } = await import("../../../src/modules/deals/public/deals");
const { getTaskActivitySnapshot } = await import("../../../src/modules/tasks/public/api");

const customersBefore = JSON.stringify(getCustomersSnapshot());
const dealsBefore = JSON.stringify(getDealsSnapshot());
const tasksBefore = JSON.stringify(getTaskActivitySnapshot());
const requestsBefore = requests.length;

await assert.rejects(
  () => createDealForCustomer({
    customerId: getCustomersSnapshot()[0]?.id ?? "customer_wf04_probe",
    id: "deal_wf04_probe",
    name: "WF-04 probe",
    amount: 1000,
    ownerId: "current-user",
    followUpTask: { title: "WF-04 follow-up probe", dueAt: "2026-09-01T00:00:00.000Z" },
  }),
  (error: Error & { code?: string }) => {
    assert.equal(
      error.code,
      "CONNECTED_WORKFLOW_COORDINATOR_FORBIDDEN",
      "WF-04 must fail closed with its own stable code, not with an incidental downstream error.",
    );
    return true;
  },
  "The WF-04 coordinator must refuse in connected mode.",
);

assert.equal(JSON.stringify(getCustomersSnapshot()), customersBefore, "A refused WF-04 must not write Customer state.");
assert.equal(JSON.stringify(getDealsSnapshot()), dealsBefore, "A refused WF-04 must not write Deal state.");
assert.equal(JSON.stringify(getTaskActivitySnapshot()), tasksBefore, "A refused WF-04 must not write Task state.");
assert.equal(requests.length, requestsBefore, "A refused WF-04 must make no HTTP call — no Deal and no Task.");

// The refusal must happen before the Customer relationship is even resolved, so a missing
// or invalid Customer cannot mask it as a different failure.
await assert.rejects(
  () => createDealForCustomer({
    customerId: "customer_that_does_not_exist",
    id: "deal_wf04_probe_2",
    name: "WF-04 probe 2",
    amount: 1,
    ownerId: "current-user",
  }),
  (error: Error & { code?: string }) => error.code === "CONNECTED_WORKFLOW_COORDINATOR_FORBIDDEN",
  "WF-04 must refuse on workflow ownership before resolving Customer context.",
);
assert.equal(requests.length, requestsBefore, "The second refusal must also make no HTTP call.");

// ---------------------------------------------------------------------------
// F. The deterministic follow-up key stays an intent/dedupe key (M3).
// ---------------------------------------------------------------------------

const wf04Source = fs.readFileSync(
  path.join(repositoryRoot, "src/workflows/customer-commercial-actions/index.ts"),
  "utf8",
);
assert.match(wf04Source, /NOT a Task identifier/u, "The intent-key comment must keep documenting M3.");
assert.doesNotMatch(
  wf04Source,
  /nextActionTaskId|nextActionRef/u,
  "WF-04 must not write a synthetic Task foreign reference onto the Deal.",
);

// ---------------------------------------------------------------------------
// E + G. Demo keeps its demo-owned coordinator, and connected never falls back to it.
// ---------------------------------------------------------------------------

await initializeApplicationComposition({ mode: "demo" });
const demoWorkflow = await import("../../../src/workflows/customer-commercial-actions/index");
assert.equal(
  demoWorkflow.isCustomerCommercialActionsUnavailable(),
  false,
  "Demo mode declares nothing unavailable, so the demo-owned WF-04 coordinator stays usable.",
);
assert.doesNotThrow(
  () => demoWorkflow.assertCustomerCommercialActionsAvailable("demo probe"),
  "Demo WF-04 must not be refused by the connected containment.",
);
assert.equal(requests.length, requestsBefore, "Demo WF-04 must not reach the connected transport.");

console.log(
  "quality.wf04-customer-commercial-actions-ownership: WF-04 BLOCKED, coordinator forbidden, refusal owned by WF-04 "
    + "while deal.create/task.create are both READY, zero Customer/Deal/Task/HTTP mutations, demo coordinator intact.",
);
