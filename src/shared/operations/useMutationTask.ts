import React from "react";
import { classifyMutationFailure, type MutationSnapshot } from "./mutationState";

export interface UseMutationTaskOptions {
  reloadLatest?: (signal: AbortSignal) => Promise<unknown> | unknown;
}

export function useMutationTask<T>(options: UseMutationTaskOptions = {}) {
  const [snapshot, setSnapshot] = React.useState<MutationSnapshot<T>>({ state: "IDLE" });
  const [recovering, setRecovering] = React.useState(false);
  const activeRef = React.useRef<AbortController | null>(null);
  const reloadLatestRef = React.useRef(options.reloadLatest);
  reloadLatestRef.current = options.reloadLatest;

  const run = React.useCallback(async (operation: (signal: AbortSignal) => Promise<T> | T): Promise<T | undefined> => {
    if (activeRef.current) return undefined;
    const controller = new AbortController();
    const submittedAt = new Date().toISOString();
    activeRef.current = controller;
    setSnapshot({ state: "SUBMITTING", submittedAt });
    try {
      const result = await operation(controller.signal);
      setSnapshot({
        state: "SUCCEEDED",
        result,
        authoritativeEntity: result,
        submittedAt,
        completedAt: new Date().toISOString(),
      });
      return result;
    } catch (error) {
      const failure = classifyMutationFailure(error);
      setSnapshot({ state: failure.state, failure, submittedAt, completedAt: new Date().toISOString() });
      return undefined;
    } finally {
      activeRef.current = null;
    }
  }, []);

  const reloadLatest = React.useCallback(async (): Promise<boolean> => {
    if (activeRef.current || !reloadLatestRef.current) return false;
    const controller = new AbortController();
    activeRef.current = controller;
    setRecovering(true);
    try {
      await reloadLatestRef.current(controller.signal);
      setSnapshot({ state: "IDLE" });
      return true;
    } catch (error) {
      const failure = classifyMutationFailure(error);
      setSnapshot({ state: failure.state, failure, completedAt: new Date().toISOString() });
      return false;
    } finally {
      setRecovering(false);
      activeRef.current = null;
    }
  }, []);

  const cancel = React.useCallback(() => activeRef.current?.abort(), []);
  const reset = React.useCallback(() => setSnapshot({ state: "IDLE" }), []);
  const dismissFailure = React.useCallback(() => {
    setSnapshot((current) => current.failure ? { state: "IDLE" } : current);
  }, []);

  return {
    snapshot,
    run,
    cancel,
    reset,
    dismissFailure,
    reloadLatest,
    busy: snapshot.state === "SUBMITTING",
    recovering,
    conflicted: snapshot.state === "CONFLICTED",
  };
}
