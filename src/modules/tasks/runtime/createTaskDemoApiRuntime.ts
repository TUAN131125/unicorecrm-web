import type { AuthoritativePage } from "@/shared/application";
import type {
  ActivityListQuery,
  ActivityMutationResult,
  ArchiveTaskInput,
  AssignTaskInput,
  CancelTaskInput,
  CompleteTaskInput,
  CreateTaskInput,
  LogActivityInput,
  RescheduleTaskInput,
  TaskApiRuntime,
  TaskCommandOptions,
  TaskListQuery,
  TaskMutationEvidence,
  TaskMutationResult,
  TaskVersionedCommandOptions,
} from "../application/ports/TaskApiRuntime";
import type { TaskActivityRepository } from "../application/ports/TaskActivityRepository";
import { archiveTask, cancelTask, completeTask, createTask, logActivity, reassignTask, rescheduleTask } from "../application/commands/taskCommands";
import { queryTasks } from "../application/queries/taskQueries";
import type { Activity, Task } from "../domain/model/task.types";

export function createTaskDemoApiRuntime(repository: TaskActivityRepository, workspaceId: () => string): TaskApiRuntime {
  return {
    mode: "demo",
    queries: {
      async list(query: TaskListQuery = {}): Promise<AuthoritativePage<Task>> {
        const filters = query.filters ?? {};
        const items = queryTasks(repository, compact({
          search: query.search,
          status: filters.status,
          priority: filters.priority,
          assigneeId: filters.assigneeId,
        })).filter((task) => !task.archivedAt);
        return page(items, "demo");
      },
      async get(taskId: string): Promise<Task> {
        const task = repository.findTaskById(taskId);
        if (!task) throw new Error(`TASK_NOT_FOUND:${taskId}`);
        return structuredClone(task);
      },
      async listActivities(query: ActivityListQuery = {}): Promise<AuthoritativePage<Activity>> {
        const filters = query.filters ?? {};
        const search = query.search?.trim().toLowerCase() ?? "";
        const items = repository.listActivities()
          .filter((activity) => !filters.type || activity.type === filters.type)
          .filter((activity) => !filters.actorId || activity.actorId === filters.actorId)
          .filter((activity) => !filters.relationshipType || activity.relationshipRef?.type === filters.relationshipType)
          .filter((activity) => !filters.relationshipId || activity.relationshipRef?.id === filters.relationshipId)
          .filter((activity) => !filters.recordModuleKey || activity.recordRef?.moduleKey === filters.recordModuleKey)
          .filter((activity) => !filters.recordId || activity.recordRef?.recordId === filters.recordId)
          .filter((activity) => !filters.occurredFrom || activity.occurredAt >= filters.occurredFrom)
          .filter((activity) => !filters.occurredTo || activity.occurredAt <= filters.occurredTo)
          .filter((activity) => !search || `${activity.subject} ${activity.body ?? ""}`.toLowerCase().includes(search))
          .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
        return page(items, "demo");
      },
    },
    commands: {
      async createTask(input: CreateTaskInput, options: TaskCommandOptions): Promise<TaskMutationResult> {
        const now = new Date().toISOString();
        const task = createTask(repository, {
          id: `task_demo_${crypto.randomUUID()}`,
          workspaceId: workspaceId(),
          title: input.title,
          assigneeId: input.assigneeId,
          dueAt: input.dueAt,
          actorId: "demo-actor",
          actorName: "Demo User",
          now,
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.priority !== undefined ? { priority: input.priority } : {}),
          ...(input.relationshipRef !== undefined ? { relationshipRef: input.relationshipRef } : {}),
          ...(input.recordRef !== undefined ? { recordRef: input.recordRef } : {}),
          ...(input.sourceRef !== undefined ? { sourceRef: input.sourceRef } : {}),
          ...(input.dedupeKey !== undefined ? { dedupeKey: input.dedupeKey } : {}),
          ...(options.correlationId !== undefined ? { correlationId: options.correlationId } : {}),
        });
        return taskResult(task, options, now);
      },
      async completeTask(taskId: string, input: CompleteTaskInput, options: TaskVersionedCommandOptions): Promise<TaskMutationResult> {
        assertVersion(repository, taskId, options.expectedVersion);
        const now = new Date().toISOString();
        return taskResult(completeTask(repository, taskId, { outcome: input.outcome, actorId: "demo-actor", actorName: "Demo User", now, correlationId: options.correlationId }), options, now);
      },
      async cancelTask(taskId: string, input: CancelTaskInput, options: TaskVersionedCommandOptions): Promise<TaskMutationResult> {
        assertVersion(repository, taskId, options.expectedVersion);
        const now = new Date().toISOString();
        return taskResult(cancelTask(repository, taskId, { reason: input.reason, actorId: "demo-actor", actorName: "Demo User", now, correlationId: options.correlationId }), options, now);
      },
      async assignTask(taskId: string, input: AssignTaskInput, options: TaskVersionedCommandOptions): Promise<TaskMutationResult> {
        assertVersion(repository, taskId, options.expectedVersion);
        const now = new Date().toISOString();
        return taskResult(reassignTask(repository, taskId, { assigneeId: input.assigneeId, actorId: "demo-actor", actorName: "Demo User", now }), options, now);
      },
      async rescheduleTask(taskId: string, input: RescheduleTaskInput, options: TaskVersionedCommandOptions): Promise<TaskMutationResult> {
        assertVersion(repository, taskId, options.expectedVersion);
        const now = new Date().toISOString();
        return taskResult(rescheduleTask(repository, taskId, { dueAt: input.dueAt, actorId: "demo-actor", actorName: "Demo User", now }), options, now);
      },
      async archiveTask(taskId: string, input: ArchiveTaskInput, options: TaskVersionedCommandOptions): Promise<TaskMutationResult> {
        assertVersion(repository, taskId, options.expectedVersion);
        const now = new Date().toISOString();
        return taskResult(archiveTask(repository, taskId, { reason: input.reason, actorId: "demo-actor", actorName: "Demo User", now, correlationId: options.correlationId }), options, now);
      },
      async logActivity(input: LogActivityInput, options: TaskCommandOptions): Promise<ActivityMutationResult> {
        const now = new Date().toISOString();
        const activity = logActivity(repository, {
          id: `activity_demo_${crypto.randomUUID()}`,
          workspaceId: workspaceId(),
          type: input.type,
          subject: input.subject,
          actorId: "demo-actor",
          actorName: "Demo User",
          occurredAt: now,
          ...(input.body !== undefined ? { body: input.body } : {}),
          ...(input.relationshipRef !== undefined ? { relationshipRef: input.relationshipRef } : {}),
          ...(input.recordRef !== undefined ? { recordRef: input.recordRef } : {}),
          ...(input.sourceRef !== undefined ? { sourceRef: input.sourceRef } : {}),
          ...(options.correlationId !== undefined ? { correlationId: options.correlationId } : {}),
        });
        return { activity, evidence: evidence(activity.id, 1, options, now, "activity") };
      },
    },
  };
}

function page<T>(items: T[], authority: "demo"): AuthoritativePage<T> {
  return { items: structuredClone(items), pageInfo: { hasNextPage: false, totalCount: items.length }, loadedAt: new Date().toISOString(), authority };
}

function taskResult(task: Task, options: TaskCommandOptions, now: string): TaskMutationResult {
  const version = task.resourceVersion ?? 1;
  const versioned = task.resourceVersion === undefined ? { ...task, resourceVersion: version } : task;
  return { task: versioned, evidence: evidence(task.id, version, options, now, "task") };
}

function evidence(aggregateId: string, version: number, options: TaskCommandOptions, now: string, aggregateType: string): TaskMutationEvidence {
  return {
    authority: "demo",
    commandId: options.idempotencyKey,
    correlationId: options.correlationId ?? `corr_${crypto.randomUUID()}`,
    aggregateId,
    aggregateType,
    version,
    occurredAt: now,
    outcome: "DEMO_COMMITTED",
    warnings: [],
    emittedEventIds: [],
    auditEvidenceIds: [],
  };
}

function assertVersion(repository: TaskActivityRepository, taskId: string, expectedVersion: number): void {
  const task = repository.findTaskById(taskId);
  if (!task) throw new Error(`TASK_NOT_FOUND:${taskId}`);
  const actual = task.resourceVersion ?? expectedVersion;
  if (actual !== expectedVersion) throw new Error(`TASK_VERSION_CONFLICT:${taskId}`);
}

function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}
