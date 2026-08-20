import { useEffect, useState } from "react";
import type { DealCollectionUpdater } from "../../application/commands/dealRepositoryCommands";
import { getDealCollectionResource } from "../../application/vertical-slice/dealAuthoritativeQueries";
import { getDealsSnapshot, replaceDeals, subscribeToDeals, updateDeals } from "../../public/deals";
import { useModuleAuthoritativeResource } from "@/shared/operations";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";

export function useDeals(options: { loadAuthoritative?: boolean } = {}) {
  const workspace = useWorkspaceContextSnapshot();
  const [deals, setDealsState] = useState(getDealsSnapshot);
  const query = useModuleAuthoritativeResource(getDealCollectionResource(), {
    enabled: options.loadAuthoritative ?? true,
    scopeKey: workspace.workspaceId,
    onScopeChange: () => replaceDeals([]),
  });
  useEffect(() => subscribeToDeals(setDealsState), []);
  const setDeals = (updater: DealCollectionUpdater) => updateDeals(updater);
  return { deals, setDeals, query };
}
