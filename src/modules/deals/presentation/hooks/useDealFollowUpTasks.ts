import React from "react";
import { useAuthSessionSnapshot } from "@/platform/identity-auth";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { useEffectiveAccess } from "@/platform/access-control";
import { getTaskApiRuntime, getTaskReadAuthorityScope, type Task } from "@/modules/tasks";
import { formatApplicationError } from "@/shared/operations";
import { getDealApiRuntime } from "../../application/composition/dealApplicationServices";
import type { Deal } from "../../domain/model/deal.types";

export function useDealFollowUpTasks(dealId: string, locale: "vi" | "en") {
  useAuthSessionSnapshot(); useWorkspaceContextSnapshot();
  const access = useEffectiveAccess();
  const authority = getTaskReadAuthorityScope();
  const enabled = authority !== undefined && access.canPerform("tasks", "read") && access.canPerform("deals", "read");
  const mayCreate = authority !== undefined && access.canPerform("tasks", "create") && access.canPerform("deals", "read");
  const [cursor, setCursor] = React.useState<string>();
  const [revision, refresh] = React.useReducer((n: number) => n + 1, 0);
  const [state, setState] = React.useState<{ key: string; tasks: Task[]; loading: boolean; error: string; next?: string; deal?: Deal }>({ key: "", tasks: [], loading: true, error: "" });
  const key = JSON.stringify([authority, dealId, cursor, revision]);
  React.useEffect(() => setCursor(undefined), [authority, dealId]);
  React.useEffect(() => {
    if (!enabled && !mayCreate) return;
    const abort = new AbortController(); let retired = false;
    setState({ key, tasks: [], loading: true, error: "" });
    void (async () => {
      const deal = await getDealApiRuntime().queries.get(dealId, abort.signal);
      const page = enabled ? await getTaskApiRuntime().queries.list({ limit: 20, sortBy: "createdAt", sortDirection: "desc",
        filters: { recordModuleKey: "deals", recordId: dealId }, ...(cursor ? { cursor } : {}) }, abort.signal) : { items: [], pageInfo: { hasNextPage: false, nextCursor: undefined } };
      return { deal, page };
    })().then(({ deal, page }) => {
        if (!retired && !abort.signal.aborted && authority === getTaskReadAuthorityScope())
          setState({ key, deal, tasks: page.items, loading: false, error: "", ...(page.pageInfo.nextCursor ? { next: page.pageInfo.nextCursor } : {}) });
      }).catch(error => {
        if (!retired && !abort.signal.aborted && authority === getTaskReadAuthorityScope())
          setState({ key, tasks: [], loading: false, error: formatApplicationError(error, { locale }) });
      });
    return () => { retired = true; abort.abort(); };
  }, [authority, cursor, dealId, enabled, key, locale, mayCreate]);
  const current = (enabled || mayCreate) && state.key === key ? state : { tasks: [], loading: enabled || mayCreate, error: "", next: undefined, deal: undefined };
  return { ...current, authority, enabled, canCreate: mayCreate && current.deal !== undefined && !current.deal.archivedAt,
    reload: () => { setCursor(undefined); refresh(); }, nextPage: () => setCursor(current.next), firstPage: () => setCursor(undefined) };
}
