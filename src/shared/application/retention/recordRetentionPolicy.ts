export type RecordRetentionClass = "DURABLE" | "MASTER" | "OPERATIONAL" | "TRANSIENT";

export type DestructiveRecordAction =
  | "ARCHIVE"
  | "RESTORE"
  | "ANONYMIZE"
  | "CANCEL"
  | "VOID"
  | "HARD_DELETE";

export interface DestructiveActionDecisionInput {
  recordType: string;
  retentionClass: RecordRetentionClass;
  action: DestructiveRecordAction;
  reason?: string;
  isDraft?: boolean;
  hasReferences?: boolean;
  hasAuditEvidence?: boolean;
  backendAuthorizedHardDelete?: boolean;
}

export class RetentionPolicyError extends Error {
  readonly code: string;
  readonly blockers: string[];

  constructor(code: string, message: string, blockers: string[] = []) {
    super(message);
    this.name = "RetentionPolicyError";
    this.code = code;
    this.blockers = blockers;
  }
}

const REASON_REQUIRED_ACTIONS = new Set<DestructiveRecordAction>(["ARCHIVE", "ANONYMIZE", "CANCEL", "VOID", "HARD_DELETE"]);

export function assertDestructiveActionAllowed(input: DestructiveActionDecisionInput): void {
  if (REASON_REQUIRED_ACTIONS.has(input.action) && !input.reason?.trim()) {
    throw new RetentionPolicyError(
      "DESTRUCTIVE_ACTION_REASON_REQUIRED",
      `${input.action} requires an explicit reason for ${input.recordType}.`,
      ["REASON_REQUIRED"],
    );
  }

  if (input.action === "HARD_DELETE") {
    if (input.retentionClass !== "TRANSIENT") {
      throw new RetentionPolicyError(
        "HARD_DELETE_FORBIDDEN",
        `${input.recordType} is retained as a ${input.retentionClass.toLowerCase()} record and cannot be hard-deleted.`,
        ["USE_ARCHIVE_CANCEL_VOID_OR_ANONYMIZE"],
      );
    }
    const blockers = [
      !input.isDraft ? "NOT_DRAFT" : undefined,
      input.hasReferences ? "HAS_REFERENCES" : undefined,
      input.hasAuditEvidence ? "HAS_AUDIT_EVIDENCE" : undefined,
      !input.backendAuthorizedHardDelete ? "BACKEND_AUTHORIZATION_REQUIRED" : undefined,
    ].filter((value): value is string => Boolean(value));
    if (blockers.length > 0) {
      throw new RetentionPolicyError(
        "HARD_DELETE_NOT_ELIGIBLE",
        `${input.recordType} is not eligible for hard delete.`,
        blockers,
      );
    }
    return;
  }

  if (input.action === "ANONYMIZE" && input.retentionClass !== "MASTER") {
    throw new RetentionPolicyError(
      "ANONYMIZE_NOT_SUPPORTED",
      `${input.recordType} must use its lifecycle action instead of anonymization.`,
      ["USE_RECORD_LIFECYCLE_ACTION"],
    );
  }

  if ((input.action === "CANCEL" || input.action === "VOID") && input.retentionClass === "MASTER") {
    throw new RetentionPolicyError(
      "LIFECYCLE_ACTION_NOT_SUPPORTED",
      `${input.recordType} is a master record and must be archived or anonymized.`,
      ["USE_ARCHIVE_OR_ANONYMIZE"],
    );
  }
}

export function redactEmailForRetention(value?: string): string | undefined {
  if (!value) return undefined;
  return "anonymized@invalid.local";
}

export function anonymizedRecordLabel(recordType: string, id: string): string {
  return `${recordType} ${id.slice(-6)} (anonymized)`;
}
