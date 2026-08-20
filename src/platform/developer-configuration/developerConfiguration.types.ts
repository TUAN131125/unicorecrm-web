export type WebhookDirection = "INBOUND" | "OUTBOUND";
export type WebhookStatus = "DRAFT" | "ACTIVE" | "PAUSED";

export interface WebhookDefinition {
  id: string;
  name: string;
  direction: WebhookDirection;
  eventKey: string;
  endpointUrl: string;
  status: WebhookStatus;
  createdAt: string;
  lastDeliveryAt: string | null;
  version: number;
}

export interface ApiKeyMetadata {
  id: string;
  name: string;
  scopes: string[];
  createdBy: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  version: number;
}

export interface DeveloperConfiguration {
  revision: number;
  webhooks: WebhookDefinition[];
  apiKeys: ApiKeyMetadata[];
}
