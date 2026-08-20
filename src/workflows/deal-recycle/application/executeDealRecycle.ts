import type { DealActivity, DealRecycleDecision } from "@/modules/deals";
import type { DealRecyclePorts } from "./ports/DealRecyclePorts";

export interface ExecuteDealRecycleCommand {
  dealId: string;
  reason: string;
  note?: string;
  recycleDecision: DealRecycleDecision;
  revisitAt?: string;
  occurredAt: string;
  activity?: DealActivity;
}

export interface DealRecycleResult {
  dealId: string;
  taskId?: string;
}

export function executeDealRecycle(
  command: ExecuteDealRecycleCommand,
  ports: DealRecyclePorts,
): DealRecycleResult {
  const deal = ports.deals.getById(command.dealId);
  if (!deal) throw new Error(`Deal not found: ${command.dealId}`);
  if (!command.reason.trim()) throw new Error("Lost Deal requires reason.");
  const recyclable = command.recycleDecision !== "DO_NOT_RECYCLE";
  if (recyclable && !command.revisitAt) throw new Error("Recyclable Lost Deal requires revisitAt.");

  const closed = ports.deals.closeLost(command.dealId, {
    reason: command.reason.trim(),
    note: command.note?.trim() || undefined,
    recycleDecision: command.recycleDecision,
    revisitAt: recyclable ? command.revisitAt : undefined,
    occurredAt: command.occurredAt,
  }, command.activity);
  if (!closed) throw new Error(`Deal could not be closed: ${command.dealId}`);

  if (!recyclable || !command.revisitAt) return { dealId: closed.id };

  const task = ports.tasks.create({
    id: `task_deal_recycle_${closed.id}`,
    title: `Theo dõi lại Deal đã mất: ${closed.name}`,
    description: [`Lý do: ${command.reason.trim()}`, command.note?.trim()].filter(Boolean).join(" — "),
    assigneeId: closed.ownerId || "unassigned",
    dueAt: command.revisitAt,
    dealId: closed.id,
    dedupeKey: `deal-recycle:${closed.id}:${command.revisitAt}`,
    actorId: closed.ownerId || "deal-recycle-workflow",
    now: command.occurredAt,
  });

  return { dealId: closed.id, taskId: task.id };
}
