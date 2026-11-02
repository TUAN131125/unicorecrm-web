import { useCallback } from "react";
import { runBackendProjection, runWorkspaceScopeReset, type ModuleListQuery } from "@/shared/application";
import { useServerPagedCollection } from "@/shared/operations";
import { getQuoteApiRuntime, isQuoteConnectedApiRuntime } from "../../application/composition/quoteApplicationServices";
import type { QuoteListQuery } from "../../application/ports/QuoteApiRuntime";
import type { Quote } from "../../domain/model/quote.types";
import { replaceQuotes } from "../../public/quotes";

function projectPage(records: readonly Quote[]): void {
  runBackendProjection("quotes", () => replaceQuotes([...records]));
}
function evictPage(): void {
  runWorkspaceScopeReset(() => replaceQuotes([]));
}

export function useQuoteListQuery(scopeKey: string, query: Omit<QuoteListQuery, "cursor" | "limit">, onReset: () => void) {
  const loadPage = useCallback((pageQuery: ModuleListQuery, signal: AbortSignal) =>
    getQuoteApiRuntime().queries.list(pageQuery as QuoteListQuery, signal), []);
  return useServerPagedCollection({
    connected: isQuoteConnectedApiRuntime(), scopeKey, query, initialPageSize: 25,
    project: projectPage, evictProjection: evictPage, loadPage, errorCodePrefix: "QUOTES", onReset,
  });
}
