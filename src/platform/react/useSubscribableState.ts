import type { Dispatch, SetStateAction } from "react";
import { useCallback } from "react";
import { useSubscribableSnapshot, type SnapshotSubscriber } from "./useSubscribableSnapshot";

export function useSubscribableState<T>(
  getSnapshot: () => T,
  subscribe: SnapshotSubscriber<T>,
  replace: (snapshot: T) => void,
): [T, Dispatch<SetStateAction<T>>] {
  const snapshot = useSubscribableSnapshot(getSnapshot, subscribe);
  const setSnapshot = useCallback<Dispatch<SetStateAction<T>>>((updater) => {
    const current = getSnapshot();
    replace(typeof updater === "function" ? (updater as (value: T) => T)(current) : updater);
  }, [getSnapshot, replace]);
  return [snapshot, setSnapshot];
}
