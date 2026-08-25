import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import { loadQualityManifest } from "../../../scripts/quality/core/quality-manifest.mjs";

/**
 * Mutation-authority coverage registration (M11).
 *
 * The invariants in `docs/ai/ARCHITECTURE_INVARIANTS.md` are each defended by one or more
 * focused gates. Those gates do the actual analysis; this one does none of it. Its only job
 * is to make the coverage itself a checked property, so an invariant cannot lose its
 * defence quietly — by a gate being dropped from the pipeline, renamed, or left in the tree
 * but never run.
 *
 * It deliberately does NOT re-scan source. A single gate containing all the architecture
 * logic would be the thing hardest to keep honest, and the M11 audit exists precisely
 * because broad gates hide weak assertions.
 */

const root = repositoryRoot;
const manifest = loadQualityManifest();
const registeredGateIds = new Set<string>(manifest.gates.map((gate: { id: string }) => gate.id));
const gatesInGroups = new Set<string>(manifest.groups.flatMap((group: { gates: string[] }) => group.gates));

/**
 * Every mutation-authority invariant, with the gates that defend it.
 *
 * `runtime` marks gates that execute the behaviour rather than reading the source. An
 * invariant proven only by source shape is recorded as such rather than described as
 * verified behaviour — M11's whole premise is that the two are not the same.
 */
interface InvariantCoverage {
  readonly invariant: string;
  readonly summary: string;
  readonly gates: readonly string[];
  readonly runtime: readonly string[];
  /** Documented limits of what these gates can prove. */
  readonly limits: string;
}

const coverage: readonly InvariantCoverage[] = [
  {
    invariant: "MA-01",
    summary: "Connected business mutations are backend-authoritative",
    gates: [
      "quality.routed-mutation-authority",
      "quality.mutation-command-authority",
      "quality.authoritative-module-adapters",
      "quality.connected-platform-configuration-authority",
    ],
    runtime: ["quality.connected-backend-integration"],
    limits: "Backend behaviour itself is never executed; the connected contract packs assert wire shape only. The "
      + "browser-write half of MA-01 — a backend read paired with a local write — is falsifiable and carries "
      + "negative controls; the positive half, that the backend really is the authority, is not.",
  },
  {
    invariant: "MA-02",
    summary: "Canonical BLOCKED commands are unreachable as connected production mutations",
    gates: ["quality.dedicated-module-command-dispatch", "quality.blocked-command-containment"],
    runtime: ["quality.blocked-command-containment"],
    limits: "Derived from the canonical command registry; a registry error would propagate into the gate.",
  },
  {
    invariant: "MA-03",
    summary: "Client intent identifiers never become server-assigned aggregate references",
    gates: ["quality.server-assigned-task-identity"],
    runtime: ["quality.server-assigned-task-identity-contracts", "quality.ai-application-contracts"],
    limits: "Identity flow is matched by value shape and one level of aliasing, not by full data-flow analysis.",
  },
  {
    invariant: "MA-04",
    summary: "No post-commit local write to an authoritative projection",
    gates: ["quality.post-commit-projection-writes"],
    runtime: [],
    limits: "Demo-only writes are recognised by a positional, pure mode guard; an obscured guard shape reads as a violation, not as an exemption.",
  },
  {
    invariant: "MA-05",
    summary: "Workspace scope eviction is infrastructure-owned",
    gates: ["quality.workspace-scope-reset"],
    runtime: ["quality.workspace-scope-reset"],
    limits: "Proven for the shared authoritative-resource hooks; a module that hand-rolls its own reset would need its own case.",
  },
  {
    invariant: "MA-06",
    summary: "Coordinator-forbidden workflows are not assembled from module commands in connected mode",
    gates: [
      "quality.workflow-coordinator-ownership",
      "quality.wf01-contact-opportunity-ownership",
      "quality.wf04-customer-commercial-actions-ownership",
      "quality.wf21-work-activation-ownership",
    ],
    runtime: [
      "quality.wf01-contact-opportunity-ownership",
      "quality.wf04-customer-commercial-actions-ownership",
      "quality.wf21-work-activation-ownership",
    ],
    limits: "Caller inventories are pinned deliberately: a new entry point must be reviewed rather than inferred.",
  },
  {
    invariant: "MA-07",
    summary: "Partial commits are preserved and reported, never discarded",
    gates: ["quality.partial-commit-outcomes"],
    runtime: ["quality.partial-commit-semantics", "quality.partial-commit-controller-runtime"],
    limits: "One representative controller is executed end to end; the remaining callers are proven by structure plus their pinned classification.",
  },
  {
    invariant: "MA-08",
    summary: "Internal topology never reaches user-facing copy",
    gates: ["quality.user-facing-error-safety"],
    runtime: ["quality.user-facing-error-presentation", "quality.partial-commit-controller-runtime"],
    limits: "Raw exception detection is derived from catch bindings rather than a sink-name list; a diagnostic laundered through an intermediate value would not be seen.",
  },
  {
    invariant: "MA-09",
    summary: "Connected UI does not call business mutations whose binding is unavailable",
    gates: ["quality.connected-business-operation-availability", "quality.connected-unavailable-port-containment"],
    runtime: ["quality.connected-unavailable-port-containment"],
    limits: "Availability declarations are compared against the connected composition; an operation nobody declares is invisible to both.",
  },
  {
    invariant: "DEP-01",
    summary: "Composition and infrastructure do not depend on presentation, even transitively",
    gates: ["quality.composition-presentation-dependency"],
    runtime: [],
    limits: "Static import graph only; dynamic imports are deliberate lazy boundaries and are counted, not traversed.",
  },
];

// ---------------------------------------------------------------------------
// 1. Every declared gate is registered and actually scheduled.
// ---------------------------------------------------------------------------

const missing: string[] = [];
const unscheduled: string[] = [];
for (const entry of coverage) {
  for (const gate of [...entry.gates, ...entry.runtime]) {
    if (!registeredGateIds.has(gate)) missing.push(`${entry.invariant} -> ${gate}`);
    else if (!gatesInGroups.has(gate)) unscheduled.push(`${entry.invariant} -> ${gate}`);
  }
}
assert.deepEqual(
  missing,
  [],
  "A gate named as the defence of a mutation-authority invariant is not registered in the quality pipeline. Either "
    + `restore it or record honestly that the invariant lost its coverage:\n${missing.join("\n")}`,
);
assert.deepEqual(
  unscheduled,
  [],
  "A gate is registered but belongs to no group, so no pipeline run executes it. An unscheduled gate proves "
    + `nothing:\n${unscheduled.join("\n")}`,
);

// ---------------------------------------------------------------------------
// 2. Every invariant in the canonical document is covered.
//
// The list above must not drift away from `ARCHITECTURE_INVARIANTS.md`: a new invariant
// added there has to arrive here with a gate, and a removed one must not linger.
// ---------------------------------------------------------------------------

const invariantsDocument = fs.readFileSync(path.join(root, "docs/ai/ARCHITECTURE_INVARIANTS.md"), "utf8");
const documented = [...invariantsDocument.matchAll(/^##\s+(MA-\d{2})\s+—/gmu)].map((match) => match[1]).sort();
assert.ok(documented.length > 0, "The canonical invariant document must declare MA-numbered invariants.");

const declared = coverage.map((entry) => entry.invariant).filter((id) => id.startsWith("MA-")).sort();
assert.deepEqual(
  declared,
  documented,
  "Every invariant in docs/ai/ARCHITECTURE_INVARIANTS.md must have declared gate coverage here, and this list must "
    + "not claim coverage for an invariant the document no longer states.",
);

// ---------------------------------------------------------------------------
// 3. Every critical invariant carries an executable negative control.
//
// The matrix is read as text on purpose: importing it would run every control as a side
// effect of this gate, and the controls mutate real source files.
// ---------------------------------------------------------------------------

const negativeControlEntry = "tests/quality/architecture/check-mutation-authority-negative-controls.mts";
assert.ok(
  registeredGateIds.has("quality.mutation-authority-negative-controls"),
  "The negative-control gate must be registered. Without it, every gate below is only claimed to work.",
);

const negativeControlSource = fs.readFileSync(path.join(root, negativeControlEntry), "utf8");
const controlledGates = new Set(
  [...negativeControlSource.matchAll(/^\s*gate:\s*"([^"]+)"/gmu)].map((match) => match[1]),
);
assert.ok(controlledGates.size > 8, `The negative-control matrix must be populated (found ${controlledGates.size}).`);

/**
 * Invariants that must have a proven negative control.
 *
 * MA-01 is still excluded deliberately, but the reason is now narrower than M11 recorded.
 * "The backend is the authority" remains unfalsifiable by a local source edit, so no control
 * can prove it. Its *negative* half can be falsified, and since M12 it is: a connected
 * browser write standing behind an authoritative backend read is a concrete defect, and
 * `quality.connected-platform-configuration-authority` carries controls that reintroduce it.
 * Requiring a control for MA-01 as a whole would still claim unearned coverage, so the
 * exclusion stands with the limit recorded against the entry above.
 */
const requireNegativeControl = ["MA-02", "MA-03", "MA-04", "MA-05", "MA-06", "MA-07", "MA-08", "MA-09", "DEP-01"];
const uncontrolled: string[] = [];
for (const entry of coverage) {
  if (!requireNegativeControl.includes(entry.invariant)) continue;
  const defended = [...entry.gates, ...entry.runtime].some((gate) => controlledGates.has(gate));
  if (!defended) uncontrolled.push(`${entry.invariant} — ${entry.summary}`);
}
assert.deepEqual(
  uncontrolled,
  [],
  "A critical mutation-authority invariant has no gate with a proven negative control. A gate that has never been "
    + `shown to fail on the defect it names is not evidence:\n${uncontrolled.join("\n")}`,
);

// ---------------------------------------------------------------------------
// 4. Every invariant states what it does not prove.
// ---------------------------------------------------------------------------

for (const entry of coverage) {
  assert.ok(
    entry.limits.trim().length > 20,
    `${entry.invariant} must record what its gates do NOT prove. Silent coverage claims are how M11's false `
      + "negatives survived ten phases.",
  );
}

const runtimeBacked = coverage.filter((entry) => entry.runtime.length > 0).length;
console.log(
  `quality.mutation-authority-semantic-coverage: PASS (${coverage.length} invariants, `
    + `${new Set(coverage.flatMap((entry) => [...entry.gates, ...entry.runtime])).size} distinct gates registered and `
    + `scheduled, ${runtimeBacked} invariants with runtime-behaviour coverage, `
    + `${controlledGates.size} gates carrying negative controls).`,
);
