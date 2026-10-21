import { useEffect, useRef, useState } from "react";
import { normalizeApplicationError } from "@/shared/domain";
import type { CommunicationsCommands } from "../../application/CommunicationsCommands";
import type { ConversationStatus } from "../../domain/models";

export type TransitionStatus = "idle" | "pending" | "success" | "unchanged" | "conflict" | "denied" | "missing" | "error";
export function useConversationTransition(commands: CommunicationsCommands | undefined, scope: string,
  enabled: boolean, refresh: () => void) {
  const active = useRef<{ scope: string; controller?: AbortController }>({ scope });
  const [snapshot, setSnapshot] = useState<{ scope: string; status: TransitionStatus }>({ scope, status: "idle" });
  useEffect(() => {
    active.current.controller?.abort(); active.current = { scope };
    return () => { active.current.controller?.abort(); active.current = { scope: "" }; };
  }, [scope, commands, enabled]);
  const transition = async (id: string, target: ConversationStatus, version: number) => {
    if (!enabled || !commands || active.current.controller) return;
    const controller = new AbortController(); active.current = { scope, controller };
    setSnapshot({ scope, status: "pending" });
    const current = () => !controller.signal.aborted && active.current.scope === scope;
    try {
      const outcome = await commands.transition(id, target, version, controller.signal, crypto.randomUUID());
      if (!current()) return;
      setSnapshot({ scope, status: outcome.data.changed ? "success" : "unchanged" });
      refresh();
    } catch (error) {
      if (!current()) return;
      const failure = normalizeApplicationError(error);
      const status = failure.status === 409 ? "conflict"
        : failure.category === "AUTHORIZATION" || failure.category === "AUTHENTICATION" ? "denied"
        : failure.category === "NOT_FOUND" ? "missing" : "error";
      setSnapshot({ scope, status }); refresh();
    } finally { if (current()) active.current = { scope }; }
  };
  return { transition, status: snapshot.scope === scope && enabled ? snapshot.status : "idle" as TransitionStatus };
}
