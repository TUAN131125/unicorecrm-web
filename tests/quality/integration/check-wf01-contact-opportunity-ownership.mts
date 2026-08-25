// @ts-nocheck -- Runtime contract for M6 / WF-01 Contact Opportunity ownership.
//
// Invariant (MA-06): WF-01 declares `connectedFrontendCoordinatorAllowed: false` and is
// canonically BLOCKED with no backend workflow operation. Connected mode must therefore
// refuse Contact -> Opportunity before the first module mutation, and the refusal must be
// owned by WF-01 itself rather than inherited from Contact-write availability.
//
// The connected composition here uses an HTTP client that records every request, so a
// refused action is proven to make no transport call, and local business state is
// snapshotted around the action so a silent local write cannot pass unnoticed.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: "http://localhost/#/w/unicore-vietnam/crm/contacts",
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
  "WF-01 ownership contracts need an authenticated session.",
);

// ---------------------------------------------------------------------------
// 0. Canonical ownership is the authority for this whole test.
// ---------------------------------------------------------------------------

const ownership = JSON.parse(
  fs.readFileSync(path.join(repositoryRoot, "docs/backend-readiness/workflow-ownership.json"), "utf8"),
);
const wf01 = ownership.workflows.find((workflow) => workflow.workflowId === "WF-01");
assert.ok(wf01, "WF-01 must exist in canonical workflow ownership.");
assert.equal(wf01.connectedFrontendCoordinatorAllowed, false, "WF-01 must forbid a connected frontend coordinator.");
assert.equal(wf01.contractReadiness, "BLOCKED", "WF-01 must still be BLOCKED.");

// No backend workflow operation exists for WF-01, so fail-closed is the only correct
// connected behaviour. `/workflows/lead-qualification/{leadId}/opportunity` is WF-10
// (Lead -> Opportunity) and must not be mistaken for it.
const openApi = JSON.parse(fs.readFileSync(path.join(repositoryRoot, "docs/api/openapi.json"), "utf8"));
const contactOpportunityOperations = Object.keys(openApi.paths ?? {}).filter((route) => (
  /contact/iu.test(route) && /opportunit/iu.test(route)
));
assert.deepEqual(
  contactOpportunityOperations,
  [],
  "WF-01 has no backend operation. If one lands, this test and the WF-01 binding must be rewritten to route to it "
    + "rather than to keep failing closed.",
);

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
  isBusinessOperationUnavailable,
  declareUnavailableBusinessOperation,
  resetBusinessOperationAvailability,
} = await import("../../../src/shared/application/index");
const {
  CONTACT_OPPORTUNITY_CREATION_OPERATION,
  isContactOpportunityCreationUnavailable,
  executeContactOpportunityCreation,
  createContactOpportunityCreationRuntime,
} = await import("../../../src/workflows/contact-opportunity-creation/index");

// ---------------------------------------------------------------------------
// 1. The connected composition declares WF-01 unavailable, and the workflow's own
//    predicate reads that declaration.
// ---------------------------------------------------------------------------

assert.ok(
  getUnavailableBusinessOperations().includes(CONTACT_OPPORTUNITY_CREATION_OPERATION),
  "The connected composition must declare WF-01 unavailable as it binds the workflow ports.",
);
assert.equal(
  isContactOpportunityCreationUnavailable(),
  true,
  "WF-01 must report itself unavailable in connected mode.",
);

// ---------------------------------------------------------------------------
// 2. MANDATORY M6 SCENARIO.
//
//    Ordinary Contact mutation availability = AVAILABLE, WF-01 availability = UNAVAILABLE.
//
//    Historical protection was incidental: Contact -> Opportunity was unreachable only
//    because Contact writes were blocked. This proves WF-01 refuses on its own authority,
//    so the day `updateContact` gains a production contract the workflow stays contained.
// ---------------------------------------------------------------------------

const connectedDeclarations = [...getUnavailableBusinessOperations()];

resetBusinessOperationAvailability();
// Every Contact-related write is now available; only WF-01 is declared unavailable.
declareUnavailableBusinessOperation(CONTACT_OPPORTUNITY_CREATION_OPERATION);
assert.equal(
  isContactOpportunityCreationUnavailable(),
  true,
  "With Contact writes AVAILABLE and WF-01 UNAVAILABLE, WF-01 must still refuse. A guard that depended on "
    + "Contact-write availability would report the workflow as available here.",
);

// The converse: the predicate is WF-01-specific, not a blanket connected-mode flag. If
// only Contact writes were blocked and WF-01 were not, WF-01 would report available — so
// the predicate cannot be satisfied by any unrelated Contact declaration.
resetBusinessOperationAvailability();
declareUnavailableBusinessOperation("Contact record save");
declareUnavailableBusinessOperation("Contact record create");
assert.equal(
  isContactOpportunityCreationUnavailable(),
  false,
  "The WF-01 predicate must read WF-01's own declaration, never an unrelated Contact-write declaration.",
);

// Restore exactly what the connected composition declared.
resetBusinessOperationAvailability();
for (const operation of connectedDeclarations) declareUnavailableBusinessOperation(operation);
assert.equal(isContactOpportunityCreationUnavailable(), true, "Connected WF-01 availability must be restored.");

// ---------------------------------------------------------------------------
// 3. Connected zero-mutation guarantee.
//
//    Anything that reaches the WF-01 ports anyway fails closed, writes nothing to Deal,
//    Contact or Task state, and makes no HTTP call.
// ---------------------------------------------------------------------------

const { getContactsSnapshot } = await import("../../../src/modules/contacts/public/contacts");
const { getDealsSnapshot } = await import("../../../src/modules/deals/public/deals");
const { getTaskActivitySnapshot } = await import("../../../src/modules/tasks/public/api");

const contactsBefore = JSON.stringify(getContactsSnapshot());
const dealsBefore = JSON.stringify(getDealsSnapshot());
const tasksBefore = JSON.stringify(getTaskActivitySnapshot());
const requestsBefore = requests.length;

// Probe the bound write ports directly. This does not depend on the connected projection
// holding seed data, so it proves the binding itself is fail-closed rather than proving
// that some fixture happened to be empty.
const connectedPorts = createContactOpportunityCreationRuntime();
assert.throws(
  () => connectedPorts.deals.create({ id: "deal_wf01_probe", name: "WF-01 probe" }),
  /unavailable as a local operation in connected mode/u,
  "The connected WF-01 Deal binding must fail closed if anything reaches it.",
);
assert.throws(
  () => connectedPorts.contacts.save({ id: "contact_wf01_probe", status: "has_open_opportunity" }),
  /unavailable as a local operation in connected mode/u,
  "The connected WF-01 Contact binding must fail closed if anything reaches it.",
);

// And the workflow itself, entered through its public boundary, never commits either half.
assert.throws(
  () => executeContactOpportunityCreation(
    {
      contactId: getContactsSnapshot()[0]?.id ?? "contact_wf01_probe",
      deal: { id: "deal_wf01_probe", name: "WF-01 probe" },
      now: "2026-08-23T00:00:00.000Z",
      activity: { title: "probe", description: "probe", author: "test" },
    },
    connectedPorts,
  ),
  Error,
  "The connected WF-01 workflow must not complete.",
);

assert.equal(JSON.stringify(getContactsSnapshot()), contactsBefore, "A refused WF-01 must not write Contact state.");
assert.equal(JSON.stringify(getDealsSnapshot()), dealsBefore, "A refused WF-01 must not write Deal state.");
assert.equal(JSON.stringify(getTaskActivitySnapshot()), tasksBefore, "A refused WF-01 must not write Task state.");
assert.equal(requests.length, requestsBefore, "A refused WF-01 must make no HTTP call.");

// ---------------------------------------------------------------------------
// 4. Demo isolation: the local coordinator still works where it is authoritative.
// ---------------------------------------------------------------------------

await initializeApplicationComposition({ mode: "demo" });
assert.equal(
  signIn({ email: "admin@unicorecrm.local", password: "admin123" }).ok,
  true,
  "Re-initialising the composition clears the session; the demo probe needs an authorised actor.",
);
const demoWorkflow = await import("../../../src/workflows/contact-opportunity-creation/index");
assert.equal(
  demoWorkflow.isContactOpportunityCreationUnavailable(),
  false,
  "Demo mode declares nothing unavailable, so the demo-authoritative WF-01 coordinator stays usable.",
);

// The demo binding is demo-authoritative: its write ports resolve to the local coordinator
// rather than to the connected fail-closed binding. Probing the port proves which binding
// the demo runtime holds without depending on demo seed data or capability fixtures — the
// local write may still be refused for unrelated reasons, but it must never be refused as
// a connected-unavailable operation.
const demoPorts = demoWorkflow.createContactOpportunityCreationRuntime();
let demoRefusal: unknown;
try {
  demoPorts.deals.create({
    id: "deal_wf01_demo",
    name: "WF-01 demo opportunity",
    buyerRef: { type: "CONTACT", id: "contact_wf01_demo" },
    contactId: "contact_wf01_demo",
    stage: "DISCOVERY",
    amount: 1000,
    ownerId: "current-user",
    createdAt: "2026-08-23T00:00:00.000Z",
    updatedAt: "2026-08-23T00:00:00.000Z",
  });
} catch (error) {
  demoRefusal = error;
}
assert.notEqual(
  (demoRefusal as Error | undefined)?.name,
  "ConnectedOperationUnavailableError",
  "Demo WF-01 must resolve to the local coordinator, not to the connected fail-closed binding.",
);
assert.equal(requests.length, requestsBefore, "Demo WF-01 must not reach the connected transport.");

console.log(
  `quality.wf01-contact-opportunity-ownership: WF-01 ${wf01.contractReadiness}, coordinator forbidden, `
    + "connected refusal owned by WF-01, zero Deal/Contact/Task/HTTP mutations, demo coordinator intact.",
);
