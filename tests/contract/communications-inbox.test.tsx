import assert from "node:assert/strict";
import React, { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { createRoot } from "react-dom/client";
import { InboxView, type InboxState } from "../../src/modules/communications/presentation/components/InboxView";
import { useInbox } from "../../src/modules/communications/presentation/hooks/useInbox";
import { pendingCommunicationsQueries } from "../../src/modules/communications/infrastructure/http/PendingCommunicationsQueries";
import type { CommunicationsQueries } from "../../src/modules/communications/application/CommunicationsQueries";
import type { CommunicationsPage, ConversationSummary } from "../../src/modules/communications/domain/models";
import { ApplicationError } from "../../src/shared/domain";
import { ROLE_TEMPLATES } from "../../src/platform/access-control/domain/roleTemplates";
import { useConversationClaim } from "../../src/modules/communications/presentation/hooks/useConversationClaim";
import type { CommunicationsCommands } from "../../src/modules/communications/application/CommunicationsCommands";
import type { MutationOutcome } from "../../src/shared/application";
import { useConversationTransition } from "../../src/modules/communications/presentation/hooks/useConversationTransition";
import { ConversationLifecycleView } from "../../src/modules/communications/presentation/components/ConversationLifecycleView";
import { conversationTargets } from "../../src/modules/communications/domain/conversationLifecycle";
import type { ConversationStatus } from "../../src/modules/communications/domain/models";
import { useConversationCrmLink } from "../../src/modules/communications/presentation/hooks/useConversationCrmLink";
import { ConversationCrmLinkView } from "../../src/modules/communications/presentation/components/ConversationCrmLinkView";
import type { CommunicationsLinkCommands, CommunicationsLinkQueries, ConversationCrmContext, CrmTarget } from "../../src/modules/communications/application/CommunicationsLink";

let checks = 0;
function check(condition: unknown, label: string) { assert.ok(condition, label); checks++; console.log(`PASS ${label}`); }
check(ROLE_TEMPLATES.every(role => !role.capabilities.some(capability => capability.startsWith("communications."))), "Communications is never automatically granted to Admin Sales Manager or other templates");
for (const kind of ["unavailable", "loading", "error", "denied", "missing"] as const) {
  const html = renderToStaticMarkup(<InboxView state={{ kind }} locale="en" />);
  check(!html.includes("No conversations yet.") && (html.includes("role=\"status\"") || html.includes("role=\"alert\"")), `${kind} is distinct from empty and accessible`);
}
const empty: InboxState = { kind: "ready", conversations: [], messages: [], hasMore: false };
check(renderToStaticMarkup(<InboxView state={empty} locale="en" />).includes("No conversations yet."), "authorized empty list state");
check(renderToStaticMarkup(<InboxView state={empty} locale="vi" detail />).includes("Chưa có tin nhắn."), "empty timeline localized");
const injected: InboxState = { kind: "ready", conversations: [], hasMore: false, messages: [{
  id: "m", conversationId: "1", sequence: 1, text: "<img src=x onerror=alert(1)>", occurredAt: "2026-10-15T00:00:00Z",
}] };
const safe = renderToStaticMarkup(<InboxView state={injected} locale="en" detail />);
check(safe.includes("&lt;img") && !safe.includes("<img"), "timeline escapes untrusted text instead of rendering HTML");
await assert.rejects(() => pendingCommunicationsQueries.list(null, new AbortController().signal), (error: unknown) => error instanceof ApplicationError && error.code === "COMMUNICATIONS_UNAVAILABLE");
check(true, "runtime gateway refuses reads without fake or network fallback");

const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost", pretendToBeVisual: true });
for (const [name, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true })) {
  Object.defineProperty(globalThis, name, { value, configurable: true });
}
const container = dom.window.document.getElementById("root");
assert.ok(container);
const root = createRoot(container);
const pending: Array<{ resolve: (page: CommunicationsPage<ConversationSummary>) => void; reject: (error: unknown) => void; signal: AbortSignal; cursor: string | null }> = [];
const queries: CommunicationsQueries = {
  list: (cursor, signal) => new Promise((resolve, reject) => pending.push({ resolve, reject, signal, cursor })),
  get: async () => null,
  messages: async () => ({ items: [], nextCursor: null }),
};
function Harness({ scope, gateway = queries, id }: { scope: string; gateway?: CommunicationsQueries; id?: string }) {
  const inbox = useInbox(gateway, scope, id);
  return <InboxView state={inbox.state} locale="en" detail={id !== undefined} onMore={inbox.more} />;
}
const summary = (id: string): ConversationSummary => ({ id, lastActivityAt: "2026-10-15T00:00:00Z", version: 1 });
await act(async () => root.render(<Harness scope="workspace-a/account-a/member-a/revision-1" />));
check(container.textContent?.includes("Loading"), "controller begins in loading");
await act(async () => pending[0]?.resolve({ items: [summary("synthetic-a")], nextCursor: "cursor-a" }));
check(container.textContent?.includes("synthetic-a"), "controller renders synthetic query response");
await act(async () => container.querySelector<HTMLButtonElement>("section > button")?.click());
check(pending[1]?.cursor === "cursor-a", "next page uses server cursor");
await act(async () => root.render(<Harness scope="workspace-b/account-b/member-b/revision-1" />));
check(pending[1]?.signal.aborted && !container.textContent?.includes("synthetic-a"), "workspace/account/member switch aborts and evicts prior content");
await act(async () => pending[1]?.resolve({ items: [summary("late-secret-a")], nextCursor: null }));
check(!container.textContent?.includes("late-secret-a"), "late previous-workspace response ignored");
await act(async () => pending[2]?.resolve({ items: [], nextCursor: null }));
check(container.textContent?.includes("No conversations yet."), "controller handles empty result");
await act(async () => root.render(<Harness scope="workspace-b/account-b/member-b/revision-2" />));
check(pending[2]?.signal.aborted && container.textContent?.includes("Loading"), "authority revision retires old request and projection");
await act(async () => pending[3]?.reject(new ApplicationError({ code: "ACCESS_DENIED", category: "AUTHORIZATION", message: "SECRET_SERVER_DIAGNOSTIC" })));
check(container.textContent?.includes("do not have access") && !container.textContent.includes("SECRET_SERVER_DIAGNOSTIC"), "authorization error shows safe denied state");
await act(async () => root.render(<Harness scope="workspace-b/account-b/member-b/revision-3" />));
await act(async () => pending[4]?.reject(new Error("SECRET_NETWORK_DIAGNOSTIC")));
check(container.textContent?.includes("could not be loaded") && !container.textContent.includes("SECRET_NETWORK_DIAGNOSTIC"), "network error hides sensitive diagnostics");
await act(async () => root.render(<Harness scope="workspace-b/account-b/member-b/revision-4" id="missing" />));
check(container.textContent?.includes("not found within your access scope"), "detail missing state");
const detailQueries: CommunicationsQueries = {
  ...queries,
  get: async id => summary(id),
  messages: async id => ({ items: [{ id: "m", conversationId: id, sequence: 1, text: "Synthetic timeline", occurredAt: "2026-10-15T00:00:00Z" }], nextCursor: null }),
};
await act(async () => root.render(<Harness scope="fixture-scope" gateway={detailQueries} id="1" />));
check(container.textContent?.includes("Synthetic timeline"), "detail controller loads timeline through query port");
await act(async () => root.render(<Harness scope="fixture-scope" gateway={pendingCommunicationsQueries} />));
check(container.textContent?.includes("currently unavailable") && !container.textContent.includes("Synthetic timeline"), "unconfigured runtime refuses and removes fixture content");
await act(async () => root.render(<Harness scope="return-a" />));
await act(async () => pending[5]?.resolve({ items: [summary("return-a-first")], nextCursor: "old-a-cursor" }));
await act(async () => container.querySelector<HTMLButtonElement>("section > button")?.click());
check(pending[6]?.cursor === "old-a-cursor", "return scenario starts on next page");
await act(async () => root.render(<Harness scope="return-b" />));
await act(async () => root.render(<Harness scope="return-a" />));
check(pending[8]?.cursor === null && pending[7]?.signal.aborted, "A to B to A restarts first page without resurrecting prior cursor");
await act(async () => pending[6]?.resolve({ items: [summary("retired-a-response")], nextCursor: null }));
check(!container.textContent?.includes("retired-a-response"), "returning to A still ignores its retired request");
await act(async () => pending[8]?.resolve({ items: [], nextCursor: null }));
const cursorRequests: Array<string | null> = [];
const retiredCursorQueries: CommunicationsQueries = {
  ...queries,
  list: async cursor => {
    cursorRequests.push(cursor);
    if (cursor !== null) throw new ApplicationError({ code: "COMMUNICATION_CURSOR_INVALID", status: 400, message: "retired" });
    return { items: [summary("current-authorized-first-page")], nextCursor: "retired-cursor" };
  },
};
await act(async () => root.render(<Harness scope="cursor-recovery" gateway={retiredCursorQueries} />));
await act(async () => container.querySelector<HTMLButtonElement>("section > button")?.click());
check(JSON.stringify(cursorRequests) === JSON.stringify([null, "retired-cursor", null]) && container.textContent?.includes("current-authorized-first-page"),
  "retired cursor resets to a newly authorized first page without persistent retry loop");
const queueState: InboxState = { ...empty, canClaim: true, conversations: [summary("claimable")] };
check(renderToStaticMarkup(<InboxView state={queueState} queue locale="en" onClaim={() => {}} />).includes(">Claim</button>"), "Claim visible only with server authority and command binding");
check(!renderToStaticMarkup(<InboxView state={{ ...queueState, canClaim: false }} queue locale="en" onClaim={() => {}} />).includes(">Claim</button>"), "server-denied Claim has no button");
for (const status of ["pending", "success", "conflict", "denied", "missing", "error"] as const) {
  const html = renderToStaticMarkup(<InboxView state={queueState} queue locale="en" claimStatus={status} onClaim={() => {}} />);
  check(html.includes('role="status"') && (status !== "pending" || html.includes("disabled")), `Claim ${status} has explicit safe feedback`);
}
const claims: Array<{ resolve: (outcome: MutationOutcome<{ conversationId: string }>) => void; reject: (error: unknown) => void; signal: AbortSignal }> = [];
const commands: CommunicationsCommands = { transition: async () => { throw new Error("Unexpected transition"); }, claim: (_id, signal) => new Promise((resolve, reject) => claims.push({ resolve, reject, signal })) };
let refreshes = 0;
const opened: string[] = [];
function ClaimHarness({ scope }: { scope: string }) {
  const command = useConversationClaim(commands, scope, true, () => refreshes++, id => opened.push(id));
  return <InboxView state={queueState} queue locale="en" onClaim={id => { void command.claim(id); }} claimStatus={command.status} />;
}
await act(async () => root.render(<ClaimHarness scope="claim-a" />));
await act(async () => container.querySelectorAll<HTMLButtonElement>("button")[1]?.click());
check(container.textContent?.includes("Claiming"), "Claim pending disables repeat submission");
await act(async () => root.render(<ClaimHarness scope="claim-b" />));
check(claims[0]?.signal.aborted, "Workspace switch aborts Claim request");
const outcome: MutationOutcome<{ conversationId: string }> = { data: { conversationId: "claimed" }, commandId: "audit", commandType: "communications.claim",
  aggregateType: "conversation", aggregateId: "claimed", idempotencyKey: "key", correlationId: "correlation", occurredAt: "2026-10-15T00:00:00Z",
  emittedEvents: [], audit: { authority: "backend", evidenceIds: ["audit"] } };
await act(async () => claims[0]?.resolve(outcome));
check(refreshes === 0 && opened.length === 0, "late Claim response cannot refresh or navigate another Workspace");
await act(async () => container.querySelectorAll<HTMLButtonElement>("button")[1]?.click());
await act(async () => claims[1]?.reject(new ApplicationError({ code: "COMMUNICATION_CLAIM_CONFLICT", status: 409, message: "PRIVATE_DIAGNOSTIC" })));
check(container.textContent?.includes("Queue refreshed") && refreshes === 1 && opened.length === 0 && !container.textContent.includes("PRIVATE_DIAGNOSTIC"), "conflict refreshes queue without granting ownership or leaking error");
await act(async () => container.querySelectorAll<HTMLButtonElement>("button")[1]?.click());
await act(async () => claims[2]?.resolve(outcome));
check(refreshes === 2 && opened[0] === "claimed", "authoritative Claim success refreshes queue then opens authorized detail");
for (const status of ["NEW", "OPEN", "PENDING", "CLOSED"] as const) {
  const conversation = { ...summary("1"), status, canTransition: true };
  const html = renderToStaticMarkup(<ConversationLifecycleView conversation={conversation} locale="en" onTransition={() => {}} />);
  check(html.includes(`data-conversation-status="${status}"`) && (html.match(/<button/g)?.length ?? 0) === conversationTargets(status).length,
    `${status} badge exposes exactly supported lifecycle intents`);
  check(!renderToStaticMarkup(<ConversationLifecycleView conversation={{ ...conversation, canTransition: false }} locale="en" onTransition={() => {}} />).includes("<button"), "backend-denied lifecycle has no action");
}
for (const status of ["pending", "success", "unchanged", "conflict", "denied", "missing", "error"] as const) {
  const html = renderToStaticMarkup(<ConversationLifecycleView conversation={{ ...summary("1"), status: "NEW", canTransition: true }} locale="en" status={status} onTransition={() => {}} />);
  check(html.includes('role="status"') && (status !== "pending" || html.includes("disabled")), `transition ${status} feedback is explicit`);
}
const transitions: Array<{ resolve: (value: MutationOutcome<{ id: string; status: ConversationStatus; changed: boolean }>) => void; reject: (error: unknown) => void; signal: AbortSignal; version: number }> = [];
const lifecycleCommands: CommunicationsCommands = { claim: commands.claim,
  transition: (_id, _target, version, signal) => new Promise((resolve, reject) => transitions.push({ resolve, reject, signal, version })) };
let lifecycleRefreshes = 0;
function TransitionHarness({ scope }: { scope: string }) {
  const operation = useConversationTransition(lifecycleCommands, scope, true, () => lifecycleRefreshes++);
  return <ConversationLifecycleView conversation={{ ...summary("1"), version: 5, status: "NEW", canTransition: true }} locale="en"
    status={operation.status} onTransition={(id, target, version) => { void operation.transition(id, target, version); }} />;
}
await act(async () => root.render(<TransitionHarness scope="transition-a" />));
await act(async () => container.querySelector<HTMLButtonElement>("button")?.click());
check(transitions[0]?.version === 5 && container.textContent?.includes("Updating status"), "transition carries authoritative expected version and disables pending actions");
await act(async () => root.render(<TransitionHarness scope="transition-b" />));
check(transitions[0]?.signal.aborted, "transition authority/Workspace change aborts request");
const transitionOutcome: MutationOutcome<{ id: string; status: ConversationStatus; changed: boolean }> = { ...outcome, data: { id: "1", status: "OPEN", changed: true } };
await act(async () => transitions[0]?.resolve(transitionOutcome));
check(lifecycleRefreshes === 0 && !container.textContent?.includes("Status updated"), "late transition cannot publish success to another Workspace");
await act(async () => container.querySelector<HTMLButtonElement>("button")?.click());
await act(async () => transitions[1]?.reject(new ApplicationError({ code: "COMMUNICATION_VERSION_CONFLICT", status: 409, message: "PRIVATE_LIFECYCLE_DIAGNOSTIC" })));
check(lifecycleRefreshes === 1 && container.textContent?.includes("Data refreshed") && !container.textContent.includes("PRIVATE_LIFECYCLE_DIAGNOSTIC"), "transition conflict refreshes without optimistic success or diagnostics");
await act(async () => container.querySelector<HTMLButtonElement>("button")?.click());
await act(async () => transitions[2]?.resolve({ ...transitionOutcome, data: { id: "1", status: "NEW", changed: false }, audit: { authority: "backend", evidenceIds: [] } }));
check(lifecycleRefreshes === 2 && container.textContent?.includes("no new change recorded"), "no-op feedback does not assert a new change or audit");
const contexts: Array<{ resolve: (value: ConversationCrmContext) => void; reject: (error: unknown) => void; signal: AbortSignal }> = [];
const searches: Array<{ resolve: (value: CrmTarget[]) => void; signal: AbortSignal }> = [];
const changes: Array<{ resolve: (value: MutationOutcome<{ changed: boolean }>) => void; reject: (error: unknown) => void; version: number; signal: AbortSignal }> = [];
const linkPort: { queries: CommunicationsLinkQueries; commands: CommunicationsLinkCommands } = {
  queries: { context: (_id, signal) => new Promise((resolve, reject) => contexts.push({ resolve, reject, signal })),
    search: (_id, _type, _search, signal) => new Promise(resolve => searches.push({ resolve, signal })) },
  commands: { change: (_id, _target, version, signal) => new Promise((resolve, reject) => changes.push({ resolve, reject, version, signal })) },
};
let crmRefreshes = 0;
let crmOperation: ReturnType<typeof useConversationCrmLink> | undefined;
function CrmHarness({ scope }: { scope: string }) {
  const operation = useConversationCrmLink(linkPort, scope, "1", true, true, () => crmRefreshes++, 9);
  crmOperation = operation;
  return <ConversationCrmLinkView crm={operation} vi={false} />;
}
const candidate: CrmTarget = { targetType: "CONTACT", targetId: "contact_safe", label: "<img src=x>", eligible: true };
await act(async () => root.render(<CrmHarness scope="crm-a" />));
check(container.textContent?.includes("Loading CRM"), "CRM loading is distinct from no link");
await act(async () => root.render(<CrmHarness scope="crm-b" />));
check(contexts[0]?.signal.aborted, "CRM Workspace switch aborts old context");
await act(async () => contexts[0]?.resolve({ state: "AVAILABLE", version: 9, canLink: true, target: candidate }));
check(!container.textContent?.includes("contact_safe"), "late CRM identity from retired authority cannot render");
await act(async () => contexts[1]?.resolve({ state: "NONE", version: 9, canLink: true }));
check(container.textContent?.includes("No CRM link"), "authoritative empty CRM context rendered");
await act(async () => { void crmOperation?.search("CONTACT", "Synthetic"); });
await act(async () => searches[0]?.resolve([candidate]));
await act(async () => crmOperation?.select(candidate));
check(container.textContent?.includes("No CRM link") && !container.querySelector("img"), "selection remains an uncommitted escaped suggestion");
await act(async () => { void crmOperation?.confirm(); });
check(changes[0]?.version === 9 && container.textContent?.includes("Saving CRM link") && container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled, "CRM command carries expected version and disables pending actions");
await act(async () => root.render(<CrmHarness scope="crm-c" />));
check(changes[0]?.signal.aborted, "CRM mutation retires on authority change");
await act(async () => changes[0]?.resolve({ ...outcome, data: { changed: true } }));
check(crmRefreshes === 0, "late CRM mutation cannot refresh another Workspace");
await act(async () => contexts[2]?.resolve({ state: "UNAVAILABLE", version: 9, canLink: true }));
check(!container.textContent?.includes("contact_safe") && container.textContent?.includes("CRM context withheld"), "withheld CRM context has no identity and still offers authorized unlink");
await act(async () => crmOperation?.select(null));
await act(async () => { void crmOperation?.confirm(); });
await act(async () => changes[1]?.reject(new ApplicationError({ code: "COMMUNICATION_VERSION_CONFLICT", status: 409, message: "PRIVATE_CRM_DIAGNOSTIC" })));
check(container.textContent?.includes("Conversation changed") && !container.textContent.includes("PRIVATE_CRM_DIAGNOSTIC"), "CRM conflict clears protected projections and uses safe feedback");
await act(async () => crmOperation?.reload());
await act(async () => contexts[3]?.reject(new ApplicationError({ code: "ACCESS_DENIED", status: 403, message: "PRIVATE_CRM_DIAGNOSTIC" })));
check(container.textContent?.includes("CRM access denied") && !container.textContent.includes("contact_safe"), "CRM denial removes old identity");
await act(async () => crmOperation?.reload());
await act(async () => contexts[4]?.reject(new ApplicationError({ code: "NETWORK_ERROR", message: "PRIVATE_CRM_DIAGNOSTIC" })));
check(container.textContent?.includes("Unable to load CRM") && !container.textContent.includes("PRIVATE_CRM_DIAGNOSTIC"), "CRM network error is sanitized");
await act(async () => root.unmount());
dom.window.close();
console.log(`ASSERTIONS ${checks}`);
