import { useCallback, useEffect, useRef, useState } from "react";
import { readQuoteDocuments, readQuoteDocumentSeller, type IssuedQuoteDocument, type QuoteSellerReadiness } from "../../public/documents";

export function useQuoteDocuments(workspaceId: string, quoteId: string, version: number | undefined) {
  const [items, setItems] = useState<readonly IssuedQuoteDocument[]>([]);
  const [seller, setSeller] = useState<QuoteSellerReadiness | null>(null);
  const [cursor, setCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(false); const [error, setError] = useState<unknown>(null);
  const [sellerError, setSellerError] = useState<unknown>(null);
  const active = useRef<AbortController | null>(null);
  const load = useCallback(async (next?: string) => {
    active.current?.abort(); const controller = new AbortController(); active.current = controller;
    setLoading(true); setError(null); setSellerError(null);
    try {
      const [pageResult, issuerResult] = await Promise.allSettled([readQuoteDocuments(quoteId, next, controller.signal), readQuoteDocumentSeller(controller.signal)]);
      if (controller.signal.aborted) return;
      if (pageResult.status === "rejected") throw pageResult.reason;
      const page = pageResult.value;
      setItems(previous => next ? [...previous, ...page.items.filter(x => !previous.some(p => p.documentId === x.documentId))] : page.items);
      setCursor(page.nextCursor);
      // Current seller readiness gates new issuance, not access to immutable issued PDFs.
      setSeller(issuerResult.status === "fulfilled" ? issuerResult.value : null);
      setSellerError(issuerResult.status === "rejected" ? issuerResult.reason : null);
    } catch (cause) { if (!controller.signal.aborted) { setError(cause); setItems([]); setSeller(null); } }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [quoteId, workspaceId]);
  useEffect(() => { setItems([]); setSeller(null); setCursor(undefined); void load(); return () => active.current?.abort(); }, [load, version]);
  return { items, seller, sellerError, loading, error, refresh: () => load(), next: cursor ? () => load(cursor) : undefined };
}
