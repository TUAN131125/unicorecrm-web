import { getReturnCollectionResource } from "../../application/vertical-slice/returnAuthoritativeQueries";
import { getReturnsSnapshot, replaceReturnsSnapshot } from "../../public/api";
import { useModuleAuthoritativeResource } from "@/shared/operations";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";

export function useReturnsAuthoritative() {
  const workspace = useWorkspaceContextSnapshot();
  return useModuleAuthoritativeResource(getReturnCollectionResource(), {
    scopeKey: workspace.workspaceId,
    onScopeChange: () => {
      const current = getReturnsSnapshot();
      replaceReturnsSnapshot({ requests: [], intents: current.intents });
    },
  });
}
