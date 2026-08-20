import React from "react";
import {
  getModuleDataAuthority,
  isModuleDataAuthorityRegistryConfigured,
  type ModuleDataAuthorityKey,
  type ModuleListQuery,
} from "@/shared/application";
import {
  useServerPagedCollection,
  type ServerPagedCollectionState,
} from "./useServerPagedCollection";

export interface UseServerPagedModuleCollectionOptions<T> {
  key: ModuleDataAuthorityKey;
  scopeKey: string;
  query?: Omit<ModuleListQuery, "cursor" | "limit">;
  enabled?: boolean;
  initialPageSize?: number;
  project(records: readonly T[]): void;
  onReset?: () => void;
}

export type ServerPagedModuleCollectionState<T> = ServerPagedCollectionState<T>;

export function useServerPagedModuleCollection<T>(
  options: UseServerPagedModuleCollectionOptions<T>,
): ServerPagedModuleCollectionState<T> {
  const connected = isModuleDataAuthorityRegistryConfigured();
  const loadPage = React.useCallback((query: ModuleListQuery, signal: AbortSignal) => (
    getModuleDataAuthority(options.key).queries.list<T>(query, signal)
  ), [options.key]);

  return useServerPagedCollection({
    connected,
    scopeKey: options.scopeKey,
    ...(options.query === undefined ? {} : { query: options.query }),
    ...(options.enabled === undefined ? {} : { enabled: options.enabled }),
    ...(options.initialPageSize === undefined ? {} : { initialPageSize: options.initialPageSize }),
    project: options.project,
    loadPage,
    errorCodePrefix: options.key.toUpperCase(),
    ...(options.onReset === undefined ? {} : { onReset: options.onReset }),
  });
}
