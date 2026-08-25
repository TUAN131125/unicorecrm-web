import { assertMutationCommandSupported, createMutationMetadata, executeMutationCommand, type MutationCommandMetadata, type MutationOutcome } from "@/shared/application";
import { reconcileCustomerConversionRuntime, startCustomerConversionRuntime } from "./application/composition/customerConversionApplicationServices";
import type { CustomerConversionReconciliationResult } from "./application/ports/CustomerConversionPort";
import { assertCustomerConversionAvailable } from "./application/customerConversionAvailability";

export { reconcileCustomerConversionRuntime, startCustomerConversionRuntime };
export type { CustomerConversionReconciliationResult };
export { isCustomerConversionUnavailable, CUSTOMER_CONVERSION_OPERATION } from "./application/customerConversionAvailability";

export function reconcileCustomerConversionCommand(now?: string, metadata: Partial<MutationCommandMetadata> = {}): Promise<MutationOutcome<CustomerConversionReconciliationResult>> {
  // WF-05 is BLOCKED with `connectedFrontendCoordinatorAllowed: false` and CMD-007 has no
  // OpenAPI operation. Refusing on WF-05 first keeps containment workflow-owned instead of
  // inherited from whichever Customer port happens to be unavailable.
  assertCustomerConversionAvailable("Customer conversion reconciliation");
  assertMutationCommandSupported("customer-conversion.reconcile", "Customer conversion reconciliation");
  return executeMutationCommand(
    { commandType: "customer-conversion.reconcile", aggregateType: "customer-conversion", aggregateId: "workspace", payload: { now } },
    createMutationMetadata("customer-conversion.reconcile", metadata),
    () => reconcileCustomerConversionRuntime(now),
  );
}
