import React from "react";
import type { ModuleListQuery } from "@/shared/application";
import { useServerPagedCollection } from "@/shared/operations";
import { getLeadApiRuntime, isLeadConnectedApiRuntime } from "../../application/composition/leadApplicationServices";
import type { Lead } from "../../domain/model/lead.types";

export function useLeadServerPagedCollection(options: {
  scopeKey: string;
  query?: Omit<ModuleListQuery, "cursor" | "limit">;
  enabled?: boolean;
  initialPageSize?: number;
  project(records: readonly Lead[]): void;
  onReset?: () => void;
}) {
  const connected = isLeadConnectedApiRuntime();
  const loadPage = React.useCallback((query: ModuleListQuery, signal: AbortSignal) => (
    getLeadApiRuntime().queries.list(query, signal)
  ), []);

  return useServerPagedCollection({
    connected,
    scopeKey: options.scopeKey,
    ...(options.query === undefined ? {} : { query: options.query }),
    ...(options.enabled === undefined ? {} : { enabled: options.enabled }),
    ...(options.initialPageSize === undefined ? {} : { initialPageSize: options.initialPageSize }),
    project: options.project,
    loadPage,
    errorCodePrefix: "LEADS",
    ...(options.onReset === undefined ? {} : { onReset: options.onReset }),
  });
}
