import { useCallback, useMemo } from "react";
import { useSubscribableSnapshot } from "@/platform/react";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { getAccessControlSnapshot, resolveEffectiveAccess, subscribeToAccessControl } from "../runtime/accessControlRuntime";
import {
  getAccessGovernanceRevision,
  isAccessGovernanceRuntimeConfigured,
  subscribeToAccessGovernance,
} from "../application/accessGovernanceBinding";

export function useEffectiveAccess() {
  const workspace = useWorkspaceContextSnapshot();
  const getSnapshot = useCallback(
    () => isAccessGovernanceRuntimeConfigured()
      ? getAccessGovernanceRevision(workspace.workspaceId)
      : getAccessControlSnapshot(workspace.workspaceId).revision,
    [workspace.workspaceId],
  );
  const subscribe = useCallback((listener: (snapshot: number) => void) => {
    const emit = () => listener(getSnapshot());
    if (isAccessGovernanceRuntimeConfigured()) return subscribeToAccessGovernance(emit);
    return subscribeToAccessControl(emit);
  }, [getSnapshot]);
  const revision = useSubscribableSnapshot(getSnapshot, subscribe);
  return useMemo(
    () => resolveEffectiveAccess(workspace.workspaceId),
    [workspace.workspaceId, revision],
  );
}
