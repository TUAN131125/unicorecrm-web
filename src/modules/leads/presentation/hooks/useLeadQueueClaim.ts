import { useRef, useState } from "react";
import { ApplicationError } from "@/shared/domain";
import { formatApplicationError } from "@/shared/operations";
import { claimLeadFromQueueViaApi } from "../../application/commands/leadApiCommands";

export function useLeadQueueClaim(options: { enabled: boolean; locale: "vi" | "en"; refresh: () => Promise<unknown>; notify: (message: string) => void }) {
  const pending = useRef(new Set<string>());
  const blocked = useRef(new Set<string>());
  const attempts = useRef(new Map<string, { idempotencyKey: string; expectedVersion: number }>());
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const claim = async (leadId: string, expectedVersion: number) => {
    if (!options.enabled || (pending.current.has(leadId) || blocked.current.has(leadId))) return;
    pending.current.add(leadId);
    setPendingIds(new Set([...pending.current, ...blocked.current]));
    const intent = attempts.current.get(leadId) ?? { idempotencyKey: `lead-claim-${crypto.randomUUID()}`, expectedVersion };
    attempts.current.set(leadId, intent);
    try {
      await claimLeadFromQueueViaApi(leadId, intent);
      attempts.current.delete(leadId);
      options.notify(options.locale === "vi" ? "Đã nhận Lead." : "Lead claimed.");
      await options.refresh();
    } catch (error) {
      if (error instanceof ApplicationError && ["LEAD_QUEUE_CLAIM_CONFLICT", "VERSION_CONFLICT"].includes(error.code)) {
        attempts.current.delete(leadId);
        options.notify(options.locale === "vi" ? "Lead này vừa được một nhân viên khác nhận." : "This Lead was just claimed by another team member.");
        blocked.current.add(leadId);
        try {
          await options.refresh();
          blocked.current.delete(leadId);
        } catch (refreshError) {
          options.notify(formatApplicationError(refreshError, { locale: options.locale }));
        }
      } else {
        options.notify(formatApplicationError(error, { locale: options.locale }));
      }
    } finally {
      pending.current.delete(leadId);
      setPendingIds(new Set([...pending.current, ...blocked.current]));
    }
  };
  return { claim, pendingIds };
}
