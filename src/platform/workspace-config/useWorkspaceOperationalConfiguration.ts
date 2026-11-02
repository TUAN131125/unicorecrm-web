import { useMemo, useSyncExternalStore } from "react";
import { getWorkspaceOperationalConfigurationRevision, readWorkspaceOperationalConfiguration, subscribeToWorkspaceOperationalConfigurationState } from "./workspaceOperationalConfigurationRuntime";
import { getWorkspaceRuntimeSettingsRevision, subscribeToWorkspaceRuntimeSettings } from "./workspaceRuntimeSettings";

export function useWorkspaceOperationalConfiguration() {
  const revision = useSyncExternalStore(subscribeToWorkspaceOperationalConfigurationState, getWorkspaceOperationalConfigurationRevision);
  const ownerRevision = useSyncExternalStore(subscribeToWorkspaceRuntimeSettings, getWorkspaceRuntimeSettingsRevision);
  return useMemo(readWorkspaceOperationalConfiguration, [revision, ownerRevision]);
}
