import { useEffect, useMemo } from "react";
import { useEffectiveAccess } from "@/platform/access-control";
import { getTaskApiRuntime, type Activity, type Task } from "@/modules/tasks";
import { createAuthoritativeResource, type AuthoritativePage } from "@/shared/application";
import { useAuthoritativeResource } from "@/shared/operations";

const activityFields = ["id", "title", "status", "priority", "assigneeId", "dueAt", "createdAt", "updatedAt", "resourceVersion", "description", "completedAt", "cancelledAt", "cancellationReason", "outcome", "relationshipRef", "recordRef", "sourceRef", "archivedAt", "archiveReason"];

// Instance-owned resources: the keyed Organization/authority boundary retires the entire instance.
function organizationPage<T extends { id: string; recordRef?: { moduleKey: string; recordId: string } }>(
  recordId: string, load: (cursor: string | undefined, signal: AbortSignal) => Promise<AuthoritativePage<T>>,
) {
  let cursor: string | undefined;
  let retained: T[] = [];
  const resource = createAuthoritativeResource(async signal => {
    const next = await load(cursor, signal);
    signal.throwIfAborted();
    const rows = cursor ? [...retained, ...next.items] : next.items;
    retained = [...new Map(rows.filter(row => row.recordRef?.moduleKey === "organizations" && row.recordRef.recordId === recordId).map(row => [row.id, row])).values()].slice(0, 500);
    return { ...next, items: retained };
  }, { shouldRetainDataOnError: () => false });
  return {
    resource,
    reset() { cursor = undefined; retained = []; resource.reset(); },
    refresh() { cursor = undefined; retained = []; return resource.refresh(); },
    async more() {
      const state = resource.getSnapshot();
      if (state.state === "LOADING" || retained.length >= 500 || !state.data?.pageInfo.hasNextPage || !state.data.pageInfo.nextCursor) return;
      cursor = state.data.pageInfo.nextCursor;
      await resource.refresh();
    },
  };
}

export function useOrganizationPanelData(recordId: string, historyOpen: boolean, visible: boolean) {
  const access = useEffectiveAccess();
  const taskEntry = useMemo(() => organizationPage<Task>(recordId, (cursor, signal) => getTaskApiRuntime().queries.list({ limit: 50, ...(cursor ? { cursor } : {}), filters: { recordModuleKey: "organizations", recordId } }, signal)), [recordId]);
  const historyEntry = useMemo(() => organizationPage<Activity>(recordId, (cursor, signal) => getTaskApiRuntime().queries.listActivities({ limit: 50, sortDirection: "desc", ...(cursor ? { cursor } : {}), filters: { recordModuleKey: "organizations", recordId } }, signal)), [recordId]);
  const readable = access.can("organizations.read") && access.can("tasks.read") && getTaskApiRuntime().mode === "connected";
  const tasksEnabled = readable && visible && ["id", "title", "status", "priority", "assigneeId", "dueAt", "recordRef"].every(field => access.getFieldAccess("tasks", field) !== "HIDDEN");
  // Mirror the existing backend Activity fail-closed contract; never invent Activity FLS/scope.
  const historySupported = access.getDataScope("tasks") === "WORKSPACE" && activityFields.every(field => access.getFieldAccess("tasks", field) === "READ_WRITE");
  const historyEnabled = readable && visible && historyOpen && historySupported;
  const tasks = useAuthoritativeResource(taskEntry.resource, { enabled: tasksEnabled });
  const history = useAuthoritativeResource(historyEntry.resource, { enabled: historyEnabled });
  useEffect(() => () => { taskEntry.reset(); historyEntry.reset(); }, [taskEntry, historyEntry]);
  useEffect(() => { if (!tasksEnabled) taskEntry.reset(); }, [tasksEnabled, taskEntry]);
  useEffect(() => { if (!historyEnabled) historyEntry.reset(); }, [historyEnabled, historyEntry]);
  return { readable, tasksEnabled, historySupported, tasks, history, taskEntry, historyEntry,
    taskItems: tasksEnabled && !tasks.loading && !tasks.error ? tasks.data?.items ?? [] : [],
    historyItems: historyEnabled && !history.loading && !history.error ? history.data?.items ?? [] : [] };
}
