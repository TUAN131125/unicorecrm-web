import { useEffect, useRef, useState } from "react";
import { getWorkspaceContextSnapshot, useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { registerUnsavedWork } from "@/platform/unsaved-work";

function fingerprint(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => typeof item === "string" ? item.trim() : item);
}

/** Owns one modal opening snapshot; commands receive this snapshot, never the current screen. */
export function useBoundFormDraft<T, S>(open: boolean, targetId: string, source: S, initial: () => T, name: string, close: () => void, canonical: (value: T) => string = fingerprint) {
  const workspace = useWorkspaceContextSnapshot();
  const openingWorkspaceId = useRef(workspace.workspaceId);
  const [draft, setDraft] = useState(initial);
  const opening = useRef(source);
  const baseline = useRef(canonical(draft));
  const identity = useRef(targetId);
  const wasOpen = useRef(false);
  const cycle = useRef(0);
  const intentId = useRef(crypto.randomUUID());
  const mounted = useRef(true);
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const dirty = canonical(draft) !== baseline.current;
  const saveRef = useRef<() => Promise<boolean>>(async () => false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (open && wasOpen.current && workspace.workspaceId !== openingWorkspaceId.current) {
      if (!dirty && !pendingRef.current) close();
      return;
    }
    if (open && (!wasOpen.current || (identity.current !== targetId && !dirty && !pendingRef.current))) {
      cycle.current += 1; intentId.current = crypto.randomUUID();
      pendingRef.current = false; setPending(false);
      openingWorkspaceId.current = workspace.workspaceId;
      identity.current = targetId;
      opening.current = structuredClone(source);
      const next = initial(); baseline.current = canonical(next); setDraft(next); setConfirmOpen(false);
    }
    if (!open && wasOpen.current) cycle.current += 1;
    wasOpen.current = open;
  });
  const discard = () => {
    if (pendingRef.current || !mounted.current) return;
    baseline.current = canonical(draft); setConfirmOpen(false); close();
  };
  useEffect(() => {
    if (!open) return;
    const registeredCycle = cycle.current;
    return registerUnsavedWork({ id: `${name}:${openingWorkspaceId.current}:${identity.current}:${registeredCycle}`, title: name, isDirty: dirty || pending,
      save: () => !mounted.current || !wasOpen.current || cycle.current !== registeredCycle || pendingRef.current || getWorkspaceContextSnapshot().workspaceId !== openingWorkspaceId.current ? Promise.resolve(false) : saveRef.current(),
      canDiscard: () => wasOpen.current && !pendingRef.current && mounted.current && registeredCycle === cycle.current,
      discard: () => { if (mounted.current && wasOpen.current && registeredCycle === cycle.current && !pendingRef.current) discard(); },
    });
  });
  useEffect(() => {
    if (!open || (!dirty && !pending)) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [open, dirty, pending]);
  return { draft, setDraft, opening, intentId: intentId.current, cycle: cycle.current, targetId: identity.current, dirty, pending, confirmOpen, setConfirmOpen, discard,
    requestClose: () => { if (pendingRef.current) return; if (dirty) setConfirmOpen(true); else close(); },
    bindSave: (save: () => Promise<boolean>) => { saveRef.current = save; },
    begin: () => {
      if (!open || pendingRef.current || !mounted.current || getWorkspaceContextSnapshot().workspaceId !== openingWorkspaceId.current) return undefined;
      pendingRef.current = true; setPending(true); const activeCycle = cycle.current;
      return { isCurrent: () => mounted.current && activeCycle === cycle.current && wasOpen.current && getWorkspaceContextSnapshot().workspaceId === openingWorkspaceId.current,
        complete: () => { if (mounted.current && activeCycle === cycle.current) baseline.current = canonical(draft); },
        finish: () => { if (mounted.current && activeCycle === cycle.current) { pendingRef.current = false; setPending(false); } } };
    },
  };
}
