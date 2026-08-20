export interface LeadWebhookPayload {
  name: string;
  email?: string;
  phone?: string;
  companyName?: string;
  source?: string;
  campaign?: string;
  summary?: string;
  sourceRecordId?: string;
  occurredAt?: string;
}

export interface WebhookAuthenticationEvidence {
  verified: boolean;
  keyId: string;
  signedAt: string;
}

export interface IngestLeadWebhookCommand {
  workspaceId: string;
  connectorId: string;
  authentication: WebhookAuthenticationEvidence;
  idempotencyKey: string;
  payload: LeadWebhookPayload;
  actorId?: string;
  now?: string;
}

export type LeadWebhookIngressResult = {
  disposition: "CREATED" | "APPENDED" | "IDEMPOTENT_REPLAY" | "RATE_LIMITED";
  leadId?: string;
  attempts: number;
  nextRetryAt?: string;
};

export interface LeadWebhookIngressPort {
  ingest(command: IngestLeadWebhookCommand): Promise<LeadWebhookIngressResult>;
}
