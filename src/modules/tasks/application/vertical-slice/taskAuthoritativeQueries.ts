import { registerWorkspaceScopeDisposer } from "@/platform/workspace-scope";
import {
  createAuthoritativeResource,
  runBackendProjection,
  runWorkspaceScopeReset,
  subscribeModuleQueryInvalidation,
  type AuthoritativePage,
  type AuthoritativeResource,
} from "@/shared/application";
import type { Activity, Task } from "../../domain/model/task.types";
import type { ActivityListQuery, TaskListQuery } from "../ports/TaskApiRuntime";
import { getTaskApiRuntime, taskActivityRepository } from "../composition/taskApplicationServices";

const PAGE_SIZE = 250;
const MAX_PAGES = 20;

const taskCollection = createTaskCollectionResource();
const scopedTaskCollections = new Map<string, AuthoritativeResource<AuthoritativePage<Task>>>();
const taskDetails = new Map<string, AuthoritativeResource<Task>>();
const activityCollections = new Map<string, AuthoritativeResource<AuthoritativePage<Activity>>>();

export function getTaskCollectionResource(): AuthoritativeResource<AuthoritativePage<Task>> {
  return taskCollection;
}

export function getTaskDetailResource(taskId: string): AuthoritativeResource<Task> {
  let resource = taskDetails.get(taskId);
  if (!resource) {
    resource = createTaskDetailResource(taskId);
    taskDetails.set(taskId, resource);
  }
  return resource;
}

export function getActivityCollectionResource(query: ActivityListQuery = {}): AuthoritativeResource<AuthoritativePage<Activity>> {
  const key = collectionQueryKey(query);
  let resource = activityCollections.get(key);
  if (!resource) {
    resource = createActivityCollectionResource(structuredClone(query));
    activityCollections.set(key, resource);
  }
  return resource;
}

export function getScopedTaskCollectionResource(
  query: Omit<TaskListQuery, "cursor" | "limit">,
): AuthoritativeResource<AuthoritativePage<Task>> {
  assertTaskIdentityQuery(query);
  const key = collectionQueryKey(query);
  let resource = scopedTaskCollections.get(key);
  if (!resource) {
    const scopedQuery = structuredClone(query);
    resource = createAuthoritativeResource(async (signal) => {
      const page = await loadAllPages((cursor) => getTaskApiRuntime().queries.list({
        ...scopedQuery, limit: PAGE_SIZE, ...(cursor ? { cursor } : {}),
      }, signal));
      signal.throwIfAborted();
      runBackendProjection("tasks", () => {
        const current = taskActivityRepository.snapshot();
        // The complete identity scope is replaced; unrelated records remain projected.
        const retained = current.tasks.filter((task) => !matchesTaskScope(task, scopedQuery));
        const tasks = dedupeById([...retained, ...page.items]);
        taskActivityRepository.replace({ tasks, activities: current.activities });
      });
      return page;
    });
    const created = resource;
    subscribeModuleQueryInvalidation("tasks", async (event) => {
      if (!isTaskMutation(event.commandType) || created.getSnapshot().state === "IDLE") return;
      const projected = taskActivityRepository.findTaskById(event.aggregateId);
      if (created.getSnapshot().data?.items.some((task) => task.id === event.aggregateId)
        || (projected && matchesTaskScope(projected, scopedQuery))) await created.refresh();
    });
    scopedTaskCollections.set(key, resource);
  }
  return resource;
}

function collectionQueryKey(query: TaskListQuery | ActivityListQuery): string {
  return JSON.stringify(query, [...new Set([
    ...Object.keys(query), ...Object.keys(query.filters ?? {}),
  ])].sort());
}

registerWorkspaceScopeDisposer(() => {
  const resources = [taskCollection, ...scopedTaskCollections.values(), ...taskDetails.values(), ...activityCollections.values()];
  for (const resource of resources) {
    if (resource.getSnapshot().state !== "IDLE") resource.reset();
  }
  runWorkspaceScopeReset(() => taskActivityRepository.replace({ tasks: [], activities: [] }));
});

function createTaskCollectionResource(): AuthoritativeResource<AuthoritativePage<Task>> {
  const resource = createAuthoritativeResource(async (signal) => {
    const page = await loadAllPages((cursor) => getTaskApiRuntime().queries.list({ limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) }, signal));
    signal.throwIfAborted();
    runBackendProjection("tasks", () => {
      const current = taskActivityRepository.snapshot();
      taskActivityRepository.replace({ tasks: page.items, activities: current.activities });
    });
    return page;
  });
  subscribeModuleQueryInvalidation("tasks", async (event) => {
    if (isTaskMutation(event.commandType) && resource.getSnapshot().state !== "IDLE") await resource.refresh();
  });
  return resource;
}

function createTaskDetailResource(taskId: string): AuthoritativeResource<Task> {
  const resource = createAuthoritativeResource(async (signal) => {
    const task = await getTaskApiRuntime().queries.get(taskId, signal);
    signal.throwIfAborted();
    runBackendProjection("tasks", () => {
      const current = taskActivityRepository.snapshot();
      const tasks = current.tasks.some((item) => item.id === task.id)
        ? current.tasks.map((item) => item.id === task.id ? task : item)
        : [...current.tasks, task];
      taskActivityRepository.replace({ tasks, activities: current.activities });
    });
    return task;
  });
  subscribeModuleQueryInvalidation("tasks", async (event) => {
    if (isTaskMutation(event.commandType) && event.aggregateId === taskId
      && resource.getSnapshot().state !== "IDLE") await resource.refresh();
  });
  return resource;
}

function createActivityCollectionResource(query: ActivityListQuery): AuthoritativeResource<AuthoritativePage<Activity>> {
  const resource = createAuthoritativeResource(async (signal) => {
    const page = await loadAllPages((cursor) => getTaskApiRuntime().queries.listActivities({ ...query, limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) }, signal));
    signal.throwIfAborted();
    runBackendProjection("tasks", () => {
      const current = taskActivityRepository.snapshot();
      const filters = query.filters ?? {};
      const hasScope = Boolean(filters.recordModuleKey || filters.recordId || filters.relationshipType || filters.relationshipId);
      const retained = hasScope ? current.activities.filter((activity) => !matchesActivityScope(activity, query)) : [];
      const activities = dedupeById([...page.items, ...retained]);
      taskActivityRepository.replace({ tasks: current.tasks, activities });
    });
    return page;
  });
  subscribeModuleQueryInvalidation("tasks", async (event) => {
    if (event.commandType !== "task.log-activity" || resource.getSnapshot().state === "IDLE") return;
    const projected = taskActivityRepository.snapshot().activities.find((activity) => activity.id === event.aggregateId);
    if (resource.getSnapshot().data?.items.some((activity) => activity.id === event.aggregateId)
      || (projected && matchesActivityScope(projected, query))) await resource.refresh();
  });
  return resource;
}

async function loadAllPages<T>(load: (cursor?: string) => Promise<AuthoritativePage<T>>): Promise<AuthoritativePage<T>> {
  const items: T[] = [];
  let cursor: string | undefined;
  let totalCount: number | undefined;
  let authority: AuthoritativePage<T>["authority"] = "backend";
  let loadedAt = new Date().toISOString();
  for (let index = 0; index < MAX_PAGES; index += 1) {
    const page = await load(cursor);
    items.push(...page.items);
    totalCount = page.pageInfo.totalCount ?? totalCount;
    authority = page.authority;
    loadedAt = page.loadedAt;
    if (!page.pageInfo.hasNextPage) {
      return { items, pageInfo: { hasNextPage: false, totalCount: totalCount ?? items.length }, loadedAt, authority };
    }
    cursor = page.pageInfo.nextCursor;
    if (!cursor) throw new Error("TASKS_AUTHORITATIVE_CURSOR_REQUIRED");
  }
  throw new Error("TASKS_AUTHORITATIVE_PAGE_LIMIT_EXCEEDED");
}

// Replacement requires a complete identity query, never a status/search subset.
function assertTaskIdentityQuery(query: Omit<TaskListQuery, "cursor" | "limit">): void {
  const filters = query.filters ?? {};
  const keys = ["recordModuleKey", "recordId", "relationshipType", "relationshipId"];
  const hasRecord = Boolean(filters.recordModuleKey && filters.recordId);
  const hasRelationship = Boolean(filters.relationshipType && filters.relationshipId);
  const partialRecord = Boolean(filters.recordModuleKey || filters.recordId) && !hasRecord;
  const partialRelationship = Boolean(filters.relationshipType || filters.relationshipId) && !hasRelationship;
  if ((!hasRecord && !hasRelationship) || partialRecord || partialRelationship
    || Object.keys(query).some((key) => key !== "filters")
    || Object.keys(filters).some((key) => !keys.includes(key))) {
    throw new Error("TASK_SCOPED_IDENTITY_QUERY_REQUIRED");
  }
}

function isTaskMutation(commandType: string): boolean {
  return ["task.create", "task.complete", "task.cancel", "task.assign", "task.reschedule", "task.archive"].includes(commandType);
}

function matchesTaskScope(task: Task, query: TaskListQuery): boolean {
  const filters = query.filters ?? {};
  if (filters.recordModuleKey && task.recordRef?.moduleKey !== filters.recordModuleKey) return false;
  if (filters.recordId && task.recordRef?.recordId !== filters.recordId) return false;
  if (filters.relationshipType && task.relationshipRef?.type !== filters.relationshipType) return false;
  if (filters.relationshipId && task.relationshipRef?.id !== filters.relationshipId) return false;
  return true;
}

function matchesActivityScope(activity: Activity, query: ActivityListQuery): boolean {
  const filters = query.filters ?? {};
  if (filters.recordModuleKey && activity.recordRef?.moduleKey !== filters.recordModuleKey) return false;
  if (filters.recordId && activity.recordRef?.recordId !== filters.recordId) return false;
  if (filters.relationshipType && activity.relationshipRef?.type !== filters.relationshipType) return false;
  if (filters.relationshipId && activity.relationshipRef?.id !== filters.relationshipId) return false;
  return true;
}

function dedupeById<T extends { id: string }>(records: readonly T[]): T[] {
  return [...new Map(records.map((record) => [record.id, record])).values()];
}
