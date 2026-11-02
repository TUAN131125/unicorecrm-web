import { useEffect, useRef, useState } from "react";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";
import { getAuthSessionSnapshot, useAuthSessionSnapshot } from "@/platform/identity-auth";
import { getActiveWorkspaceId, isConnectedWorkspaceRuntime, useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { getConnectedOutboundWebhookApi, type OutboundWebhookSubscription, type OutboundWebhookDelivery } from "../../application/composition/outboundWebhookApplicationServices";

export type ConnectionRead<T> = { status: "loading" | "unavailable" | "denied" | "error" } | { status: "ready"; data: T; readAt: string };

/** Each query settles independently. Retired workspace/session observations cannot publish. */
export function useConnectionsOverview() {
  const workspace = useWorkspaceContextSnapshot();
  const session = useAuthSessionSnapshot();
  const canRead = useEffectiveAccess().can(CAPABILITIES.STUDIO_READ);
  const connected = isConnectedWorkspaceRuntime();
  const scope = JSON.stringify([workspace.workspaceId, workspace.memberId, session?.sessionId, session?.status, canRead, connected]);
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const [refresh, setRefresh] = useState(0);
  const initial: ConnectionRead<never> = !canRead || session?.status !== "ACTIVE" ? { status: "denied" } : !connected ? { status: "unavailable" } : { status: "loading" };
  const [subscriptions, setSubscriptions] = useState<{ scope: string; value: ConnectionRead<OutboundWebhookSubscription[]> }>({ scope, value: initial });
  const [deliveries, setDeliveries] = useState<{ scope: string; value: ConnectionRead<OutboundWebhookDelivery[]> }>({ scope, value: initial });

  useEffect(() => {
    let retired = false;
    const active = () => !retired && currentScope.current === scope && getAuthSessionSnapshot()?.sessionId === session?.sessionId && getAuthSessionSnapshot()?.status === "ACTIVE" && getActiveWorkspaceId() === workspace.workspaceId;
    setSubscriptions({ scope, value: initial });
    setDeliveries({ scope, value: initial });
    if (initial.status !== "loading") return;
    void (async () => {
      try {
        const api = getConnectedOutboundWebhookApi();
        // These gateway queries are read-only and do not expose signing secrets.
        void api.listOutboundWebhookSubscriptions().then(data => {
          if (active()) setSubscriptions({ scope, value: { status: "ready", data, readAt: new Date().toISOString() } });
        }, () => { if (active()) setSubscriptions({ scope, value: { status: "error" } }); });
        void api.listOutboundWebhookDeliveries().then(data => {
          if (active()) setDeliveries({ scope, value: { status: "ready", data, readAt: new Date().toISOString() } });
        }, () => { if (active()) setDeliveries({ scope, value: { status: "error" } }); });
      } catch {
        if (active()) {
          setSubscriptions({ scope, value: { status: "error" } });
          setDeliveries({ scope, value: { status: "error" } });
        }
      }
    })();
    return () => { retired = true; };
  }, [scope, refresh]);

  return {
    subscriptions: subscriptions.scope === scope ? subscriptions.value : initial,
    deliveries: deliveries.scope === scope ? deliveries.value : initial,
    reload: () => setRefresh(value => value + 1),
    canRefresh: canRead && connected && session?.status === "ACTIVE",
  };
}
