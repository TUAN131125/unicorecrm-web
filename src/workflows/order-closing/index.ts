import { createMutationMetadata, executeMutationCommand, type MutationCommandMetadata, type MutationOutcome } from "@/shared/application";
import { executeOrderClosing as executeOrderClosingLocal, type ExecuteOrderClosingCommand, type OrderClosingResult } from "./application/executeOrderClosing";
import { createOrderClosingRuntime } from "./application/composition/orderClosingApplicationServices";

export { executeOrderClosing } from "./application/executeOrderClosing";
export type { ExecuteOrderClosingCommand, OrderClosingBlockedItem, OrderClosingResult } from "./application/executeOrderClosing";
export { createOrderClosingRuntime } from "./application/composition/orderClosingApplicationServices";
export { evaluateOrderClosingPolicy, orderRequiresShipping, STANDARD_ORDER_CLOSING_POLICY } from "./domain/orderClosingPolicy";
export type { OrderClosingEvaluation, OrderClosingPolicy } from "./domain/orderClosingPolicy";

export function executeOrderClosingCommand(
  command: ExecuteOrderClosingCommand,
  metadata: Partial<MutationCommandMetadata> = {},
): Promise<MutationOutcome<OrderClosingResult>> {
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
