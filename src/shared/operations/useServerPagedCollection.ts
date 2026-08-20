import React from "react";
import type { AuthoritativePage, ModuleListQuery } from "@/shared/application";
import { normalizeApplicationError, type ApplicationError } from "@/shared/domain";

interface ServerPageSnapshot<T> {
  state: "IDLE" | "LOADING" | "READY" | "ERROR";
  page?: AuthoritativePage<T>;
  error?: ApplicationError;
  requestedAt?: string;
  loadedAt?: string;
}

export interface UseServerPagedCollectionOptions<T> {
  connected: boolean;
  scopeKey: string;
  query?: Omit<ModuleListQuery, "cursor" | "limit">;
  enabled?: boolean;
  initialPageSize?: number;
  project(records: readonly T[]): void;
  loadPage(query: ModuleListQuery, signal: AbortSignal): Promise<AuthoritativePage<T>>;
  errorCodePrefix: string;
  onReset?: () => void;
}

export interface ServerPagedCollectionState<T> {
  connected: boolean;
  enabled: boolean;
  items: T[];
  page: number;
  setPage(page: number): void;
  pageSize: number;
  setPageSize(pageSize: number): void;
  pageCount: number;
  totalItems: number;
  rangeStart: number;
  rangeEnd: number;
  hasNextPage: boolean;
  canGoPrevious: boolean;
  canGoNext: boolean;
  loading: boolean;
  refreshing: boolean;
  stale: boolean;
  error?: ApplicationError;
  loadedAt?: string;
  refresh(): Promise<void>;
  cancel(): void;
}

const PAGE_SIZE_OPTIONS = new Set([25, 50, 100]);

export function useServerPagedCollection<T>(
  options: UseServerPagedCollectionOptions<T>,
): ServerPagedCollectionState<T> {
  const enabled = options.connected && (options.enabled ?? true);
  const [page, setPageState] = React.useState(1);
  const [pageSize, setPageSizeState] = React.useState(() => normalizePageSize(options.initialPageSize ?? 25));
  const [snapshot, setSnapshot] = React.useState<ServerPageSnapshot<T>>({ state: "IDLE" });
  const controllerRef = React.useRef<AbortController | undefined>(undefined);
  const requestVersionRef = React.useRef(0);
  const cursorByPageRef = React.useRef(new Map<number, string | undefined>([[1, undefined]]));
  const queryKey = React.useMemo(() => stableQueryKey(options.query), [options.query]);
  const resetKey = `${options.scopeKey}\u0000${queryKey}\u0000${pageSize}`;
  const previousResetKeyRef = React.useRef(resetKey);
  const previousEnabledRef = React.useRef(enabled);

  const reset = React.useCallback(() => {
    requestVersionRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = undefined;
    cursorByPageRef.current = new Map([[1, undefined]]);
    setPageState(1);
    setSnapshot({ state: "IDLE" });
    options.project([]);
    options.onReset?.();
  }, [options.project, options.onReset]);

  React.useLayoutEffect(() => {
    if (previousResetKeyRef.current === resetKey) return;
    previousResetKeyRef.current = resetKey;
    reset();
  }, [reset, resetKey]);

  React.useLayoutEffect(() => {
    const wasEnabled = previousEnabledRef.current;
    previousEnabledRef.current = enabled;
    if (!wasEnabled && enabled) reset();
  }, [enabled, reset]);

  React.useEffect(() => () => {
    requestVersionRef.current += 1;
    controllerRef.current?.abort();
  }, []);

  const load = React.useCallback(async (force: boolean) => {
    if (!enabled) return;
    if (!force && snapshot.state === "READY") return;

    const cursor = cursorByPageRef.current.get(page);
    if (page > 1 && cursor === undefined) {
      setPageState((current) => Math.max(1, current - 1));
      return;
    }

    requestVersionRef.current += 1;
    const requestVersion = requestVersionRef.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const requestedAt = new Date().toISOString();
    const previousPage = snapshot.page;
    setSnapshot({
      state: "LOADING",
      requestedAt,
      ...(previousPage === undefined ? {} : { page: previousPage }),
    });

    try {
      const result = await options.loadPage({
        ...options.query,
        limit: pageSize,
        ...(cursor === undefined ? {} : { cursor }),
      }, controller.signal);
      if (controller.signal.aborted || requestVersion !== requestVersionRef.current) return;

      if (result.pageInfo.hasNextPage) {
        const nextCursor = result.pageInfo.nextCursor?.trim();
        if (!nextCursor) throw new Error(`${options.errorCodePrefix}_SERVER_PAGE_CURSOR_REQUIRED`);
        cursorByPageRef.current.set(page + 1, nextCursor);
      } else {
        cursorByPageRef.current.delete(page + 1);
      }
      for (const knownPage of [...cursorByPageRef.current.keys()]) {
        if (knownPage > page + 1) cursorByPageRef.current.delete(knownPage);
      }

      options.project(result.items);
      setSnapshot({
        state: "READY",
        page: result,
        requestedAt,
        loadedAt: result.loadedAt || new Date().toISOString(),
      });
    } catch (error: unknown) {
      if (controller.signal.aborted || requestVersion !== requestVersionRef.current) return;
      setSnapshot({
        state: "ERROR",
        error: normalizeApplicationError(error),
        requestedAt,
        ...(previousPage === undefined ? {} : { page: previousPage }),
      });
    } finally {
      if (requestVersion === requestVersionRef.current) controllerRef.current = undefined;
    }
  }, [enabled, options.errorCodePrefix, options.loadPage, options.project, options.query, page, pageSize, snapshot.page, snapshot.state]);

  React.useEffect(() => {
    if (enabled && snapshot.state === "IDLE") void load(false);
  }, [enabled, load, snapshot.state]);

  const totalCount = snapshot.page?.pageInfo.totalCount;
  const hasNextPage = snapshot.page?.pageInfo.hasNextPage ?? false;
  const pageCount = totalCount === undefined
    ? Math.max(1, page + (hasNextPage ? 1 : 0))
    : Math.max(1, Math.ceil(totalCount / pageSize));
  const items = snapshot.page?.items ?? [];
  const totalItems = totalCount ?? ((page - 1) * pageSize + items.length + (hasNextPage ? 1 : 0));
  const rangeStart = items.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = items.length === 0 ? 0 : rangeStart + items.length - 1;

  const setPage = React.useCallback((nextPage: number) => {
    const normalized = Math.max(1, Math.floor(nextPage));
    if (normalized === page) return;
    if (normalized > page && !cursorByPageRef.current.has(normalized)) return;
    requestVersionRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = undefined;
    options.project([]);
    setPageState(normalized);
    setSnapshot({ state: "IDLE" });
  }, [options.project, page]);

  const setPageSize = React.useCallback((nextSize: number) => {
    setPageSizeState(normalizePageSize(nextSize));
  }, []);

  const refresh = React.useCallback(async () => {
    await load(true);
  }, [load]);

  const cancel = React.useCallback(() => {
    requestVersionRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = undefined;
    setSnapshot((current) => current.page
      ? { state: "READY", page: current.page, loadedAt: current.loadedAt }
      : { state: "IDLE" });
  }, []);

  return {
    connected: options.connected,
    enabled,
    items,
    page,
    setPage,
    pageSize,
    setPageSize,
    pageCount,
    totalItems,
    rangeStart,
    rangeEnd,
    hasNextPage,
    canGoPrevious: page > 1,
    canGoNext: hasNextPage || page < pageCount,
    loading: enabled && (snapshot.state === "IDLE" || snapshot.state === "LOADING"),
    refreshing: enabled && snapshot.state === "LOADING" && snapshot.page !== undefined,
    stale: enabled && snapshot.state === "ERROR" && snapshot.page !== undefined,
    ...(snapshot.error === undefined ? {} : { error: snapshot.error }),
    ...(snapshot.loadedAt === undefined ? {} : { loadedAt: snapshot.loadedAt }),
    refresh,
    cancel,
  };
}

function normalizePageSize(value: number): number {
  const normalized = Math.max(1, Math.floor(value));
  return PAGE_SIZE_OPTIONS.has(normalized) ? normalized : 25;
}

function stableQueryKey(query: Omit<ModuleListQuery, "cursor" | "limit"> | undefined): string {
  if (!query) return "{}";
  const filters = Object.fromEntries(
    Object.entries(query.filters ?? {})
      .filter(([, value]) => value !== undefined && value !== "")
      .sort(([left], [right]) => left.localeCompare(right)),
  );
  return JSON.stringify({
    search: query.search?.trim() || undefined,
    sortBy: query.sortBy || undefined,
    sortDirection: query.sortDirection || undefined,
    filters,
  });
}
