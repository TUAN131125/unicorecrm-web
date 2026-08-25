import type { Deal } from "@/modules/deals";
import { createTaskCommand, type RecordRef, type Task, type TaskPriority } from "@/modules/tasks";
import type { MutationOutcome } from "@/shared/application";
import { assertWorkActivationAvailable } from "./application/workActivationAvailability";

export {
  WORK_ACTIVATION_OPERATION,
  assertWorkActivationAvailable,
  isWorkActivationUnavailable,
} from "./application/workActivationAvailability";

function safeDueAt(value?: string, fallbackHours = 24): string {
  if (value && !Number.isNaN(new Date(value).getTime())) return new Date(value).toISOString();
  return new Date(Date.now() + fallbackHours * 60 * 60 * 1000).toISOString();
}

/**
 * Deterministic Task creation *intent* key for a Deal next action.
 *
 * NOT a Task identifier. The Task aggregate id is server-assigned: `CreateTaskRequest`
 * in `docs/api/openapi.json` is a closed schema carrying no `id`, and the authoritative
 * id only arrives in `TaskMutationResult.task.id`. This value is safe as an idempotency
 * key and dedupe key so a repeated activation replays instead of creating a second Task;
 * it must never be persisted as a Task foreign reference (`Deal.nextActionRef.id`,
 * `CreateDealRequest.nextActionTaskId`, `UpdateDealNextActionRequest.taskId`).
 */
export function getDealNextActionTaskIntentKey(dealId: string, dueAt: string): string {
  return `task_deal_${dealId}_${dueAt.slice(0, 10)}`;
}

/**
 * Activates the Deal "next action" as a real Task through the authoritative
 * `task.create` command.
 *
 * NOT ATOMIC WITH THE DEAL COMMAND. No backend workflow operation exists that
 * commits a Deal mutation and its next-action Task in one transaction: the command
 * registry has `deal.create`, `deal.update-next-action` and `task.create` as three
 * independent commands, and OpenAPI exposes no `/workflows/...` operation covering
 * both. Callers must therefore await this and surface its failure instead of
 * reporting the Deal operation as fully successful. Atomic Deal+Task activation
 * remains a backend requirement.
 *
 * The Task identifier is server-assigned (`CreateTaskRequest` carries no `id`), so
 * `getDealNextActionTaskIntentKey` is used only to derive a deterministic idempotency
 * key and dedupe key; a repeated activation replays instead of creating a second Task.
 * Callers must not persist that key as a Deal Task foreign reference.
 */
export async function ensureDealNextActionTask(deal: Deal): Promise<MutationOutcome<Task> | undefined> {
  if (!deal.nextActionAt || ["WON", "LOST"].includes(String(deal.stage))) return undefined;
  // Asserted only once activation would actually happen: a call that is a no-op for this
  // Deal is not the workflow and must not be refused.
  assertWorkActivationAvailable("Activating the next action for a Deal");
  const intentId = getDealNextActionTaskIntentKey(deal.id, deal.nextActionAt);
  return createTaskCommand({
    id: intentId,
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
  }, {
    idempotencyKey: `task.create:${intentId}`,
    correlationId: `deal:${deal.id}`,
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

/**
 * Deterministic Task creation *intent* key for an activated AI suggestion. Same
 * identity rule as `getDealNextActionTaskIntentKey`: the Task aggregate id is
 * server-assigned, so this value may only key idempotency and dedupe.
 */
export function getAiSuggestedTaskIntentKey(suggestionId: string): string {
  return `task_ai_${suggestionId}`;
}

export async function activateAiSuggestedTask(
  input: AiSuggestedTaskActivationInput,
): Promise<MutationOutcome<Task>> {
  const intentId = getAiSuggestedTaskIntentKey(input.suggestionId);
  return createTaskCommand(
    {
      id: intentId,
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
      idempotencyKey: `task.create:${intentId}`,
      correlationId: `ai:${input.suggestionId}`,
      actor: { id: input.actor.id, name: input.actor.name },
    },
  );
}
