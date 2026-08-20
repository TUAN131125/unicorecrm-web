import { assertCustomerRelationshipContextSnapshot, saveCustomerCareCardSnapshot, type CustomerCareCard, type CustomerCareCardPriority, type CustomerCareCardType } from "@/modules/customers";
import { createTaskSnapshot, getTasksForCustomerSnapshot, logActivitySnapshot, type Task } from "@/modules/tasks";
import { getWorkspaceContextSnapshot } from "@/platform/workspace-context";

export interface CreateCustomerCareCardWithTaskInput {
  cardId: string;
  taskId: string;
  customerId: string;
  type: CustomerCareCardType;
  title: string;
  description?: string;
  priority?: CustomerCareCardPriority;
  ownerId: string;
  dueAt?: string;
  taskTitle: string;
  actorId: string;
  now?: string;
}

export function createCustomerCareCardWithTask(input: CreateCustomerCareCardWithTaskInput): { card: CustomerCareCard; task: Task } {
  const { customer, relationshipRef } = assertCustomerRelationshipContextSnapshot(input.customerId);
  const workspaceId = getWorkspaceContextSnapshot().workspaceId;
  const now = input.now ?? new Date().toISOString();
  const existingTask = getTasksForCustomerSnapshot(customer.id).find((task) => task.dedupeKey === `customer-care:${input.cardId}:primary`);
  const task = existingTask ?? createTaskSnapshot({
    id: input.taskId,
    customerId: customer.id,
    relationshipRef,
    title: input.taskTitle,
    description: input.description,
    priority: input.priority ?? "NORMAL",
    assigneeId: input.ownerId,
    dueAt: input.dueAt ?? now,
    recordRef: { moduleKey: "customers", recordId: input.cardId, label: input.title },
    sourceRef: { type: "CUSTOMER_CARE_CARD", id: input.cardId },
    dedupeKey: `customer-care:${input.cardId}:primary`,
    actorId: input.actorId,
    now,
  });

  const card = saveCustomerCareCardSnapshot({
    id: input.cardId,
    workspaceId,
    customerId: customer.id,
    type: input.type,
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    status: task.status === "COMPLETED" ? "COMPLETED" : "OPEN",
    priority: input.priority ?? "NORMAL",
    ownerId: input.ownerId,
    dueAt: input.dueAt,
    primaryTaskId: task.id,
    taskIds: [task.id],
    createdAt: now,
    updatedAt: now,
  });

  logActivitySnapshot({
    id: `activity_care_card_${card.id}`,
    type: "SYSTEM",
    subject: `Care card created: ${card.title}`,
    body: `Primary Task: ${task.title}`,
    actorId: input.actorId,
    occurredAt: now,
    customerId: customer.id,
    relationshipRef,
    recordRef: { moduleKey: "customers", recordId: card.id, label: card.title },
    sourceRef: { type: "CUSTOMER_CARE_CARD", id: card.id },
  });

  return { card, task };
}

export function deriveCustomerCareCardProgress(card: CustomerCareCard): { completed: number; total: number; percent: number; derivedStatus: CustomerCareCard["status"] } {
  const tasks = getTasksForCustomerSnapshot(card.customerId).filter((task) => card.taskIds.includes(task.id));
  const completed = tasks.filter((task) => task.status === "COMPLETED").length;
  const total = tasks.length;
  return {
    completed,
    total,
    percent: total ? Math.round((completed / total) * 100) : 0,
    derivedStatus: total > 0 && completed === total ? "COMPLETED" : card.status,
  };
}
