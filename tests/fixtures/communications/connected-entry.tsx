import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { FetchHttpClient } from "../../../src/platform/api/client/FetchHttpClient";
import { createCommunicationsQueries } from "../../../src/modules/communications/infrastructure/http/createCommunicationsQueries";
import { useInbox } from "../../../src/modules/communications/presentation/hooks/useInbox";
import { InboxView } from "../../../src/modules/communications/presentation/components/InboxView";
import { createCommunicationsCommands } from "../../../src/modules/communications/infrastructure/http/createCommunicationsCommands";
import { useConversationClaim } from "../../../src/modules/communications/presentation/hooks/useConversationClaim";
import { useConversationTransition } from "../../../src/modules/communications/presentation/hooks/useConversationTransition";
import { createCommunicationsLink } from "../../../src/modules/communications/infrastructure/http/createCommunicationsLink";
import { useConversationCrmLink } from "../../../src/modules/communications/presentation/hooks/useConversationCrmLink";
import { ConversationCrmLinkView } from "../../../src/modules/communications/presentation/components/ConversationCrmLinkView";

declare global { interface Window { COM_TEST: { url: string; id: string; tokens: Record<string, string> } } }
const config = window.COM_TEST;
function ConnectedFixture() {
  const [actor, setActor] = useState("a");
  const [workspace, setWorkspace] = useState("ws_com1_a");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [queue, setQueue] = useState(false);
  const [statusView, setStatusView] = useState<"active" | "closed">("active");
  const http = useMemo(() => new FetchHttpClient({
    baseUrl: config.url, accessTokenProvider: { getAccessToken: () => config.tokens[actor] },
    workspaceIdProvider: { getWorkspaceId: () => workspace }, getAuthorityKey: () => `${actor}:${workspace}`,
  }), [actor, workspace]);
  const queries = useMemo(() => createCommunicationsQueries(http, queue ? "unassigned" : "assigned", queue ? "active" : statusView), [http, queue, statusView]);
  const commands = useMemo(() => createCommunicationsCommands(http), [http]);
  const linkPort = useMemo(() => createCommunicationsLink(http), [http]);
  const scope = `${actor}/${workspace}/${queue}/${statusView}/${conversationId}`;
  const inbox = useInbox(queries, scope, conversationId, { enabled: actor !== "logout" });
  const claim = useConversationClaim(commands, `${actor}/${workspace}/${queue}`, actor !== "logout", inbox.refresh,
    id => { setQueue(false); setConversationId(id); });
  const lifecycle = useConversationTransition(commands, scope, actor !== "logout", inbox.refresh);
  const crm = useConversationCrmLink(linkPort, scope, conversationId, actor !== "logout" && !!conversationId && inbox.state.kind === "ready",
    true, inbox.refresh, inbox.state.kind === "ready" ? inbox.state.conversations[0]?.version : undefined);
  return <>
    <select aria-label="Actor" value={actor} onChange={event => setActor(event.target.value)}>
      {["a", "b", "admin", "manager", "triage", "logout"].map(value => <option key={value}>{value}</option>)}
    </select>
    <button onClick={() => setConversationId(config.id)}>Open detail</button>
    <button onClick={() => { setConversationId(undefined); setQueue(false); }}>List</button>
    <button onClick={() => { setConversationId(undefined); setQueue(true); }}>Queue</button>
    <button onClick={inbox.refresh}>Refresh</button>
    <button onClick={() => { setQueue(false); setConversationId(undefined); setStatusView("active"); }}>Active</button>
    <button onClick={() => { setQueue(false); setConversationId(undefined); setStatusView("closed"); }}>Closed</button>
    <button onClick={() => setWorkspace(workspace === "ws_com1_a" ? "ws_com1_b" : "ws_com1_a")}>Switch workspace</button>
    <InboxView state={inbox.state} locale="en" detail={conversationId !== undefined} queue={queue} onMore={inbox.more} onOpen={setConversationId}
      onClaim={id => { void claim.claim(id); }} claimStatus={claim.status}
      onTransition={(id, target, version) => { void lifecycle.transition(id, target, version); }} transitionStatus={lifecycle.status} />
    {conversationId && inbox.state.kind === "ready" && <ConversationCrmLinkView crm={crm} vi={false} />}
  </>;
}
const container = document.getElementById("root");
if (!container) throw new Error("Missing connected fixture root");
createRoot(container).render(<ConnectedFixture />);
