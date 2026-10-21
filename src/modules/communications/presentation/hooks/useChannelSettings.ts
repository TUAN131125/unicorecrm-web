import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n";
import { useEffectiveAccess, CAPABILITIES } from "@/platform/access-control";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { useAuthSessionSnapshot } from "@/platform/identity-auth";
import { normalizeApplicationError } from "@/shared/domain";
import { getChannelManagement } from "../../runtime";
import type { ChannelAccount, ChannelPage, ChannelProvider } from "../../application/ChannelManagement";

export type ChannelState = { kind: "loading" | "denied" | "unavailable" | "error" | "authentication" }
  | { kind: "ready"; providers: ChannelProvider[]; page: ChannelPage };
interface Draft { id: string | null; providerKey: string; displayName: string; version: number }
function failure(error: unknown): "conflict" | "denied" | "authentication" | "validation" | "error" {
  const e = normalizeApplicationError(error);
  if (e.status === 409) return "conflict";
  if (e.status === 403) return "denied";
  if (e.status === 401) return "authentication";
  if (e.status === 400 || e.status === 422) return "validation";
  return "error";
}
export function useChannelSettings() {
  const workspace = useWorkspaceContextSnapshot();
  const access = useEffectiveAccess();
  const session = useAuthSessionSnapshot();
  const { locale } = useI18n();
  const enabled = workspace.status === "active" && session?.status === "ACTIVE" && access.can(CAPABILITIES.COMMUNICATIONS_CHANNELS_MANAGE);
  const scope = JSON.stringify([workspace.workspaceId, workspace.accountId, workspace.memberId, workspace.membershipId,
    session?.sessionId, session?.status, access.authorityRevision, enabled]);
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const [filters, setFilters] = useState({ scope, provider: "", status: "", cursor: null as string | null });
  const selection = filters.scope === scope ? filters : { scope, provider: "", status: "", cursor: null };
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<{ scope: string; state: ChannelState }>({ scope, state: { kind: "loading" } });
  const [editing, setEditing] = useState<{ scope: string; draft: Draft | null }>({ scope, draft: null });
  const [mutation, setMutation] = useState<{ scope: string; status: "idle" | "saving" | ReturnType<typeof failure> }>({ scope, status: "idle" });
  const pending = useRef<AbortController | null>(null);
  const retryKey = useRef<{ scope: string; fingerprint: string; key: string } | null>(null);
  const api = getChannelManagement();
  const filterScope = JSON.stringify([scope, selection.provider, selection.status, selection.cursor]);
  useEffect(() => {
    setEditing({ scope, draft: null }); setMutation({ scope, status: "idle" });
    return () => { pending.current?.abort(); retryKey.current = null; };
  }, [scope]);
  useEffect(() => {
    const controller = new AbortController();
    if (!enabled) { setSnapshot({ scope: filterScope, state: { kind: "denied" } }); return; }
    if (!api) { setSnapshot({ scope: filterScope, state: { kind: "unavailable" } }); return; }
    setSnapshot({ scope: filterScope, state: { kind: "loading" } });
    void Promise.all([api.providers(controller.signal), api.list(selection.provider, selection.status, selection.cursor, controller.signal)])
      .then(([providers, page]) => { if (!controller.signal.aborted) setSnapshot({ scope: filterScope, state: { kind: "ready", providers, page } }); })
      .catch((error: unknown) => { if (!controller.signal.aborted) { const kind = failure(error); setSnapshot({ scope: filterScope,
        state: { kind: kind === "denied" || kind === "authentication" ? kind : "error" } }); } });
    return () => controller.abort();
  }, [api, enabled, filterScope, revision, selection.provider, selection.status, selection.cursor]);
  const state: ChannelState = !enabled ? { kind: "denied" } : snapshot.scope === filterScope ? snapshot.state : { kind: "loading" };
  const draft = editing.scope === scope ? editing.draft : null;
  const status = mutation.scope === scope ? mutation.status : "idle";
  const refresh = () => setRevision(v => v + 1);
  const perform = async (action: "create" | "rename" | "disable" | "enable", value: Draft) => {
    if (!enabled || !api || pending.current || currentScope.current !== scope) return;
    const controller = new AbortController();
    pending.current = controller;
    const fingerprint = JSON.stringify([action, { ...value, displayName: value.displayName.trim() }]);
    if (retryKey.current?.scope !== scope || retryKey.current.fingerprint !== fingerprint) retryKey.current = { scope, fingerprint, key: crypto.randomUUID() };
    const key = retryKey.current.key;
    setMutation({ scope, status: "saving" });
    try {
      await api.mutate(action, value.id, value.providerKey, value.displayName.trim(), value.version, key, controller.signal);
      if (!controller.signal.aborted && currentScope.current === scope) {
        retryKey.current = null; setEditing({ scope, draft: null }); setMutation({ scope, status: "idle" }); refresh();
      }
    } catch (error: unknown) {
      if (!controller.signal.aborted && currentScope.current === scope) {
        const result = failure(error);
        setMutation({ scope, status: result });
        if (result === "conflict") { setEditing({ scope, draft: null }); retryKey.current = null; refresh(); }
        if (result === "denied" || result === "authentication") { setEditing({ scope, draft: null }); setSnapshot({ scope: filterScope, state: { kind: result } }); }
      }
    } finally { if (pending.current === controller) pending.current = null; }
  };
  return { state, status, draft, vi: locale === "vi", refresh,
    provider: selection.provider, filterStatus: selection.status,
    filter: (provider: string, status: string) => setFilters({ scope, provider, status, cursor: null }),
    more: () => { if (state.kind === "ready") setFilters({ ...selection, cursor: state.page.nextCursor }); },
    first: () => setFilters({ ...selection, cursor: null }),
    add: () => { setMutation({ scope, status: "idle" }); setEditing({ scope, draft: { id: null, providerKey: state.kind === "ready" ? state.providers[0]?.key ?? "" : "", displayName: "", version: 0 } }); },
    edit: (row: ChannelAccount) => { setMutation({ scope, status: "idle" }); setEditing({ scope, draft: { id: row.id, providerKey: row.providerKey ?? "", displayName: row.displayName ?? "", version: row.configurationVersion } }); },
    changeDraft: (value: Draft) => setEditing({ scope, draft: value }),
    cancel: () => setEditing({ scope, draft: null }),
    save: () => { if (draft) void perform(draft.id ? "rename" : "create", draft); },
    toggle: (row: ChannelAccount) => { void perform(row.status === "DISABLED" ? "enable" : "disable", { id: row.id, providerKey: row.providerKey ?? "", displayName: row.displayName ?? "", version: row.configurationVersion }); },
  };
}
