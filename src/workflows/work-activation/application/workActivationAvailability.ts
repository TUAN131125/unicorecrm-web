import { isBusinessOperationUnavailable, MutationCommandError } from "@/shared/application";

/**
 * Availability of WF-21 (work-activation) in the active runtime.
 *
 * WF-21 is canonically `BLOCKED` with `connectedFrontendCoordinatorAllowed: false`, and no
 * backend operation commits a Deal mutation and its next-action Task together:
 * `deal.create`, `deal.update-next-action` and `task.create` are three independent
 * commands and OpenAPI exposes no work-activation workflow operation.
 *
 * All three commands are individually `PRODUCTION_CONTRACT_READY`, so — as with WF-04 —
 * there is no incidental protection to inherit. A guard derived from Deal or Task
 * availability would protect nothing. This predicate reads the runtime availability
 * registry that the connected composition writes, so the predicate and the runtime can
 * never disagree, and demo mode — which declares nothing — keeps its demo-owned
 * activation.
 *
 * Scope note: this covers the Deal <-> Task *coordination*. Creating a Task from a single
 * authoritative `task.create` (an activated AI suggestion, a Lead follow-up) is not WF-21
 * and is deliberately not gated here.
 */
export const WORK_ACTIVATION_OPERATION = "WF-21 deal work activation";

/** True when the active runtime cannot perform WF-21 authoritatively. */
export function isWorkActivationUnavailable(): boolean {
  return isBusinessOperationUnavailable(WORK_ACTIVATION_OPERATION);
}

/**
 * Fails closed before the activation command.
 *
 * Callers refuse first so the user is told before anything is written, but the boundary
 * asserts too: the Deal mutation commits for real, so a caller that forgets the preflight
 * would otherwise leave a committed Deal whose requested follow-up work never existed.
 */
export function assertWorkActivationAvailable(operation: string): void {
  if (!isWorkActivationUnavailable()) return;
  throw new MutationCommandError({
    code: "CONNECTED_WORKFLOW_COORDINATOR_FORBIDDEN",
    message: `${operation} cannot run in connected mode: WF-21 work-activation is BLOCKED and the connected `
      + "frontend may not coordinate a Deal mutation with its next-action Task.",
    category: "INFRASTRUCTURE",
    retryable: false,
    details: {
      workflowId: "WF-21",
      operation,
      authority: "docs/backend-readiness/workflow-ownership.json",
    },
  });
}
