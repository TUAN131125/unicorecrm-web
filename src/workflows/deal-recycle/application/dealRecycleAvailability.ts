import { isBusinessOperationUnavailable, MutationCommandError } from "@/shared/application";

/**
 * Availability of WF-09 (deal-recycle) in the active runtime.
 *
 * WF-09 is canonically `BLOCKED` with `connectedFrontendCoordinatorAllowed: false`,
 * `ownershipDecision: BACKEND_ORCHESTRATED` and an unresolved blocking decision
 * (`DEC-WORKFLOW-DEAL-RECYCLE`). `deal.mark-lost-and-plan-recycle` (CMD-015) is BLOCKED
 * with no OpenAPI operation: closing a Deal lost and planning its recycle Task is a
 * backend-orchestrated pair, not two frontend commands.
 *
 * WF-09 currently has no presentation entry point at all, so this declaration is what keeps
 * a future caller from inheriting protection from Deal or Task availability instead of
 * refusing on WF-09.
 */
export const DEAL_RECYCLE_OPERATION = "WF-09 deal recycle";

/** True when the active runtime cannot perform WF-09 authoritatively. */
export function isDealRecycleUnavailable(): boolean {
  return isBusinessOperationUnavailable(DEAL_RECYCLE_OPERATION);
}

/** Fails closed before the first recycle command. */
export function assertDealRecycleAvailable(operation: string): void {
  if (!isDealRecycleUnavailable()) return;
  throw new MutationCommandError({
    code: "CONNECTED_WORKFLOW_COORDINATOR_FORBIDDEN",
    message: `${operation} cannot run in connected mode: WF-09 deal-recycle is BLOCKED and the connected frontend `
      + "may not sequence a Deal close-lost with its recycle Task.",
    category: "INFRASTRUCTURE",
    retryable: false,
    details: {
      workflowId: "WF-09",
      operation,
      authority: "docs/backend-readiness/workflow-ownership.json",
    },
  });
}
