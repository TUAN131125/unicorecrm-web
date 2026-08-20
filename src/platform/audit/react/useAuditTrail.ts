import React from "react";
import { getOperationalAuditSnapshot, subscribeToOperationalAudit } from "@/platform/operational-audit";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import type {
  AuditEventCategory,
  AuditEventOutcome,
  AuditJsonValue,
  AuditTrailEntry,
  AuditTrailPage,
  AuditTrailRequest,
} from "../application/auditTrail";
import {
  getAuditTrailAuthority,
  isAuditTrailAuthorityConfigured,
} from "../application/auditTrailBinding";

export interface UseAuditTrailInput {
  resourceKey?: string;
  recordId?: string;
  categories?: readonly AuditEventCategory[];
  outcomes?: readonly AuditEventOutcome[];
  correlationId?: string;
  search?: string;
  limit?: number;
  enabled?: boolean;
}

interface AuditTrailState {
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  stale: boolean;
  data?: AuditTrailPage;
  error?: unknown;
}

export function useAuditTrail(input: UseAuditTrailInput = {}) {
  const workspace = useWorkspaceContextSnapshot();
  const connected = isAuditTrailAuthorityConfigured();
  const enabled = input.enabled ?? true;
  const categoriesKey = [...(input.categories ?? [])].sort().join("|");
  const outcomesKey = [...(input.outcomes ?? [])].sort().join("|");
  const requestKey = [
    workspace.workspaceId,
    input.resourceKey ?? "",
    input.recordId ?? "",
    categoriesKey,
    outcomesKey,
    input.correlationId ?? "",
    input.search ?? "",
    input.limit ?? 50,
  ].join("::");
  const request = React.useMemo<AuditTrailRequest>(() => ({
    workspaceId: workspace.workspaceId,
    ...(input.resourceKey ? { resourceKey: input.resourceKey } : {}),
    ...(input.recordId ? { recordId: input.recordId } : {}),
    ...(input.categories?.length ? { categories: [...input.categories] } : {}),
    ...(input.outcomes?.length ? { outcomes: [...input.outcomes] } : {}),
    ...(input.correlationId ? { correlationId: input.correlationId } : {}),
    ...(input.search ? { search: input.search } : {}),
    limit: input.limit ?? 50,
  }), [requestKey]);
  const [state, setState] = React.useState<AuditTrailState>({ loading: connected && enabled, refreshing: false, loadingMore: false, stale: false });
  const abortRef = React.useRef<AbortController | undefined>(undefined);
  const generationRef = React.useRef(0);

  const load = React.useCallback(async (mode: "initial" | "refresh" | "more") => {
    if (!enabled) return undefined;
    if (!connected) {
      const cursor = mode === "more" ? state.data?.nextCursor : undefined;
      if (mode === "more" && !cursor) return state.data;
      const page = buildDemoPage({ ...request, ...(cursor ? { cursor } : {}) });
      setState((current) => ({
        loading: false,
        refreshing: false,
        loadingMore: false,
        stale: false,
        data: mode === "more" && current.data
          ? { ...page, items: dedupeEntries([...current.data.items, ...page.items]) }
          : page,
      }));
      return page;
    }

    const cursor = mode === "more" ? state.data?.nextCursor : undefined;
    if (mode === "more" && !cursor) return state.data;
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState((current) => ({
      ...current,
      loading: mode === "initial" && !current.data,
      refreshing: mode === "refresh",
      loadingMore: mode === "more",
      error: undefined,
    }));

    try {
      const page = await getAuditTrailAuthority().list({ ...request, ...(cursor ? { cursor } : {}) }, controller.signal);
      if (generation !== generationRef.current) return undefined;
      setState((current) => ({
        loading: false,
        refreshing: false,
        loadingMore: false,
        stale: false,
        data: mode === "more" && current.data
          ? { ...page, items: dedupeEntries([...current.data.items, ...page.items]) }
          : page,
      }));
      return page;
    } catch (error) {
      if (controller.signal.aborted || generation !== generationRef.current) return undefined;
      setState((current) => ({
        ...current,
        loading: false,
        refreshing: false,
        loadingMore: false,
        stale: Boolean(current.data),
        error,
      }));
      return undefined;
    }
  }, [connected, enabled, request, state.data]);

  React.useEffect(() => {
    generationRef.current += 1;
    abortRef.current?.abort();
    if (!enabled) {
      setState({ loading: false, refreshing: false, loadingMore: false, stale: false });
      return undefined;
    }
    setState({ loading: connected, refreshing: false, loadingMore: false, stale: false });
    void load("initial");
    if (connected) return () => abortRef.current?.abort();
    return subscribeToOperationalAudit(() => {
      setState({ loading: false, refreshing: false, loadingMore: false, stale: false, data: buildDemoPage(request) });
    });
  }, [requestKey, connected, enabled]);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  return {
    connected,
    ...state,
    refresh: () => load("refresh"),
    loadMore: () => load("more"),
    cancel: () => abortRef.current?.abort(),
  };
}

function buildDemoPage(request: AuditTrailRequest): AuditTrailPage {
  const normalizedSearch = request.search?.trim().toLocaleLowerCase() ?? "";
  const filtered = getOperationalAuditSnapshot(request.resourceKey, request.recordId)
    .filter((entry) => !request.categories?.length || request.categories.includes(categoryFor(entry.moduleKey)))
    .filter(() => !request.outcomes?.length || request.outcomes.includes("SUCCEEDED"))
    .filter((entry) => !request.correlationId || entry.correlationId === request.correlationId)
    .filter((entry) => !normalizedSearch || [entry.action, entry.actorId, entry.actorName, entry.reason, entry.correlationId, JSON.stringify(entry.before ?? ""), JSON.stringify(entry.after ?? "")]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase()
      .includes(normalizedSearch))
  const offset = request.cursor?.startsWith("demo:") ? Number(request.cursor.slice(5)) : 0;
  const limit = request.limit ?? 50;
  const items = filtered.slice(offset, offset + limit).map<AuditTrailEntry>((entry) => ({
      id: entry.id,
      workspaceId: entry.workspaceId,
      resourceKey: entry.moduleKey,
      recordId: entry.recordId,
      category: categoryFor(entry.moduleKey),
      outcome: "SUCCEEDED",
      action: entry.action,
      ...(entry.reason ? { summary: entry.reason } : {}),
      actor: {
        id: entry.actorId,
        ...(entry.actorName ? { displayName: entry.actorName } : {}),
        type: "USER",
      },
      occurredAt: entry.occurredAt,
      source: "demo-operational-audit",
      ...(entry.correlationId ? { correlationId: entry.correlationId } : {}),
      changedFields: changedFields(entry.before, entry.after),
      ...(toAuditJson(entry.before) !== undefined ? { before: toAuditJson(entry.before) } : {}),
      ...(toAuditJson(entry.after) !== undefined ? { after: toAuditJson(entry.after) } : {}),
      authority: "demo",
    }));
  const nextOffset = offset + items.length;
  return { workspaceId: request.workspaceId, items, ...(nextOffset < filtered.length ? { nextCursor: `demo:${nextOffset}` } : {}), authority: "demo" };
}

function categoryFor(moduleKey: string): AuditEventCategory {
  if (moduleKey === "access-control") return "AUTHORIZATION";
  if (moduleKey === "studio") return "CONFIGURATION";
  if (moduleKey === "backup") return "BACKUP";
  if (moduleKey === "identity") return "SECURITY";
  return "DATA_CHANGE";
}

function changedFields(before: unknown, after: unknown): string[] {
  if (!before || !after || typeof before !== "object" || typeof after !== "object" || Array.isArray(before) || Array.isArray(after)) return [];
  const left = before as Record<string, unknown>;
  const right = after as Record<string, unknown>;
  return [...new Set([...Object.keys(left), ...Object.keys(right)])].filter((key) => JSON.stringify(left[key]) !== JSON.stringify(right[key]));
}

function toAuditJson(value: unknown): AuditJsonValue | undefined {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(value)) as AuditJsonValue;
  } catch {
    return String(value);
  }
}

function dedupeEntries(entries: readonly AuditTrailEntry[]): AuditTrailEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
}
