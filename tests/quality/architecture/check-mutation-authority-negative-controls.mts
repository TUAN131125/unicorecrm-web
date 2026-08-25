import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";

/**
 * Negative controls for the mutation-authority gates (M11).
 *
 * Every gate in this family reports PASS today. That is only meaningful if the gate would
 * report FAIL when the defect it names is actually reintroduced — and M11 found several
 * that would not have: an AI Task-identity assertion that could never fail, an error-safety
 * scan whose sink list did not name the sinks that were leaking, and a partial-commit check
 * satisfied by text inside an unreachable branch.
 *
 * So each critical invariant carries an executable proof here. A control reintroduces the
 * real production defect in the real source file, runs the gate, and requires it to fail.
 * Nothing is asserted about wording — only that known-bad architecture is rejected and
 * known-good architecture is accepted.
 *
 * Safety (M11 §19): the file's exact bytes are captured before the edit and restored in a
 * `finally`, the restored content is verified by SHA-256, and a journal on disk records the
 * original bytes for the whole window so an interrupted run can be recovered on the next
 * one. This gate must never leave a mutation in the working tree.
 */

const root = repositoryRoot;
const journalPath = path.join(root, "node_modules", ".cache", "m11-negative-control-journal.json");

interface NegativeControl {
  /** Stable id, used in the reported matrix. */
  readonly id: string;
  /** The invariant this control defends. */
  readonly invariant: string;
  /** Gate expected to reject the mutation. */
  readonly gate: string;
  /** Repository-relative production or test file to mutate. */
  readonly file: string;
  /** Exact text to replace; must appear at least once. */
  readonly find: string;
  /** The defect to reintroduce. */
  readonly replace: string;
  /** What the mutation represents, for the failure message. */
  readonly defect: string;
  /**
   * Replace every occurrence rather than the first.
   *
   * Needed when the invariant is set membership: removing one of several equivalent
   * declarations proves nothing, because the remaining ones still satisfy it.
   */
  readonly replaceAll?: boolean;
}

/**
 * One control per invariant whose reintroduction is cheap to express as a local edit.
 *
 * Invariants whose defect cannot be reproduced by a single local substitution — a whole
 * missing preflight, a contract change — are covered by the gates' own derived inventories
 * instead, and recorded as such in the M11 coverage matrix rather than faked here.
 */
const controls: readonly NegativeControl[] = [
  {
    id: "MA-01/MA-02-dedicated-dispatch",
    invariant: "MA-02 — dedicated commands must not be routed through the generic authority",
    gate: "quality.dedicated-module-command-dispatch",
    file: "src/platform/api/runtime/RoutedHttpMutationAuthority.ts",
    find: "PRODUCTION_COMMAND_CONTRACTS",
    replace: "PRODUCTION_COMMAND_CONTRACTS_DISABLED_BY_NEGATIVE_CONTROL",
    defect: "the routed authority stops deriving its contract set from the canonical registry",
  },
  {
    id: "MA-03-task-identity",
    invariant: "MA-03 — a client-generated Task identity must not become a Deal Task reference",
    gate: "quality.server-assigned-task-identity",
    file: "src/modules/deals/presentation/hooks/useDealPipelineController.ts",
    find: "        run: () => updateDealNextActionCommand(editingDeal.id, {\n          nextActionAt,",
    replace: "        run: () => updateDealNextActionCommand(editingDeal.id, {\n          taskId: `task_deal_${editingDeal.id}`,\n          nextActionAt,",
    defect: "the M3 defect verbatim: a deterministic client Task key is sent as UpdateDealNextActionRequest.taskId",
  },
  {
    id: "MA-06-wf21-preflight",
    invariant: "MA-06 — a coordinator-forbidden workflow must refuse before its first mutation",
    gate: "quality.wf21-work-activation-ownership",
    file: "src/workflows/work-activation/index.ts",
    find: "assertWorkActivationAvailable",
    replace: "skipWorkActivationAvailabilityCheckForNegativeControl",
    defect: "the WF-21 boundary loses its availability assertion",
  },
  {
    id: "MA-06-wf04-declaration",
    invariant: "MA-06 — connected composition must declare a coordinator-forbidden workflow unavailable",
    gate: "quality.workflow-coordinator-ownership",
    file: "src/app/composition/connected/connectedWorkflowServices.ts",
    find: "declareUnavailableConnectedWorkflow(CUSTOMER_COMMERCIAL_ACTIONS_OPERATION)",
    replace: "void CUSTOMER_COMMERCIAL_ACTIONS_OPERATION",
    defect: "WF-04's connected unavailability declaration is removed while the import stays",
  },
  {
    id: "MA-07-outcome-guard",
    invariant: "MA-07 — a partial commit must be reported, not discarded",
    gate: "quality.partial-commit-outcomes",
    file: "src/modules/deals/presentation/hooks/useDealPipelineController.ts",
    find: 'if (report.status !== "FULL_SUCCESS") {',
    replace: "if (report.committed.length >= 0 && false) {",
    defect: "the partial-commit branch is left in place but made unreachable",
  },
  {
    id: "MA-07-committed-evidence",
    invariant: "MA-07 — the committed steps must be named, not only the failure",
    gate: "quality.partial-commit-outcomes",
    file: "src/modules/deals/presentation/hooks/useDealPipelineController.ts",
    find: "committed: describe(report.committed.map((entry) => entry.step)),",
    replace: 'committed: "",',
    defect: "the committed half of a partial outcome is dropped from the user-facing report",
  },
  {
    id: "MA-08-error-model",
    invariant: "MA-08 — the error model must not promote an internal diagnostic to user copy",
    gate: "quality.user-facing-error-safety",
    file: "src/shared/application/mutation/mutationAuthority.ts",
    find: "message: options.message",
    replace: "message: options.message,\n      userMessage: options.userMessage ?? options.message",
    defect: "MutationCommandError defaults `userMessage` back to the internal diagnostic",
  },
  {
    id: "MA-08-presentation-sink",
    invariant: "MA-08 — presentation must not render raw exception text",
    gate: "quality.user-facing-error-safety",
    file: "src/workflows/lead-qualification/presentation/pages/LeadSellNowPage.tsx",
    find: "setError(formatApplicationError(caught, { locale }));",
    replace: "setError(caught instanceof Error ? caught.message : String(caught));",
    defect: "a real presentation surface renders the raw exception message again",
  },
  {
    id: "MA-08-formatter",
    invariant: "MA-08 — the central formatter must map architecture refusals to safe copy",
    gate: "quality.user-facing-error-presentation",
    file: "src/shared/operations/errorPresentation.ts",
    find: "export function isUnsafeForDisplay(code: string): boolean {\n  return UNSAFE_FOR_DISPLAY_CODES.has(code);",
    replace: "export function isUnsafeForDisplay(code: string): boolean {\n  return false && UNSAFE_FOR_DISPLAY_CODES.has(code);",
    defect: "the formatter stops recognising architecture refusals and renders their diagnostics",
  },
  {
    id: "MA-07-controller-surface",
    invariant: "MA-07 — the React caller must actually surface the partial outcome",
    gate: "quality.partial-commit-controller-runtime",
    file: "src/modules/leads/presentation/hooks/useLeadDetailController.tsx",
    find: 'showToast(callReport.status === "PARTIAL_SUCCESS"',
    replace: 'showToast(false && callReport.status === "PARTIAL_SUCCESS"',
    defect: "the controller computes a correct report and then reports only the failure",
  },
  {
    id: "DF-20-transitive-barrel",
    invariant: "Composition must not depend on presentation, even transitively",
    gate: "quality.composition-presentation-dependency",
    file: "src/app/composition/connected/connectedWorkflowServices.ts",
    find: 'import { CUSTOMER_COMMERCIAL_ACTIONS_OPERATION } from "@/workflows/customer-commercial-actions/application/customerCommercialActionsAvailability";',
    replace: 'import { CUSTOMER_COMMERCIAL_ACTIONS_OPERATION } from "@/workflows/customer-commercial-actions";',
    defect: "the exact M7 regression: a barrel import that names nothing about presentation",
  },
  {
    id: "DF-03-ai-task-identity",
    invariant: "MA-03 — a blocked AI action must create no Task, provably",
    gate: "quality.ai-application-contracts",
    file: "src/ai/application/aiActionApplicationService.ts",
    find: "  if (!decision.allowed) {",
    replace: "  if (false && !decision.allowed) {",
    defect: "a blocked governance decision stops preventing Task creation",
  },
  {
    id: "MA-02-blocked-containment",
    invariant: "MA-02 — a canonical BLOCKED command must stay unreachable in connected mode",
    gate: "quality.blocked-command-containment",
    file: "src/shared/application/mutation/mutationAuthorityBinding.ts",
    find: "export function isMutationCommandUnavailable",
    replace: "export function isMutationCommandUnavailableDisabledByNegativeControl",
    defect: "the BLOCKED-command predicate the boundaries consult disappears",
  },
  {
    id: "MA-04-post-commit-projection",
    invariant: "MA-04 — presentation must not write the authoritative projection after a commit",
    gate: "quality.post-commit-projection-writes",
    file: "src/modules/deals/presentation/hooks/useDealPipelineController.ts",
    find: "    setIsEditModalOpen(false);\n    setEditingDeal(null);",
    replace: "    replaceDeals(getDealsSnapshot());\n    setIsEditModalOpen(false);\n    setEditingDeal(null);",
    defect: "the success path patches the Deal repository locally to imitate the committed result",
  },
  {
    id: "MA-05-scope-reset",
    invariant: "MA-05 — workspace scope eviction must go through the infrastructure reset authority",
    gate: "quality.workspace-scope-reset",
    file: "src/shared/operations/useModuleAuthoritativeResource.ts",
    find: "runWorkspaceScopeReset(() => options.onScopeChange?.());",
    replace: "options.onScopeChange?.();",
    defect: "a scope reset performs an ordinary local projection write instead of an authorized reset",
  },
  {
    id: "MA-09-unavailable-port",
    invariant: "MA-09 — an unavailable connected operation must stay declared and refused",
    gate: "quality.connected-unavailable-port-containment",
    file: "src/modules/deals/public/deals.ts",
    find: 'return isBusinessOperationUnavailable("Deal stage reset");',
    replace: "return false;",
    defect: "an unavailable connected operation reports itself as available to its callers",
  },
  {
    id: "MA-01-platform-configuration-write",
    invariant: "MA-01 — connected mode must not persist workspace configuration in the browser behind a backend read",
    gate: "quality.connected-platform-configuration-authority",
    file: "src/platform/configuration-runtime/configurationRuntime.ts",
    find: "  assertConfigurationOperationAvailable(CRM_OBJECT_SCHEMA_SAVE_OPERATION);",
    replace: "  void CRM_OBJECT_SCHEMA_SAVE_OPERATION;",
    defect: "the M12 defect verbatim: a browser-persisted CRM object-schema write loses its connected-mode guard while "
      + "listCrmObjectSchemas stays an authoritative backend read",
  },
  {
    id: "MA-01-platform-configuration-preflight",
    invariant: "MA-01 — the Studio surface must refuse before a non-authoritative configuration write",
    gate: "quality.connected-platform-configuration-authority",
    file: "src/workspaces/studio/presentation/views/WebhooksApiView.tsx",
    find: "    if (isDeveloperWebhookSaveUnavailable()) {",
    replace: "    if (isDeveloperWebhookSaveUnavailable() && false) {",
    defect: "the Studio webhook preflight is left in place but made unreachable",
  },
  {
    id: "MA-06-wf12-declaration",
    invariant: "MA-06 — WF-12 order-closing must own its own connected refusal",
    gate: "quality.workflow-coordinator-ownership",
    file: "src/app/composition/connected/connectedWorkflowServices.ts",
    // The declaration is set membership, so removing one member proves nothing while the
    // others still declare WF-12. The defect is the binding declaring nothing at all, which
    // is what the pre-M12 source did: fail closed at each port, name no workflow.
    find: "unavailableConnectedOperation(ORDER_CLOSING_OPERATION)",
    replace: "() => connectedOperationUnavailable(\"Order closing local operation\")",
    replaceAll: true,
    defect: "WF-12 reverts to failing closed at each port without declaring the workflow, so callers can only inherit "
      + "another aggregate's protection",
  },
  {
    id: "MA-08-inline-formatter-alias",
    invariant: "MA-08 — raw exception text must not reach the user through an alias of the catch binding",
    gate: "quality.user-facing-error-safety",
    file: "src/workflows/lead-qualification/presentation/pages/LeadSellNowPage.tsx",
    find: "setError(formatApplicationError(caught, { locale }));",
    replace: "setError(((e: unknown) => String((e as Error).message))(caught));",
    defect: "the M12 shape: the exception is passed into an inline formatter, so every dangerous read lands on the "
      + "arrow parameter instead of the catch binding",
  },
  {
    id: "MA-01-configuration-guard-alias",
    invariant: "MA-01 — the configuration guard must be the real imported assertion",
    gate: "quality.connected-platform-configuration-authority",
    file: "src/platform/integrations/integrationConfigurationRuntime.ts",
    find: "  assertConfigurationOperationAvailable,",
    replace: "  assertConfigurationOperationAvailable as assertConfigurationOperationAvailableUnused,",
    defect: "the guard is neutralised by import aliasing while every call site still reads as though it were guarded",
  },
];;

// ---------------------------------------------------------------------------
// Journal recovery: restore anything a previous interrupted run left behind.
// ---------------------------------------------------------------------------

function recoverJournal(): void {
  if (!fs.existsSync(journalPath)) return;
  const entries = JSON.parse(fs.readFileSync(journalPath, "utf8")) as { file: string; base64: string }[];
  for (const entry of entries) {
    fs.writeFileSync(path.join(root, entry.file), Buffer.from(entry.base64, "base64"));
  }
  fs.rmSync(journalPath, { force: true });
  console.log(`quality.mutation-authority-negative-controls: recovered ${entries.length} file(s) from an interrupted run.`);
}
recoverJournal();

/**
 * This gate edits real source files for the duration of each control, so it must never run
 * while another gate is reading the tree. The pipeline runs gates sequentially; sharding
 * would break that assumption, so refuse rather than risk a sibling shard observing a
 * mutated file and reporting a phantom violation.
 */
assert.equal(
  process.env.QUALITY_SHARD ?? "",
  "",
  "quality.mutation-authority-negative-controls mutates source files in place and must run unsharded, so no other "
    + "gate can observe a transient mutation. Run it without QUALITY_SHARD.",
);

const sha256 = (buffer: Buffer) => crypto.createHash("sha256").update(buffer).digest("hex");

function runGate(gateId: string): { ok: boolean; output: string } {
  const result = spawnSync(
    process.execPath,
    [path.join(root, "scripts/quality/run-quality-pipeline.mjs"), "--gate", gateId],
    { cwd: root, encoding: "utf8", timeout: 300_000 },
  );
  return { ok: result.status === 0, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

// ---------------------------------------------------------------------------
// Run the matrix.
// ---------------------------------------------------------------------------

const failures: string[] = [];
const proven: string[] = [];

/**
 * Baseline: every gate under control must PASS on the unmodified tree first.
 *
 * Without this the whole matrix can pass vacuously. A control asserts "the gate fails when
 * the defect is present" — but a gate that is *already* failing satisfies that for the wrong
 * reason, and the control reports itself proven while proving nothing. M12 hit exactly this:
 * a change to workflow-owned refusal broke `quality.blocked-command-containment`, and its
 * control still reported PASS.
 *
 * Each distinct gate is run once here and the result reused, so this costs one run per gate,
 * not one per control.
 */
const baseline = new Map<string, boolean>();
for (const gate of new Set(controls.map((control) => control.gate))) {
  baseline.set(gate, runGate(gate).ok);
}
const alreadyFailing = [...baseline.entries()].filter(([, ok]) => !ok).map(([gate]) => gate);
assert.deepEqual(
  alreadyFailing,
  [],
  "Every gate under negative control must PASS on the unmodified tree before its control runs. A gate that is "
    + "already failing would satisfy its control for the wrong reason and report itself proven while proving "
    + "nothing. Fix these gates first: " + alreadyFailing.join(", "),
);

for (const control of controls) {
  const absolute = path.join(root, control.file);
  assert.ok(fs.existsSync(absolute), `${control.id}: ${control.file} must exist.`);

  const original = fs.readFileSync(absolute);
  const originalHash = sha256(original);
  const text = original.toString("utf8");
  assert.ok(
    text.includes(control.find),
    `${control.id}: the control's anchor is no longer present in ${control.file}. The code moved; re-point the `
      + "control rather than deleting it, or the invariant loses its proof.\nAnchor: " + control.find,
  );

  fs.mkdirSync(path.dirname(journalPath), { recursive: true });
  fs.writeFileSync(journalPath, JSON.stringify([{ file: control.file, base64: original.toString("base64") }]));

  try {
    const mutatedSource = control.replaceAll === true
      ? text.split(control.find).join(control.replace)
      : text.replace(control.find, control.replace);
    assert.notEqual(mutatedSource, text, `${control.id}: the control must actually change the file it mutates.`);
    fs.writeFileSync(absolute, Buffer.from(mutatedSource, "utf8"));
    const mutated = runGate(control.gate);
    if (mutated.ok) {
      failures.push(
        `${control.id} (${control.gate})\n    invariant: ${control.invariant}\n    defect:    ${control.defect}\n`
          + "    The gate still PASSED with the defect present, so it does not actually defend this invariant.",
      );
    } else {
      proven.push(`${control.id} -> ${control.gate}`);
    }
  } finally {
    fs.writeFileSync(absolute, original);
    const restoredHash = sha256(fs.readFileSync(absolute));
    fs.rmSync(journalPath, { force: true });
    assert.equal(
      restoredHash,
      originalHash,
      `${control.id}: ${control.file} was not restored byte-for-byte. Restore it from git before continuing.`,
    );
  }
}

assert.deepEqual(
  failures,
  [],
  "A mutation-authority gate reported PASS while the defect it exists to catch was present in the source. A gate "
    + `that cannot fail is not a gate:\n\n  ${failures.join("\n\n  ")}`,
);

assert.equal(
  fs.existsSync(journalPath),
  false,
  "The negative-control journal must be empty when the gate finishes; a leftover journal means a mutation may still "
    + "be in the working tree.",
);

console.log(
  `quality.mutation-authority-negative-controls: PASS (${proven.length} controls proven; every mutated source file `
    + "restored byte-for-byte)\n  " + proven.join("\n  "),
);
