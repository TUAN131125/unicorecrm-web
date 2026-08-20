import { useSubscribableSnapshot } from "@/platform/react";
import { getIntegrationConfiguration, subscribeToIntegrationConfiguration } from "./integrationConfigurationRuntime";

export function useIntegrationConfiguration() {
  return useSubscribableSnapshot(getIntegrationConfiguration, subscribeToIntegrationConfiguration);
}
