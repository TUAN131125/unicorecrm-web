import { useEffect, useState } from "react";
import { getQuoteCollectionResource } from "../../application/vertical-slice/quoteAuthoritativeQueries";
import { getQuotesSnapshot, replaceQuotes, subscribeToQuotes } from "../../public/quotes";
import { useModuleAuthoritativeResource } from "@/shared/operations";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";

export function useQuotes(options: { loadAuthoritative?: boolean } = {}) {
  const workspace = useWorkspaceContextSnapshot();
  const [quotes, setQuotes] = useState(() => getQuotesSnapshot());
  const query = useModuleAuthoritativeResource(getQuoteCollectionResource(), {
    enabled: options.loadAuthoritative ?? true,
    scopeKey: workspace.workspaceId,
    onScopeChange: () => replaceQuotes([]),
  });
  useEffect(() => subscribeToQuotes(setQuotes), []);
  return { quotes, query };
}
