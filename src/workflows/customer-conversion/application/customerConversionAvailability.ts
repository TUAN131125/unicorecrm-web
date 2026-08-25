import { isBusinessOperationUnavailable, MutationCommandError } from "@/shared/application";

/**
 * Availability of WF-05 (customer-conversion) in the active runtime.
 *
 * WF-05 is canonically `BLOCKED` with `connectedFrontendCoordinatorAllowed: false`,
 * `ownershipDecision: BACKEND_ORCHESTRATED` and an unresolved blocking decision
 * (`DEC-WORKFLOW-CUSTOMER-CONVERSION`). `customer-conversion.reconcile` (CMD-007) is
 * BLOCKED and has no OpenAPI operation, so no backend command exists to route to.
 *
 * Before M12 the connected binding failed closed only once `reconcile` had already been
 * called, so a caller could refuse only by re-deriving some other aggregate's availability.
 * Declaring WF-05 itself lets the workflow boundary and its callers refuse on WF-05.
 */
export const CUSTOMER_CONVERSION_OPERATION = "WF-05 customer conversion";

/** True when the active runtime cannot perform WF-05 authoritatively. */
export function isCustomerConversionUnavailable(): boolean {
  return isBusinessOperationUnavailable(CUSTOMER_CONVERSION_OPERATION);
}

/** Fails closed before the reconciliation runs. */
export function assertCustomerConversionAvailable(operation: string): void {
  if (!isCustomerConversionUnavailable()) return;
  throw new MutationCommandError({
    code: "CONNECTED_WORKFLOW_COORDINATOR_FORBIDDEN",
    message: `${operation} cannot run in connected mode: WF-05 customer-conversion is BLOCKED and the connected `
      + "frontend may not reconcile Customer conversion state locally.",
    category: "INFRASTRUCTURE",
    retryable: false,
    details: {
      workflowId: "WF-05",
      operation,
      authority: "docs/backend-readiness/workflow-ownership.json",
    },
  });
}
