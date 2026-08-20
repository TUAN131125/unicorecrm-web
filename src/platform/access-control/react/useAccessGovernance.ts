import { useEffect } from "react";
import { useSubscribableSnapshot } from "@/platform/react";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { getAccessGovernanceRuntimeBinding } from "../application/accessGovernanceBinding";

export function useAccessGovernance() {
  const workspace = useWorkspaceContextSnapshot();
  const binding = getAccessGovernanceRuntimeBinding();
  const state = useSubscribableSnapshot(() => binding.getState(), (listener) => binding.subscribe(() => listener(binding.getState())));
  useEffect(() => {
    const controller = new AbortController();
    void binding.load(workspace.workspaceId, controller.signal);
    return () => controller.abort();
  }, [binding, workspace.workspaceId]);
  return {
    workspace,
    state,
    runtime: binding.getRuntime(),
    refresh: (signal?: AbortSignal) => binding.refresh(workspace.workspaceId, signal),
  };
}
