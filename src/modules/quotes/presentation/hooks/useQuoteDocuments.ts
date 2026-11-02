import { useCallback, useEffect, useRef, useState } from "react";
import { readQuoteDocuments, readQuoteDocumentSeller, type IssuedQuoteDocument, type QuoteSellerReadiness } from "../../public/documents";

export function useQuoteDocuments(workspaceId: string, quoteId: string, version: number | undefined) {
  const [items, setItems] = useState<readonly IssuedQuoteDocument[]>([]);
  const [seller, setSeller] = useState<QuoteSellerReadiness | null>(null);
  const [cursor, setCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(false); const [error, setError] = useState<unknown>(null);
  const active = useRef<AbortController | null>(null);
  const load = useCallback(async (next?: string) => {
    active.current?.abort(); const controller = new AbortController(); active.current = controller;
    setLoading(true); setError(null);
    try {
      const [page, issuer] = await Promise.all([readQuoteDocuments(quoteId, next, controller.signal), readQuoteDocumentSeller(controller.signal)]);
      if (controller.signal.aborted) return;
      setItems(previous => next ? [...previous, ...page.items.filter(x => !previous.some(p => p.documentId === x.documentId))] : page.items);
      setCursor(page.nextCursor); setSeller(issuer);
    } catch (cause) { if (!controller.signal.aborted) { setError(cause); setItems([]); setSeller(null); } }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [quoteId, workspaceId]);
  useEffect(() => { setItems([]); setSeller(null); setCursor(undefined); void load(); return () => active.current?.abort(); }, [load, version]);
  return { items, seller, loading, error, refresh: () => load(), next: cursor ? () => load(cursor) : undefined };
}
