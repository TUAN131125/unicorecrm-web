import React from "react";
import {
  getModuleDataAuthority,
  isModuleDataAuthorityRegistryConfigured,
  type AuthoritativePageInfo,
  type ModuleListQuery,
} from "@/shared/application";
import { normalizeApplicationError, type ApplicationError } from "@/shared/domain";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import type { Deal } from "../../domain/model/deal.types";
import { replaceDeals } from "../../public/deals";

interface DealStageWindowSnapshot {
  state: "IDLE" | "LOADING" | "READY" | "ERROR";
  items: Deal[];
  pageInfo: AuthoritativePageInfo;
  loadedAt?: string;
  error?: ApplicationError;
}

export interface UseDealStageWindowsOptions {
  enabled: boolean;
  stages: readonly string[];
  search?: string;
  ownerId?: string;
  stageFilter?: string;
  closeDateStatus?: string;
  minimumAmount?: number;
  currency?: string;
  ownershipScope?: "MINE" | "TEAM" | "ALLOWED";
  windowSize?: number;
}

export interface DealStageWindowQuery {
  connected: boolean;
  enabled: boolean;
  loading: boolean;
  refreshing: boolean;
  stale: boolean;
  error?: ApplicationError;
  loadedAt?: string;
  refresh(): Promise<void>;
  cancel(): void;
  loadMore(stage: string): Promise<void>;
  isStageLoading(stage: string): boolean;
  hasMore(stage: string): boolean;
  loadedCount(stage: string): number;
  totalCount(stage: string): number;
}

const DEFAULT_WINDOW_SIZE = 50;
const MAX_WINDOW_SIZE = 100;

export function useDealStageWindows(options: UseDealStageWindowsOptions): DealStageWindowQuery {
  const workspace = useWorkspaceContextSnapshot();
  const connected = isModuleDataAuthorityRegistryConfigured();
  const enabled = connected && options.enabled;
  const stages = React.useMemo(
    () => [...new Set(options.stages.map((stage) => stage.trim()).filter(Boolean))],
    [options.stages],
  );
  const windowSize = normalizeWindowSize(options.windowSize ?? DEFAULT_WINDOW_SIZE);
  /**
   * Only the parameters listDeals actually declares are sent. Close-date status, amount,
   * currency and ownership scope are presentation filters with no backend query parameter;
   * the controller already applies them to the loaded window, so sending them would only
   * make every stage request fail the transport contract check.
   */
  const query = React.useMemo<Omit<ModuleListQuery, "cursor" | "limit">>(() => ({
    search: options.search?.trim() || undefined,
    sortBy: "updatedAt",
    sortDirection: "desc",
    filters: {
      ownerId: normalizeFilter(options.ownerId, "all"),
    },
  }), [options.ownerId, options.search]);
  const requestedStages = React.useMemo(
    () => options.stageFilter && options.stageFilter !== "all"
      ? stages.filter((stage) => stage === options.stageFilter)
      : stages,
    [options.stageFilter, stages],
  );
  const resetKey = React.useMemo(
    () => JSON.stringify({ workspaceId: workspace.workspaceId, stages: requestedStages, query, windowSize }),
    [query, requestedStages, windowSize, workspace.workspaceId],
  );
  const [windows, setWindows] = React.useState<Record<string, DealStageWindowSnapshot>>({});
  const controllersRef = React.useRef(new Map<string, AbortController>());
  const requestVersionsRef = React.useRef(new Map<string, number>());
  const previousResetKeyRef = React.useRef(resetKey);
  const initialLoadKeyRef = React.useRef<string | undefined>(undefined);

  const abortAll = React.useCallback(() => {
    for (const controller of controllersRef.current.values()) controller.abort();
    controllersRef.current.clear();
    requestVersionsRef.current.clear();
  }, []);

  const reset = React.useCallback(() => {
    abortAll();
    initialLoadKeyRef.current = undefined;
    setWindows({});
    replaceDeals([]);
  }, [abortAll]);

  React.useLayoutEffect(() => {
    if (previousResetKeyRef.current === resetKey) return;
    previousResetKeyRef.current = resetKey;
    reset();
  }, [reset, resetKey]);

  // Aborting the in-flight windows also has to release the initial-load latch, or the
  // stage windows stay empty forever after a remount: the latch was already claimed by
  // the aborted round and no later effect would ever issue the requests again.
  React.useEffect(() => () => {
    abortAll();
    initialLoadKeyRef.current = undefined;
  }, [abortAll]);

  React.useEffect(() => {
    if (!enabled) return;
    const merged = requestedStages.flatMap((stage) => windows[stage]?.items ?? []);
    replaceDeals(merged);
  }, [enabled, requestedStages, windows]);

  const loadStage = React.useCallback(async (stage: string, append: boolean) => {
    if (!enabled || !requestedStages.includes(stage)) return;

    const current = windows[stage];
    const cursor = append ? current?.pageInfo.nextCursor?.trim() : undefined;
    if (append && (!current?.pageInfo.hasNextPage || !cursor)) return;

    const requestVersion = (requestVersionsRef.current.get(stage) ?? 0) + 1;
    requestVersionsRef.current.set(stage, requestVersion);
    controllersRef.current.get(stage)?.abort();
    const controller = new AbortController();
    controllersRef.current.set(stage, controller);

    setWindows((snapshot) => ({
      ...snapshot,
      [stage]: {
        state: "LOADING",
        items: snapshot[stage]?.items ?? [],
        pageInfo: snapshot[stage]?.pageInfo ?? { hasNextPage: false },
        ...(snapshot[stage]?.loadedAt === undefined ? {} : { loadedAt: snapshot[stage]?.loadedAt }),
      },
    }));

    try {
      const result = await getModuleDataAuthority("deals").queries.list<Deal>({
        ...query,
        limit: windowSize,
        ...(cursor === undefined ? {} : { cursor }),
        filters: {
          ...query.filters,
          // listDeals filters by the backend stage code, not by a presentation stage name.
          stageCode: stage,
        },
      }, controller.signal);
      if (controller.signal.aborted || requestVersionsRef.current.get(stage) !== requestVersion) return;
      if (result.items.some((deal) => deal.stage !== stage)) {
        throw new Error(`DEAL_STAGE_WINDOW_MISMATCH:${stage}`);
      }
      if (result.pageInfo.hasNextPage && !result.pageInfo.nextCursor?.trim()) {
        throw new Error(`DEAL_STAGE_WINDOW_CURSOR_REQUIRED:${stage}`);
      }

      setWindows((snapshot) => {
        const previousItems = append ? snapshot[stage]?.items ?? [] : [];
        return {
          ...snapshot,
          [stage]: {
            state: "READY",
            items: mergeUniqueDeals(previousItems, result.items),
            pageInfo: result.pageInfo,
            loadedAt: result.loadedAt || new Date().toISOString(),
          },
        };
      });
    } catch (error: unknown) {
      if (controller.signal.aborted || requestVersionsRef.current.get(stage) !== requestVersion) return;
      setWindows((snapshot) => ({
        ...snapshot,
        [stage]: {
          state: "ERROR",
          items: snapshot[stage]?.items ?? [],
          pageInfo: snapshot[stage]?.pageInfo ?? { hasNextPage: false },
          ...(snapshot[stage]?.loadedAt === undefined ? {} : { loadedAt: snapshot[stage]?.loadedAt }),
          error: normalizeApplicationError(error),
        },
      }));
    } finally {
      if (requestVersionsRef.current.get(stage) === requestVersion) controllersRef.current.delete(stage);
    }
  }, [enabled, query, requestedStages, windowSize, windows]);

  const refresh = React.useCallback(async () => {
    await Promise.all(requestedStages.map((stage) => loadStage(stage, false)));
  }, [loadStage, requestedStages]);

  React.useEffect(() => {
    if (!enabled || requestedStages.length === 0 || initialLoadKeyRef.current === resetKey) return;
    initialLoadKeyRef.current = resetKey;
    void refresh();
  }, [enabled, refresh, requestedStages.length, resetKey]);

  const cancel = React.useCallback(() => {
    abortAll();
    setWindows((snapshot) => Object.fromEntries(
      Object.entries(snapshot).map(([stage, value]) => [
        stage,
        value.items.length > 0
          ? { ...value, state: "READY", error: undefined }
          : { state: "IDLE", items: [], pageInfo: { hasNextPage: false } },
      ]),
    ));
  }, [abortAll]);

  const snapshots = requestedStages.map((stage) => windows[stage]);
  const loading = enabled && requestedStages.length > 0 && snapshots.some((snapshot) => !snapshot || (snapshot.state === "LOADING" && snapshot.items.length === 0));
  const refreshing = enabled && snapshots.some((snapshot) => snapshot?.state === "LOADING" && snapshot.items.length > 0);
  const stale = enabled && snapshots.some((snapshot) => snapshot?.state === "ERROR" && snapshot.items.length > 0);
  const error = snapshots.find((snapshot) => snapshot?.error)?.error;
  const loadedAt = snapshots
    .map((snapshot) => snapshot?.loadedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);

  return {
    connected,
    enabled,
    loading,
    refreshing,
    stale,
    ...(error === undefined ? {} : { error }),
    ...(loadedAt === undefined ? {} : { loadedAt }),
    refresh,
    cancel,
    loadMore: (stage) => loadStage(stage, true),
    isStageLoading: (stage) => windows[stage]?.state === "LOADING",
    hasMore: (stage) => windows[stage]?.pageInfo.hasNextPage ?? false,
    loadedCount: (stage) => windows[stage]?.items.length ?? 0,
    totalCount: (stage) => windows[stage]?.pageInfo.totalCount ?? windows[stage]?.items.length ?? 0,
  };
}

function normalizeWindowSize(value: number): number {
  return Math.min(MAX_WINDOW_SIZE, Math.max(10, Math.floor(value)));
}

function normalizeFilter(value: string | undefined, emptyValue: string): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized !== emptyValue ? normalized : undefined;
}

function mergeUniqueDeals(existing: readonly Deal[], incoming: readonly Deal[]): Deal[] {
  const byId = new Map(existing.map((deal) => [deal.id, deal]));
  for (const deal of incoming) byId.set(deal.id, deal);
  return [...byId.values()];
}
