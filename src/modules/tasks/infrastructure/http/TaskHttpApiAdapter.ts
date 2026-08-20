import type {
  ActivityListResponse,
  ActivityMutationResponse,
  ArchiveTaskRequest,
  AssignTaskRequest,
  CancelTaskRequest,
  CommercialApiClient,
  CompleteTaskRequest,
  RescheduleTaskRequest,
  TaskListResponse,
  TaskMutationResponse,
} from "@/platform/api/generated/commercialApi";
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
  TaskCommandOptions,
  TaskCommandPort,
  TaskListQuery,
  TaskMutationResult,
  TaskQueryPort,
  TaskVersionedCommandOptions,
} from "../../application/ports/TaskApiRuntime";
import type { Activity, Task } from "../../domain/model/task.types";
import {
  mapActivityMutationResponse,
  mapActivityReadModel,
  mapCreateTaskRequest,
  mapLogActivityRequest,
  mapTaskMutationResponse,
  mapTaskReadModel,
} from "./TaskApiMapper";

export class TaskHttpApiAdapter implements TaskQueryPort, TaskCommandPort {
  constructor(private readonly api: CommercialApiClient) {}

  async list(query: TaskListQuery = {}, signal?: AbortSignal): Promise<AuthoritativePage<Task>> {
    const filters = query.filters ?? {};
    const response = await this.api.listTasks<TaskListResponse>(compact({
      cursor: query.cursor,
      limit: query.limit,
      search: query.search,
      sortBy: query.sortBy as "updatedAt" | "createdAt" | "dueAt" | "priority" | "title" | undefined,
      sortDirection: query.sortDirection,
      status: filters.status,
      priority: filters.priority,
      assigneeId: filters.assigneeId,
      relationshipType: filters.relationshipType,
      relationshipId: filters.relationshipId,
      recordModuleKey: filters.recordModuleKey,
      recordId: filters.recordId,
      overdueAt: filters.overdueAt,
    }), signal);
    return {
      items: response.items.map(mapTaskReadModel),
      pageInfo: response.pageInfo,
      loadedAt: new Date().toISOString(),
      authority: "backend",
    };
  }

  async get(taskId: string, signal?: AbortSignal): Promise<Task> {
    return mapTaskReadModel(await this.api.getTask(taskId, signal));
  }

  async listActivities(query: ActivityListQuery = {}, signal?: AbortSignal): Promise<AuthoritativePage<Activity>> {
    const filters = query.filters ?? {};
    const response = await this.api.listActivities<ActivityListResponse>(compact({
      cursor: query.cursor,
      limit: query.limit,
      search: query.search,
      sortDirection: query.sortDirection,
      type: filters.type,
      actorId: filters.actorId,
      relationshipType: filters.relationshipType,
      relationshipId: filters.relationshipId,
      recordModuleKey: filters.recordModuleKey,
      recordId: filters.recordId,
      occurredFrom: filters.occurredFrom,
      occurredTo: filters.occurredTo,
    }), signal);
    return {
      items: response.items.map(mapActivityReadModel),
      pageInfo: response.pageInfo,
      loadedAt: new Date().toISOString(),
      authority: "backend",
    };
  }

  async createTask(input: CreateTaskInput, options: TaskCommandOptions): Promise<TaskMutationResult> {
    const response = await this.api.createTask<TaskMutationResponse>(mapCreateTaskRequest(input), options);
    return mapTaskMutationResponse(response);
  }

  async completeTask(taskId: string, input: CompleteTaskInput, options: TaskVersionedCommandOptions): Promise<TaskMutationResult> {
    const body: CompleteTaskRequest = { outcome: input.outcome.trim() };
    return mapTaskMutationResponse(await this.api.completeTask<TaskMutationResponse>(taskId, body, options));
  }

  async cancelTask(taskId: string, input: CancelTaskInput, options: TaskVersionedCommandOptions): Promise<TaskMutationResult> {
    const body: CancelTaskRequest = { reason: input.reason.trim() };
    return mapTaskMutationResponse(await this.api.cancelTask<TaskMutationResponse>(taskId, body, options));
  }

  async assignTask(taskId: string, input: AssignTaskInput, options: TaskVersionedCommandOptions): Promise<TaskMutationResult> {
    const body: AssignTaskRequest = { assigneeId: input.assigneeId.trim() };
    return mapTaskMutationResponse(await this.api.assignTask<TaskMutationResponse>(taskId, body, options));
  }

  async rescheduleTask(taskId: string, input: RescheduleTaskInput, options: TaskVersionedCommandOptions): Promise<TaskMutationResult> {
    const body: RescheduleTaskRequest = { dueAt: input.dueAt };
    return mapTaskMutationResponse(await this.api.rescheduleTask<TaskMutationResponse>(taskId, body, options));
  }

  async archiveTask(taskId: string, input: ArchiveTaskInput, options: TaskVersionedCommandOptions): Promise<TaskMutationResult> {
    const body: ArchiveTaskRequest = { reason: input.reason.trim() };
    return mapTaskMutationResponse(await this.api.archiveTask<TaskMutationResponse>(taskId, body, options));
  }

  async logActivity(input: LogActivityInput, options: TaskCommandOptions): Promise<ActivityMutationResult> {
    const response = await this.api.logActivity<ActivityMutationResponse>(mapLogActivityRequest(input), options);
    return mapActivityMutationResponse(response);
  }
}

function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}
