import { useEffect, useRef, useState } from "react";
import { registerUnsavedWork } from "@/platform/unsaved-work";

/** Owns target identity only; each workflow owns its canonical business draft. */
export function useTargetBoundWorkflow(routeId: string | undefined, name: string) {
  const [targetId, setTargetId] = useState(routeId);
  const [cycle, setCycle] = useState(0);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const mounted = useRef(true);
  const activeCycle = useRef(cycle);
  activeCycle.current = cycle;
  const state = useRef({ dirty: false, reset: () => {}, save: async () => false });

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (routeId !== targetId && !state.current.dirty && !pendingRef.current) {
      setTargetId(routeId);
      setCycle(value => value + 1);
    }
  });

  function register(dirty: boolean, reset: () => void, save: () => Promise<boolean>) {
    state.current = { dirty, reset, save };
  }
  useEffect(() => registerUnsavedWork({
    id: `${name}:${targetId}:${cycle}`,
    title: `${name}: ${targetId ?? ""}`,
    isDirty: state.current.dirty || pending,
    save: () => pendingRef.current || !mounted.current || activeCycle.current !== cycle ? Promise.resolve(false) : state.current.save(),
    canDiscard: () => !pendingRef.current && mounted.current && activeCycle.current === cycle,
    discard: () => {
      if (pendingRef.current || !mounted.current || activeCycle.current !== cycle) return;
      state.current.reset();
      state.current.dirty = false;
      if (routeId !== targetId) {
        setTargetId(routeId);
        setCycle(value => value + 1);
      }
    },
  }));
  useEffect(() => {
    if (!state.current.dirty && !pending) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  });

  return {
    targetId, cycle, pending, register,
    begin: () => {
      if (pendingRef.current || !mounted.current) return false;
      pendingRef.current = true;
      setPending(true);
      return true;
    },
    isCurrent: () => mounted.current && activeCycle.current === cycle,
    finish: () => {
      if (!mounted.current || activeCycle.current !== cycle) return;
      pendingRef.current = false;
      setPending(false);
    },
  };
}
