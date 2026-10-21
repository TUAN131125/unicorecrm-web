import { useEffect, useRef, useState } from "react";
import { normalizeApplicationError } from "@/shared/domain";
import type { CommunicationsLinkCommands, CommunicationsLinkQueries, ConversationCrmContext, CrmTarget } from "../../application/CommunicationsLink";

type Status = "loading" | "ready" | "pending" | "conflict" | "denied" | "error" | "unavailable";
interface Snapshot { scope: string; status: Status; context?: ConversationCrmContext; candidates: CrmTarget[]; selected?: CrmTarget | null; searching: boolean; searched?: boolean }
export function useConversationCrmLink(port: { queries: CommunicationsLinkQueries; commands: CommunicationsLinkCommands } | undefined,
  authorityScope: string, id: string | undefined, enabled: boolean, canWrite: boolean, refresh: () => void, revision: number | undefined) {
  const scope = JSON.stringify([authorityScope, id, enabled]);
  const [reload, setReload] = useState(0);
  const [snapshot, setSnapshot] = useState<Snapshot>({ scope, status: "loading", candidates: [], searching: false });
  const active = useRef<{ scope: string; search?: AbortController; mutation?: AbortController }>({ scope });
  useEffect(() => {
    active.current.search?.abort(); active.current.mutation?.abort(); active.current = { scope };
    setSnapshot({ scope, status: enabled && port ? "loading" : "unavailable", candidates: [], searching: false });
    const controller = new AbortController();
    if (enabled && port && id) void port.queries.context(id, controller.signal).then(context => {
      if (!controller.signal.aborted) setSnapshot({ scope, status: "ready", context, candidates: [], searching: false });
    }).catch(error => {
      if (!controller.signal.aborted) setSnapshot({ scope, status: failure(error), candidates: [], searching: false });
    });
    return () => { controller.abort(); active.current.search?.abort(); active.current.mutation?.abort(); active.current = { scope: "" }; };
  }, [port, scope, id, enabled, revision, reload]);
  const current = snapshot.scope === scope && enabled ? snapshot : { scope, status: "unavailable" as const, candidates: [], searching: false };
  const search = async (type: "LEAD" | "CONTACT", query: string) => {
    if (!port || !id || !enabled || !canWrite || !current.context?.canLink || current.status !== "ready" || !query.trim()) return;
    active.current.search?.abort(); const controller = new AbortController(); active.current.search = controller;
    setSnapshot(value => ({ ...value, candidates: [], selected: undefined, searching: true }));
    try {
      const candidates = await port.queries.search(id, type, query.trim(), controller.signal);
      if (!controller.signal.aborted && active.current.scope === scope) setSnapshot(value => ({ ...value, candidates, searching: false, searched: true }));
    } catch (error) {
      if (!controller.signal.aborted && active.current.scope === scope) setSnapshot({ scope, status: failure(error), candidates: [], searching: false });
    }
  };
  const confirm = async () => {
    if (!port || !id || !enabled || !canWrite || !current.context?.canLink || current.selected === undefined || active.current.mutation) return;
    active.current.search?.abort(); const controller = new AbortController(); active.current.mutation = controller;
    setSnapshot(value => ({ ...value, status: "pending" }));
    try {
      await port.commands.change(id, current.selected, current.context.version, controller.signal, crypto.randomUUID());
      if (!controller.signal.aborted && active.current.scope === scope) { refresh(); setReload(value => value + 1); }
    } catch (error) {
      if (!controller.signal.aborted && active.current.scope === scope) {
        setSnapshot({ scope, status: failure(error), candidates: [], searching: false });
      }
    } finally { if (active.current.scope === scope) delete active.current.mutation; }
  };
  return { ...current, canWrite, search, confirm,
    select: (selected: CrmTarget | null) => { if (current.status === "ready" && canWrite) setSnapshot(value => ({ ...value, selected })); },
    reload: () => setReload(value => value + 1) };
}
function failure(error: unknown): Status {
  const normalized = normalizeApplicationError(error);
  return normalized.status === 409 ? "conflict" : normalized.category === "AUTHENTICATION" || normalized.category === "AUTHORIZATION" || normalized.category === "NOT_FOUND" ? "denied" : "error";
}
