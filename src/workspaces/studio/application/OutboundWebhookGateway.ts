import type { OutboundWebhookForm } from "./connectedOutboundWebhookBehavior";

export interface IntegrationEventCatalogItem {
  eventType: string;
  schemaVersion: number;
  name: string;
  description: string;
  sourceCategory: string;
}

export interface OutboundWebhookSubscription {
  subscriptionId: string;
  workspaceId: string;
  name: string;
  eventType: string;
  endpointUrl: string;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
  version: number;
  createdAt: string;
  updatedAt: string;
  archivedAt?: unknown;
}

export interface OutboundWebhookDelivery {
  deliveryId: string;
  subscriptionId: string;
  eventId: string;
  eventType: string;
  status: "PENDING" | "IN_FLIGHT" | "RETRY_SCHEDULED" | "SUCCEEDED" | "DEAD_LETTER";
  attemptCount: number;
  nextAttemptAt: string;
  lastHttpStatus?: unknown;
  lastErrorCode?: unknown;
  createdAt: string;
  succeededAt?: unknown;
  deadLetteredAt?: unknown;
  replayable: boolean;
}

export interface OutboundWebhookMutationResponse {
  subscription: OutboundWebhookSubscription;
  outcome: string;
  signingSecret?: string;
}
export interface OutboundWebhookCommandOptions {
  idempotencyKey: string;
  expectedVersion?: number;
  signal?: AbortSignal;
}
export interface OutboundWebhookGateway {
  getIntegrationEventCatalog(): Promise<IntegrationEventCatalogItem[]>;
  listOutboundWebhookSubscriptions(): Promise<OutboundWebhookSubscription[]>;
  listOutboundWebhookDeliveries(): Promise<OutboundWebhookDelivery[]>;
  createOutboundWebhookSubscription(body: OutboundWebhookForm, options: OutboundWebhookCommandOptions): Promise<OutboundWebhookMutationResponse>;
  updateOutboundWebhookSubscription(id: string, body: OutboundWebhookForm, options: OutboundWebhookCommandOptions & { expectedVersion: number }): Promise<OutboundWebhookMutationResponse>;
  activateOutboundWebhookSubscription(id: string, body: Record<string, never>, options: OutboundWebhookCommandOptions & { expectedVersion: number }): Promise<OutboundWebhookMutationResponse>;
  pauseOutboundWebhookSubscription(id: string, body: Record<string, never>, options: OutboundWebhookCommandOptions & { expectedVersion: number }): Promise<OutboundWebhookMutationResponse>;
  resumeOutboundWebhookSubscription(id: string, body: Record<string, never>, options: OutboundWebhookCommandOptions & { expectedVersion: number }): Promise<OutboundWebhookMutationResponse>;
  archiveOutboundWebhookSubscription(id: string, body: Record<string, never>, options: OutboundWebhookCommandOptions & { expectedVersion: number }): Promise<OutboundWebhookMutationResponse>;
  rotateOutboundWebhookSecret(id: string, body: Record<string, never>, options: OutboundWebhookCommandOptions & { expectedVersion: number }): Promise<OutboundWebhookMutationResponse>;
  replayOutboundWebhookDelivery(id: string, body: Record<string, never>, options: OutboundWebhookCommandOptions): Promise<OutboundWebhookDelivery>;
}
