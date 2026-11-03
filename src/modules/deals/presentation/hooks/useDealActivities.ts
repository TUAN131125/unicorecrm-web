import React from "react";
import { useEffectiveAccess } from "@/platform/access-control";
import { getTaskApiRuntime, getTaskReadAuthorityScope, type Activity } from "@/modules/tasks";
import { subscribeModuleQueryInvalidation } from "@/shared/application";
import { formatApplicationError } from "@/shared/operations";
import { useDealSelectionAuthority } from "./useDealSelectionQueries";

/** One bounded page from the Activity owner, retired on session/workspace/permission changes. */
export function useDealActivities(dealId: string, locale: "vi" | "en") {
  useDealSelectionAuthority();
  const access = useEffectiveAccess();
  const authority = getTaskReadAuthorityScope();
  const enabled = authority !== undefined && access.canPerform("tasks", "read") && access.canPerform("deals", "read");
  const [cursor, setCursor] = React.useState<string>();
  const [revision, refresh] = React.useReducer((n: number) => n + 1, 0);
  const [state, setState] = React.useState<{ key: string; items: Activity[]; error?: string; next?: string }>();
  const key = JSON.stringify([authority, dealId, cursor, revision, enabled]);
  React.useEffect(() => setCursor(undefined), [authority, dealId]);
  React.useEffect(() => subscribeModuleQueryInvalidation("tasks", async event => {
    if (event.commandType === "task.log-activity") { setCursor(undefined); refresh(); }
  }), [authority, dealId]);
  React.useEffect(() => {
    if (!enabled) return;
    const abort = new AbortController(); let retired = false;
    void getTaskApiRuntime().queries.listActivities({ limit: 30, sortDirection: "desc", filters: { recordModuleKey: "deals", recordId: dealId }, ...(cursor ? { cursor } : {}) }, abort.signal)
      .then(page => { if (!retired && authority === getTaskReadAuthorityScope()) setState({ key,
        items: page.items.filter(item => item.recordRef?.moduleKey === "deals" && item.recordRef.recordId === dealId),
        ...(page.pageInfo.nextCursor ? { next: page.pageInfo.nextCursor } : {}) }); })
      .catch(error => { if (!retired && !abort.signal.aborted && authority === getTaskReadAuthorityScope()) setState({ key, items: [], error: formatApplicationError(error, { locale }) }); });
    return () => { retired = true; abort.abort(); };
  }, [authority, cursor, dealId, enabled, key, locale]);
  const current = enabled && state?.key === key ? state : undefined;
  return { items: current?.items ?? [], error: current?.error, loading: enabled && !current, enabled,
    // Deployed LogActivity admits Lead/Contact/Organization/Customer references only.
    canCreate: getTaskApiRuntime().mode !== "connected" && enabled && access.canPerform("tasks", "create"), next: current?.next, nextPage: () => setCursor(current?.next), reload: () => { setCursor(undefined); refresh(); } };
}
