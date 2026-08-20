import { createMutationMetadata, executeMutationCommand, type MutationCommandMetadata, type MutationOutcome } from "@/shared/application";
import { reconcileCustomerConversionRuntime, startCustomerConversionRuntime } from "./application/composition/customerConversionApplicationServices";
import type { CustomerConversionReconciliationResult } from "./application/ports/CustomerConversionPort";

export { reconcileCustomerConversionRuntime, startCustomerConversionRuntime };
export type { CustomerConversionReconciliationResult };

export function reconcileCustomerConversionCommand(now?: string, metadata: Partial<MutationCommandMetadata> = {}): Promise<MutationOutcome<CustomerConversionReconciliationResult>> {
  return executeMutationCommand(
    { commandType: "customer-conversion.reconcile", aggregateType: "customer-conversion", aggregateId: "workspace", payload: { now } },
    createMutationMetadata("customer-conversion.reconcile", metadata),
    () => reconcileCustomerConversionRuntime(now),
  );
}
