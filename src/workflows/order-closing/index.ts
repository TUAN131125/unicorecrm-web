import { assertMutationCommandSupported, createMutationMetadata, executeMutationCommand, type MutationCommandMetadata, type MutationOutcome } from "@/shared/application";
import { executeOrderClosing as executeOrderClosingLocal, type ExecuteOrderClosingCommand, type OrderClosingResult } from "./application/executeOrderClosing";
import { createOrderClosingRuntime } from "./application/composition/orderClosingApplicationServices";
import { assertOrderClosingAvailable } from "./application/orderClosingAvailability";

export { executeOrderClosing } from "./application/executeOrderClosing";
export type { ExecuteOrderClosingCommand, OrderClosingBlockedItem, OrderClosingResult } from "./application/executeOrderClosing";
export { createOrderClosingRuntime } from "./application/composition/orderClosingApplicationServices";
export { evaluateOrderClosingPolicy, orderRequiresShipping, STANDARD_ORDER_CLOSING_POLICY } from "./domain/orderClosingPolicy";
export { isOrderClosingUnavailable, ORDER_CLOSING_OPERATION } from "./application/orderClosingAvailability";
export type { OrderClosingEvaluation, OrderClosingPolicy } from "./domain/orderClosingPolicy";

/**
 * `order.complete-from-fulfillment-evidence` (CMD-046) is PRODUCTION_CONTRACT_READY with a
 * complete OpenAPI operation, a generated client method, `IF_MATCH_REQUIRED` and an
 * idempotency key — everything a dedicated connected workflow adapter would need.
 *
 * Its owning workflow is not. WF-12 order-closing is `contractReadiness: BLOCKED`,
 * `connectedFrontendCoordinatorAllowed: false`, blocked on `DEC-WORKFLOW-ORDER-CLOSING`,
 * a decision that appears nowhere in this repository — the marker every unresolved
 * `DEC-WORKFLOW-*` carries. `runtimeImplementationMode: DEDICATED_WORKFLOW_HTTP_ADAPTER`
 * requires dispatch through that workflow, so the command being ready does not make the
 * workflow usable. Reconciling the two canonical records is a backend/product ownership
 * decision; the frontend must not pick a winner by shipping an adapter.
 *
 * Refusal is therefore workflow-owned: WF-12 declares its own connected unavailability and
 * this boundary asserts on it before anything else, so connected mode refuses on WF-12
 * rather than on whichever Order or evidence port happens to be blocked today. Demo keeps
 * its local executor unchanged.
 */
export function executeOrderClosingCommand(
  command: ExecuteOrderClosingCommand,
  metadata: Partial<MutationCommandMetadata> = {},
): Promise<MutationOutcome<OrderClosingResult>> {
  assertOrderClosingAvailable("Order closing");
  assertMutationCommandSupported("order.complete-from-fulfillment-evidence", "Order closing");
  const aggregateId = command.orderIds.length === 1 ? command.orderIds[0] : `batch:${command.orderIds.join(",")}`;
  return executeMutationCommand(
    {
      commandType: "order.complete-from-fulfillment-evidence",
      aggregateType: command.orderIds.length === 1 ? "order" : "order-batch",
      aggregateId,
      payload: command,
    },
    createMutationMetadata(`order.complete:${aggregateId}`, {
      ...metadata,
      correlationId: metadata.correlationId ?? command.correlationId,
    }),
    () => executeOrderClosingLocal(command, createOrderClosingRuntime()),
  );
}
