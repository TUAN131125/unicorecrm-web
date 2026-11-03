import React from "react";
import { readOrderPage, type CustomerOrder } from "@/modules/orders";
import { useEffectiveAccess } from "@/platform/access-control";
import { formatApplicationError } from "@/shared/operations";
import { getDealSelectionAuthority, useDealSelectionAuthority } from "./useDealSelectionQueries";

/** Confirmed candidates come from Orders, independently of the Quote list's current page. */
export function useDealRelatedOrders(dealId: string | undefined, enabled: boolean, locale: "vi" | "en") {
  const authority = useDealSelectionAuthority(); const access = useEffectiveAccess();
  const permitted = enabled && access.can("orders.read");
  const [revision, refresh] = React.useReducer((n: number) => n + 1, 0);
  const [state, setState] = React.useState<{ key: string; items: CustomerOrder[]; error?: string }>();
  const key = JSON.stringify([authority, dealId, permitted, revision]);
  React.useEffect(() => {
    if (!permitted || !dealId) return;
    const abort = new AbortController();
    void readOrderPage({ limit: 50, filters: { sourceDealId: dealId, state: "CONFIRMED" } }, abort.signal)
      .then(page => { if (!abort.signal.aborted && authority === getDealSelectionAuthority()) setState({ key,
        items: page.items.filter(order => order.sourceDealId === dealId && order.state === "CONFIRMED" && !order.archivedAt) }); })
      .catch(error => { if (!abort.signal.aborted && authority === getDealSelectionAuthority()) setState({ key, items: [], error: formatApplicationError(error, { locale }) }); });
    return () => abort.abort();
  }, [authority, dealId, key, locale, permitted]);
  const current = permitted && state?.key === key ? state : undefined;
  return { items: current?.items ?? [], permitted, loading: permitted && Boolean(dealId) && !current,
    error: current?.error, reload: refresh };
}
