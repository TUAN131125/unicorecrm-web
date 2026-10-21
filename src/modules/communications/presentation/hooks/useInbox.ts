import { useEffect, useState } from "react";
import { normalizeApplicationError } from "@/shared/domain";
import type { CommunicationsQueries } from "../../application/CommunicationsQueries";
import type { InboxState } from "../components/InboxView";

interface Snapshot { scope: string; state: InboxState; cursor: string | null }

// Sensitive projections stay in memory and are retired on every authority/scope change.
// Caller scope must include Workspace, account, membership and authority revision.
export function useInbox(queries: CommunicationsQueries, authorityScope: string, conversationId?: string, options: { enabled?: boolean; pollMs?: number } = {}) {
  const enabled = options.enabled !== false;
  const scope = JSON.stringify([authorityScope, conversationId, enabled]);
  const [revision, setRevision] = useState(0);
  const [pageCursor, setPageCursor] = useState<{ scope: string; value: string | null }>({ scope, value: null });
  const cursor = pageCursor.scope === scope ? pageCursor.value : null;
  const [snapshot, setSnapshot] = useState<Snapshot>({ scope, state: { kind: "loading" }, cursor: null });
  useEffect(() => {
    if (!enabled) return;
    const refresh = () => setRevision(current => current + 1);
    const timer = options.pollMs ? setInterval(refresh, options.pollMs) : undefined;
    if (options.pollMs) window.addEventListener("focus", refresh);
    return () => { if (timer) clearInterval(timer); if (options.pollMs) window.removeEventListener("focus", refresh); };
  }, [scope, enabled, options.pollMs]);
  useEffect(() => {
    if (!enabled) { setSnapshot({ scope, state: { kind: "denied" }, cursor: null }); return; }
    setPageCursor(current => current.scope === scope ? current : { scope, value: null });
    const controller = new AbortController();
    setSnapshot({ scope, state: { kind: "loading" }, cursor: null });
    const load = async () => {
      try {
        const conversation = conversationId ? await queries.get(conversationId, controller.signal) : undefined;
        if (controller.signal.aborted) return;
        if (conversation === null) {
          if (!controller.signal.aborted) setSnapshot({ scope, state: { kind: "missing" }, cursor: null });
          return;
        }
        if (conversationId) {
          const page = await queries.messages(conversationId, cursor, controller.signal);
          if (controller.signal.aborted) return;
          setSnapshot({ scope, state: { kind: "ready", conversations: conversation ? [conversation] : [], messages: page.items, hasMore: page.nextCursor !== null }, cursor: page.nextCursor });
        } else {
          const page = await queries.list(cursor, controller.signal);
          if (controller.signal.aborted) return;
          setSnapshot({ scope, state: { kind: "ready", conversations: page.items, messages: [], hasMore: page.nextCursor !== null,
            canClaim: page.canClaim === true }, cursor: page.nextCursor });
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        const normalized = normalizeApplicationError(error);
        if (normalized.code === "COMMUNICATION_CURSOR_INVALID" && cursor !== null) {
          setPageCursor({ scope, value: null });
          return; // reauthorize the first page; never reuse a cursor from retired authority
        }
        const kind = normalized.code === "COMMUNICATIONS_UNAVAILABLE" ? "unavailable"
          : normalized.category === "AUTHORIZATION" || normalized.category === "AUTHENTICATION" ? "denied"
          : normalized.category === "NOT_FOUND" ? "missing" : "error";
        setSnapshot({ scope, state: { kind }, cursor: null });
      }
    };
    void load();
    return () => controller.abort();
  }, [queries, scope, conversationId, cursor, revision, enabled]);
  return {
    state: !enabled ? { kind: "denied" as const } : snapshot.scope === scope ? snapshot.state : { kind: "loading" as const },
    refresh: () => setRevision(current => current + 1),
    more: () => { if (snapshot.scope === scope && snapshot.cursor) setPageCursor({ scope, value: snapshot.cursor }); },
  };
}
