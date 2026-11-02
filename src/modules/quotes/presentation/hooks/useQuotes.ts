import { useEffect, useState } from "react";
import { getQuoteCollectionResource } from "../../application/vertical-slice/quoteAuthoritativeQueries";
import { getQuotesSnapshot, getRetainedQuotesSnapshot, replaceQuotes, subscribeToQuotes } from "../../public/quotes";
import { useModuleAuthoritativeResource } from "@/shared/operations";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";

export function useQuotes(options: { loadAuthoritative?: boolean; includeArchived?: boolean } = {}) {
  const workspace = useWorkspaceContextSnapshot();
  const [quotes, setQuotes] = useState(() => options.includeArchived ? getRetainedQuotesSnapshot() : getQuotesSnapshot());
  const query = useModuleAuthoritativeResource(getQuoteCollectionResource(), {
    enabled: options.loadAuthoritative ?? true,
    scopeKey: workspace.workspaceId,
    onScopeChange: () => replaceQuotes([]),
  });
  useEffect(() => subscribeToQuotes(() => setQuotes(options.includeArchived ? getRetainedQuotesSnapshot() : getQuotesSnapshot())), [options.includeArchived]);
  return { quotes, query };
}
