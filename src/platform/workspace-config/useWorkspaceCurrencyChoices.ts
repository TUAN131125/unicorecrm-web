import { useMemo, useSyncExternalStore } from "react";
import { getWorkspaceOperationalConfiguration, getWorkspaceOperationalConfigurationRevision, isConnectedWorkspaceOperationalConfigurationProjection, subscribeToWorkspaceOperationalConfigurationState } from "./workspaceOperationalConfigurationRuntime";
import { isConnectedWorkspaceRuntimeSettings, useWorkspaceRuntimeSettings } from "./workspaceRuntimeSettings";

/** Known choices, not a substitute for the server's enabled-currency policy. */
export function useWorkspaceCurrencyChoices(): string[] {
  const settings = useWorkspaceRuntimeSettings();
  const revision = useSyncExternalStore(subscribeToWorkspaceOperationalConfigurationState, getWorkspaceOperationalConfigurationRevision);
  return useMemo(() => {
    const enabled = !isConnectedWorkspaceRuntimeSettings() || isConnectedWorkspaceOperationalConfigurationProjection()
      ? getWorkspaceOperationalConfiguration().localeRegion.currencies.enabledCurrencies : [];
    return [...new Set([settings.baseCurrency, ...enabled])];
  }, [settings.baseCurrency, settings.workspaceId, revision]);
}
