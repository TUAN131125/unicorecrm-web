import React from "react";
import type { AuthoritativeResource } from "@/shared/application";

export interface UseAuthoritativeResourceOptions {
  enabled?: boolean;
}

export function useAuthoritativeResource<T>(
  resource: AuthoritativeResource<T>,
  options: UseAuthoritativeResourceOptions = {},
) {
  const enabled = options.enabled ?? true;
  const snapshot = React.useSyncExternalStore(resource.subscribe, resource.getSnapshot, resource.getSnapshot);

  React.useEffect(() => {
    if (enabled && snapshot.state === "IDLE") void resource.load();
  }, [enabled, resource, snapshot.state]);

  return {
    ...snapshot,
    enabled,
    loading: enabled && (snapshot.state === "IDLE" || snapshot.state === "LOADING"),
    refreshing: enabled && snapshot.state === "LOADING" && snapshot.data !== undefined,
    stale: enabled && snapshot.state === "ERROR" && snapshot.data !== undefined,
    refresh: resource.refresh,
    cancel: resource.cancel,
  };
}
