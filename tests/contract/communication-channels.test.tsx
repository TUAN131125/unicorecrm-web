import assert from "node:assert/strict";
import "./communications-api-admission.test.mts";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { HttpClient, HttpRequest } from "../../src/platform/api/client/HttpClient";
import { createChannelManagementApi } from "../../src/modules/communications/infrastructure/http/createChannelManagement";
import { ChannelSettingsView } from "../../src/modules/communications/presentation/components/ChannelSettingsView";
import { TelegramCredentialForm, TelegramConnectionView } from "../../src/modules/communications/presentation/components/TelegramConnectionPanel";
import type { ChannelAccount, ChannelPage, ChannelProvider, TelegramConnection } from "../../src/modules/communications/application/ChannelManagement";
import type { useTelegramConnection } from "../../src/modules/communications/presentation/hooks/useTelegramConnection";
import type { useChannelSettings } from "../../src/modules/communications/presentation/hooks/useChannelSettings";
let count = 0;
const check = (value: unknown, label: string) => { assert.ok(value, label); console.log(`PASS ${++count} ${label}`); };
const provider: ChannelProvider = { key: "gmail", name: "Gmail", channelType: "EMAIL", metadataDraft: "SUPPORTED", liveConnection: "NOT_IMPLEMENTED", inbound: "NOT_IMPLEMENTED", outbound: "NOT_IMPLEMENTED" };
const account = (id: string, displayName: string): ChannelAccount => ({ id, displayName, providerKey: "gmail", channelType: "EMAIL", status: "DRAFT", configurationVersion: 1, createdAt: "2026-10-16T00:00:00Z", updatedAt: "2026-10-16T00:00:00Z", externalAccountKey: null, lastVerifiedAt: null });
const page: ChannelPage = { items: [account("one", "Gmail CSKH"), account("two", "Gmail Sales")], nextCursor: null, totalCount: 2, summary: { total: 2, drafts: 2, connected: 0, disabled: 0, unverified: 0, providerTypes: 1 } };
const noop = () => {};
const props: ReturnType<typeof useChannelSettings> = { state: { kind: "ready", providers: [provider], page }, status: "idle", draft: null, vi: false, provider: "", filterStatus: "", refresh: noop, filter: noop, more: noop, first: noop, add: noop, edit: noop, changeDraft: noop, cancel: noop, save: noop, toggle: noop };
const render = (p: ReturnType<typeof useChannelSettings>) => renderToStaticMarkup(<ChannelSettingsView {...p} />);
const html = render(props);
check(html.includes("Gmail CSKH") && html.includes("Gmail Sales") && html.includes("ID: one") && html.includes("ID: two"), "multiple accounts per provider retain distinct identities");
check(html.includes("Draft") && html.includes("Not implemented") && html.includes("Last verified: None"), "drafts display honest readiness");
check(!html.includes('type="password"') && !html.includes("credentialReference"), "no credentials inputs or browser credential contract");
for (const kind of ["loading", "denied", "unavailable", "error", "authentication"] as const) {
  const state = render({ ...props, state: { kind } });
  check(!state.includes("Gmail CSKH") && !state.includes("Gmail Sales"), `${kind} state contains no prior account metadata`);
}
check(render({ ...props, state: { kind: "ready", providers: [provider], page: { ...page, items: [] } } }).includes("No matching accounts"), "empty state permits another same-provider account");
check(render({ ...props, status: "conflict" }).includes("Configuration changed"), "conflict requires review after reload");
const attack = render({ ...props, state: { kind: "ready", providers: [provider], page: { ...page, items: [account("id", '<img src=x onerror="bad()">')] } } });
check(attack.includes("&lt;img") && !attack.includes("<img"), "account metadata is escaped text");
let response: unknown = [provider]; const requests: HttpRequest[] = [];
const http: HttpClient = { async request<T>(input: HttpRequest): Promise<T> { requests.push(input); return response as T; } };
const api = createChannelManagementApi(http); const signal = new AbortController().signal;
check((await api.providers(signal)).length === 1, "backend catalog drives provider options");
response = page;
check((await api.list("gmail", "DRAFT", "opaque", signal)).items.length === 2 && requests.at(-1)?.query?.cursor === "opaque", "server pagination and filter query forwarded");
response = { account: account("one", "Renamed"), auditId: "audit", occurredAt: "2026-10-16T00:00:00Z", correlationId: "correlation", replayed: false };
await api.mutate("rename", "one", "gmail", "Renamed", 1, "stable-key", signal);
check(requests.at(-1)?.path === "/communications/channel-accounts/one" && requests.at(-1)?.method === "PATCH"
  && requests.at(-1)?.idempotencyKey === "stable-key" && requests.at(-1)?.retry === "never", "rename targets account ID with explicit idempotency and no blind retry");
await api.mutate("disable", "one", "gmail", "Renamed", 1, "disable-key", signal);
check(requests.at(-1)?.path.endsWith("/one/disable"), "disable does not target provider singleton");
response = { ...page, items: [{ ...account("one", "Fake"), status: "CONNECTED" }] };
await assert.rejects(() => api.list("", "", null, signal)); check(true, "fake connected wire response rejected");
response = { ...page, summary: { ...page.summary, connected: 1 } };
await assert.rejects(() => api.list("", "", null, signal)); check(true, "fake active summary rejected");
response = [{ ...provider, liveConnection: "SUPPORTED" }];
await assert.rejects(() => api.providers(signal)); check(true, "unimplemented runtime cannot masquerade as live adapter");
response = { ...page, token: "must-not-return" };
await assert.rejects(() => api.list("", "", null, signal)); check(true, "unexpected sensitive wire field rejected");
const connection: TelegramConnection = { channelAccountId: "one", provider: "telegram", configurationVersion: 2, configurationState: "CONFIGURED", credentialPresent: true,
  credentialGeneration: 1, verificationState: "UNVERIFIED", botId: null, lastVerifiedAt: null, health: "UNVERIFIED", lastError: null, enabled: true, securityReady: true, liveAllowed: false,
  providerAllowed: false, active: false, lastSuccessfulPollAt: null, lastCommittedUpdateAt: null, retryAfter: null, connectionGeneration: 1 };
response = connection;
check((await api.connection("one", signal)).credentialPresent, "connection API returns credential presence without secret");
await api.credential("put", "one", "fixture-contract", 1, "credential-key", signal);
check(requests.at(-1)?.method === "PUT" && requests.at(-1)?.path === "/communications/channel-accounts/one/credentials"
  && requests.at(-1)?.query === undefined && requests.at(-1)?.retry === "never" && requests.at(-1)?.idempotencyKey === "credential-key", "credential travels only in scoped body with version/idempotency and no automatic retry");
await api.credential("remove", "one", null, 2, "remove-key", signal);
check(requests.at(-1)?.method === "DELETE" && !JSON.stringify(requests.at(-1)?.body).includes("botToken"), "local removal carries no credential");
response = { ...connection, botToken: "unexpected" }; await assert.rejects(() => api.connection("one", signal)); check(true, "secret-bearing connection response rejected");
response = { ...connection, liveAllowed: true, providerAllowed: true }; check((await api.connection("one", signal)).liveAllowed, "live admission comes from the backend rather than a frontend constant");
response = { ...connection, channelAccountId: "two" }; await assert.rejects(() => api.connection("one", signal)); check(true, "connection response account binding enforced");
const tokenForm = renderToStaticMarkup(<TelegramCredentialForm save={noop} vi={false} blocked={false} />);
check(tokenForm.includes('type="password"') && tokenForm.includes('value=""') && /autocomplete="new-password"/i.test(tokenForm), "credential form starts blank and masked with no stored-token reveal");
check(renderToStaticMarkup(<TelegramCredentialForm save={noop} vi={false} blocked />).includes("disabled"), "security-not-ready form is blocked");
for (const action of ["verify", "activate", "deactivate", "reconnect"] as const) {
  response = { ...connection, providerAllowed: true };
  await api.lifecycle(action, "one", 2, `${action}-key`, signal);
  const request = requests.at(-1);
  check(request?.path === `/communications/channel-accounts/one/${action}` && request.method === "POST"
    && JSON.stringify(request.body) === '{"expectedVersion":2}' && request.idempotencyKey === `${action}-key` && request.retry === "never", `${action} uses account identity, expected version, idempotency and no implicit retry`);
}
for (const field of ["providerAllowed", "active", "liveAllowed"] as const) {
  response = { ...connection, [field]: "true" }; await assert.rejects(() => api.connection("one", signal));
  check(true, `${field} rejects nonboolean authority`);
}
for (const bad of [{ health: ["HEALTHY"] }, { health: "CONNECTED" }, { verificationState: "CONNECTED" }, { lastSuccessfulPollAt: "not-a-date" }, { connectionGeneration: -1 }]) {
  response = { ...connection, ...bad }; await assert.rejects(() => api.connection("one", signal)); check(true, "invalid lifecycle projection fails closed");
}
const controller = (value: TelegramConnection, status = "ready"): ReturnType<typeof useTelegramConnection> => ({
  scope: "scope", value, status, formKey: "scope", retry: noop, save: noop, remove: noop, lifecycle: noop, disconnect: noop,
});
const view = (value: TelegramConnection, status = "ready") => renderToStaticMarkup(<TelegramConnectionView c={controller(value, status)} vi={false} />);
function buttonDisabled(markup: string, label: string) { return new RegExp(`<button[^>]*disabled[^>]*>${label}</button>`).test(markup); }
const blocked = view(connection);
check(blocked.includes("Live verification not admitted") && /type="password"[^>]*disabled/.test(blocked) && buttonDisabled(blocked, "Verify Bot") && buttonDisabled(blocked, "Activate Inbound"), "normal unadmitted provider blocks real token entry and lifecycle calls");
const unverified = view({ ...connection, providerAllowed: true });
check(!buttonDisabled(unverified, "Verify Bot") && buttonDisabled(unverified, "Activate Inbound"), "admitted unverified account requires verification before activation");
const ready = view({ ...connection, providerAllowed: true, verificationState: "SYNTHETIC_VERIFIED", botId: "12345", health: "READY_TO_ACTIVATE", lastVerifiedAt: "2026-10-17T00:00:00Z" });
check(ready.includes("Synthetic verified bot") && !buttonDisabled(ready, "Activate Inbound") && ready.includes("Only the synthetic environment is admitted"), "synthetic identity and explicit activation readiness stay distinct from live admission");
const active = view({ ...connection, providerAllowed: true, active: true, verificationState: "SYNTHETIC_VERIFIED", health: "STARTING" });
check(buttonDisabled(active, "Activate Inbound") && !buttonDisabled(active, "Deactivate Inbound") && active.includes("STARTING") && !active.includes("HEALTHY"), "activation does not infer healthy polling");
const healthy = view({ ...connection, providerAllowed: true, active: true, verificationState: "SYNTHETIC_VERIFIED", health: "HEALTHY", lastSuccessfulPollAt: "2026-10-17T01:00:00Z", lastCommittedUpdateAt: "2026-10-17T01:00:01Z", retryAfter: "2026-10-17T01:01:00Z" });
check(healthy.includes("Last successful poll") && healthy.includes("2026-10-17T01:00:01Z") && healthy.includes("Retry after"), "health renders server poll and committed-update evidence");
check(buttonDisabled(view({ ...connection, providerAllowed: true, enabled: false, health: "DISABLED" }), "Verify Bot"), "disabled account cannot verify");
check(buttonDisabled(view({ ...connection, providerAllowed: true, configurationState: "DISCONNECTED", health: "RECONNECT_REQUIRED" }), "Verify Bot"), "disconnected account uses reconnect rather than ineligible direct verification");
check(buttonDisabled(view({ ...connection, providerAllowed: true, health: "READY_TO_ACTIVATE", verificationState: "SYNTHETIC_VERIFIED" }, "saving"), "Activate Inbound"), "pending action prevents duplicate activation");
response = { account: account("one", "Retained"), auditId: "audit", occurredAt: "2026-10-17T00:00:00Z", correlationId: "correlation", replayed: false };
await api.mutate("disconnect", "one", "telegram", "", 2, "disconnect-key", signal);
check(requests.at(-1)?.path === "/communications/channel-accounts/one/disconnect" && JSON.stringify(requests.at(-1)?.body) === '{"expectedVersion":2}', "disconnect reuses account management command rather than credential deletion");
console.log(`ASSERTIONS ${count}`);
