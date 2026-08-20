import React from "react";
import type { AuthoritativeResource } from "@/shared/application";
import { isModuleDataAuthorityRegistryConfigured } from "@/shared/application";
import { useAuthoritativeResource } from "./useAuthoritativeResource";

export interface UseModuleAuthoritativeResourceOptions {
  enabled?: boolean;
  scopeKey?: string;
  onScopeChange?: () => void;
}

export function useModuleAuthoritativeResource<T>(
  resource: AuthoritativeResource<T>,
  options: UseModuleAuthoritativeResourceOptions = {},
) {
  const connected = isModuleDataAuthorityRegistryConfigured();
  const enabled = connected && (options.enabled ?? true);
  const previousScopeRef = React.useRef(options.scopeKey);

  React.useLayoutEffect(() => {
    const previousScope = previousScopeRef.current;
    previousScopeRef.current = options.scopeKey;
    if (!connected || previousScope === undefined || previousScope === options.scopeKey) return;
    options.onScopeChange?.();
    resource.reset();
  }, [connected, options.scopeKey, options.onScopeChange, resource]);

  return {
    ...useAuthoritativeResource(resource, { enabled }),
    connected,
  };
}
