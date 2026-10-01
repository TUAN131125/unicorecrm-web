import { useEffect, useRef, useState } from "react";
import { ApplicationError, normalizeApplicationError } from "@/shared/domain";
import { handoverLeadWithTasksViaApi } from "../../application/commands/leadApiCommands";
import { getLeadDetailResource } from "../../application/vertical-slice/leadAuthoritativeQueries";
import type { HandoverLeadWithTasksInput } from "../../application/ports/LeadApiRuntime";
import type { Lead } from "../../domain/model/lead.types";

export function useLeadHandover(lead: Lead | undefined) {
  const [pending, setPending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [ambiguous, setAmbiguous] = useState(false);
  const busy = useRef(false);
  const attempt = useRef<{ leadId: string; idempotencyKey: string; expectedVersion: number; input: HandoverLeadWithTasksInput } | undefined>(undefined);
  const refreshed = useRef<Lead | undefined>(undefined);
  const recordId = useRef(lead?.id);
  const epoch = useRef(0);
  useEffect(() => {
    if (recordId.current === lead?.id) return;
    recordId.current = lead?.id;
    epoch.current++;
    attempt.current = undefined;
    refreshed.current = undefined;
    busy.current = false;
    setPending(false);
    setBlocked(false);
    setAmbiguous(false);
  }, [lead?.id]);
  const newest = refreshed.current?.id === lead?.id
    && (refreshed.current?.resourceVersion ?? -1) > (lead?.resourceVersion ?? -1)
    ? refreshed.current : lead;
  useEffect(() => {
    if (newest?.id === recordId.current) refreshed.current = newest;
  }, [newest]);
  const isAmbiguousRetry = (input: HandoverLeadWithTasksInput) => Boolean(ambiguous
    && attempt.current?.leadId === lead?.id
    && attempt.current?.input.nextOwnerId === input.nextOwnerId.trim()
    && attempt.current?.input.reason === input.reason.trim());
  const recover = async () => {
    if (!lead || busy.current || ambiguous) return;
    const startedEpoch = epoch.current;
    const resource = getLeadDetailResource(lead.id);
    const next = await resource.refresh();
    if (startedEpoch !== epoch.current) return;
    if (!next) throw resource.getSnapshot().error ?? new ApplicationError({ code: "RESOURCE_NOT_FOUND", category: "NOT_FOUND", message: "Lead refresh failed" });
    if (refreshed.current?.id !== next.id || (next.resourceVersion ?? -1) >= (refreshed.current.resourceVersion ?? -1)) refreshed.current = next;
    attempt.current = undefined;
    setBlocked(false);
  };
  const submit = async (input: HandoverLeadWithTasksInput) => {
    if (!lead || busy.current || blocked) return;
    const observed = newest;
    if (!observed) return;
    const payload = { nextOwnerId: input.nextOwnerId.trim(), reason: input.reason.trim() };
    if (!attempt.current && (!observed.ownerId || observed.archivedAt || observed.resourceVersion === undefined
      || payload.nextOwnerId === observed.ownerId || !payload.nextOwnerId || !payload.reason || payload.reason.length > 1000)) return;
    if (!attempt.current && observed.resourceVersion !== undefined) attempt.current = { leadId: lead.id, idempotencyKey: `lead-handover-${crypto.randomUUID()}`, expectedVersion: observed.resourceVersion, input: payload };
    const intent = attempt.current;
    if (!intent) return;
    if (intent.leadId !== lead.id || JSON.stringify(intent.input) !== JSON.stringify(payload)) {
      throw new ApplicationError({ code: "IDEMPOTENCY_KEY_REUSED", category: "CONFLICT", message: "Retry the original handover before changing its intent.", userMessage: "Retry the original handover before changing its intent." });
    }
    busy.current = true;
    setPending(true);
    const startedEpoch = epoch.current;
    try {
      const result = await handoverLeadWithTasksViaApi(intent.leadId, intent.input, intent);
      if (startedEpoch !== epoch.current) return;
      attempt.current = undefined;
      if (refreshed.current?.id !== result.lead.id || (result.lead.resourceVersion ?? -1) >= (refreshed.current.resourceVersion ?? -1)) refreshed.current = result.lead;
      setAmbiguous(false);
      return result;
    } catch (failure) {
      if (startedEpoch !== epoch.current) return;
      const error = normalizeApplicationError(failure);
      if (error.status === 412 || error.code === "VERSION_CONFLICT") {
        setBlocked(true);
        setAmbiguous(false);
      } else if (error.category === "NETWORK" || error.status === undefined || error.status >= 500) {
        setAmbiguous(true);
      } else {
        attempt.current = undefined;
        setAmbiguous(false);
      }
      throw failure;
    } finally {
      if (startedEpoch === epoch.current) {
        busy.current = false;
        setPending(false);
      }
    }
  };
  return { pending, blocked, ambiguous, isAmbiguousRetry, submit, recover };
}
