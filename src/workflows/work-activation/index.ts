import type { Deal } from "@/modules/deals";
import { createTaskCommand, createTaskSnapshot, type RecordRef, type Task, type TaskPriority } from "@/modules/tasks";
import type { MutationOutcome } from "@/shared/application";

function safeDueAt(value?: string, fallbackHours = 24): string {
  if (value && !Number.isNaN(new Date(value).getTime())) return new Date(value).toISOString();
  return new Date(Date.now() + fallbackHours * 60 * 60 * 1000).toISOString();
}

export function getDealNextActionTaskId(dealId: string, dueAt: string): string {
  return `task_deal_${dealId}_${dueAt.slice(0, 10)}`;
}

export function ensureDealNextActionTask(deal: Deal): Task | undefined {
  if (!deal.nextActionAt || ["WON", "LOST"].includes(String(deal.stage))) return undefined;
  return createTaskSnapshot({
    id: getDealNextActionTaskId(deal.id, deal.nextActionAt),
    title: deal.nextActionSummary || `Next action for ${deal.name}`,
    description: `Keep the active Deal moving before ${new Date(deal.nextActionAt).toLocaleString()}.`,
    priority: "HIGH",
    assigneeId: deal.ownerId,
    dueAt: safeDueAt(deal.nextActionAt),
    relationshipRef: deal.buyerRef.type === "CONTACT" ? { type: "CONTACT", id: deal.buyerRef.id } : { type: "ORGANIZATION_ACCOUNT", id: deal.buyerRef.id },
    recordRef: { moduleKey: "deals", recordId: deal.id, label: deal.name },
    sourceRef: { type: "DEAL_NEXT_ACTION", id: deal.id },
    dedupeKey: `deal-next-action:${deal.id}:${deal.nextActionAt}`,
    actorId: "workflow",
    actorName: "Work Activation Workflow",
    correlationId: `deal:${deal.id}`,
    now: deal.createdAt,
  });
}

/**
 * Canonical activation boundary for an AI recommendation that a human chose to
 * materialize as work. It is the only path the AI Assistant may use to create a
 * Task: the AI application service never touches the Task repository and the AI
 * UI never composes a Task command itself. Support Tickets intentionally do not
 * create mirror Tasks automatically; concrete actions are created from the
 * Support Ticket UI.
 *
 * Evidence, `sourceRef.type = AI_SUGGESTION`, dedupe key and correlation id are
 * preserved so the resulting Task stays explainable and replay-safe.
 */
export interface AiSuggestedTaskActivationInput {
  suggestionId: string;
  title: string;
  description?: string;
  assigneeId: string;
  dueAt?: string;
  priority?: TaskPriority;
  recordRef?: RecordRef;
  evidence: string;
  actor: { id: string; name: string };
}

export function getAiSuggestedTaskId(suggestionId: string): string {
  return `task_ai_${suggestionId}`;
}

export async function activateAiSuggestedTask(
  input: AiSuggestedTaskActivationInput,
): Promise<MutationOutcome<Task>> {
  const taskId = getAiSuggestedTaskId(input.suggestionId);
  return createTaskCommand(
    {
      id: taskId,
      title: input.title,
      ...(input.description === undefined ? {} : { description: input.description }),
      priority: input.priority ?? "NORMAL",
      assigneeId: input.assigneeId,
      dueAt: safeDueAt(input.dueAt, 24),
      ...(input.recordRef === undefined ? {} : { recordRef: input.recordRef }),
      sourceRef: { type: "AI_SUGGESTION", id: input.suggestionId, evidence: input.evidence },
      dedupeKey: `ai-task:${input.suggestionId}`,
      actorId: input.actor.id,
      actorName: input.actor.name,
    },
    {
      idempotencyKey: `task.create:${taskId}`,
      correlationId: `ai:${input.suggestionId}`,
      actor: { id: input.actor.id, name: input.actor.name },
    },
  );
}
