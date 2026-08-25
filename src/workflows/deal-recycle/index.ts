import { assertMutationCommandSupported, createMutationMetadata, executeMutationCommand, type MutationCommandMetadata, type MutationOutcome } from "@/shared/application";
import { executeDealRecycle as executeDealRecycleLocal, type DealRecycleResult, type ExecuteDealRecycleCommand } from "./application/executeDealRecycle";
import { createDealRecycleRuntime } from "./application/composition/dealRecycleApplicationServices";
import { assertDealRecycleAvailable } from "./application/dealRecycleAvailability";

export { executeDealRecycle } from "./application/executeDealRecycle";
export type { DealRecycleResult, ExecuteDealRecycleCommand } from "./application/executeDealRecycle";
export { createDealRecycleRuntime } from "./application/composition/dealRecycleApplicationServices";
export { isDealRecycleUnavailable, DEAL_RECYCLE_OPERATION } from "./application/dealRecycleAvailability";

export function executeDealRecycleCommand(
  command: ExecuteDealRecycleCommand,
  metadata: Partial<MutationCommandMetadata> = {},
): Promise<MutationOutcome<DealRecycleResult>> {
  // WF-09 is BLOCKED with `connectedFrontendCoordinatorAllowed: false`. The close-lost and
  // the recycle Task are a backend-orchestrated pair; refuse on WF-09 before either.
  assertDealRecycleAvailable("Deal recycle");
  assertMutationCommandSupported("deal.mark-lost-and-plan-recycle", "Deal recycle");
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
