/**
 * RC-07 partial-commit semantics (MA-07).
 *
 * Some user actions need several authoritative backend mutations because no backend
 * operation covers them atomically. When an earlier mutation commits and a later one
 * fails, the backend keeps the committed change — so the frontend must not report the
 * action as if nothing happened, and must not quietly swallow the failure either.
 *
 * This module only *describes* what happened. It never issues a command, and in
 * particular it never reverses one: `compensationOwner` is BACKEND for every workflow
 * that has a compensation contract at all, and a frontend rollback is just another
 * distributed sequence that can fail halfway.
 */

export type PartialCommitStatus = "FULL_SUCCESS" | "PARTIAL_SUCCESS" | "NO_COMMIT_FAILURE";

/** Authoritative facts a committed step returned. Never synthesised. */
export interface CommittedStep {
  /** Stable step key, used for messages and tests — not a user-facing string. */
  readonly step: string;
  readonly commandId?: string;
  readonly correlationId?: string;
  readonly occurredAt?: string;
  readonly version?: number;
}

export interface PartialCommitReport {
  readonly status: PartialCommitStatus;
  /** Steps whose backend mutation committed, in order. */
  readonly committed: readonly CommittedStep[];
  /** The step that failed, when one did. */
  readonly failedStep?: string;
  /** The original error, preserved for the caller's existing error formatting. */
  readonly error?: unknown;
  /**
   * True when something committed, so the authoritative projection is now stale.
   * The caller must refetch/invalidate — it must not patch local state to imitate the
   * backend result (MA-04 still applies).
   */
  readonly requiresRefresh: boolean;
}

/** One step of a sequence. `run` performs exactly one authoritative mutation. */
export interface CommitStep<T = unknown> {
  readonly step: string;
  run(): Promise<T>;
}

/** Evidence shape carried by `MutationOutcome`; read defensively, never fabricated. */
interface OutcomeLike {
  commandId?: unknown;
  correlationId?: unknown;
  occurredAt?: unknown;
  version?: unknown;
  data?: { resourceVersion?: unknown };
}

function committedStepFrom(step: string, outcome: unknown): CommittedStep {
  const candidate = (outcome ?? {}) as OutcomeLike;
  const version = typeof candidate.version === "number"
    ? candidate.version
    : typeof candidate.data?.resourceVersion === "number" ? candidate.data.resourceVersion : undefined;
  return {
    step,
    ...(typeof candidate.commandId === "string" ? { commandId: candidate.commandId } : {}),
    ...(typeof candidate.correlationId === "string" ? { correlationId: candidate.correlationId } : {}),
    ...(typeof candidate.occurredAt === "string" ? { occurredAt: candidate.occurredAt } : {}),
    ...(version === undefined ? {} : { version }),
  };
}

/**
 * Runs authoritative mutations in order and stops at the first failure.
 *
 * It stops rather than continuing because the later steps of these flows generally depend
 * on the earlier ones; continuing would widen the partial commit rather than describe it.
 * The steps that already committed are preserved in the report.
 */
export async function executeSequentialCommits(steps: readonly CommitStep[]): Promise<PartialCommitReport> {
  const committed: CommittedStep[] = [];
  for (const step of steps) {
    try {
      committed.push(committedStepFrom(step.step, await step.run()));
    } catch (error) {
      return {
        status: committed.length > 0 ? "PARTIAL_SUCCESS" : "NO_COMMIT_FAILURE",
        committed,
        failedStep: step.step,
        error,
        requiresRefresh: committed.length > 0,
      };
    }
  }
  return { status: "FULL_SUCCESS", committed, requiresRefresh: committed.length > 0 };
}

/** One item of a bulk authoritative action. */
export interface BulkCommitOutcome {
  readonly committed: readonly string[];
  readonly failed: readonly { readonly id: string; readonly error: unknown }[];
  readonly status: PartialCommitStatus;
  readonly requiresRefresh: boolean;
}

/**
 * Summarises a per-item settlement so both sides survive.
 *
 * `Promise.all` cannot be used for authoritative bulk mutations: its rejection discards
 * the outcomes of the items that already committed. `Promise.allSettled` keeps them, but
 * only if the caller then reports the fulfilled half too.
 */
export function summarizeBulkCommits(
  ids: readonly string[],
  settled: readonly PromiseSettledResult<unknown>[],
): BulkCommitOutcome {
  const committed: string[] = [];
  const failed: { id: string; error: unknown }[] = [];
  ids.forEach((id, index) => {
    const result = settled[index];
    if (result && result.status === "fulfilled") committed.push(id);
    else failed.push({ id, error: result && result.status === "rejected" ? result.reason : undefined });
  });
  const status: PartialCommitStatus = failed.length === 0
    ? "FULL_SUCCESS"
    : committed.length === 0 ? "NO_COMMIT_FAILURE" : "PARTIAL_SUCCESS";
  return { committed, failed, status, requiresRefresh: committed.length > 0 };
}

/**
 * A short, safe sentence describing a partial commit.
 *
 * It names the committed work in domain terms supplied by the caller and says that a later
 * step did not complete. It deliberately carries no error text: the caller appends its own
 * formatted message through the existing error presentation, and centralised
 * error/unavailable UX belongs to a later phase.
 */
export function describePartialCommit(
  report: PartialCommitReport,
  labels: { readonly committed: string; readonly failed: string },
  locale: string,
): string {
  const vi = locale === "vi";
  if (report.status !== "PARTIAL_SUCCESS") return "";
  return vi
    ? `${labels.committed} đã được lưu. ${labels.failed} chưa hoàn tất.`
    : `${labels.committed} was saved. ${labels.failed} did not complete.`;
}
