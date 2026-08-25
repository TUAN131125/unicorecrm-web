import { isBusinessOperationUnavailable, MutationCommandError } from "@/shared/application";

/**
 * Availability of WF-04 (customer-commercial-actions) in the active runtime.
 *
 * WF-04 is canonically `BLOCKED` with `connectedFrontendCoordinatorAllowed: false`, and no
 * backend workflow operation commits a Customer's Deal and its follow-up Task together.
 * `deal.create` and `task.create` are each `PRODUCTION_CONTRACT_READY`, but sequencing two
 * authoritative commands from the frontend does not make the frontend the workflow owner —
 * it just produces a real, non-atomic partial commit that nobody owns.
 *
 * The refusal has to belong to WF-04 itself. Refusing because Customer writes, Deal writes
 * or Task writes are blocked would be incidental: all three are available today, so such a
 * guard would protect nothing at all. This predicate reads the runtime availability
 * registry that the connected composition writes, so the predicate and the runtime can
 * never disagree, and demo mode — which declares nothing — keeps its demo-owned
 * coordinator.
 */
export const CUSTOMER_COMMERCIAL_ACTIONS_OPERATION = "WF-04 customer commercial actions";

/** True when the active runtime cannot perform WF-04 authoritatively. */
export function isCustomerCommercialActionsUnavailable(): boolean {
  return isBusinessOperationUnavailable(CUSTOMER_COMMERCIAL_ACTIONS_OPERATION);
}

/**
 * Fails closed before the workflow's first authoritative command.
 *
 * Callers refuse first so the user gets a readable message, but the workflow asserts too:
 * `deal.create` commits for real, so a caller that forgets the preflight would otherwise
 * leave a committed Deal behind for a workflow the frontend may not coordinate.
 */
export function assertCustomerCommercialActionsAvailable(operation: string): void {
  if (!isCustomerCommercialActionsUnavailable()) return;
  throw new MutationCommandError({
    code: "CONNECTED_WORKFLOW_COORDINATOR_FORBIDDEN",
    message: `${operation} cannot run in connected mode: WF-04 customer-commercial-actions is BLOCKED and the `
      + "connected frontend may not coordinate it.",
    category: "INFRASTRUCTURE",
    retryable: false,
    details: {
      workflowId: "WF-04",
      operation,
      authority: "docs/backend-readiness/workflow-ownership.json",
    },
  });
}
