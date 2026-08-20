import type { Deal } from "@/modules/deals";
import { createTaskSnapshot, type Task } from "@/modules/tasks";

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
 * Explicit AI recommendations may become a Task only after the caller chooses to
 * materialize the recommendation as work. Care cases intentionally do not create
 * mirror Tasks automatically; concrete actions are created from the Support Ticket UI.
 */
export function createAiSuggestedTask(input: {
  suggestionId: string;
  title: string;
  description?: string;
  assigneeId: string;
  dueAt?: string;
  recordRef?: { moduleKey: string; recordId: string; label?: string };
  evidence: string;
}): Task {
  return createTaskSnapshot({
    id: `task_ai_${input.suggestionId}`,
    title: input.title,
    description: input.description,
    priority: "NORMAL",
    assigneeId: input.assigneeId,
    dueAt: safeDueAt(input.dueAt, 24),
    recordRef: input.recordRef,
    sourceRef: { type: "AI_SUGGESTION", id: input.suggestionId, evidence: input.evidence },
    dedupeKey: `ai-task:${input.suggestionId}`,
    actorId: "ai-policy",
    actorName: "AI Internal Action",
    correlationId: `ai:${input.suggestionId}`,
  });
}
