export interface ChannelProvider {
  key: string; name: string; channelType: "EMAIL" | "MESSAGING";
  metadataDraft: "SUPPORTED"; liveConnection: "NOT_IMPLEMENTED";
  inbound: "NOT_IMPLEMENTED"; outbound: "NOT_IMPLEMENTED";
}
export interface ChannelAccount {
  id: string; providerKey: string | null; channelType: string | null; displayName: string | null;
  status: "DRAFT" | "DISABLED" | "UNVERIFIED"; configurationVersion: number;
  createdAt: string | null; updatedAt: string | null; externalAccountKey: null; lastVerifiedAt: null;
}
export interface ChannelPage {
  items: ChannelAccount[]; nextCursor: string | null; totalCount: number;
  summary: { total: number; drafts: number; connected: number; disabled: number; unverified: number; providerTypes: number };
}
export interface ChannelMutation { account: ChannelAccount; auditId: string; occurredAt: string; correlationId: string; replayed: boolean }
export interface TelegramConnection {
  channelAccountId: string; provider: "telegram"; configurationVersion: number; configurationState: "NOT_CONFIGURED" | "CONFIGURED" | "DISCONNECTED";
  credentialPresent: boolean; credentialGeneration: number; verificationState: "UNVERIFIED" | "SYNTHETIC_VERIFIED" | "VERIFIED";
  botId: string | null; lastVerifiedAt: string | null;
  health: "SECURITY_NOT_READY" | "DISABLED" | "NOT_CONFIGURED" | "RECONNECT_REQUIRED" | "AUTH_FAILED" | "WEBHOOK_CONFLICT" | "UNVERIFIED" | "READY_TO_ACTIVATE" | "DEGRADED" | "HEALTHY" | "STARTING";
  lastError: string | null; enabled: boolean; securityReady: boolean; liveAllowed: boolean; providerAllowed: boolean; active: boolean;
  lastSuccessfulPollAt: string | null; lastCommittedUpdateAt: string | null; retryAfter: string | null; connectionGeneration: number;
}
export type TelegramLifecycleAction = "verify" | "activate" | "deactivate" | "reconnect";
export interface ChannelManagement {
  connection(id: string, signal: AbortSignal): Promise<TelegramConnection>;
  lifecycle(action: TelegramLifecycleAction, id: string, version: number, key: string, signal: AbortSignal): Promise<TelegramConnection>;
  credential(action: "put" | "remove", id: string, token: string | null, version: number, key: string, signal: AbortSignal): Promise<TelegramConnection>;
  providers(signal: AbortSignal): Promise<ChannelProvider[]>;
  list(provider: string, status: string, cursor: string | null, signal: AbortSignal): Promise<ChannelPage>;
  mutate(action: "create" | "rename" | "disable" | "enable" | "disconnect", id: string | null, providerKey: string,
    displayName: string, expectedVersion: number, key: string, signal: AbortSignal): Promise<ChannelMutation>;
}
