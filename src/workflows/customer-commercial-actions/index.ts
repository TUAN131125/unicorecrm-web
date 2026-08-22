import { createDealCommand, DealStage, type Deal, type DealForecastCategory, type DealLineItem } from "@/modules/deals";
import { assertCustomerRelationshipContextSnapshot } from "@/modules/customers";
import { createTaskCommand } from "@/modules/tasks";

export interface CreateDealForCustomerInput {
  customerId: string;
  id: string;
  name: string;
  amount: number;
  ownerId: string;
  expectedCloseDate?: string;
  actorName?: string;
  now?: string;
  stage?: string;
  probability?: number;
  forecastCategory?: DealForecastCategory;
  followUpTask?: {
    title: string;
    dueAt: string;
    description?: string;
  };
  notes?: string;
  interestedProducts?: string[];
  lineItems?: DealLineItem[];
}

function taskIdForDeal(dealId: string, dueAt: string): string {
  return `task_deal_${dealId}_${dueAt.slice(0, 10)}`;
}

/**
 * Creates a commercial opportunity for an existing Customer relationship.
 *
 * Both steps use authoritative commands (`deal.create`, `task.create`). They are
 * NOT atomic with each other: WF-04 customer-commercial-actions is still
 * `contractReadiness: BLOCKED` with `connectedFrontendCoordinatorAllowed: false`,
 * and no backend operation commits a Deal and its follow-up Task in one
 * transaction. A Task failure therefore leaves a committed Deal without its
 * follow-up Task and must propagate to the caller rather than be swallowed.
 * Atomic Customer-commercial-action semantics remain a backend requirement.
 *
 * The Task identifier is server-assigned (`CreateTaskRequest` carries no `id`),
 * so `taskIdForDeal` only derives a deterministic idempotency/dedupe key.
 */
export async function createDealForCustomer(input: CreateDealForCustomerInput): Promise<Deal> {
  const { customer, relationshipRef } = assertCustomerRelationshipContextSnapshot(input.customerId);
  const now = input.now ?? new Date().toISOString();
  const dueAt = input.followUpTask ? new Date(input.followUpTask.dueAt).toISOString() : undefined;
  const taskId = dueAt ? taskIdForDeal(input.id, dueAt) : undefined;
  const deal = (await createDealCommand({
    id: input.id,
    name: input.name.trim(),
    buyerRef: relationshipRef,
    customerId: customer.id,
    stage: input.stage ?? DealStage.DISCOVERY,
    amount: input.amount,
    opportunityScore: input.probability ?? 40,
    ownerId: input.ownerId,
    expectedCloseDate: input.expectedCloseDate ?? "",
    createdAt: now,
    updatedAt: now,
    forecastCategory: input.forecastCategory ?? "PIPELINE",
    ...(dueAt && taskId ? {
      nextActionAt: dueAt,
      nextActionSummary: input.followUpTask?.title.trim(),
      nextActionRef: { type: "TASK" as const, id: taskId },
    } : {}),
    interestedProducts: input.interestedProducts ?? [],
    lineItems: input.lineItems ?? [],
    notes: input.notes?.trim() || undefined,
    activities: [{
      id: `activity_${input.id}_created`,
      type: "system",
      title: "Opportunity created",
      description: `Created from Customer ${customer.customerCode}`,
      createdAt: now,
      author: input.actorName ?? "System",
    }],
  }, {
    idempotencyKey: `deal.create:${input.id}`,
    correlationId: `customer:${customer.id}`,
  })).data;

  if (dueAt && taskId && input.followUpTask) {
    await createTaskCommand({
      id: taskId,
      title: input.followUpTask.title.trim(),
      description: input.followUpTask.description?.trim() || input.notes?.trim() || undefined,
      priority: "NORMAL",
      assigneeId: input.ownerId,
      dueAt,
      customerId: customer.id,
      relationshipRef,
      recordRef: { moduleKey: "deals", recordId: deal.id, label: deal.name },
      sourceRef: { type: "CUSTOMER_DEAL_FOLLOW_UP", id: deal.id },
      dedupeKey: `deal-next-action:${deal.id}:${dueAt}`,
      actorId: input.ownerId,
      actorName: input.actorName ?? "CRM User",
      correlationId: `deal:${deal.id}`,
      now,
    }, {
      idempotencyKey: `task.create:${taskId}`,
      correlationId: `deal:${deal.id}`,
    });
  }

  return deal;
}
