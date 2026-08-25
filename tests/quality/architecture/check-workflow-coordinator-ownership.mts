import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import { walkFiles } from "../../../scripts/quality/core/filesystem.mjs";

/**
 * MA-06 invariant (M6).
 *
 * A workflow whose canonical ownership record declares
 * `connectedFrontendCoordinatorAllowed: false` must not be implemented in connected mode
 * by the frontend sequencing individual module mutations. Individually authoritative
 * commands do not make frontend workflow coordination authoritative.
 *
 * Containment must be owned by the workflow itself. A connected action that happens to be
 * unreachable because some *other* aggregate's writes are blocked is incidental
 * protection: it silently disappears the day that unrelated contract lands. So the
 * refusal must be derived from the workflow's own connected binding.
 *
 * The workflow inventory is read from `docs/backend-readiness/workflow-ownership.json`,
 * never from a hand-written list, so a canonical ownership change automatically widens or
 * narrows this gate.
 */

const root = repositoryRoot;

interface WorkflowOwnership {
  workflowId: string;
  name: string;
  sourcePath: string;
  connectedFrontendCoordinatorAllowed: boolean;
  contractReadiness: string;
  blockingDecisionId: string | null;
}

const ownership = JSON.parse(
  fs.readFileSync(path.join(root, "docs/backend-readiness/workflow-ownership.json"), "utf8"),
) as { workflows: WorkflowOwnership[] };

const coordinatorForbidden = ownership.workflows.filter(
  (workflow) => workflow.connectedFrontendCoordinatorAllowed === false,
);
assert.ok(
  coordinatorForbidden.length > 0,
  "Canonical workflow ownership must declare at least one workflow the connected frontend may not coordinate.",
);

const sourceFiles = walkFiles(path.join(root, "src"))
  .map((file: string) => file.split(path.sep).join("/"))
  .filter((file: string) => /\.tsx?$/u.test(file));
const read = new Map<string, string>(sourceFiles.map((file) => [file, fs.readFileSync(file, "utf8")]));
const relative = (file: string) => path.relative(root, file).split(path.sep).join("/");
const sourceOf = (relativePath: string): string => {
  const absolute = [...read.keys()].find((file) => relative(file) === relativePath);
  assert.ok(absolute, `${relativePath} must be readable.`);
  return read.get(absolute)!;
};

/** Source with block and line comments removed, so prose cannot satisfy or trip a check. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/^[^\n"'`]*\/\/.*$/gmu, "");
}

/** Text of a balanced run starting at `open`. */
function balanced(text: string, open: number, pair: "()" | "{}"): string {
  const [start, end] = pair.split("") as [string, string];
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === start) depth += 1;
    else if (text[index] === end) {
      depth -= 1;
      if (depth === 0) return text.slice(open, index + 1);
    }
  }
  return text.slice(open);
}

// ---------------------------------------------------------------------------
// 1. Every coordinator-forbidden workflow fails closed in the connected composition.
// ---------------------------------------------------------------------------

const connectedWorkflows = sourceOf("src/app/composition/connected/connectedWorkflowServices.ts");

/** The connected binding block for one workflow member, e.g. `contactOpportunityCreation`. */
function connectedBindingOf(member: string): string | undefined {
  const heading = new RegExp(`\\n\\s{4}${member}\\s*:\\s*\\{`, "u").exec(connectedWorkflows);
  if (!heading) return undefined;
  return balanced(connectedWorkflows, connectedWorkflows.indexOf("{", heading.index), "{}");
}

/** `contact-opportunity-creation` -> `contactOpportunityCreation`. */
const memberNameOf = (workflowName: string) =>
  workflowName.replace(/-([a-z])/gu, (_match, letter: string) => letter.toUpperCase());

const boundWorkflows = coordinatorForbidden
  .map((workflow) => ({ workflow, binding: connectedBindingOf(memberNameOf(workflow.name)) }))
  .filter((entry): entry is { workflow: WorkflowOwnership; binding: string } => entry.binding !== undefined);
assert.ok(
  boundWorkflows.length > 0,
  "The connected composition must bind at least one coordinator-forbidden workflow.",
);

for (const { workflow, binding } of boundWorkflows) {
  // A write member of a coordinator-forbidden workflow may not be bound to a local
  // implementation: it must resolve to the shared unavailable-operation helper.
  const writeMembers = [...binding.matchAll(/([A-Za-z0-9_$]+)\s*:\s*(\([^)]*\)|[A-Za-z0-9_$]+)\s*=>/gu)]
    .map((match) => ({ member: match[1], body: binding.slice(match.index! + match[0].length, match.index! + match[0].length + 240) }))
    .filter((entry) => /^(save|create|update|close|complete|record|restore|reconcile|resolve|run)/u.test(entry.member));
  for (const entry of writeMembers) {
    assert.match(
      entry.body,
      /connectedOperationUnavailable|unavailableConnectedOperation/u,
      `${workflow.workflowId} (${workflow.name}) declares connectedFrontendCoordinatorAllowed:false, so its connected `
        + `\`${entry.member}\` binding must fail closed instead of performing a local write.`,
    );
  }
}

// ---------------------------------------------------------------------------
// 2. Containment must be workflow-owned, not incidental.
//
// A coordinator-forbidden workflow that is still BLOCKED must declare its own
// unavailability at bind time, so presentation can refuse on the workflow itself.
// ---------------------------------------------------------------------------

const blockedCoordinatorForbidden = boundWorkflows.filter(
  ({ workflow }) => workflow.contractReadiness === "BLOCKED",
);

/**
 * Blocked coordinator-forbidden workflows that do NOT yet declare their own connected
 * unavailability, and whose callers therefore still rely on incidental protection.
 *
 * Empty since M12: WF-05 (customer-conversion), WF-09 (deal-recycle) and WF-12
 * (order-closing) each now bind through `unavailableConnectedOperation` and expose their own
 * availability predicate, so every BLOCKED coordinator-forbidden workflow the connected
 * composition binds owns its own refusal.
 *
 * The comparison is exact in both directions: a workflow that loses its declaration fails
 * this gate, and one that gains a declaration without being removed from this list fails it
 * too.
 */
const awaitingWorkflowOwnedDeclaration: string[] = [];

// The label may be a literal or — better — a constant shared with the workflow's own
// availability predicate, so the two can never drift apart.
const declaresOwnUnavailability = /unavailableConnectedOperation\(\s*(?:["'`][^"'`]+["'`]|[A-Z][A-Z0-9_]*)\s*\)/u;
const undeclared = blockedCoordinatorForbidden
  .filter(({ binding }) => !declaresOwnUnavailability.test(binding))
  .map(({ workflow }) => workflow.workflowId);
assert.deepEqual(
  undeclared.slice().sort(),
  awaitingWorkflowOwnedDeclaration.slice().sort(),
  "A BLOCKED coordinator-forbidden workflow must declare its own connected unavailability through "
    + "`unavailableConnectedOperation`. Without a declaration, presentation can only refuse by re-deriving some other "
    + "aggregate's availability, which is incidental protection that disappears when that unrelated contract lands.",
);
assert.ok(
  !awaitingWorkflowOwnedDeclaration.includes("WF-01"),
  "WF-01 containment is owned by M6 and must not be pinned as awaiting a declaration.",
);

// ---------------------------------------------------------------------------
// 3. WF-01 — Contact Opportunity Creation.
//
// The canonical record is the authority for whether these assertions apply at all.
// ---------------------------------------------------------------------------

const wf01 = ownership.workflows.find((workflow) => workflow.workflowId === "WF-01");
assert.ok(wf01, "WF-01 must exist in canonical workflow ownership.");
assert.equal(wf01.name, "contact-opportunity-creation", "WF-01 must remain contact-opportunity-creation.");

if (wf01.connectedFrontendCoordinatorAllowed === false && wf01.contractReadiness === "BLOCKED") {
  // 3a. The workflow boundary exposes its own availability predicate.
  const workflowBoundary = sourceOf("src/workflows/contact-opportunity-creation/index.ts");
  assert.match(
    workflowBoundary,
    /isContactOpportunityCreationUnavailable/u,
    "WF-01 must expose a workflow-specific availability predicate from its public boundary so callers can refuse "
      + "on WF-01 itself rather than on Contact CRUD availability.",
  );

  const availabilitySource = sourceOf(
    "src/workflows/contact-opportunity-creation/application/contactOpportunityAvailability.ts",
  );
  // The predicate must read WF-01's own declaration. Reading any other operation label —
  // a Contact-write label, say — would make WF-01 containment incidental again, which is
  // exactly the defect M6 closes.
  assert.match(
    availabilitySource,
    /isBusinessOperationUnavailable\(\s*CONTACT_OPPORTUNITY_CREATION_OPERATION\s*\)/u,
    "The WF-01 availability predicate must read the WF-01 operation constant that the connected composition declares, "
      + "so the predicate and the binding can never disagree and cannot silently start tracking another aggregate.",
  );

  // 3b. Every presentation handler that performs WF-01 refuses on the WF-01 predicate.
  //
  // WF-01 semantics = create an opportunity for a Contact AND link the Contact to it
  // (status `has_open_opportunity` / Contact opportunity activity). A handler that does
  // both implements WF-01, whether or not it calls the workflow boundary.
  const wf01Handlers: { file: string; handler: string; body: string }[] = [];
  for (const file of sourceFiles) {
    if (!/\/presentation\//u.test(file)) continue;
    const text = read.get(file)!;
    for (const match of text.matchAll(/const\s+(handle[A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?\([^)]*\)?[^=]*=>\s*\{/gu)) {
      const open = text.indexOf("{", match.index! + match[0].length - 1);
      const body = balanced(text, open, "{}");
      const createsOpportunity = /executeContactOpportunityCreation|createDealCommand|createDealSnapshot/u.test(body);
      const linksContact = /has_open_opportunity|executeContactOpportunityCreation/u.test(body);
      if (createsOpportunity && linksContact) {
        wf01Handlers.push({ file: relative(file), handler: match[1], body });
      }
    }
  }
  // Pinned so the scan can never pass vacuously: if a handler is renamed, moved or a new
  // WF-01 entry point appears, this fails until the inventory is reviewed.
  assert.deepEqual(
    wf01Handlers.map((entry) => `${entry.file} -> ${entry.handler}`).sort(),
    [
      "src/modules/contacts/presentation/hooks/useContactDetailController.tsx -> handleCreateOpportunity",
      "src/modules/contacts/presentation/hooks/useContactListController.tsx -> handleCommitOpportunity",
    ],
    "The WF-01 caller inventory must match exactly; a new or renamed Contact-opportunity handler must be reviewed.",
  );

  const unguarded = wf01Handlers.filter((entry) => !/isContactOpportunityCreationUnavailable|refuseUnavailableContactOpportunity/u.test(entry.body));
  assert.deepEqual(
    unguarded.map((entry) => `${entry.file} -> ${entry.handler}`),
    [],
    "A connected handler that creates an opportunity for a Contact and links the Contact to it performs WF-01. "
      + "WF-01 is BLOCKED with connectedFrontendCoordinatorAllowed:false, so the handler must refuse on the "
      + "WF-01 availability predicate before any mutation.",
  );

  // 3c. The WF-01 refusal must not be *replaced* by a Contact-write check. A handler whose
  // only guard is Contact-write availability regains reachability the day `updateContact`
  // lands, while WF-01 is still BLOCKED.
  for (const entry of wf01Handlers) {
    const guardIndex = entry.body.search(/isContactOpportunityCreationUnavailable|refuseUnavailableContactOpportunity/u);
    const firstMutation = entry.body.search(/executeContactOpportunityCreation\(|createDealCommand\(|createDealSnapshot\(|createTaskCommand\(/u);
    assert.ok(
      guardIndex >= 0 && guardIndex < firstMutation,
      `${entry.file} -> ${entry.handler} must consult the WF-01 availability predicate before its first mutation, `
        + "so connected mode performs zero Deal, Contact or Task writes while WF-01 is unavailable.",
    );
  }

  // 3d. The local coordinator stays out of the connected runtime: only the demo bundle may
  // wire the local WF-01 runtime.
  const localRuntimeImporters = sourceFiles
    .filter((file) => read.get(file)!.includes("runtime/createContactOpportunityCreationRuntime"))
    .map(relative)
    .filter((file) => file !== "src/workflows/contact-opportunity-creation/runtime/createContactOpportunityCreationRuntime.ts");
  assert.deepEqual(
    localRuntimeImporters.sort(),
    ["src/app/composition/demoApplicationServiceBundle.ts"],
    "The local WF-01 coordinator runtime may only be wired by the demo composition. Any other importer risks a "
      + "connected fallback to local workflow authority.",
  );
}

// ---------------------------------------------------------------------------
// 4. WF-04 — Customer Commercial Actions.
//
// WF-04 has no ports and no composition binding: the workflow module calls the module
// commands directly. Containment therefore has to live in the workflow function itself
// plus its callers, but the availability declaration still comes from the connected
// composition so the runtime and the predicate stay in lockstep.
// ---------------------------------------------------------------------------

const wf04 = ownership.workflows.find((workflow) => workflow.workflowId === "WF-04");
assert.ok(wf04, "WF-04 must exist in canonical workflow ownership.");
assert.equal(wf04.name, "customer-commercial-actions", "WF-04 must remain customer-commercial-actions.");

if (wf04.connectedFrontendCoordinatorAllowed === false && wf04.contractReadiness === "BLOCKED") {
  // 4a. The workflow boundary exposes its own availability predicate, reading its own
  // declared operation — not Customer, Deal or Task availability.
  const wf04Boundary = sourceOf("src/workflows/customer-commercial-actions/index.ts");
  assert.match(
    wf04Boundary,
    /isCustomerCommercialActionsUnavailable/u,
    "WF-04 must expose a workflow-specific availability predicate so callers can refuse on WF-04 itself rather than "
      + "on Customer, Deal or Task availability.",
  );

  const wf04Availability = sourceOf(
    "src/workflows/customer-commercial-actions/application/customerCommercialActionsAvailability.ts",
  );
  assert.match(
    wf04Availability,
    /isBusinessOperationUnavailable\(\s*CUSTOMER_COMMERCIAL_ACTIONS_OPERATION\s*\)/u,
    "The WF-04 availability predicate must read the WF-04 operation constant that the connected composition declares.",
  );

  // 4b. The connected composition declares WF-04 unavailable.
  // Match the declaration call, not merely the imported identifier: deleting the call while
  // leaving the import must fail this gate.
  assert.match(
    connectedWorkflows,
    /declareUnavailableConnectedWorkflow\(\s*CUSTOMER_COMMERCIAL_ACTIONS_OPERATION\s*\)/u,
    "The connected workflow composition must declare WF-04 unavailable, so the predicate and the runtime cannot "
      + "disagree about whether the frontend may coordinate it.",
  );

  // 4c. The workflow function itself refuses before its first authoritative command.
  // `deal.create` and `task.create` are both PRODUCTION_CONTRACT_READY, so an unguarded
  // entry commits a real Deal before anything notices WF-04 is blocked.
  const coordinatorBody = balanced(
    wf04Boundary,
    wf04Boundary.indexOf("{", wf04Boundary.search(/export async function createDealForCustomer/u)),
    "{}",
  );
  const wf04Guard = coordinatorBody.search(/isCustomerCommercialActionsUnavailable|assertCustomerCommercialActionsAvailable/u);
  const wf04FirstMutation = coordinatorBody.search(/createDealCommand\(|createTaskCommand\(/u);
  assert.ok(
    wf04Guard >= 0 && wf04Guard < wf04FirstMutation,
    "createDealForCustomer must refuse on WF-04 availability before its first authoritative command, so connected "
      + "mode cannot commit a Deal for a workflow the frontend is not allowed to coordinate.",
  );

  // 4d. Every presentation caller refuses first too, so the user is told the action is
  // unavailable instead of the coordinator throwing out of an event handler.
  const wf04Callers = sourceFiles
    .filter((file) => /\/presentation\//u.test(file) && read.get(file)!.includes("createDealForCustomer"))
    .map(relative);
  assert.deepEqual(
    wf04Callers.sort(),
    ["src/modules/customers/presentation/pages/Customer360Page.tsx"],
    "The WF-04 caller inventory must match exactly; a new Customer commercial-action entry point must be reviewed.",
  );
  for (const caller of wf04Callers) {
    const text = sourceOf(caller);
    const guard = text.search(/isCustomerCommercialActionsUnavailable|refuseUnavailableCustomerCommercialAction/u);
    const call = text.search(/createDealForCustomer\(/u);
    assert.ok(
      guard >= 0 && guard < call,
      `${caller} must consult the WF-04 availability predicate before calling createDealForCustomer.`,
    );
  }

  // 4e. WF-04 must not gain frontend compensation. Rolling a committed Deal back when the
  // follow-up Task fails would be more frontend workflow ownership, not less.
  assert.doesNotMatch(
    wf04Boundary,
    /archiveDealCommand|deleteDeal|closeDealLostCommand|rollback/iu,
    "WF-04 must not compensate a committed Deal from the frontend. Compensation is BACKEND-owned; if the backend "
      + "workflow does not exist, fail closed instead.",
  );
}

// ---------------------------------------------------------------------------
// 5. WF-21 — Work Activation.
//
// WF-21 is the Deal <-> Task coordination: establishing a Deal's next action AND
// materialising it as a Task. Neither command alone is the workflow — `deal.create`,
// `deal.update-next-action` and `task.create` are each individually authoritative. The
// workflow is the *sequence*, which is exactly what a coordinator-forbidden workflow may
// not be assembled from in the frontend.
//
// Single-command activation is deliberately NOT in scope: `activateAiSuggestedTask` issues
// one authoritative `task.create` and mutates no Deal, so there is no coordination and no
// partial commit to own.
// ---------------------------------------------------------------------------

const wf21 = ownership.workflows.find((workflow) => workflow.workflowId === "WF-21");
assert.ok(wf21, "WF-21 must exist in canonical workflow ownership.");
assert.equal(wf21.name, "work-activation", "WF-21 must remain work-activation.");

if (wf21.connectedFrontendCoordinatorAllowed === false && wf21.contractReadiness === "BLOCKED") {
  // 5a. The workflow boundary exposes its own availability predicate.
  const wf21Boundary = sourceOf("src/workflows/work-activation/index.ts");
  assert.match(
    wf21Boundary,
    /isWorkActivationUnavailable/u,
    "WF-21 must expose a workflow-specific availability predicate so callers can refuse on WF-21 itself rather than "
      + "on Deal or Task command availability.",
  );

  const wf21Availability = sourceOf("src/workflows/work-activation/application/workActivationAvailability.ts");
  assert.match(
    wf21Availability,
    /isBusinessOperationUnavailable\(\s*WORK_ACTIVATION_OPERATION\s*\)/u,
    "The WF-21 availability predicate must read the WF-21 operation constant that the connected composition declares.",
  );

  // 5b. The connected composition declares WF-21 unavailable.
  assert.match(
    connectedWorkflows,
    /declareUnavailableConnectedWorkflow\(\s*WORK_ACTIVATION_OPERATION\s*\)/u,
    "The connected workflow composition must declare WF-21 unavailable.",
  );

  // 5c. The activation boundary itself refuses before its authoritative command.
  const activationBody = balanced(
    wf21Boundary,
    wf21Boundary.indexOf("{", wf21Boundary.search(/export async function ensureDealNextActionTask/u)),
    "{}",
  );
  const activationGuard = activationBody.search(/assertWorkActivationAvailable|isWorkActivationUnavailable/u);
  const activationMutation = activationBody.search(/createTaskCommand\(/u);
  assert.ok(
    activationGuard >= 0 && activationGuard < activationMutation,
    "ensureDealNextActionTask must refuse on WF-21 availability before creating the Task.",
  );

  // Single-command AI activation must NOT be gated: it is not a coordination.
  const aiBody = balanced(
    wf21Boundary,
    wf21Boundary.indexOf("{", wf21Boundary.search(/export async function activateAiSuggestedTask/u)),
    "{}",
  );
  assert.doesNotMatch(
    aiBody,
    /assertWorkActivationAvailable|isWorkActivationUnavailable/u,
    "activateAiSuggestedTask issues one authoritative task.create and mutates no Deal. Gating it would disable a "
      + "legitimate single authoritative command, not close an ownership violation.",
  );

  // 5d. Every caller that sequences a Deal mutation with activation must refuse first.
  // Detection is by shape, not by helper name: a handler that mutates a Deal and activates
  // work in the same body performs WF-21 however the helper is spelled.
  const dealMutation = /createDealCommand\(|updateDealNextActionCommand\(/u;
  const activationCall = /ensureDealNextActionTask\(/u;
  const wf21Handlers: { file: string; handler: string; body: string }[] = [];
  for (const file of sourceFiles) {
    if (!/\/presentation\//u.test(file)) continue;
    const text = read.get(file)!;
    for (const match of text.matchAll(/(?:const|async function)\s+([A-Za-z0-9_$]+)\s*=?\s*(?:async\s*)?\([^)]*\)?[^=;{]*(?:=>)?\s*\{/gu)) {
      const open = text.indexOf("{", match.index! + match[0].length - 1);
      if (open < 0) continue;
      const body = balanced(text, open, "{}");
      if (dealMutation.test(body) && activationCall.test(body)) {
        wf21Handlers.push({ file: relative(file), handler: match[1], body });
      }
    }
  }
  // Pinned so the scan can never pass vacuously: a renamed, moved or new Deal
  // work-activation handler must be reviewed rather than silently dropping out of scope.
  assert.deepEqual(
    wf21Handlers.map((entry) => `${entry.file} -> ${entry.handler}`).sort(),
    [
      "src/modules/deals/presentation/hooks/useDealPipelineController.ts -> handleAddDealSubmit",
      "src/modules/deals/presentation/hooks/useDealPipelineController.ts -> handleEditDealSubmit",
      "src/modules/organizations/presentation/detail/OrganizationCreateOpportunityModal.tsx -> submit",
    ],
    "The WF-21 caller inventory must match exactly.",
  );

  for (const entry of wf21Handlers) {
    const guard = entry.body.search(/isWorkActivationUnavailable|refuseUnavailableWorkActivation/u);
    const firstMutation = entry.body.search(dealMutation);
    assert.ok(
      guard >= 0 && guard < firstMutation,
      `${entry.file} -> ${entry.handler} sequences a Deal mutation with work activation, which is WF-21. It must `
        + "refuse on WF-21 availability before its first Deal mutation, so connected mode cannot commit the Deal and "
        + "then discover the activation is not allowed.",
    );
  }

  // 5e. No Deal-create -> Task-create -> Deal-update relinking workaround, and no
  // Task-first reorder. Both would add coordination rather than remove it.
  // Matched against code only: the boundary's doc comments deliberately *name* these
  // fields to record the M3 rule, and prose must not trip the gate.
  assert.doesNotMatch(
    stripComments(wf21Boundary),
    /nextActionTaskId|nextActionRef\s*[:=]|updateDealNextActionCommand/u,
    "WF-21 must not write a Task foreign reference back onto the Deal. The Task id is server-assigned and relinking "
      + "would be a third frontend-coordinated commit.",
  );
}

console.log(
  `quality.workflow-coordinator-ownership: ${coordinatorForbidden.length} coordinator-forbidden workflows; `
    + `${blockedCoordinatorForbidden.length} blocked and connected-bound, of which `
    + `${blockedCoordinatorForbidden.length - awaitingWorkflowOwnedDeclaration.length} declare their own connected `
    + `unavailability and ${awaitingWorkflowOwnedDeclaration.length} remain pinned for later phases.`,
);
