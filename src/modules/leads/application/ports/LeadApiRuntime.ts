import type { AuthoritativePage, ModuleListQuery } from "@/shared/application";
import type { MoneyDto } from "@/shared/money";
import type { Lead } from "../../domain/model/lead.types";

export type LeadApiRuntimeMode = "demo" | "connected" | "test";

export interface LeadListQuery extends ModuleListQuery {}

export interface LeadProfileInterestedProductInput {
  productId: string;
  interestLevel: "low" | "medium" | "high";
  estimatedQuantity?: number;
  expectedBudget?: MoneyDto;
  note?: string;
}

export interface LeadProfileInput {
  displayName: string;
  salutation?: string;
  title?: string;
  department?: string;
  phone?: string;
  workPhone?: string;
  otherPhone?: string;
  email?: string;
  personalEmail?: string;
  zaloId?: string;
  facebook?: string;
  preferredChannel?: "phone" | "email" | "zalo" | "facebook" | "other";
  doNotCall?: boolean;
  doNotEmail?: boolean;
  companyName?: string;
  companySize?: string;
  industry?: string;
  businessType?: string;
  website?: string;
  taxCode?: string;
  companyAddress?: string;
  country?: string;
  province?: string;
  district?: string;
  ward?: string;
  contactAddress?: string;
  source: string;
  campaignId?: string;
  ownerId: string;
  assignedTeam?: string;
  decisionRole?: string;
  priority?: "low" | "medium" | "high";
  interestedProducts?: readonly LeadProfileInterestedProductInput[];
  estimatedValue: MoneyDto;
  budgetRange?: string;
  purchaseTimeline?: string;
  painPoint?: string;
  nextFollowUpAt?: string;
  followUpNote?: string;
  tags?: readonly string[];
  description?: string;
  internalNotes?: string;
  customFields?: Readonly<Record<string, string | number | boolean | readonly string[]>>;
}

export type CreateLeadInput = LeadProfileInput;
export type ReplaceLeadProfileInput = LeadProfileInput;

export interface LeadCommandOptions {
  idempotencyKey: string;
  correlationId?: string;
  signal?: AbortSignal;
}

export interface LeadVersionedCommandOptions extends LeadCommandOptions {
  expectedVersion: number;
}

export interface ReplaceLeadProfileOptions extends LeadVersionedCommandOptions {}

export type LeadProgressionTarget = "CONTACTING" | "VERIFYING";

export interface AdvanceLeadWorkStateInput {
  targetWorkState: LeadProgressionTarget;
  verificationProfile?: {
    companyName?: string;
    painPoint?: string;
    nextFollowUpAt?: string;
  };
}

export interface DisqualifyLeadInput {
  reason: string;
  evidence: string;
}

export interface ArchiveLeadInput {
  reason: string;
}

export interface AssignLeadOwnerInput {
  ownerId: string;
  reason: string;
}

export interface LeadImportItemInput {
  displayName: string;
  phone?: string;
  workPhone?: string;
  email?: string;
  companyName?: string;
  title?: string;
  source: string;
  ownerId: string;
  painPoint?: string;
  nextFollowUpAt?: string;
  preferredChannel?: "phone" | "email" | "zalo" | "facebook" | "other";
}

export interface ImportLeadBatchInput {
  checksum: string;
  items: readonly LeadImportItemInput[];
}

export interface LeadTaskVersionedTargetInput {
  taskId: string;
  expectedVersion: number;
}

export interface HandoverLeadWithTasksInput {
  nextOwnerId: string;
  reason: string;
  taskTargets: readonly LeadTaskVersionedTargetInput[];
}

export interface LeadVersionedTargetInput {
  leadId: string;
  expectedVersion: number;
}

export interface ArchiveLeadBatchInput {
  items: readonly LeadVersionedTargetInput[];
  reason: string;
}

export interface AdvanceLeadWorkStateBatchInput {
  items: readonly LeadVersionedTargetInput[];
  targetWorkState: LeadProgressionTarget;
}

export interface AssignLeadOwnerBatchInput {
  items: readonly LeadVersionedTargetInput[];
  ownerId: string;
  reason: string;
}

export interface DisqualifyLeadBatchInput {
  items: readonly LeadVersionedTargetInput[];
  reason: string;
  evidence: string;
}

export interface ApplyLeadTagBatchInput {
  items: readonly LeadVersionedTargetInput[];
  tag: string;
}

export interface ScheduleLeadFollowUpBatchInput {
  items: readonly LeadVersionedTargetInput[];
  followUpAt: string;
  note: string;
}

export interface ClaimLeadFromQueueInput {
  reason: string;
}

export interface RequestLeadExportInput {
  leadIds: readonly string[];
  format: "CSV";
}

export interface RecordLeadConsentInput {
  channel: "CALL" | "EMAIL" | "SMS" | "ZALO";
  decision: "GRANTED" | "DENIED" | "WITHDRAWN";
  source: string;
  evidence?: string;
  expiresAt?: string;
  lawfulBasis?: string;
}

export interface MergeLeadDuplicatesInput {
  survivor: LeadVersionedTargetInput;
  duplicates: readonly LeadVersionedTargetInput[];
  reason: string;
}

export interface ConfirmLeadDuplicatesDistinctInput {
  primary: LeadVersionedTargetInput;
  candidates: readonly LeadVersionedTargetInput[];
  reason: string;
}

export interface LeadMutationEvidence {
  authority: "backend" | "demo" | "test";
  commandId: string;
  correlationId: string;
  aggregateId: string;
  aggregateType: string;
  version: string | number;
  occurredAt: string;
  outcome: "COMMITTED" | "REPLAYED";
  warnings: readonly string[];
  emittedEventIds: readonly string[];
  auditEvidenceIds: readonly string[];
}

export interface LeadMutationResult {
  lead: Lead;
  evidence: LeadMutationEvidence;
}

export type CreateLeadResult = LeadMutationResult;
export type ReplaceLeadProfileResult = LeadMutationResult;
export type AdvanceLeadWorkStateResult = LeadMutationResult;
export type DisqualifyLeadResult = LeadMutationResult;
export type ReopenDisqualifiedLeadResult = LeadMutationResult;
export type ArchiveLeadResult = LeadMutationResult;
export type AnonymizeLeadResult = LeadMutationResult;
export type RecordLeadConsentResult = LeadMutationResult;
export type AssignLeadOwnerResult = LeadMutationResult;

export interface HandoverLeadWithTasksResult extends LeadMutationResult {
  reassignedTaskIds: string[];
  handoverTaskId: string;
}

export interface LeadBatchMutationResult {
  leads: Lead[];
  evidence: LeadMutationEvidence;
}

export type ArchiveLeadBatchResult = LeadBatchMutationResult;
export type AdvanceLeadWorkStateBatchResult = LeadBatchMutationResult;
export type AssignLeadOwnerBatchResult = LeadBatchMutationResult;
export type DisqualifyLeadBatchResult = LeadBatchMutationResult;
export type ApplyLeadTagBatchResult = LeadBatchMutationResult;
export type ScheduleLeadFollowUpBatchResult = LeadBatchMutationResult;
export type ClaimLeadFromQueueResult = LeadMutationResult;

export interface LeadExportArtifact {
  exportId: string;
  fileName: string;
  mediaType: "text/csv";
  downloadUrl: string;
  expiresAt: string;
  exportedCount: number;
}

export interface RequestLeadExportResult {
  artifact: LeadExportArtifact;
  evidence: LeadMutationEvidence;
}

export interface ImportLeadBatchResult extends LeadBatchMutationResult {
  checksum: string;
  importedCount: number;
}

export interface LeadIdentityResolutionMutationResult {
  primaryLeadId: string;
  leads: Lead[];
  evidence: LeadMutationEvidence;
}

export type MergeLeadDuplicatesResult = LeadIdentityResolutionMutationResult;
export type ConfirmLeadDuplicatesDistinctResult = LeadIdentityResolutionMutationResult;

export interface LeadQueryPort {
  list(query?: LeadListQuery, signal?: AbortSignal): Promise<AuthoritativePage<Lead>>;
  get(leadId: string, signal?: AbortSignal): Promise<Lead>;
}

export interface LeadCommandPort {
  createLead(input: CreateLeadInput, options: LeadCommandOptions): Promise<CreateLeadResult>;
  replaceLeadProfile(
    leadId: string,
    input: ReplaceLeadProfileInput,
    options: ReplaceLeadProfileOptions,
  ): Promise<ReplaceLeadProfileResult>;
  advanceLeadWorkState(
    leadId: string,
    input: AdvanceLeadWorkStateInput,
    options: LeadVersionedCommandOptions,
  ): Promise<AdvanceLeadWorkStateResult>;
  disqualifyLead(
    leadId: string,
    input: DisqualifyLeadInput,
    options: LeadVersionedCommandOptions,
  ): Promise<DisqualifyLeadResult>;
  reopenDisqualifiedLead(
    leadId: string,
    options: LeadVersionedCommandOptions,
  ): Promise<ReopenDisqualifiedLeadResult>;
  archiveLead(
    leadId: string,
    input: ArchiveLeadInput,
    options: LeadVersionedCommandOptions,
  ): Promise<ArchiveLeadResult>;
  assignLeadOwner(
    leadId: string,
    input: AssignLeadOwnerInput,
    options: LeadVersionedCommandOptions,
  ): Promise<AssignLeadOwnerResult>;
  importLeadBatch(
    input: ImportLeadBatchInput,
    options: LeadCommandOptions,
  ): Promise<ImportLeadBatchResult>;
  handoverLeadWithTasks(
    leadId: string,
    input: HandoverLeadWithTasksInput,
    options: LeadVersionedCommandOptions,
  ): Promise<HandoverLeadWithTasksResult>;
  archiveLeadBatch(
    input: ArchiveLeadBatchInput,
    options: LeadCommandOptions,
  ): Promise<ArchiveLeadBatchResult>;
  advanceLeadWorkStateBatch(
    input: AdvanceLeadWorkStateBatchInput,
    options: LeadCommandOptions,
  ): Promise<AdvanceLeadWorkStateBatchResult>;
  assignLeadOwnerBatch(
    input: AssignLeadOwnerBatchInput,
    options: LeadCommandOptions,
  ): Promise<AssignLeadOwnerBatchResult>;
  disqualifyLeadBatch(
    input: DisqualifyLeadBatchInput,
    options: LeadCommandOptions,
  ): Promise<DisqualifyLeadBatchResult>;
  applyLeadTagBatch(
    input: ApplyLeadTagBatchInput,
    options: LeadCommandOptions,
  ): Promise<ApplyLeadTagBatchResult>;
  scheduleLeadFollowUpBatch(
    input: ScheduleLeadFollowUpBatchInput,
    options: LeadCommandOptions,
  ): Promise<ScheduleLeadFollowUpBatchResult>;
  claimLeadFromQueue(
    leadId: string,
    input: ClaimLeadFromQueueInput,
    options: LeadVersionedCommandOptions,
  ): Promise<ClaimLeadFromQueueResult>;
  requestLeadExport(
    input: RequestLeadExportInput,
    options: LeadCommandOptions,
  ): Promise<RequestLeadExportResult>;
  anonymizeLead(
    leadId: string,
    input: ArchiveLeadInput,
    options: LeadVersionedCommandOptions,
  ): Promise<AnonymizeLeadResult>;
  recordLeadConsent(
    leadId: string,
    input: RecordLeadConsentInput,
    options: LeadVersionedCommandOptions,
  ): Promise<RecordLeadConsentResult>;
  mergeLeadDuplicates(
    input: MergeLeadDuplicatesInput,
    options: LeadCommandOptions,
  ): Promise<MergeLeadDuplicatesResult>;
  confirmLeadDuplicatesDistinct(
    input: ConfirmLeadDuplicatesDistinctInput,
    options: LeadCommandOptions,
  ): Promise<ConfirmLeadDuplicatesDistinctResult>;
}

export interface LeadApiRuntime {
  readonly mode: LeadApiRuntimeMode;
  readonly queries: LeadQueryPort;
  readonly commands: LeadCommandPort;
}
