import { useSubscribableSnapshot } from "@/platform/react";
import { getWorkspaceConfigSnapshot, subscribeToWorkspaceConfig } from "./workspaceConfigRuntime";

export function useWorkspaceConfigSnapshot() {
  return useSubscribableSnapshot(getWorkspaceConfigSnapshot, subscribeToWorkspaceConfig);
}
