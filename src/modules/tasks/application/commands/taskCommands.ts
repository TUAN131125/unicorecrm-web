import { recordOperationalAudit } from "@/platform/operational-audit";
import type { RelationshipRef } from "@/platform/identity";
import type { TaskActivityRepository } from "../ports/TaskActivityRepository";
import type { Activity, ActivityType, RecordRef, Task, TaskPriority, TaskSourceRef } from "../../domain/model/task.types";
import { canTransitionTask } from "../../domain/rules/taskLifecycle";
import { CAPABILITIES, assertRuntimeCommandAccess, assertRuntimeCapability, assertRuntimeWorkspaceAccess } from "@/platform/access-control";
import { assertDestructiveActionAllowed } from "@/shared/application";
import { publishNotification } from "@/platform/notifications";

export interface CreateTaskCommand {
  id: string;
  workspaceId: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
  assigneeId: string;
  dueAt: string;
  customerId?: string;
  relationshipRef?: RelationshipRef;
  recordRef?: RecordRef;
  sourceRef?: TaskSourceRef;
  dedupeKey?: string;
  actorId: string;
  actorName?: string;
  now?: string;
  correlationId?: string;
}

export function createTask(repository: TaskActivityRepository, command: CreateTaskCommand): Task {
  assertRuntimeWorkspaceAccess(command.workspaceId);
  assertRuntimeCapability(CAPABILITIES.TASKS_CREATE);
  if (!command.title.trim()) throw new Error("Task title is required.");
  if (!command.assigneeId.trim()) throw new Error("Task assignee is required.");
  if (!command.dueAt) throw new Error("Task due date is required.");
  if (command.dedupeKey) {
    const existing = repository.findTaskByDedupeKey(command.dedupeKey);
    if (existing) return existing;
  }
  const now = command.now ?? new Date().toISOString();
  const task: Task = {
    id: command.id,
    workspaceId: command.workspaceId,
    title: command.title.trim(),
    description: command.description?.trim() || undefined,
    status: "OPEN",
    priority: command.priority ?? "NORMAL",
    assigneeId: command.assigneeId,
    dueAt: command.dueAt,
    customerId: command.customerId,
    relationshipRef: command.relationshipRef,
    recordRef: command.recordRef,
    sourceRef: command.sourceRef,
    dedupeKey: command.dedupeKey,
    createdAt: now,
    updatedAt: now,
  };
  const saved = repository.saveTask(task);
  recordOperationalAudit({ moduleKey: "tasks", recordId: saved.id, action: "TaskCreated", actorId: command.actorId, actorName: command.actorName, correlationId: command.correlationId, after: saved });
  publishNotification({
    id: `notification_task_assigned_${saved.id}_${saved.assigneeId}`,
    recipientMemberId: saved.assigneeId,
    category: "work",
    type: "TASK_ASSIGNED",
    title: "Công việc được giao",
    message: saved.title,
    priority: saved.priority === "URGENT" ? "urgent" : saved.priority === "HIGH" ? "high" : saved.priority === "LOW" ? "low" : "medium",
    entityRef: { moduleKey: "tasks", recordId: saved.id, label: saved.title },
    route: `/tasks/${saved.id}`,
    sourceEventId: command.correlationId,
    dedupeKey: `task-assigned:${saved.id}:${saved.assigneeId}`,
    createdAt: now,
  });
  return saved;
}

export function completeTask(repository: TaskActivityRepository, taskId: string, input: { actorId: string; actorName?: string; outcome: string; now?: string; correlationId?: string }): Task {
  const current = repository.findTaskById(taskId);
  if (!current) throw new Error(`Task ${taskId} not found.`);
  assertRuntimeCommandAccess(CAPABILITIES.TASKS_COMPLETE, "tasks", current);
  if (!canTransitionTask(current.status, "COMPLETED")) throw new Error("Task cannot be completed from its current state.");
  if (!input.outcome.trim()) throw new Error("Task completion requires an outcome.");
  const now = input.now ?? new Date().toISOString();
  const saved = repository.saveTask({ ...current, status: "COMPLETED", outcome: input.outcome.trim(), completedAt: now, updatedAt: now });
  recordOperationalAudit({ moduleKey: "tasks", recordId: saved.id, action: "TaskCompleted", actorId: input.actorId, actorName: input.actorName, correlationId: input.correlationId, before: current, after: saved });
  return saved;
}

export function cancelTask(repository: TaskActivityRepository, taskId: string, input: { actorId: string; actorName?: string; reason: string; now?: string; correlationId?: string }): Task {
  const current = repository.findTaskById(taskId);
  if (!current) throw new Error(`Task ${taskId} not found.`);
  assertRuntimeCommandAccess(CAPABILITIES.TASKS_UPDATE, "tasks", current);
  if (!canTransitionTask(current.status, "CANCELLED")) throw new Error("Task cannot be cancelled from its current state.");
  if (!input.reason.trim()) throw new Error("Task cancellation requires a reason.");
  const now = input.now ?? new Date().toISOString();
  const saved = repository.saveTask({ ...current, status: "CANCELLED", cancellationReason: input.reason.trim(), cancelledAt: now, updatedAt: now });
  recordOperationalAudit({ moduleKey: "tasks", recordId: saved.id, action: "TaskCancelled", actorId: input.actorId, actorName: input.actorName, reason: input.reason.trim(), correlationId: input.correlationId, before: current, after: saved });
  return saved;
}

export function archiveTask(repository: TaskActivityRepository, taskId: string, input: { actorId: string; actorName?: string; reason: string; now?: string; correlationId?: string }): Task {
  const current = repository.findTaskById(taskId);
  if (!current) throw new Error(`Task ${taskId} not found.`);
  assertRuntimeCommandAccess(CAPABILITIES.TASKS_UPDATE, "tasks", current);
  assertDestructiveActionAllowed({ recordType: "Task", retentionClass: "OPERATIONAL", action: "ARCHIVE", reason: input.reason });
  const now = input.now ?? new Date().toISOString();
  const saved = repository.saveTask({ ...current, archivedAt: now, archiveReason: input.reason.trim(), updatedAt: now });
  recordOperationalAudit({ moduleKey: "tasks", recordId: saved.id, action: "TaskArchived", actorId: input.actorId, actorName: input.actorName, reason: input.reason.trim(), correlationId: input.correlationId, before: current, after: saved });
  return saved;
}

export function reassignTask(repository: TaskActivityRepository, taskId: string, input: { assigneeId: string; actorId: string; actorName?: string; now?: string }): Task {
  const current = repository.findTaskById(taskId);
  if (!current) throw new Error(`Task ${taskId} not found.`);
  assertRuntimeCommandAccess(CAPABILITIES.TASKS_ASSIGN, "tasks", current);
  if (current.status !== "OPEN") throw new Error("Only open Tasks can be reassigned.");
  if (!input.assigneeId.trim()) throw new Error("Task assignee is required.");
  const now = input.now ?? new Date().toISOString();
  const saved = repository.saveTask({ ...current, assigneeId: input.assigneeId, updatedAt: now });
  recordOperationalAudit({ moduleKey: "tasks", recordId: saved.id, action: "TaskAssigned", actorId: input.actorId, actorName: input.actorName, before: current, after: saved });
  if (current.assigneeId !== saved.assigneeId) {
    publishNotification({
      id: `notification_task_reassigned_${saved.id}_${saved.assigneeId}_${now}`,
      recipientMemberId: saved.assigneeId,
      category: "work",
      type: "TASK_REASSIGNED",
      title: "Công việc được chuyển cho bạn",
      message: saved.title,
      priority: saved.priority === "URGENT" ? "urgent" : saved.priority === "HIGH" ? "high" : saved.priority === "LOW" ? "low" : "medium",
      entityRef: { moduleKey: "tasks", recordId: saved.id, label: saved.title },
      route: `/tasks/${saved.id}`,
      sourceEventId: `task-assigned:${saved.id}:${now}`,
      dedupeKey: `task-reassigned:${saved.id}:${saved.assigneeId}:${now}`,
      createdAt: now,
    });
  }
  return saved;
}


export function rescheduleTask(repository: TaskActivityRepository, taskId: string, input: { dueAt: string; actorId: string; actorName?: string; now?: string }): Task {
  const current = repository.findTaskById(taskId);
  if (!current) throw new Error(`Task ${taskId} not found.`);
  assertRuntimeCommandAccess(CAPABILITIES.TASKS_UPDATE, "tasks", current);
  if (current.status !== "OPEN") throw new Error("Only open Tasks can be rescheduled.");
  if (!input.dueAt) throw new Error("Task due date is required.");
  const now = input.now ?? new Date().toISOString();
  const saved = repository.saveTask({ ...current, dueAt: input.dueAt, updatedAt: now });
  recordOperationalAudit({ moduleKey: "tasks", recordId: saved.id, action: "TaskRescheduled", actorId: input.actorId, actorName: input.actorName, before: current, after: saved });
  return saved;
}

export interface LogActivityCommand {
  id: string;
  workspaceId: string;
  type: ActivityType;
  subject: string;
  body?: string;
  actorId: string;
  actorName?: string;
  occurredAt?: string;
  customerId?: string;
  relationshipRef?: RelationshipRef;
  recordRef?: RecordRef;
  sourceRef?: TaskSourceRef;
  correlationId?: string;
}

export function logActivity(repository: TaskActivityRepository, command: LogActivityCommand): Activity {
  assertRuntimeWorkspaceAccess(command.workspaceId);
  assertRuntimeCapability(CAPABILITIES.TASKS_UPDATE);
  if (!command.subject.trim()) throw new Error("Activity subject is required.");
  const activity: Activity = {
    id: command.id,
    workspaceId: command.workspaceId,
    type: command.type,
    subject: command.subject.trim(),
    body: command.body?.trim() || undefined,
    actorId: command.actorId,
    occurredAt: command.occurredAt ?? new Date().toISOString(),
    customerId: command.customerId,
    relationshipRef: command.relationshipRef,
    recordRef: command.recordRef,
    sourceRef: command.sourceRef,
  };
  const saved = repository.saveActivity(activity);
  recordOperationalAudit({ moduleKey: "tasks", recordId: saved.id, action: "ActivityLogged", actorId: command.actorId, actorName: command.actorName, correlationId: command.correlationId, after: saved });
  return saved;
}
