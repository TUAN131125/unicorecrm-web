import React from "react";
import type { AuthoritativeResource } from "@/shared/application";
import { runWorkspaceScopeReset } from "@/shared/application";
import { useAuthoritativeResource } from "@/shared/operations";
import { isLeadConnectedApiRuntime } from "../../application/composition/leadApplicationServices";

export interface UseLeadAuthoritativeResourceOptions {
  enabled?: boolean;
  scopeKey?: string;
  onScopeChange?: () => void;
}

export function useLeadAuthoritativeResource<T>(
  resource: AuthoritativeResource<T>,
  options: UseLeadAuthoritativeResourceOptions = {},
) {
  const connected = isLeadConnectedApiRuntime();
  const enabled = connected && (options.enabled ?? true);
  const previousScopeRef = React.useRef(options.scopeKey);

  React.useLayoutEffect(() => {
    const previousScope = previousScopeRef.current;
    previousScopeRef.current = options.scopeKey;
    if (!connected || previousScope === undefined || previousScope === options.scopeKey) return;
    // Evicting the previous workspace's cached read model is a projection operation,
    // not an authoritative business mutation, so it runs inside the scope-reset scope.
    // Callers stay free to pass a plain `replaceX([])` cache reset.
    runWorkspaceScopeReset(() => options.onScopeChange?.());
    resource.reset();
  }, [connected, options.scopeKey, options.onScopeChange, resource]);

  return {
    ...useAuthoritativeResource(resource, { enabled }),
    connected,
  };
}
