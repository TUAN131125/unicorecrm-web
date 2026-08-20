import { useEffect, useState } from "react";
import { getLeadCollectionResource } from "../../application/vertical-slice/leadAuthoritativeQueries";
import { getLeadsSnapshot, replaceLeads, subscribeToLeads } from "../../public/leads";
import { useLeadAuthoritativeResource } from "./useLeadAuthoritativeResource";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";

export function useLeads(options: { loadAuthoritative?: boolean } = {}) {
  const workspace = useWorkspaceContextSnapshot();
  const [leads, setLeadsState] = useState(getLeadsSnapshot);
  const query = useLeadAuthoritativeResource(getLeadCollectionResource(), {
    enabled: options.loadAuthoritative ?? true,
    scopeKey: workspace.workspaceId,
    onScopeChange: () => replaceLeads([]),
  });

  useEffect(() => subscribeToLeads(setLeadsState), []);

  return { leads, query };
}
