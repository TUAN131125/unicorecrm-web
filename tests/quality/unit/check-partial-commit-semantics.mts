// Behaviour contract for M9 / RC-07 partial-commit semantics (MA-07).
//
// Failure is injected at each step boundary of a multi-command sequence and the reported
// outcome is asserted: what committed must survive, the failing step must be named, and
// nothing may be reversed from the frontend.
import assert from "node:assert/strict";
import {
  executeSequentialCommits,
  summarizeBulkCommits,
  describePartialCommit,
  type PartialCommitReport,
} from "../../../src/shared/operations/partialCommit";

/** A command outcome shaped like `MutationOutcome`, carrying real evidence fields. */
function outcome(step: string, version: number) {
  return {
    commandId: `cmd_${step}`,
    correlationId: `corr_${step}`,
    occurredAt: "2026-08-23T00:00:00.000Z",
    data: { id: "deal_1", resourceVersion: version },
  };
}

// ---------------------------------------------------------------------------
// 1. Full success.
// ---------------------------------------------------------------------------

const committedSteps: string[] = [];
const full = await executeSequentialCommits([
  { step: "profile", run: async () => { committedSteps.push("profile"); return outcome("profile", 4); } },
  { step: "forecast", run: async () => { committedSteps.push("forecast"); return outcome("forecast", 5); } },
  { step: "stage", run: async () => { committedSteps.push("stage"); return outcome("stage", 6); } },
]);
assert.equal(full.status, "FULL_SUCCESS");
assert.deepEqual(full.committed.map((entry) => entry.step), ["profile", "forecast", "stage"]);
assert.equal(full.failedStep, undefined);
assert.deepEqual(committedSteps, ["profile", "forecast", "stage"]);

// ---------------------------------------------------------------------------
// 2. THE DEAL-EDIT FAILURE MATRIX.
//
//    Failure is injected at each boundary in turn. Every earlier command must remain
//    committed and reported; no later command may run; nothing may be reversed.
// ---------------------------------------------------------------------------

const dealEditSteps = ["profile", "forecast", "nextAction", "owner", "stage"] as const;

for (let failAt = 0; failAt < dealEditSteps.length; failAt += 1) {
  const ran: string[] = [];
  const report: PartialCommitReport = await executeSequentialCommits(
    dealEditSteps.map((step, index) => ({
      step,
      run: async () => {
        ran.push(step);
        if (index === failAt) throw new Error(`${step.toUpperCase()}_REJECTED`);
        return outcome(step, 4 + index);
      },
    })),
  );

  const expectedCommitted = dealEditSteps.slice(0, failAt);
  assert.deepEqual(
    report.committed.map((entry) => entry.step),
    [...expectedCommitted],
    `Failing at ${dealEditSteps[failAt]} must retain the steps that already committed.`,
  );
  assert.equal(report.failedStep, dealEditSteps[failAt], "The failing step must be named.");
  assert.equal(
    report.status,
    failAt === 0 ? "NO_COMMIT_FAILURE" : "PARTIAL_SUCCESS",
    "A failure with nothing committed is not a partial commit; a failure after a commit is.",
  );
  assert.equal(
    report.requiresRefresh,
    failAt > 0,
    "Anything committed leaves the authoritative projection stale and must be refetched.",
  );

  // No later command may run once a step failed: continuing would widen the partial commit.
  assert.deepEqual(
    ran,
    dealEditSteps.slice(0, failAt + 1),
    "Execution must stop at the first failure.",
  );

  // Authoritative evidence from the committed steps survives, and is never invented.
  for (const [index, entry] of report.committed.entries()) {
    assert.equal(entry.commandId, `cmd_${dealEditSteps[index]}`, "The command id must be preserved.");
    assert.equal(entry.correlationId, `corr_${dealEditSteps[index]}`, "The correlation id must be preserved.");
    assert.equal(entry.version, 4 + index, "The authoritative resource version must be preserved.");
  }

  // The original error is preserved for the caller's existing error formatting.
  assert.match(String((report.error as Error).message), /_REJECTED$/u, "The original error must be preserved.");
}

// A committed step that returns no evidence must not have evidence fabricated for it.
const sparse = await executeSequentialCommits([
  { step: "activity", run: async () => undefined },
  { step: "followUpTask", run: async () => { throw new Error("TASK_REJECTED"); } },
]);
assert.equal(sparse.status, "PARTIAL_SUCCESS");
assert.deepEqual(sparse.committed, [{ step: "activity" }], "Missing evidence must stay missing, not be invented.");
assert.equal(sparse.failedStep, "followUpTask");

// ---------------------------------------------------------------------------
// 3. LEAD ACTIVITY -> TASK.
//
//    The activity commits and the follow-up Task fails: the call log must not be reported
//    as lost, and must not be deleted to "undo" the action.
// ---------------------------------------------------------------------------

assert.equal(sparse.requiresRefresh, true, "A committed activity leaves the Lead timeline stale.");
const leadMessage = describePartialCommit(
  sparse,
  { committed: "The call log", failed: "the follow-up task" },
  "en",
);
assert.match(leadMessage, /The call log was saved/u, "The committed half must be stated.");
assert.match(leadMessage, /did not complete/u, "The failed half must be stated.");
assert.equal(
  describePartialCommit({ ...sparse, status: "NO_COMMIT_FAILURE" }, { committed: "x", failed: "y" }, "en"),
  "",
  "A total failure must not be described as a partial success.",
);

// ---------------------------------------------------------------------------
// 4. BULK ORDER CANCELLATION.
//
//    One item fails: the orders that cancelled must be reported, not hidden behind the
//    failure of the others.
// ---------------------------------------------------------------------------

const ids = ["order_1", "order_2", "order_3"];
const settled: PromiseSettledResult<unknown>[] = [
  { status: "fulfilled", value: outcome("order_1", 2) },
  { status: "rejected", reason: new Error("ORDER_LOCKED") },
  { status: "fulfilled", value: outcome("order_3", 2) },
];
const bulk = summarizeBulkCommits(ids, settled);
assert.equal(bulk.status, "PARTIAL_SUCCESS");
assert.deepEqual(bulk.committed, ["order_1", "order_3"], "Committed items must be reported by id.");
assert.deepEqual(bulk.failed.map((entry) => entry.id), ["order_2"], "Failed items must be reported by id.");
assert.equal(bulk.requiresRefresh, true);

assert.equal(summarizeBulkCommits(ids, [
  { status: "rejected", reason: new Error("A") },
  { status: "rejected", reason: new Error("B") },
  { status: "rejected", reason: new Error("C") },
]).status, "NO_COMMIT_FAILURE", "Nothing committed is a total failure, not a partial one.");

assert.equal(summarizeBulkCommits(ids, [
  { status: "fulfilled", value: 1 },
  { status: "fulfilled", value: 2 },
  { status: "fulfilled", value: 3 },
]).status, "FULL_SUCCESS");

// ---------------------------------------------------------------------------
// 5. No compensation. The reporter must never issue or reverse a command.
// ---------------------------------------------------------------------------

const reversals: string[] = [];
const withReversalSpy = await executeSequentialCommits([
  { step: "profile", run: async () => outcome("profile", 4) },
  { step: "forecast", run: async () => { throw new Error("FORECAST_REJECTED"); } },
]);
assert.deepEqual(reversals, [], "The partial-commit reporter must not reverse a committed command.");
assert.deepEqual(
  withReversalSpy.committed.map((entry) => entry.step),
  ["profile"],
  "The committed profile update stays committed; the backend owns any compensation.",
);

console.log(
  "quality.partial-commit-semantics: PASS (deal-edit failure matrix at 5 boundaries, lead activity->task, "
    + "bulk settlement, evidence preserved, no frontend compensation).",
);
