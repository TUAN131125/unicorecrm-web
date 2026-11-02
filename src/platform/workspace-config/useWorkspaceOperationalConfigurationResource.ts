import { useMemo, useSyncExternalStore } from "react";
import { ApplicationError } from "@/shared/domain";
import { getWorkspaceOperationalConfigurationRevision, readWorkspaceOperationalConfiguration, subscribeToWorkspaceOperationalConfigurationState } from "./workspaceOperationalConfigurationRuntime";
import { getWorkspaceRuntimeSettingsRevision, subscribeToWorkspaceRuntimeSettings } from "./workspaceRuntimeSettings";
import type { WorkspaceOperationalConfiguration } from "./workspaceOperationalConfiguration.types";

/** Optional document consumers retain a visible failure without blocking unrelated CRM commands. */
export function useWorkspaceOperationalConfigurationResource(): { data?: WorkspaceOperationalConfiguration; loading: boolean; error?: ApplicationError } {
  const revision = useSyncExternalStore(subscribeToWorkspaceOperationalConfigurationState, getWorkspaceOperationalConfigurationRevision);
  const ownerRevision = useSyncExternalStore(subscribeToWorkspaceRuntimeSettings, getWorkspaceRuntimeSettingsRevision);
  return useMemo(() => {
    try { return { data: readWorkspaceOperationalConfiguration(), loading: false }; }
    catch (error) {
      if (error instanceof Promise) return { loading: true };
      if (error instanceof ApplicationError) return { loading: false, error };
      throw error;
    }
  }, [revision, ownerRevision]);
}
