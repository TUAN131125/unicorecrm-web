import { useCallback, useRef, useState } from "react";
import { ApplicationError } from "@/shared/domain";
import { formatApplicationError } from "@/shared/operations";
import { claimLeadFromQueueViaApi } from "../../application/commands/leadApiCommands";

export type ClaimQueueObservation = {
  queryKey: string;
  pageKey: string;
  items: readonly { id: string; resourceVersion?: number }[];
};

export function useLeadQueueClaim(options: { enabled: boolean; locale: "vi" | "en"; refresh: () => Promise<unknown>; notify: (message: string) => void; onClaimed?: (leadId: string) => void }) {
  const pending = useRef(new Set<string>());
  const blocked = useRef(new Map<string, number>());
  const previousObservation = useRef<ClaimQueueObservation | undefined>(undefined);
  const attempts = useRef(new Map<string, { idempotencyKey: string; expectedVersion: number }>());
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const reconcile = useCallback((observation: ClaimQueueObservation) => {
    const previous = previousObservation.current;
    previousObservation.current = observation;
    const versions = new Map(observation.items.map(item => [item.id, item.resourceVersion]));
    // Only consecutive observations of the same page/query provide removal evidence.
    const removedIds = previous?.queryKey === observation.queryKey && previous.pageKey === observation.pageKey
      ? previous.items.filter(item => !versions.has(item.id)).map(item => item.id)
      : [];
    const removed = new Set(removedIds);
    let changed = false;
    for (const [id, rejectedVersion] of blocked.current) {
      const observedVersion = versions.get(id);
      if (removed.has(id) || (observedVersion !== undefined && observedVersion > rejectedVersion)) {
        blocked.current.delete(id); changed = true;
      }
    }
    for (const [id, attempt] of attempts.current) {
      const observedVersion = versions.get(id);
      if (removed.has(id) || (observedVersion !== undefined && observedVersion !== attempt.expectedVersion)) attempts.current.delete(id);
    }
    if (changed) setPendingIds(new Set([...pending.current, ...blocked.current.keys()]));
    return removedIds;
  }, []);
  const claim = async (leadId: string, expectedVersion: number) => {
    if (!options.enabled || (pending.current.has(leadId) || blocked.current.has(leadId))) return;
    pending.current.add(leadId);
    setPendingIds(new Set([...pending.current, ...blocked.current.keys()]));
    const intent = attempts.current.get(leadId) ?? { idempotencyKey: `lead-claim-${crypto.randomUUID()}`, expectedVersion };
    attempts.current.set(leadId, intent);
    try {
      await claimLeadFromQueueViaApi(leadId, intent);
      attempts.current.delete(leadId);
      options.onClaimed?.(leadId);
      options.notify(options.locale === "vi" ? "Đã nhận Lead." : "Lead claimed.");
      await options.refresh();
    } catch (error) {
      if (error instanceof ApplicationError && ["LEAD_QUEUE_CLAIM_CONFLICT", "VERSION_CONFLICT"].includes(error.code)) {
        attempts.current.delete(leadId);
        options.notify(options.locale === "vi" ? "Lead này vừa được một nhân viên khác nhận." : "This Lead was just claimed by another team member.");
        blocked.current.set(leadId, intent.expectedVersion);
        try {
          await options.refresh();
          // The collection can resolve refresh after recording an error. Only a
          // successful authoritative observation may unblock via reconcile().
        } catch (refreshError) {
          options.notify(formatApplicationError(refreshError, { locale: options.locale }));
        }
      } else {
        options.notify(formatApplicationError(error, { locale: options.locale }));
      }
    } finally {
      pending.current.delete(leadId);
      setPendingIds(new Set([...pending.current, ...blocked.current.keys()]));
    }
  };
  return { claim, pendingIds, reconcile };
}
