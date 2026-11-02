import { useCallback, useEffect, useRef, useState } from "react";
import { readQuotePage } from "../../public/quotes";
import type { Quote } from "../../domain/model/quote.types";

export function useQuoteRevisionChain(workspaceId: string, rootQuoteId: string, refreshVersion: number | undefined) {
  const [items, setItems] = useState<Quote[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const controller = useRef<AbortController | null>(null);
  const load = useCallback(async (next?: string) => {
    controller.current?.abort();
    const active = new AbortController(); controller.current = active;
    setLoading(true); setError(null);
    try {
      const result = await readQuotePage({ limit: 50, ...(next ? { cursor: next } : {}), sortBy: "quoteRevision", sortDirection: "asc",
        filters: { rootQuoteId, archived: "ALL" } }, active.signal);
      if (active.signal.aborted) return;
      setItems(previous => next ? [...previous, ...result.items] : [...result.items]);
      setCursor(result.pageInfo.nextCursor); setHasNext(result.pageInfo.hasNextPage);
    } catch (err) { if (!active.signal.aborted) setError(err); }
    finally { if (!active.signal.aborted) setLoading(false); }
  }, [workspaceId, rootQuoteId]);
  useEffect(() => { setItems([]); setCursor(undefined); setHasNext(false); void load(); return () => controller.current?.abort(); }, [load, refreshVersion]);
  return { items, hasNext, loading, error, retry: () => load(), next: () => cursor ? load(cursor) : Promise.resolve() };
}
