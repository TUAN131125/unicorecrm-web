import { useEffect, useState } from "react";
import { getLeadCollectionResource, retainLeadCollectionReader } from "../../application/vertical-slice/leadAuthoritativeQueries";
import { getLeadsSnapshot, replaceLeads, subscribeToLeads } from "../../public/leads";
import { useLeadAuthoritativeResource } from "./useLeadAuthoritativeResource";
import { isLeadConnectedApiRuntime } from "../../application/composition/leadApplicationServices";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";

export function useLeads(options: { loadAuthoritative?: boolean } = {}) {
  const workspace = useWorkspaceContextSnapshot();
  const [leads, setLeadsState] = useState(getLeadsSnapshot);
  const enabled = isLeadConnectedApiRuntime() && (options.loadAuthoritative ?? true);
  useEffect(() => {
    if (enabled) return retainLeadCollectionReader();
  }, [enabled]);
  const query = useLeadAuthoritativeResource(getLeadCollectionResource(), {
    enabled: options.loadAuthoritative ?? true,
    scopeKey: workspace.workspaceId,
    onScopeChange: () => replaceLeads([]),
  });

  useEffect(() => subscribeToLeads(setLeadsState), []);

  return { leads: query.connected && (options.loadAuthoritative ?? true) ? query.data?.items ?? [] : leads, query };
}
