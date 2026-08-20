import { useSyncExternalStore } from "react";
import { getConfigurationRuntimeSnapshot, subscribeToConfigurationRuntime } from "./configurationRuntime";

export function useConfigurationRuntime() {
  return useSyncExternalStore(subscribeToConfigurationRuntime, getConfigurationRuntimeSnapshot, getConfigurationRuntimeSnapshot);
}
