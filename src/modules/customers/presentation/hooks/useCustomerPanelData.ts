import { useEffect, useMemo } from "react";
import { useEffectiveAccess } from "@/platform/access-control";
import { getTaskApiRuntime, type Activity, type Task } from "@/modules/tasks";
import { useAuthoritativeResource } from "@/shared/operations";
import { createCustomerPanelPage } from "../../application/queries/customerPanelPage";

const taskFields = ["id", "title", "status", "priority", "assigneeId", "dueAt", "recordRef"];
// Existing Activity reachability gate: WORKSPACE scope and no restrictive Task field policy.
// This does not invent Activity field-security or ownership semantics.
const activityFields = ["id", "title", "status", "priority", "assigneeId", "dueAt", "createdAt", "updatedAt", "resourceVersion", "description", "completedAt", "cancelledAt", "cancellationReason", "outcome", "relationshipRef", "recordRef", "sourceRef", "archivedAt", "archiveReason"];

export function useCustomerPanelData(customerId: string, historyOpen: boolean, visible: boolean) {
  const access = useEffectiveAccess();
  const taskEntry = useMemo(() => createCustomerPanelPage<Task>(customerId, (cursor, signal) =>
    getTaskApiRuntime().queries.list({ limit: 50, ...(cursor ? { cursor } : {}), filters: { recordModuleKey: "customers", recordId: customerId } }, signal)),
  [customerId, access.workspaceId, access.accountId, access.membershipId, access.authorityRevision]);
  const historyEntry = useMemo(() => createCustomerPanelPage<Activity>(customerId, (cursor, signal) =>
    getTaskApiRuntime().queries.listActivities({ limit: 50, sortDirection: "desc", ...(cursor ? { cursor } : {}), filters: { recordModuleKey: "customers", recordId: customerId } }, signal)),
  [customerId, access.workspaceId, access.accountId, access.membershipId, access.authorityRevision]);
  const readable = access.can("customers.view") && access.can("tasks.read") && getTaskApiRuntime().mode === "connected";
  // Authorization context emits canonical lowercase keys, unlike record evaluation,
  // which returns the caller's requested casing. Match the actual context vocabulary.
  const fieldAccess = (field: string) => access.getFieldAccess("tasks", field.toLowerCase());
  const tasksEnabled = readable && visible && taskFields.every(field => {
    const permission = fieldAccess(field);
    return permission === "READ_WRITE" || permission === "READ_ONLY";
  });
  const historySupported = access.getDataScope("tasks") === "WORKSPACE"
    && activityFields.every(field => fieldAccess(field) === "READ_WRITE");
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
