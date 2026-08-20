import { useSubscribableSnapshot } from "@/platform/react";
import { getWorkspaceContextSnapshot, subscribeToWorkspaceContext } from "./workspaceContextRuntime";

export function useWorkspaceContextSnapshot() {
  return useSubscribableSnapshot(getWorkspaceContextSnapshot, subscribeToWorkspaceContext);
}
