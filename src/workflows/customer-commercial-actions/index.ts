import { createDealSnapshot, DealStage, type Deal, type DealForecastCategory, type DealLineItem } from "@/modules/deals";
import { assertCustomerRelationshipContextSnapshot } from "@/modules/customers";
import { createTaskSnapshot } from "@/modules/tasks";

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

export function createDealForCustomer(input: CreateDealForCustomerInput): Deal {
  const { customer, relationshipRef } = assertCustomerRelationshipContextSnapshot(input.customerId);
  const now = input.now ?? new Date().toISOString();
  const dueAt = input.followUpTask ? new Date(input.followUpTask.dueAt).toISOString() : undefined;
  const taskId = dueAt ? taskIdForDeal(input.id, dueAt) : undefined;
  const deal = createDealSnapshot({
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
  });

  if (dueAt && taskId && input.followUpTask) {
    createTaskSnapshot({
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
    });
  }

  return deal;
}
