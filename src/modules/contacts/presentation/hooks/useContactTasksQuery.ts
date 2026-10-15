import { useEffect } from "react";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";
import { getTaskApiRuntime, type Task } from "@/modules/tasks";
import { createAuthoritativeResource, type AuthoritativePage } from "@/shared/application";
import { useModuleAuthoritativeResource } from "@/shared/operations";
import { getContactReadAuthorityScope } from "../../application/vertical-slice/contactReadAuthorityScope";
import { useContactReadAuthorityScope } from "./useContactReadAuthorityScope";

const resources = new Map<string, ReturnType<typeof createEntry>>();
let currentScope: string | undefined;

function createEntry(recordId: string, scope: string) {
  let cursor: string | undefined;
  let retained: Task[] = [];
  const resource = createAuthoritativeResource<AuthoritativePage<Task>>(async signal => {
    const next = await getTaskApiRuntime().queries.list({
      limit: 50, ...(cursor ? { cursor } : {}),
      filters: { recordModuleKey: "contacts", recordId },
    }, signal);
    signal.throwIfAborted();
    if (scope !== getContactReadAuthorityScope()) throw new DOMException("Task read authority changed", "AbortError");
    const rows = cursor ? [...retained, ...next.items] : next.items;
    retained = [...new Map(rows.map(task => [task.id, task])).values()];
    return { ...next, items: retained };
  });
  return {
    resource,
    reset() { cursor = undefined; retained = []; resource.reset(); },
    async loadMore() {
      const data = resource.getSnapshot().data;
      if (!data?.pageInfo.hasNextPage || !data.pageInfo.nextCursor) return;
      cursor = data.pageInfo.nextCursor;
      await resource.refresh();
    },
  };
}

export function useContactTasksQuery(recordId: string | undefined) {
  const scope = useContactReadAuthorityScope();
  const access = useEffectiveAccess();
  const connected = getTaskApiRuntime().mode === "connected";
  if (currentScope !== scope) {
    const previous = [...resources.values()];
    resources.clear(); currentScope = scope;
    queueMicrotask(() => previous.forEach(entry => entry.reset()));
  }
  const key = `${scope}:${recordId ?? "missing"}`;
  let entry = resources.get(key);
  if (!entry) { entry = createEntry(recordId ?? "missing", scope); resources.set(key, entry); }
  const enabled = connected && Boolean(recordId) && access.can(CAPABILITIES.CONTACTS_READ) && access.can(CAPABILITIES.TASKS_READ);
  const query = useModuleAuthoritativeResource(entry.resource, { enabled, scopeKey: key, onScopeChange: entry.reset });
  useEffect(() => { if (!enabled) entry.reset(); }, [enabled, entry]);
  return {
    connected, enabled, loading: query.loading, error: query.error,
    items: enabled && !query.loading && !query.error ? query.data?.items ?? [] : [],
    hasNextPage: enabled && !query.error && query.data?.pageInfo.hasNextPage === true,
    loadMore: entry.loadMore,
  };
}
