import { useSubscribableSnapshot } from "@/platform/react";

export function useRepositorySnapshot<T>(
  subscribe: (listener: (snapshot: T) => void) => () => void,
  getSnapshot: () => T,
): T {
  // Repository snapshot getters intentionally return defensive array/object copies.
  // React 19's useSyncExternalStore requires referentially cached snapshots and will
  // enter an update loop when getSnapshot() creates a fresh value on every read.
  // Keep the defensive repository contract and update React state only when the
  // repository subscription emits a real change.
  return useSubscribableSnapshot(getSnapshot, subscribe);
}
