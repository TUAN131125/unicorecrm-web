import { isBusinessOperationUnavailable, MutationCommandError } from "@/shared/application";

/**
 * Availability of WF-12 (order-closing) in the active runtime.
 *
 * The canonical records disagree, and that disagreement is the whole finding.
 * `order.complete-from-fulfillment-evidence` (CMD-046) is `PRODUCTION_CONTRACT_READY` with
 * a complete OpenAPI operation (`completeOrderFromFulfillmentEvidence`), a generated client
 * method, `IF_MATCH_REQUIRED` and `IdempotencyKey`. Its owning workflow WF-12 is
 * `contractReadiness: BLOCKED`, `connectedFrontendCoordinatorAllowed: false`, blocked on
 * `DEC-WORKFLOW-ORDER-CLOSING` — a decision that exists nowhere in this repository, which
 * is the marker every unresolved `DEC-WORKFLOW-*` carries.
 *
 * `runtimeImplementationMode: DEDICATED_WORKFLOW_HTTP_ADAPTER` means the command must be
 * dispatched through its workflow, and that workflow is blocked. Deciding which canonical
 * record wins is a backend/product ownership decision, not a frontend one, so no adapter is
 * invented here: WF-12 declares its own unavailability and connected mode refuses on WF-12.
 *
 * Compare WF-10 lead-qualification, which is `PRODUCTION_CONTRACT_READY` at both the
 * command and the workflow level and therefore does own a real dedicated HTTP adapter.
 */
export const ORDER_CLOSING_OPERATION = "WF-12 order closing";

/** True when the active runtime cannot perform WF-12 authoritatively. */
export function isOrderClosingUnavailable(): boolean {
  return isBusinessOperationUnavailable(ORDER_CLOSING_OPERATION);
}

/** Fails closed before any Order completion is attempted. */
export function assertOrderClosingAvailable(operation: string): void {
  if (!isOrderClosingUnavailable()) return;
  throw new MutationCommandError({
    code: "CONNECTED_WORKFLOW_COORDINATOR_FORBIDDEN",
    message: `${operation} cannot run in connected mode: WF-12 order-closing is BLOCKED on `
      + "DEC-WORKFLOW-ORDER-CLOSING, so the connected frontend may not coordinate Order completion even though "
      + "order.complete-from-fulfillment-evidence is itself contract-ready.",
    category: "INFRASTRUCTURE",
    retryable: false,
    details: {
      workflowId: "WF-12",
      operation,
      authority: "docs/backend-readiness/workflow-ownership.json",
    },
  });
}
