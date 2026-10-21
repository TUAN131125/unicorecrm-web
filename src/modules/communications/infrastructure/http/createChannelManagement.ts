import type { HttpClient } from "@/platform/api";
import { ApiClientError } from "@/platform/api/errors/ApiClientError";
import { CommunicationsApiClient } from "@/platform/api/generated/communicationsApi";
import type { ChannelAccount, ChannelManagement, ChannelPage, ChannelProvider, TelegramConnection } from "../../application/ChannelManagement";

const invalid = (): never => { throw new ApiClientError({ code: "CONTRACT_VIOLATION", message: "Invalid channel metadata response.", retryable: false }); };
function record(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some(key => !keys.includes(key)) || keys.some(key => !Object.hasOwn(row, key))) return invalid();
  return row;
}
function text(v: unknown): string { return typeof v === "string" && v.length > 0 ? v : invalid(); }
function providerKey(value: string): "gmail" | "telegram" | "zalo" | "messenger" {
  if (value === "gmail" || value === "telegram" || value === "zalo" || value === "messenger") return value;
  return invalid();
}
function accountStatus(value: string): "DRAFT" | "DISABLED" | "UNVERIFIED" {
  if (value === "DRAFT" || value === "DISABLED" || value === "UNVERIFIED") return value;
  return invalid();
}
function nullable(v: unknown): string | null { return v === null ? null : text(v); }
function number(v: unknown): number { return typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : invalid(); }
function timestamp(v: unknown): string | null { return v === null ? null : typeof v === "string" && Number.isFinite(Date.parse(v)) ? v : invalid(); }
function account(v: unknown): ChannelAccount {
  const r = record(v, ["id", "providerKey", "channelType", "displayName", "status", "configurationVersion", "createdAt", "updatedAt", "externalAccountKey", "lastVerifiedAt"]);
  if (r.status !== "DRAFT" && r.status !== "DISABLED" && r.status !== "UNVERIFIED" || r.externalAccountKey !== null || r.lastVerifiedAt !== null) return invalid();
  return { id: text(r.id), providerKey: nullable(r.providerKey), channelType: nullable(r.channelType), displayName: nullable(r.displayName),
    status: r.status, configurationVersion: number(r.configurationVersion), createdAt: timestamp(r.createdAt), updatedAt: timestamp(r.updatedAt),
    externalAccountKey: null, lastVerifiedAt: null };
}
function connection(v: unknown, id: string): TelegramConnection {
  const r = record(v, ["channelAccountId", "provider", "configurationVersion", "configurationState", "credentialPresent", "credentialGeneration", "verificationState", "botId", "lastVerifiedAt", "health", "lastError", "enabled", "securityReady", "liveAllowed", "providerAllowed", "active", "lastSuccessfulPollAt", "lastCommittedUpdateAt", "retryAfter", "connectionGeneration"]);
  if (r.channelAccountId !== id || r.provider !== "telegram" || typeof r.liveAllowed !== "boolean" || typeof r.providerAllowed !== "boolean" || typeof r.active !== "boolean" || typeof r.enabled !== "boolean" || typeof r.securityReady !== "boolean" || typeof r.credentialPresent !== "boolean"
    || r.configurationState !== "NOT_CONFIGURED" && r.configurationState !== "CONFIGURED" && r.configurationState !== "DISCONNECTED"
    || r.verificationState !== "UNVERIFIED" && r.verificationState !== "SYNTHETIC_VERIFIED" && r.verificationState !== "VERIFIED"
    || typeof r.health !== "string" || !["SECURITY_NOT_READY", "DISABLED", "NOT_CONFIGURED", "RECONNECT_REQUIRED", "AUTH_FAILED", "WEBHOOK_CONFLICT", "UNVERIFIED", "READY_TO_ACTIVATE", "DEGRADED", "HEALTHY", "STARTING"].includes(r.health)) return invalid();
  const health = r.health as TelegramConnection["health"];
  return { channelAccountId: id, provider: "telegram", configurationVersion: number(r.configurationVersion), configurationState: r.configurationState,
    credentialPresent: r.credentialPresent, credentialGeneration: number(r.credentialGeneration), verificationState: r.verificationState,
    botId: nullable(r.botId), lastVerifiedAt: timestamp(r.lastVerifiedAt), health, lastError: nullable(r.lastError),
    enabled: r.enabled, securityReady: r.securityReady, liveAllowed: r.liveAllowed, providerAllowed: r.providerAllowed, active: r.active,
    lastSuccessfulPollAt: timestamp(r.lastSuccessfulPollAt), lastCommittedUpdateAt: timestamp(r.lastCommittedUpdateAt),
    retryAfter: timestamp(r.retryAfter), connectionGeneration: number(r.connectionGeneration) };
}
export function createChannelManagementApi(http: HttpClient): ChannelManagement {
  const client = new CommunicationsApiClient(http);
  return {
    async connection(id, signal) {
      return connection(await client.getTelegramConnection<unknown>(id, {}, signal), id);
    },
    async lifecycle(action, id, version, key, signal) {
      const method = { verify: client.verifyTelegramConnection, activate: client.activateTelegramConnection,
        deactivate: client.deactivateTelegramConnection, reconnect: client.reconnectTelegramConnection }[action];
      return connection(await method.call(client, id, { expectedVersion: version }, { idempotencyKey: key, retry: "never", signal }), id);
    },
    async credential(action, id, token, version, key, signal) {
      const options = { idempotencyKey: key, retry: "never" as const, signal };
      const value = action === "put"
        ? await client.replaceTelegramCredential<unknown>(id, { botToken: token ?? "", expectedVersion: version }, options)
        : await client.removeTelegramCredential<unknown>(id, { expectedVersion: version }, options);
      return connection(value, id);
    },
    async providers(signal) {
      const value = await client.listCommunicationChannelProviders<unknown>({}, signal);
      if (!Array.isArray(value) || value.length > 100) return invalid();
      return value.map((v): ChannelProvider => {
        const r = record(v, ["key", "name", "channelType", "metadataDraft", "liveConnection", "inbound", "outbound"]);
        if (r.channelType !== "EMAIL" && r.channelType !== "MESSAGING" || r.metadataDraft !== "SUPPORTED"
          || r.liveConnection !== "NOT_IMPLEMENTED" || r.inbound !== "NOT_IMPLEMENTED" || r.outbound !== "NOT_IMPLEMENTED") return invalid();
        return { key: text(r.key), name: text(r.name), channelType: r.channelType, metadataDraft: "SUPPORTED", liveConnection: "NOT_IMPLEMENTED", inbound: "NOT_IMPLEMENTED", outbound: "NOT_IMPLEMENTED" };
      });
    },
    async list(provider, status, cursor, signal): Promise<ChannelPage> {
      const v = await client.listCommunicationChannelAccounts<unknown>({ limit: 25,
        ...(provider ? { provider: providerKey(provider) } : {}), ...(status ? { status: accountStatus(status) } : {}), ...(cursor ? { cursor } : {}) }, signal);
      const r = record(v, ["items", "nextCursor", "totalCount", "summary"]);
      if (!Array.isArray(r.items) || r.items.length > 100 || r.nextCursor !== null && (typeof r.nextCursor !== "string" || r.nextCursor.length > 4096)) return invalid();
      const s = record(r.summary, ["total", "drafts", "connected", "disabled", "unverified", "providerTypes"]);
      if (number(s.connected) !== 0) return invalid();
      return { items: r.items.map(account), nextCursor: nullable(r.nextCursor), totalCount: number(r.totalCount), summary: {
        total: number(s.total), drafts: number(s.drafts), connected: 0, disabled: number(s.disabled), unverified: number(s.unverified), providerTypes: number(s.providerTypes) } };
    },
    async mutate(action, id, providerKey, displayName, expectedVersion, key, signal) {
      if (action !== "create" && !id) return invalid();
      const options = { idempotencyKey: key, retry: "never" as const, signal };
      let v: unknown;
      if (action === "create") {
        if (providerKey !== "gmail" && providerKey !== "telegram" && providerKey !== "zalo" && providerKey !== "messenger") return invalid();
        v = await client.createCommunicationChannelAccount<unknown>({ providerKey, displayName }, options);
      }
      else if (action === "rename") v = await client.updateCommunicationChannelAccount<unknown>(id ?? "", { displayName, expectedVersion }, options);
      else {
        const method = { disable: client.disableCommunicationChannelAccount, enable: client.enableCommunicationChannelAccount,
          disconnect: client.disconnectCommunicationChannelAccount }[action];
        v = await method.call(client, id ?? "", { expectedVersion }, options);
      }
      const r = record(v, ["account", "auditId", "occurredAt", "correlationId", "replayed"]);
      if (typeof r.replayed !== "boolean") return invalid();
      const result = account(r.account);
      if (id !== null && result.id !== id) return invalid();
      return { account: result, auditId: text(r.auditId), occurredAt: timestamp(r.occurredAt) ?? invalid(), correlationId: text(r.correlationId), replayed: r.replayed };
    },
  };
}
