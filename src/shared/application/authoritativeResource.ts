import { normalizeApplicationError, type ApplicationError } from "@/shared/domain";

export type AuthoritativeResourceState = "IDLE" | "LOADING" | "READY" | "ERROR";

export interface AuthoritativeResourceSnapshot<T> {
  state: AuthoritativeResourceState;
  data?: T;
  error?: ApplicationError;
  requestedAt?: string;
  loadedAt?: string;
}

export interface AuthoritativeResource<T> {
  getSnapshot(): AuthoritativeResourceSnapshot<T>;
  subscribe(listener: () => void): () => void;
  load(options?: { force?: boolean }): Promise<T | undefined>;
  refresh(): Promise<T | undefined>;
  cancel(): void;
  replace(data: T): void;
  reset(): void;
}

export function createAuthoritativeResource<T>(loader: (signal: AbortSignal) => Promise<T>): AuthoritativeResource<T> {
  let snapshot: AuthoritativeResourceSnapshot<T> = { state: "IDLE" };
  let controller: AbortController | undefined;
  let inFlight: Promise<T | undefined> | undefined;
  let requestVersion = 0;
  const listeners = new Set<() => void>();

  const emit = () => {
    for (const listener of listeners) listener();
  };

  const setSnapshot = (next: AuthoritativeResourceSnapshot<T>) => {
    snapshot = next;
    emit();
  };

  const run = (force: boolean): Promise<T | undefined> => {
    if (!force && snapshot.state === "READY") return Promise.resolve(snapshot.data);
    if (!force && inFlight) return inFlight;
    controller?.abort();
    controller = new AbortController();
    const currentController = controller;
    const currentVersion = ++requestVersion;
    const requestedAt = new Date().toISOString();
    const previousData = snapshot.data;
    setSnapshot({
      state: "LOADING",
      requestedAt,
      ...(previousData === undefined ? {} : { data: previousData }),
    });
    inFlight = loader(currentController.signal)
      .then((data) => {
        if (currentVersion !== requestVersion || currentController.signal.aborted) return undefined;
        setSnapshot({
          state: "READY",
          data,
          requestedAt,
          loadedAt: new Date().toISOString(),
        });
        return data;
      })
      .catch((error: unknown) => {
        if (currentVersion !== requestVersion || currentController.signal.aborted) return undefined;
        const currentData = snapshot.data;
        setSnapshot({
          state: "ERROR",
          error: normalizeApplicationError(error),
          requestedAt,
          ...(currentData === undefined ? {} : { data: currentData }),
        });
        return undefined;
      })
      .finally(() => {
        if (currentVersion === requestVersion) {
          inFlight = undefined;
          controller = undefined;
        }
      });
    return inFlight;
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    load: (options) => run(Boolean(options?.force)),
    refresh: () => run(true),
    cancel() {
      if (!controller) return;
      requestVersion += 1;
      controller.abort();
      controller = undefined;
      inFlight = undefined;
      setSnapshot(snapshot.data === undefined
        ? { state: "IDLE" }
        : {
            state: "READY",
            data: snapshot.data,
            ...(snapshot.loadedAt === undefined ? {} : { loadedAt: snapshot.loadedAt }),
          });
    },
    replace(data) {
      controller?.abort();
      controller = undefined;
      inFlight = undefined;
      requestVersion += 1;
      setSnapshot({ state: "READY", data, loadedAt: new Date().toISOString() });
    },
    reset() {
      controller?.abort();
      controller = undefined;
      inFlight = undefined;
      requestVersion += 1;
      setSnapshot({ state: "IDLE" });
    },
  };
}
