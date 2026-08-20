import type { Task } from "@/modules/tasks";
import type { Deal, DealActivity, DealRecycleDecision } from "@/modules/deals";

export interface DealRecyclePorts {
  deals: {
    getById(dealId: string): Deal | undefined;
    closeLost(
      dealId: string,
      input: {
        reason: string;
        note?: string;
        recycleDecision: DealRecycleDecision;
        revisitAt?: string;
        occurredAt: string;
      },
      activity?: DealActivity,
    ): Deal | undefined;
  };
  tasks: {
    create(input: { id: string; title: string; description?: string; assigneeId: string; dueAt: string; dealId: string; dedupeKey: string; actorId: string; now: string }): Task;
  };
}
