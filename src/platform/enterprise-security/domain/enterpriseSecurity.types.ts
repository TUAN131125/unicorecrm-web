export type SessionAssuranceLevel = "AAL1" | "AAL2";

export interface EnterpriseSessionPolicy {
  idleTimeoutMinutes: number;
  absoluteTimeoutHours: number;
  mfaChallengeMinutes: number;
  maxMfaAttempts: number;
  requireMfaForAdministrativeAccounts: boolean;
}

export interface TamperEvidentAuditRecord {
  eventId: string;
  scopeId: string;
  sequence: number;
  category: "IDENTITY" | "AUTHORIZATION" | "CONFIGURATION" | "DATA_CHANGE" | "BACKUP" | "INTEGRATION";
  action: string;
  actorId: string;
  subjectId?: string;
  occurredAt: string;
  metadata?: Record<string, unknown>;
  previousHash: string;
  payloadHash: string;
  recordHash: string;
}

export interface AuditLedgerVerification {
  valid: boolean;
  records: number;
  headHash: string;
  firstInvalidSequence?: number;
  reason?: string;
}

export interface WorkspaceBackupEntry {
  key: string;
  value: string;
  checksum: string;
}

export interface WorkspaceBackupArchive {
  schemaVersion: 1;
  workspaceId: string;
  createdAt: string;
  createdByAccountId: string;
  entries: WorkspaceBackupEntry[];
  excludedKeys: string[];
  archiveChecksum: string;
}

export interface WorkspaceRestorePlan {
  workspaceId: string;
  archiveChecksumValid: boolean;
  keysToCreate: string[];
  keysToReplace: string[];
  keysUnchanged: string[];
  rejectedKeys: string[];
  canApply: boolean;
}

export interface IntegrationResiliencePolicy {
  maxAttempts: number;
  baseBackoffMs: number;
  rateLimit: { maxOperations: number; windowMs: number };
  idempotencyWindowMs: number;
}

export interface IntegrationExecutionAttempt {
  attempt: number;
  startedAt: string;
  completedAt: string;
  status: "SUCCEEDED" | "FAILED";
  errorCode?: string;
}

export interface IntegrationExecutionResult<T> {
  status: "SUCCEEDED" | "FAILED" | "IDEMPOTENT_REPLAY" | "RATE_LIMITED";
  value?: T;
  attempts: IntegrationExecutionAttempt[];
  idempotencyKey: string;
  nextRetryAt?: string;
  errorCode?: string;
}
