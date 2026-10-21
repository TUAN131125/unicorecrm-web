import { useEffect, useRef, useState } from "react";
import { useEffectiveAccess, CAPABILITIES } from "@/platform/access-control";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { useAuthSessionSnapshot } from "@/platform/identity-auth";
import { normalizeApplicationError } from "@/shared/domain";
import { getChannelManagement } from "../../runtime";
import type { TelegramConnection, TelegramLifecycleAction } from "../../application/ChannelManagement";

export function useTelegramConnection(id: string, version: number, refreshAccounts: () => void) {
  const workspace = useWorkspaceContextSnapshot(); const access = useEffectiveAccess(); const session = useAuthSessionSnapshot();
  const allowed = workspace.status === "active" && session?.status === "ACTIVE" && access.can(CAPABILITIES.COMMUNICATIONS_CHANNELS_MANAGE);
  const scope = JSON.stringify([workspace.workspaceId, workspace.accountId, workspace.memberId, workspace.membershipId, session?.sessionId, session?.status, access.authorityRevision, allowed, id, version]);
  const current = useRef(scope); current.current = scope;
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<{ scope: string; value: TelegramConnection | null; status: string }>({ scope, value: null, status: "loading" });
  const pending = useRef<AbortController | null>(null);
  const retryKey = useRef<{ scope: string; action: string; version: number; key: string } | null>(null);
  const api = getChannelManagement();
  useEffect(() => () => { pending.current?.abort(); retryKey.current = null; }, [scope]);
  useEffect(() => {
    const controller = new AbortController();
    setSnapshot({ scope, value: null, status: allowed ? "loading" : "denied" });
    if (allowed && api) void api.connection(id, controller.signal).then(value => {
      if (!controller.signal.aborted && current.current === scope) setSnapshot({ scope, value, status: "ready" });
    }).catch(() => { if (!controller.signal.aborted && current.current === scope) setSnapshot({ scope, value: null, status: "error" }); });
    return () => { controller.abort(); pending.current?.abort(); };
  }, [scope, allowed, api, id, revision]);
  const state = allowed && snapshot.scope === scope ? snapshot : { scope, value: null, status: allowed ? "loading" : "denied" };
  const mutate = async (action: "put" | "remove" | "disconnect" | TelegramLifecycleAction, token: string | null = null) => {
    if (!allowed || !api || !state.value || pending.current || current.current !== scope) return;
    const connection = state.value;
    if ((action === "put" || action === "verify" || action === "activate" || action === "reconnect") && (!connection.providerAllowed || !connection.securityReady)) return;
    const controller = new AbortController(); pending.current = controller;
    if (action === "put" || retryKey.current?.scope !== scope || retryKey.current.action !== action || retryKey.current.version !== connection.configurationVersion)
      retryKey.current = { scope, action, version: connection.configurationVersion, key: crypto.randomUUID() };
    const key = retryKey.current.key;
    setSnapshot({ ...state, status: "saving" });
    try {
      let value: TelegramConnection;
      if (action === "put" || action === "remove") value = await api.credential(action, id, token, connection.configurationVersion, key, controller.signal);
      else if (action === "disconnect") {
        await api.mutate("disconnect", id, "telegram", "", connection.configurationVersion, key, controller.signal);
        if (controller.signal.aborted || current.current !== scope) return;
        value = await api.connection(id, controller.signal);
      } else value = await api.lifecycle(action, id, connection.configurationVersion, key, controller.signal);
      if (!controller.signal.aborted && current.current === scope) { retryKey.current = null; setSnapshot({ scope, value, status: "ready" }); refreshAccounts(); }
    } catch (error: unknown) {
      if (!controller.signal.aborted && current.current === scope) {
        const e = normalizeApplicationError(error);
        const status = e.code === "SECURITY_NOT_READY" ? "security" : e.code === "LIVE_NOT_ADMITTED" ? "admission"
          : e.status === 409 ? "conflict" : e.status === 401 || e.status === 403 ? "denied" : e.status === 404 ? "missing" : "error";
        setSnapshot({ scope, value: null, status });
        if (status === "conflict" || status === "denied" || status === "missing") { retryKey.current = null; refreshAccounts(); }
      }
    } finally { if (pending.current === controller) pending.current = null; }
  };
  return { ...state, formKey: scope, retry: () => setRevision(v => v + 1), save: (token: string) => { void mutate("put", token); },
    remove: () => { void mutate("remove"); }, lifecycle: (action: TelegramLifecycleAction) => { void mutate(action); }, disconnect: () => { void mutate("disconnect"); } };
}
