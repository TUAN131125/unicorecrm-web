import { createTaskSnapshot } from "@/modules/tasks";
import { closeDealLost, getDealSnapshot } from "@/modules/deals";
import type { DealRecyclePorts } from "../application/ports/DealRecyclePorts";

export function createDealRecycleRuntime(): DealRecyclePorts {
  return {
    deals: {
      getById: getDealSnapshot,
      closeLost: closeDealLost,
    },
    tasks: {
      create: (input) => createTaskSnapshot({
        id: input.id, title: input.title, description: input.description, assigneeId: input.assigneeId, dueAt: input.dueAt,
        recordRef: { moduleKey: "deals", recordId: input.dealId },
        sourceRef: { type: "DEAL_RECYCLE", id: input.dealId, evidence: "Lost Deal recycle decision" },
        dedupeKey: input.dedupeKey, actorId: input.actorId, now: input.now,
      }),
    },
  };
}
