import { useEffect, useSyncExternalStore } from "react";
import { getAuthSessionSnapshot } from "@/platform/identity-auth";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";
import { getTaskApiRuntime, type Task } from "@/modules/tasks";
import { createAuthoritativeResource, subscribeModuleQueryInvalidation, type AuthoritativePage } from "@/shared/application";
import { useAuthoritativeResource } from "@/shared/operations";
import { getContactRelationshipAuthority, subscribeContactRelationshipAuthority } from "../model/contactRelationshipAuthority";


const resources = new Map<string, ReturnType<typeof createEntry>>();
let currentScope: string | undefined;
let activeRecord: string | undefined;
let recordGeneration = 0;

function createEntry(recordId: string, scope: string) {
  const generation = recordGeneration;
  let cursor: string | undefined;
  let retained: Task[] = [];
  let readers = 0;
  const resource = createAuthoritativeResource<AuthoritativePage<Task>>(async signal => {
    const next = await getTaskApiRuntime().queries.list({
      limit: 50, ...(cursor ? { cursor } : {}),
      filters: { recordModuleKey: "contacts", recordId },
    }, signal);
    signal.throwIfAborted();
    if (scope !== getContactRelationshipAuthority() || generation !== recordGeneration) throw new DOMException("Task read authority changed", "AbortError");
    const rows = cursor ? [...retained, ...next.items] : next.items;
    retained = [...new Map(rows.filter(task => task.recordRef?.moduleKey === "contacts" && task.recordRef.recordId === recordId).map(task => [task.id, task])).values()].slice(0, 500);
    return { ...next, items: retained };
  });
  const refresh = () => { cursor = undefined; return resource.refresh(); };
  const stop = subscribeModuleQueryInvalidation("tasks", async () => { if (readers > 0 && resource.getSnapshot().state !== "IDLE") await refresh(); });
  return {
    resource, refresh,
    retain() { readers++; return () => { readers--; if (!readers) resource.cancel(); }; },
    dispose() { stop(); resource.reset(); retained = []; },
    reset() { cursor = undefined; retained = []; resource.reset(); },
    async loadMore() {
      if (resource.getSnapshot().state === "LOADING" || retained.length >= 500) return;
      const data = resource.getSnapshot().data;
      if (!data?.pageInfo.hasNextPage || !data.pageInfo.nextCursor) return;
      cursor = data.pageInfo.nextCursor;
      await resource.refresh();
    },
  };
}

export function useContactTasksQuery(recordId: string | undefined) {
  const scope = useSyncExternalStore(subscribeContactRelationshipAuthority, getContactRelationshipAuthority, getContactRelationshipAuthority);
  const access = useEffectiveAccess();
  const connected = getTaskApiRuntime().mode === "connected";
  if (currentScope !== scope || activeRecord !== recordId) {
    const previous = [...resources.values()];
    resources.clear(); currentScope = scope; activeRecord = recordId; recordGeneration++;
    queueMicrotask(() => previous.forEach(entry => entry.dispose()));
  }
  const key = `${scope}:${recordId ?? "missing"}`;
  let entry = resources.get(key);
  if (!entry) { entry = createEntry(recordId ?? "missing", scope); resources.set(key, entry); }
  const session = getAuthSessionSnapshot();
  const enabled = session?.status === "ACTIVE" && session.principal.accountId === access.accountId && connected && Boolean(recordId) && access.can(CAPABILITIES.CONTACTS_READ) && access.can(CAPABILITIES.TASKS_READ) && ["id", "title", "status", "dueAt"].every(field => access.getFieldAccess("tasks", field) !== "HIDDEN");
  const query = useAuthoritativeResource(entry.resource, { enabled });
  useEffect(() => entry.retain(), [entry]);
  useEffect(() => { if (!enabled) entry.reset(); }, [enabled, entry]);
  return {
    connected, enabled, loading: query.loading, error: query.error,
    state: query.state, stale: query.stale, refresh: entry.refresh,
    atLimit: (query.data?.items.length ?? 0) >= 500,
    items: enabled && !query.loading && !query.error ? query.data?.items ?? [] : [],
    hasNextPage: enabled && !query.error && query.data?.pageInfo.hasNextPage === true,
    loadMore: entry.loadMore,
  };
}
