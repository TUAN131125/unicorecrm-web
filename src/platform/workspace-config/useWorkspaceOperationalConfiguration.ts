import { useSubscribableSnapshot } from "@/platform/react";
import { getWorkspaceOperationalConfiguration, subscribeToWorkspaceOperationalConfiguration } from "./workspaceOperationalConfigurationRuntime";

export function useWorkspaceOperationalConfiguration() {
  return useSubscribableSnapshot(getWorkspaceOperationalConfiguration, subscribeToWorkspaceOperationalConfiguration);
}
