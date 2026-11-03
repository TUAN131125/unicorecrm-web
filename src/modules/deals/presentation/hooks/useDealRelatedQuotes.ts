import React from "react";
import { readQuotePage, type Quote } from "@/modules/quotes";
import { useEffectiveAccess } from "@/platform/access-control";
import { formatApplicationError } from "@/shared/operations";
import { getDealSelectionAuthority, useDealSelectionAuthority } from "./useDealSelectionQueries";

export function useDealRelatedQuotes(dealId: string | undefined, enabled: boolean, locale: "vi" | "en") {
  const authority = useDealSelectionAuthority();
  const access = useEffectiveAccess();
  const permitted = enabled && access.canPerform("quotes", "read");
  const [cursor, setCursor] = React.useState<string>();
  const [revision, refresh] = React.useReducer((n: number) => n + 1, 0);
  const [state, setState] = React.useState<{ key: string; items: Quote[]; error?: string; next?: string }>();
  const key = JSON.stringify([authority, dealId, cursor, revision, permitted]);
  React.useEffect(() => setCursor(undefined), [authority, dealId]);
  React.useEffect(() => {
    if (!permitted || !dealId) return;
    const abort = new AbortController(); let retired = false;
    void readQuotePage({ limit: 10, sortBy: "updatedAt", sortDirection: "desc", filters: { sourceDealId: dealId }, ...(cursor ? { cursor } : {}) }, abort.signal)
      .then(page => { if (!retired && authority === getDealSelectionAuthority()) setState({ key,
        items: page.items.filter(quote => (quote.sourceDealId ?? quote.dealId) === dealId),
        ...(page.pageInfo.nextCursor ? { next: page.pageInfo.nextCursor } : {}) }); })
      .catch(error => { if (!retired && !abort.signal.aborted && authority === getDealSelectionAuthority()) setState({ key, items: [], error: formatApplicationError(error, { locale }) }); });
    return () => { retired = true; abort.abort(); };
  }, [authority, cursor, dealId, key, locale, permitted]);
  const current = permitted && state?.key === key ? state : undefined;
  return { items: current?.items ?? [], loading: permitted && Boolean(dealId) && !current, error: current?.error,
    permitted, next: current?.next, reload: () => { setCursor(undefined); refresh(); }, nextPage: () => setCursor(current?.next) };
}
