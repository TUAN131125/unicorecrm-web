import React from "react";
import type { AuthoritativePage, ModuleListQuery } from "@/shared/application";
import { normalizeApplicationError, type ApplicationError } from "@/shared/domain";

interface ServerPageSnapshot<T> {
  scopeKey: string;
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
  authorizationScopeKey?: string;
  enabled?: boolean;
  initialPageSize?: number;
  project(records: readonly T[]): void;
  evictProjection?: () => void;
  loadPage(query: ModuleListQuery, signal: AbortSignal): Promise<AuthoritativePage<T>>;
  errorCodePrefix: string;
  onReset?: () => void;
  retainPreviousPage?: boolean;
  refreshIntervalMs?: number;
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
  const scopeKey = JSON.stringify([options.scopeKey, options.authorizationScopeKey]);
  const enabled = options.connected && (options.enabled ?? true);
  const [page, setPageState] = React.useState(1);
  const [pageSize, setPageSizeState] = React.useState(() => normalizePageSize(options.initialPageSize ?? 25));
  const [snapshot, setSnapshot] = React.useState<ServerPageSnapshot<T>>({ state: "IDLE", scopeKey: scopeKey });
  const controllerRef = React.useRef<AbortController | undefined>(undefined);
  const requestVersionRef = React.useRef(0);
  const cursorByPageRef = React.useRef(new Map<number, string | undefined>([[1, undefined]]));
  const queryKey = React.useMemo(() => stableQueryKey(options.query), [options.query]);
  const resetKey = `${scopeKey}\u0000${queryKey}\u0000${pageSize}`;
  const previousResetKeyRef = React.useRef(resetKey);
  const previousScopeKeyRef = React.useRef(scopeKey);
  const previousEnabledRef = React.useRef(enabled);

  const reset = React.useCallback((evictProjection: boolean) => {
    requestVersionRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = undefined;
    cursorByPageRef.current = new Map([[1, undefined]]);
    setPageState(1);
    setSnapshot((current) => evictProjection
      ? { state: "IDLE", scopeKey: scopeKey }
      : current.page === undefined || options.retainPreviousPage === false
        ? { state: "IDLE", scopeKey: scopeKey }
        : {
            state: "IDLE",
            scopeKey: current.scopeKey,
            page: current.page,
            ...(current.loadedAt === undefined ? {} : { loadedAt: current.loadedAt }),
          });
    if (evictProjection) {
      if (options.evictProjection) options.evictProjection();
      else options.project([]);
    }
    options.onReset?.();
  }, [options.evictProjection, options.project, options.onReset, scopeKey, options.retainPreviousPage]);

  React.useLayoutEffect(() => {
    if (previousResetKeyRef.current === resetKey) return;
    const scopeChanged = previousScopeKeyRef.current !== scopeKey;
    previousResetKeyRef.current = resetKey;
    previousScopeKeyRef.current = scopeKey;
    reset(scopeChanged);
  }, [scopeKey, reset, resetKey]);

  React.useLayoutEffect(() => {
    const wasEnabled = previousEnabledRef.current;
    previousEnabledRef.current = enabled;
    if (wasEnabled && !enabled) reset(true);
    else if (!wasEnabled && enabled) reset(false);
  }, [enabled, reset]);

  React.useEffect(() => () => {
    requestVersionRef.current += 1;
    controllerRef.current?.abort();
  }, []);

  const load = React.useCallback(async (force: boolean) => {
    if (!enabled || previousScopeKeyRef.current !== scopeKey) return;
    if (!force && snapshot.scopeKey === scopeKey && snapshot.state === "READY") return;

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
    const previousPage = options.retainPreviousPage !== false && snapshot.scopeKey === scopeKey ? snapshot.page : undefined;
    setSnapshot({
      state: "LOADING",
      scopeKey: scopeKey,
      requestedAt,
      ...(previousPage === undefined ? {} : { page: previousPage }),
    });

    try {
      const result = await options.loadPage({
        ...options.query,
        limit: pageSize,
        ...(cursor === undefined ? {} : { cursor }),
      }, controller.signal);
      if (controller.signal.aborted || requestVersion !== requestVersionRef.current || previousScopeKeyRef.current !== scopeKey) return;

      // Cursor pages do not imply a total. Only a server-provided count may clamp the page.
      const authoritativePageCount = result.pageInfo.totalCount === undefined ? undefined : Math.max(1, Math.ceil(result.pageInfo.totalCount / pageSize));
      if (authoritativePageCount !== undefined && page > authoritativePageCount) {
        setPageState(authoritativePageCount);
        setSnapshot((current) => current.page === undefined
          ? { state: "IDLE", scopeKey: scopeKey }
          : { state: "IDLE", scopeKey: current.scopeKey, page: current.page, ...(current.loadedAt === undefined ? {} : { loadedAt: current.loadedAt }) });
        return;
      }

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
        scopeKey: scopeKey,
        page: result,
        requestedAt,
        loadedAt: result.loadedAt || new Date().toISOString(),
      });
    } catch (error: unknown) {
      if (controller.signal.aborted || requestVersion !== requestVersionRef.current || previousScopeKeyRef.current !== scopeKey) return;
      const normalized = normalizeApplicationError(error);
      const denied = ["AUTHENTICATION", "AUTHORIZATION"].includes(normalized.category);
      if (denied) {
        if (options.evictProjection) options.evictProjection(); else options.project([]);
      }
      setSnapshot({
        state: "ERROR",
        scopeKey: scopeKey,
        error: normalized,
        requestedAt,
        ...(denied || previousPage === undefined ? {} : { page: previousPage }),
      });
    } finally {
      if (requestVersion === requestVersionRef.current) controllerRef.current = undefined;
    }
  }, [enabled, options.errorCodePrefix, options.loadPage, options.project, options.query, scopeKey, options.retainPreviousPage, page, pageSize, snapshot.page, snapshot.state, snapshot.scopeKey]);

  React.useEffect(() => {
    if (enabled && snapshot.state === "IDLE") void load(false);
  }, [enabled, load, snapshot.state]);

  const visibleSnapshot = enabled && snapshot.scopeKey === scopeKey ? snapshot : { state: "IDLE" as const, scopeKey: scopeKey };
  const totalCount = visibleSnapshot.page?.pageInfo.totalCount;
  const hasNextPage = visibleSnapshot.page?.pageInfo.hasNextPage ?? false;
  const pageCount = totalCount === undefined
    ? Math.max(1, page + (hasNextPage ? 1 : 0))
    : Math.max(1, Math.ceil(totalCount / pageSize));
  const items = visibleSnapshot.page?.items ?? [];
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
    setPageState(normalized);
    setSnapshot((current) => current.page === undefined || options.retainPreviousPage === false
      ? { state: "IDLE", scopeKey: current.scopeKey }
      : {
          state: "IDLE",
          scopeKey: current.scopeKey,
          page: current.page,
          ...(current.loadedAt === undefined ? {} : { loadedAt: current.loadedAt }),
        });
  }, [page, options.retainPreviousPage]);

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
      ? { state: "READY", scopeKey: current.scopeKey, page: current.page, loadedAt: current.loadedAt }
      : { state: "IDLE", scopeKey: current.scopeKey });
  }, []);

  const revalidation = React.useRef({ refresh, loading: snapshot.state === "LOADING", error: snapshot.error });
  revalidation.current = { refresh, loading: snapshot.state === "LOADING", error: snapshot.error };
  React.useEffect(() => {
    if (!enabled) return;
    let disposed = false; let running = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const interval = options.refreshIntervalMs;
    const schedule = () => { clearTimeout(timer); if (!disposed && interval && !revalidation.current.error && document.visibilityState === "visible" && navigator.onLine) timer = setTimeout(() => void wake(), Math.max(5000, interval)); };
    const wake = async (event?: Event) => {
      clearTimeout(timer);
      if (disposed || running || document.visibilityState !== "visible" || !navigator.onLine) return;
      const current = revalidation.current;
      // refresh() may settle before React publishes its error to this ref. A timer already
      // scheduled in that gap must not turn a failed query into an automatic retry loop.
      if (current.loading || (!event && current.error) || ["AUTHENTICATION", "AUTHORIZATION"].includes(current.error?.category ?? "")) { schedule(); return; }
      running = true;
      try { await current.refresh(); } finally { running = false; schedule(); }
    };
    window.addEventListener("focus", wake); window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", wake); schedule();
    return () => { disposed = true; clearTimeout(timer); window.removeEventListener("focus", wake); window.removeEventListener("online", wake); document.removeEventListener("visibilitychange", wake); };
  }, [enabled, scopeKey, options.refreshIntervalMs]);

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
    canGoPrevious: snapshot.state === "READY" && page > 1,
    canGoNext: snapshot.state === "READY" && (hasNextPage || page < pageCount),
    loading: enabled && (visibleSnapshot.state === "IDLE" || visibleSnapshot.state === "LOADING"),
    refreshing: enabled && ["IDLE", "LOADING"].includes(visibleSnapshot.state) && visibleSnapshot.page !== undefined,
    stale: enabled && visibleSnapshot.state === "ERROR" && visibleSnapshot.page !== undefined,
    ...(visibleSnapshot.error === undefined ? {} : { error: visibleSnapshot.error }),
    ...(visibleSnapshot.loadedAt === undefined ? {} : { loadedAt: visibleSnapshot.loadedAt }),
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
