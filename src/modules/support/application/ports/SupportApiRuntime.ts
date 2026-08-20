import type { RelationshipRef } from "@/platform/identity";
import type { AuthoritativePage, ModuleListQuery } from "@/shared/application";
import type {
  SupportCase,
  SupportCaseCategory,
  SupportCaseChannel,
  SupportCasePriority,
  SupportCaseSlaStatus,
  SupportCaseSource,
  SupportCaseStatus,
} from "../../domain/model/supportCase.types";

export type SupportApiRuntimeMode = "demo" | "connected" | "test";

export interface SupportCaseListQuery extends ModuleListQuery {
  filters?: {
    status?: SupportCaseStatus;
    priority?: SupportCasePriority;
    category?: SupportCaseCategory;
    ownerId?: string;
    relationshipType?: RelationshipRef["type"];
    relationshipId?: string;
    slaStatus?: SupportCaseSlaStatus;
  };
}

export interface SupportCaseProfileInput {
  title: string;
  description: string;
  priority: SupportCasePriority;
  category: SupportCaseCategory;
  source: SupportCaseSource;
  channel?: SupportCaseChannel;
  relationshipRef: RelationshipRef;
  customerId?: string;
  customerName?: string;
  contactId?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  relatedOrderId?: string;
  relatedOrderNumber?: string;
  relatedProductId?: string;
  relatedProductName?: string;
  relatedOwnedProductId?: string;
  ownerId?: string;
  ownerName?: string;
  nextFollowUpAt?: string;
  firstResponseDueAt?: string;
  resolutionDueAt?: string;
  tags?: readonly string[];
}

export type CreateSupportCaseInput = SupportCaseProfileInput;
export type ReplaceSupportCaseProfileInput = SupportCaseProfileInput;
export interface AssignSupportCaseInput { ownerId: string; }
export interface TransitionSupportCaseInput {
  nextStatus: SupportCaseStatus;
  resolutionSummary?: string;
  reason?: string;
}
export interface AddSupportCaseReplyInput { body: string; }
export interface AddSupportCaseInternalNoteInput { body: string; }

export interface SupportCommandOptions {
  idempotencyKey: string;
  correlationId?: string;
  signal?: AbortSignal;
}

export interface SupportVersionedCommandOptions extends SupportCommandOptions {
  expectedVersion: number;
}

export interface SupportMutationEvidence {
  authority: "backend" | "demo" | "test";
  commandId: string;
  correlationId: string;
  aggregateId: string;
  aggregateType: string;
  version: number;
  occurredAt: string;
  outcome: "COMMITTED" | "REPLAYED" | "DEMO_COMMITTED";
  warnings: readonly string[];
  emittedEventIds: readonly string[];
  auditEvidenceIds: readonly string[];
}

export interface SupportMutationResult {
  supportCase: SupportCase;
  evidence: SupportMutationEvidence;
}

export interface SupportQueryPort {
  list(query?: SupportCaseListQuery, signal?: AbortSignal): Promise<AuthoritativePage<SupportCase>>;
  get(caseId: string, signal?: AbortSignal): Promise<SupportCase>;
}

export interface SupportCommandPort {
  createSupportCase(input: CreateSupportCaseInput, options: SupportCommandOptions): Promise<SupportMutationResult>;
  replaceSupportCaseProfile(caseId: string, input: ReplaceSupportCaseProfileInput, options: SupportVersionedCommandOptions): Promise<SupportMutationResult>;
  assignSupportCase(caseId: string, input: AssignSupportCaseInput, options: SupportVersionedCommandOptions): Promise<SupportMutationResult>;
  transitionSupportCase(caseId: string, input: TransitionSupportCaseInput, options: SupportVersionedCommandOptions): Promise<SupportMutationResult>;
  addSupportCaseReply(caseId: string, input: AddSupportCaseReplyInput, options: SupportVersionedCommandOptions): Promise<SupportMutationResult>;
  addSupportCaseInternalNote(caseId: string, input: AddSupportCaseInternalNoteInput, options: SupportVersionedCommandOptions): Promise<SupportMutationResult>;
}

export interface SupportApiRuntime {
  mode: SupportApiRuntimeMode;
  queries: SupportQueryPort;
  commands: SupportCommandPort;
}
