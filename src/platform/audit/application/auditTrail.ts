export type AuditEventCategory =
  | "DATA_CHANGE"
  | "AUTHORIZATION"
  | "CONFIGURATION"
  | "APPROVAL"
  | "AUTOMATION"
  | "INTEGRATION"
  | "SECURITY"
  | "BACKUP";

export type AuditEventOutcome = "SUCCEEDED" | "FAILED" | "DENIED" | "PENDING";
export type AuditActorType = "USER" | "SERVICE_ACCOUNT" | "AUTOMATION" | "PROVIDER" | "SYSTEM";
export type AuditTrailAuthoritySource = "backend" | "demo";

export type AuditJsonPrimitive = string | number | boolean | null;
export type AuditJsonValue = AuditJsonPrimitive | AuditJsonValue[] | { [key: string]: AuditJsonValue };

export interface AuditActor {
  id: string;
  displayName?: string;
  type: AuditActorType;
  ipAddress?: string;
}

export interface AuditEvidence {
  approvalId?: string;
  automationRunId?: string;
  integrationRequestId?: string;
  providerReference?: string;
  exportReference?: string;
}

export interface AuditTrailEntry {
  id: string;
  workspaceId: string;
  sequence?: number;
  resourceKey: string;
  recordId?: string;
  category: AuditEventCategory;
  outcome: AuditEventOutcome;
  action: string;
  summary?: string;
  reasonCode?: string;
  actor: AuditActor;
  occurredAt: string;
  source: string;
  requestId?: string;
  correlationId?: string;
  causationId?: string;
  changedFields: readonly string[];
  before?: AuditJsonValue;
  after?: AuditJsonValue;
  evidence?: AuditEvidence;
  authority: AuditTrailAuthoritySource;
}

export interface AuditTrailRequest {
  workspaceId: string;
  resourceKey?: string;
  recordId?: string;
  cursor?: string;
  limit?: number;
  categories?: readonly AuditEventCategory[];
  outcomes?: readonly AuditEventOutcome[];
  correlationId?: string;
  search?: string;
}

export interface AuditTrailPage {
  workspaceId: string;
  items: readonly AuditTrailEntry[];
  nextCursor?: string;
  authority: AuditTrailAuthoritySource;
}

export interface AuditTrailAuthority {
  readonly source: "backend";
  list(request: AuditTrailRequest, signal?: AbortSignal): Promise<AuditTrailPage>;
}
