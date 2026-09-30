import { useEffect, useRef, useState } from "react";
import { normalizeApplicationError } from "@/shared/domain";
import { assignLeadOwnerViaApi } from "../../application/commands/leadApiCommands";
import { getLeadDetailResource } from "../../application/vertical-slice/leadAuthoritativeQueries";
import type { Lead } from "../../domain/model/lead.types";

export function useLeadOwnerAssign(lead: Lead, onAssigned?: (id: string) => void, refresh?: () => Promise<unknown>) {
  const [observed, setObserved] = useState(lead);
  const [pending, setPending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [ambiguous, setAmbiguous] = useState(false);
  const [error, setError] = useState<unknown>();
  const busy = useRef(false);
  const attempt = useRef<{ idempotencyKey: string; expectedVersion: number } | undefined>(undefined);
  const previousInputVersion = useRef(lead.resourceVersion);
  useEffect(() => {
    if (lead.resourceVersion === previousInputVersion.current) return;
    if (busy.current || lead.resourceVersion === undefined) return;
    previousInputVersion.current = lead.resourceVersion;
    setObserved(lead);
    attempt.current = undefined;
    setBlocked(false);
    setAmbiguous(false);
  }, [lead, pending]);
  const recover = async () => {
    try {
      const resource = getLeadDetailResource(lead.id);
      const next = await resource.refresh();
      if (!next) throw resource.getSnapshot().error ?? new Error("Lead refresh did not produce authoritative data");
      setObserved(next);
      if (next.resourceVersion !== observed.resourceVersion) {
        attempt.current = undefined;
        setBlocked(false);
        setAmbiguous(false);
      }
      await refresh?.();
    } catch (failure) { setError(failure); }
  };
  const submit = async (ownerId: string, reason: string) => {
    if (busy.current || blocked || !ownerId || !reason.trim() || observed.resourceVersion === undefined) return false;
    busy.current = true;
    setPending(true);
    setError(undefined);
    attempt.current ??= { idempotencyKey: `lead-assign-${crypto.randomUUID()}`, expectedVersion: observed.resourceVersion };
    try {
      await assignLeadOwnerViaApi(lead.id, { ownerId, reason: reason.trim() }, attempt.current);
      attempt.current = undefined;
      setAmbiguous(false);
      onAssigned?.(lead.id);
      // A committed owner comes only from the server result. Refresh failure cannot undo success.
      try { await refresh?.(); } catch (failure) { setError(failure); }
      return true;
    } catch (failure) {
      setError(failure);
      const normalized = normalizeApplicationError(failure);
      if (normalized.code === "VERSION_CONFLICT" || normalized.category === "CONFLICT") {
        setBlocked(true);
        attempt.current = undefined;
        await recover();
      } else if (normalized.category === "NETWORK" || normalized.status === undefined || normalized.status >= 500) {
        setAmbiguous(true);
      } else {
        attempt.current = undefined;
      }
      return false;
    } finally { busy.current = false; setPending(false); }
  };
  return { observed, pending, blocked, ambiguous, error, submit, recover };
}
