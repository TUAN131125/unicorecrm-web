import { useEffect, useState } from "react";
import { getDealCollectionResource, getDealsSnapshot, replaceDeals, subscribeToDeals } from "@/modules/deals";
import { useModuleAuthoritativeResource } from "@/shared/operations";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";

export function useDeals(options: { loadAuthoritative?: boolean } = {}) {
  const workspace = useWorkspaceContextSnapshot();
  const [deals, setDeals] = useState(() => getDealsSnapshot());
  const query = useModuleAuthoritativeResource(getDealCollectionResource(), {
    enabled: options.loadAuthoritative ?? true,
    scopeKey: workspace.workspaceId,
    onScopeChange: () => replaceDeals([]),
  });
  useEffect(() => subscribeToDeals(setDeals), []);
  return { deals, query };
}
