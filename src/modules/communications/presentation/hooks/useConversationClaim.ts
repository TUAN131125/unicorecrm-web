import { useEffect, useRef, useState } from "react";
import { normalizeApplicationError } from "@/shared/domain";
import type { CommunicationsCommands } from "../../application/CommunicationsCommands";

export type ClaimStatus = "idle" | "pending" | "success" | "conflict" | "denied" | "missing" | "error";
export function useConversationClaim(commands: CommunicationsCommands | undefined, scope: string,
  enabled: boolean, refresh: () => void, onSuccess: (id: string) => void) {
  const active = useRef<{ scope: string; controller?: AbortController }>({ scope });
  const [snapshot, setSnapshot] = useState<{ scope: string; status: ClaimStatus }>({ scope, status: "idle" });
  useEffect(() => {
    active.current.controller?.abort();
    active.current = { scope };
    return () => { active.current.controller?.abort(); active.current = { scope: "" }; };
  }, [scope, commands, enabled]);
  const claim = async (id: string) => {
    if (!enabled || !commands || active.current.controller) return;
    const controller = new AbortController();
    active.current = { scope, controller };
    setSnapshot({ scope, status: "pending" });
    const current = () => !controller.signal.aborted && active.current.scope === scope;
    try {
      // Idempotency is the server's null-to-self transition; the key remains stable during this request.
      const outcome = await commands.claim(id, controller.signal, crypto.randomUUID());
      if (!current()) return;
      setSnapshot({ scope, status: "success" });
      refresh();
      onSuccess(outcome.data.conversationId);
    } catch (error) {
      if (!current()) return;
      const failure = normalizeApplicationError(error);
      const status = failure.code === "COMMUNICATION_CLAIM_CONFLICT" ? "conflict"
        : failure.category === "AUTHORIZATION" || failure.category === "AUTHENTICATION" ? "denied"
        : failure.category === "NOT_FOUND" ? "missing" : "error";
      setSnapshot({ scope, status });
      refresh();
    } finally {
      if (current()) active.current = { scope };
    }
  };
  return { claim, status: snapshot.scope === scope && enabled ? snapshot.status : "idle" as ClaimStatus };
}
