import {
  createAuthoritativeResource,
  runBackendProjection,
  subscribeModuleQueryInvalidation,
  type AuthoritativePage,
  type AuthoritativeResource,
} from "@/shared/application";
import type { Activity, Task } from "../../domain/model/task.types";
import type { ActivityListQuery } from "../ports/TaskApiRuntime";
import { getTaskApiRuntime, taskActivityRepository } from "../composition/taskApplicationServices";

const PAGE_SIZE = 250;
const MAX_PAGES = 20;

const taskCollection = createTaskCollectionResource();
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
  const key = JSON.stringify(query);
  let resource = activityCollections.get(key);
  if (!resource) {
    resource = createActivityCollectionResource(query);
    activityCollections.set(key, resource);
  }
  return resource;
}

function createTaskCollectionResource(): AuthoritativeResource<AuthoritativePage<Task>> {
  const resource = createAuthoritativeResource(async (signal) => {
    const page = await loadAllPages((cursor) => getTaskApiRuntime().queries.list({ limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) }, signal));
    runBackendProjection("tasks", () => {
      const current = taskActivityRepository.snapshot();
      taskActivityRepository.replace({ tasks: page.items, activities: current.activities });
    });
    return page;
  });
  subscribeModuleQueryInvalidation("tasks", async () => {
    if (resource.getSnapshot().state !== "IDLE") await resource.refresh();
  });
  return resource;
}

function createTaskDetailResource(taskId: string): AuthoritativeResource<Task> {
  const resource = createAuthoritativeResource(async (signal) => {
    const task = await getTaskApiRuntime().queries.get(taskId, signal);
    runBackendProjection("tasks", () => {
      const current = taskActivityRepository.snapshot();
      const tasks = current.tasks.some((item) => item.id === task.id)
        ? current.tasks.map((item) => item.id === task.id ? task : item)
        : [...current.tasks, task];
      taskActivityRepository.replace({ tasks, activities: current.activities });
    });
    return task;
  });
  subscribeModuleQueryInvalidation("tasks", async () => {
    if (resource.getSnapshot().state !== "IDLE") await resource.refresh();
  });
  return resource;
}

function createActivityCollectionResource(query: ActivityListQuery): AuthoritativeResource<AuthoritativePage<Activity>> {
  const resource = createAuthoritativeResource(async (signal) => {
    const page = await loadAllPages((cursor) => getTaskApiRuntime().queries.listActivities({ ...query, limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) }, signal));
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
  subscribeModuleQueryInvalidation("tasks", async () => {
    if (resource.getSnapshot().state !== "IDLE") await resource.refresh();
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
