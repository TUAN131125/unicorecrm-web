import { useEffect, useState } from "react";

export type SnapshotSubscriber<T> = (listener: (snapshot: T) => void) => () => void;

export function useSubscribableSnapshot<T>(
  getSnapshot: () => T,
  subscribe: SnapshotSubscriber<T>,
): T {
  const [snapshot, setSnapshot] = useState<T>(getSnapshot);

  useEffect(() => {
    setSnapshot(getSnapshot());
    return subscribe(setSnapshot);
  }, [getSnapshot, subscribe]);

  return snapshot;
}
