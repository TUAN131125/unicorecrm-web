import { useAuthoritativeResource } from "@/shared/operations";
import { getActivityCollectionResource, getScopedTaskCollectionResource, getTaskApiRuntime } from "@/modules/tasks";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";

export function useLeadDetailWorkResources(leadId: string) {
  // Re-render on workspace changes; the Tasks boundary resets its resources and projection.
  useWorkspaceContextSnapshot();
  const query = { filters: { recordModuleKey: "leads", recordId: leadId } };
  const taskQuery = useAuthoritativeResource(getScopedTaskCollectionResource(query), { enabled: Boolean(leadId) });
  const activityQuery = useAuthoritativeResource(getActivityCollectionResource(query), { enabled: Boolean(leadId) });
  const tasks = (taskQuery.data?.items ?? []).filter((task) => !task.archivedAt);
  const activities = activityQuery.data?.items ?? [];
  const openTasks = tasks.filter((task) => task.status === "OPEN")
    .sort((left, right) => Date.parse(left.dueAt) - Date.parse(right.dueAt) || left.id.localeCompare(right.id));
  const completedTasks = tasks.filter((task) => task.status === "COMPLETED" || task.status === "CANCELLED")
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt) || left.id.localeCompare(right.id));
  const now = Date.now();
  return {
    tasks, activities, openTasks, completedTasks,
    overdueTasks: openTasks.filter((task) => Date.parse(task.dueAt) < now),
    nextTask: openTasks[0],
    taskQuery: { ...taskQuery, connected: getTaskApiRuntime().mode === "connected" },
    activityQuery: { ...activityQuery, connected: getTaskApiRuntime().mode === "connected" },
  };
}
