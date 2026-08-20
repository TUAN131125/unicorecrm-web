import { createMutationMetadata, executeMutationCommand, type MutationCommandMetadata, type MutationOutcome } from "@/shared/application";
import { executeDealRecycle as executeDealRecycleLocal, type DealRecycleResult, type ExecuteDealRecycleCommand } from "./application/executeDealRecycle";
import { createDealRecycleRuntime } from "./application/composition/dealRecycleApplicationServices";

export { executeDealRecycle } from "./application/executeDealRecycle";
export type { DealRecycleResult, ExecuteDealRecycleCommand } from "./application/executeDealRecycle";
export { createDealRecycleRuntime } from "./application/composition/dealRecycleApplicationServices";

export function executeDealRecycleCommand(
  command: ExecuteDealRecycleCommand,
  metadata: Partial<MutationCommandMetadata> = {},
): Promise<MutationOutcome<DealRecycleResult>> {
  return executeMutationCommand(
    {
      commandType: "deal.mark-lost-and-plan-recycle",
      aggregateType: "deal",
      aggregateId: command.dealId,
      payload: command,
    },
    createMutationMetadata(`deal.recycle:${command.dealId}`, metadata),
    () => executeDealRecycleLocal(command, createDealRecycleRuntime()),
  );
}
