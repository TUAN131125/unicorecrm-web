import type {
  AdvanceLeadWorkStateBatchRequest,
  AdvanceLeadWorkStateRequest,
  AnonymizeLeadRequest,
  ArchiveLeadBatchRequest,
  ApplyLeadTagBatchRequest,
  ArchiveLeadRequest,
  AssignLeadOwnerBatchRequest,
  AssignLeadOwnerRequest,
  CommercialApiClient,
  ClaimLeadFromQueueRequest,
  ConfirmLeadDuplicatesDistinctRequest,
  CreateLeadResponse,
  DisqualifyLeadBatchRequest,
  DisqualifyLeadRequest,
  LeadBatchArchiveResponse,
  LeadBatchCreateResponse,
  LeadBatchMutationResponse,
  LeadHandoverResponse,
  LeadIdentityResolutionResponse,
  LeadExportResponse,
  LeadMutationResponse,
  HandoverLeadWithTasksRequest,
  ImportLeadBatchRequest,
  MergeLeadDuplicatesRequest,
  RecordLeadConsentRequest,
  RequestLeadExportRequest,
  ReplaceLeadProfileResponse,
  ReopenDisqualifiedLeadRequest,
  ScheduleLeadFollowUpBatchRequest,
} from "@/platform/api/generated/commercialApi";
import { ApiClientError } from "@/platform/api/errors";
import type {
  AdvanceLeadWorkStateBatchInput,
  AdvanceLeadWorkStateBatchResult,
  AdvanceLeadWorkStateInput,
  AdvanceLeadWorkStateResult,
  AnonymizeLeadInput,
  AnonymizeLeadResult,
  ApplyLeadTagBatchInput,
  ApplyLeadTagBatchResult,
  ArchiveLeadBatchInput,
  ArchiveLeadBatchResult,
  ArchiveLeadInput,
  ArchiveLeadResult,
  AssignLeadOwnerBatchInput,
  AssignLeadOwnerBatchResult,
  AssignLeadOwnerInput,
  AssignLeadOwnerResult,
  ClaimLeadFromQueueInput,
  ClaimLeadFromQueueResult,
  ConfirmLeadDuplicatesDistinctInput,
  ConfirmLeadDuplicatesDistinctResult,
  CreateLeadInput,
  CreateLeadResult,
  DisqualifyLeadBatchInput,
  DisqualifyLeadBatchResult,
  DisqualifyLeadInput,
  DisqualifyLeadResult,
  LeadCommandOptions,
  LeadCommandPort,
  HandoverLeadWithTasksInput,
  HandoverLeadWithTasksResult,
  ImportLeadBatchInput,
  ImportLeadBatchResult,
  LeadIdentityResolutionMutationResult,
  LeadMutationEvidence,
  LeadMutationResult,
  LeadVersionedCommandOptions,
  MergeLeadDuplicatesInput,
  MergeLeadDuplicatesResult,
  RecordLeadConsentInput,
  RecordLeadConsentResult,
  RequestLeadExportInput,
  RequestLeadExportResult,
  ReopenDisqualifiedLeadResult,
  ScheduleLeadFollowUpBatchInput,
  ScheduleLeadFollowUpBatchResult,
  ReplaceLeadProfileInput,
  ReplaceLeadProfileOptions,
  ReplaceLeadProfileResult,
} from "../../application/ports/LeadApiRuntime";
import {
  mapCreateLeadInputToRequest,
  mapLeadDocumentToApplication,
  mapReplaceLeadProfileInputToRequest,
} from "./LeadApiMapper";

type LeadMutationOperationId =
  | "createLead"
  | "replaceLeadProfile"
  | "advanceLeadWorkState"
  | "disqualifyLead"
  | "reopenDisqualifiedLead"
  | "archiveLead"
  | "assignLeadOwner"
  | "handoverLeadWithTasks"
  | "anonymizeLead"
  | "recordLeadConsent"
  | "claimLeadFromQueue";

type LeadBatchOperationId =
  | "archiveLeadBatch"
  | "advanceLeadWorkStateBatch"
  | "assignLeadOwnerBatch"
  | "disqualifyLeadBatch"
  | "applyLeadTagBatch"
  | "scheduleLeadFollowUpBatch";
type LeadIdentityOperationId = "mergeLeadDuplicates" | "confirmLeadDuplicatesDistinct";
type AuthoritativeLeadResponse = CreateLeadResponse | ReplaceLeadProfileResponse | LeadMutationResponse;

type MutationEnvelope = {
  commandId: string;
  correlationId: string;
  aggregateId: string;
  aggregateType: string;
  version: number;
  occurredAt: string;
  outcome: "COMMITTED" | "REPLAYED";
  warnings?: string[];
  emittedEventIds?: string[];
  auditEvidenceIds?: string[];
};

export class LeadHttpCommandAdapter implements LeadCommandPort {
  constructor(private readonly api: CommercialApiClient) {}

  async createLead(input: CreateLeadInput, options: LeadCommandOptions): Promise<CreateLeadResult> {
    const response = await this.api.createLead<CreateLeadResponse>(mapCreateLeadInputToRequest(input), commandOptions("createLead", options));
    return mapAuthoritativeLeadMutation("createLead", response);
  }

  async replaceLeadProfile(
    leadId: string,
    input: ReplaceLeadProfileInput,
    options: ReplaceLeadProfileOptions,
  ): Promise<ReplaceLeadProfileResult> {
    const aggregateId = requireLeadId("replaceLeadProfile", leadId);
    const response = await this.api.replaceLeadProfile<ReplaceLeadProfileResponse>(
      aggregateId,
      mapReplaceLeadProfileInputToRequest(input),
      versionedOptions("replaceLeadProfile", options),
    );
    return requireTargetLead("replaceLeadProfile", aggregateId, response);
  }

  async advanceLeadWorkState(
    leadId: string,
    input: AdvanceLeadWorkStateInput,
    options: LeadVersionedCommandOptions,
  ): Promise<AdvanceLeadWorkStateResult> {
    const aggregateId = requireLeadId("advanceLeadWorkState", leadId);
    const body: AdvanceLeadWorkStateRequest = {
      targetWorkState: input.targetWorkState,
      ...(input.verificationProfile === undefined ? {} : {
        verificationProfile: compact({
          companyName: input.verificationProfile.companyName?.trim() || undefined,
          painPoint: input.verificationProfile.painPoint?.trim() || undefined,
          nextFollowUpAt: input.verificationProfile.nextFollowUpAt?.trim() || undefined,
        }),
      }),
    };
    const response = await this.api.advanceLeadWorkState<LeadMutationResponse>(aggregateId, body, versionedOptions("advanceLeadWorkState", options));
    return requireTargetLead("advanceLeadWorkState", aggregateId, response);
  }

  async disqualifyLead(
    leadId: string,
    input: DisqualifyLeadInput,
    options: LeadVersionedCommandOptions,
  ): Promise<DisqualifyLeadResult> {
    const aggregateId = requireLeadId("disqualifyLead", leadId);
    const reason = requireReason("disqualifyLead", input.reason);
    const evidence = input.evidence?.trim() || undefined;
    const body: DisqualifyLeadRequest = compact({ reason, evidence });
    const response = await this.api.disqualifyLead<LeadMutationResponse>(aggregateId, body, versionedOptions("disqualifyLead", options));
    return requireTargetLead("disqualifyLead", aggregateId, response);
  }

  async reopenDisqualifiedLead(
    leadId: string,
    options: LeadVersionedCommandOptions,
  ): Promise<ReopenDisqualifiedLeadResult> {
    const aggregateId = requireLeadId("reopenDisqualifiedLead", leadId);
    const body: ReopenDisqualifiedLeadRequest = {};
    const response = await this.api.reopenDisqualifiedLead<LeadMutationResponse>(aggregateId, body, versionedOptions("reopenDisqualifiedLead", options));
    return requireTargetLead("reopenDisqualifiedLead", aggregateId, response);
  }

  async archiveLead(
    leadId: string,
    input: ArchiveLeadInput,
    options: LeadVersionedCommandOptions,
  ): Promise<ArchiveLeadResult> {
    const aggregateId = requireLeadId("archiveLead", leadId);
    const reason = input.reason?.trim() || undefined;
    const body: ArchiveLeadRequest = compact({ reason });
    const response = await this.api.archiveLead<LeadMutationResponse>(aggregateId, body, versionedOptions("archiveLead", options));
    return requireTargetLead("archiveLead", aggregateId, response);
  }

  async assignLeadOwner(
    leadId: string,
    input: AssignLeadOwnerInput,
    options: LeadVersionedCommandOptions,
  ): Promise<AssignLeadOwnerResult> {
    const aggregateId = requireLeadId("assignLeadOwner", leadId);
    const ownerId = input.ownerId.trim();
    if (!ownerId) throw contractViolation("assignLeadOwner", "ownerId", "assignLeadOwner requires a target owner ID.");
    const body: AssignLeadOwnerRequest = { ownerId, reason: requireReason("assignLeadOwner", input.reason) };
    const response = await this.api.assignLeadOwner<LeadMutationResponse>(aggregateId, body, versionedOptions("assignLeadOwner", options));
    const result = requireTargetLead("assignLeadOwner", aggregateId, response);
    if (result.lead.ownerId !== ownerId) {
      throw contractViolation("assignLeadOwner", "result.ownerId", "assignLeadOwner must return the authoritative assigned owner.");
    }
    return result;
  }

  async importLeadBatch(
    input: ImportLeadBatchInput,
    options: LeadCommandOptions,
  ): Promise<ImportLeadBatchResult> {
    const checksum = input.checksum.trim();
    if (!checksum) throw contractViolation("importLeadBatch", "checksum", "importLeadBatch requires the validated file checksum.");
    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw contractViolation("importLeadBatch", "items", "importLeadBatch requires at least one Lead profile.");
    }
    const body: ImportLeadBatchRequest = {
      checksum,
      items: input.items.map((item) => compact({
        displayName: item.displayName.trim(),
        phone: item.phone?.trim() || undefined,
        workPhone: item.workPhone?.trim() || undefined,
        email: item.email?.trim() || undefined,
        companyName: item.companyName?.trim() || undefined,
        title: item.title?.trim() || undefined,
        source: item.source.trim(),
        ownerId: item.ownerId.trim(),
        painPoint: item.painPoint?.trim() || undefined,
        nextFollowUpAt: item.nextFollowUpAt?.trim() || undefined,
        preferredChannel: item.preferredChannel,
      })),
    };
    const response = await this.api.importLeadBatch<LeadBatchCreateResponse>(body, commandOptions("importLeadBatch", options));
    assertEnvelope("importLeadBatch", response);
    if (!response.result || response.result.checksum !== checksum || response.result.importedCount !== body.items.length || !Array.isArray(response.result.leads)) {
      throw contractViolation("importLeadBatch", "result", "importLeadBatch must return the authoritative complete import result.");
    }
    const leads = response.result.leads.map(mapLeadDocumentToApplication);
    if (leads.length !== body.items.length) throw contractViolation("importLeadBatch", "result.leads", "importLeadBatch returned an incomplete Lead batch.");
    assertUniqueLeadIds("importLeadBatch", leads.map((lead) => lead.id));
    return { checksum, importedCount: response.result.importedCount, leads, evidence: mapEvidence(response) };
  }

  async handoverLeadWithTasks(
    leadId: string,
    input: HandoverLeadWithTasksInput,
    options: LeadVersionedCommandOptions,
  ): Promise<HandoverLeadWithTasksResult> {
    const aggregateId = requireLeadId("handoverLeadWithTasks", leadId);
    const nextOwnerId = input.nextOwnerId.trim();
    if (!nextOwnerId) throw contractViolation("handoverLeadWithTasks", "nextOwnerId", "handoverLeadWithTasks requires a target owner ID.");
    const taskTargets = input.taskTargets.map((target, index) => {
      const taskId = target.taskId.trim();
      if (!taskId || !Number.isInteger(target.expectedVersion) || target.expectedVersion < 1) {
        throw contractViolation("handoverLeadWithTasks", `taskTargets[${index}]`, "Every open Task requires an ID and positive expectedVersion.");
      }
      return { taskId, expectedVersion: target.expectedVersion };
    });
    if (new Set(taskTargets.map((target) => target.taskId)).size !== taskTargets.length) {
      throw contractViolation("handoverLeadWithTasks", "taskTargets", "Task targets must be unique.");
    }
    const body: HandoverLeadWithTasksRequest = {
      nextOwnerId,
      reason: requireReason("handoverLeadWithTasks", input.reason),
      taskTargets,
    };
    const response = await this.api.handoverLeadWithTasks<LeadHandoverResponse>(aggregateId, body, versionedOptions("handoverLeadWithTasks", options));
    assertEnvelope("handoverLeadWithTasks", response);
    if (!response.result || !response.result.lead || !Array.isArray(response.result.reassignedTaskIds) || !response.result.handoverTaskId) {
      throw contractViolation("handoverLeadWithTasks", "result", "handoverLeadWithTasks must return the Lead, reassigned Task IDs and handover Task ID.");
    }
    const lead = mapLeadDocumentToApplication(response.result.lead);
    if (lead.id !== aggregateId || lead.ownerId !== nextOwnerId || lead.resourceVersion !== response.version) {
      throw contractViolation("handoverLeadWithTasks", "result.lead", "handoverLeadWithTasks returned an inconsistent authoritative Lead.");
    }
    const expectedTaskIds = [...taskTargets.map((target) => target.taskId)].sort();
    const actualTaskIds = [...response.result.reassignedTaskIds].sort();
    if (actualTaskIds.length !== expectedTaskIds.length || actualTaskIds.some((value, index) => value !== expectedTaskIds[index])) {
      throw contractViolation("handoverLeadWithTasks", "result.reassignedTaskIds", "handoverLeadWithTasks must account for every declared open Task.");
    }
    return {
      lead,
      reassignedTaskIds: [...response.result.reassignedTaskIds],
      handoverTaskId: response.result.handoverTaskId,
      evidence: mapEvidence(response),
    };
  }

  async archiveLeadBatch(
    input: ArchiveLeadBatchInput,
    options: LeadCommandOptions,
  ): Promise<ArchiveLeadBatchResult> {
    const body: ArchiveLeadBatchRequest = {
      items: normalizeTargets("archiveLeadBatch", input.items),
      ...(input.reason?.trim() ? { reason: input.reason.trim() } : {}),
    };
    const response = await this.api.archiveLeadBatch<LeadBatchArchiveResponse>(body, commandOptions("archiveLeadBatch", options));
    assertEnvelope("archiveLeadBatch", response);
    if (!response.result || !Array.isArray(response.result.leads) || response.result.leads.length !== body.items.length) {
      throw contractViolation("archiveLeadBatch", "result.leads", "archiveLeadBatch must return every archived Lead exactly once.");
    }
    const leads = response.result.leads.map(mapLeadDocumentToApplication);
    assertUniqueLeadIds("archiveLeadBatch", leads.map((lead) => lead.id));
    const requested = new Set(body.items.map((item) => item.leadId));
    if (leads.some((lead) => !requested.has(lead.id) || !lead.archivedAt)) {
      throw contractViolation("archiveLeadBatch", "result.leads", "archiveLeadBatch returned an unexpected or non-archived Lead.");
    }
    return { leads, evidence: mapEvidence(response) };
  }

  async advanceLeadWorkStateBatch(
    input: AdvanceLeadWorkStateBatchInput,
    options: LeadCommandOptions,
  ): Promise<AdvanceLeadWorkStateBatchResult> {
    const body: AdvanceLeadWorkStateBatchRequest = {
      items: normalizeTargets("advanceLeadWorkStateBatch", input.items),
      targetWorkState: input.targetWorkState,
    };
    const response = await this.api.advanceLeadWorkStateBatch<LeadBatchMutationResponse>(body, commandOptions("advanceLeadWorkStateBatch", options));
    return mapBatchMutation("advanceLeadWorkStateBatch", response, body.items.map((item) => item.leadId));
  }

  async assignLeadOwnerBatch(
    input: AssignLeadOwnerBatchInput,
    options: LeadCommandOptions,
  ): Promise<AssignLeadOwnerBatchResult> {
    const ownerId = input.ownerId.trim();
    if (!ownerId) throw contractViolation("assignLeadOwnerBatch", "ownerId", "assignLeadOwnerBatch requires a target owner ID.");
    const body: AssignLeadOwnerBatchRequest = {
      items: normalizeTargets("assignLeadOwnerBatch", input.items),
      ownerId,
      reason: requireReason("assignLeadOwnerBatch", input.reason),
    };
    const response = await this.api.assignLeadOwnerBatch<LeadBatchMutationResponse>(body, commandOptions("assignLeadOwnerBatch", options));
    const result = mapBatchMutation("assignLeadOwnerBatch", response, body.items.map((item) => item.leadId));
    if (result.leads.some((lead) => lead.ownerId !== ownerId)) {
      throw contractViolation("assignLeadOwnerBatch", "result.leads", "assignLeadOwnerBatch must return the authoritative owner for every Lead.");
    }
    return result;
  }

  async disqualifyLeadBatch(
    input: DisqualifyLeadBatchInput,
    options: LeadCommandOptions,
  ): Promise<DisqualifyLeadBatchResult> {
    const reason = requireReason("disqualifyLeadBatch", input.reason);
    const evidence = input.evidence?.trim() || undefined;
    const body: DisqualifyLeadBatchRequest = {
      items: normalizeTargets("disqualifyLeadBatch", input.items),
      reason,
      ...(evidence === undefined ? {} : { evidence }),
    };
    const response = await this.api.disqualifyLeadBatch<LeadBatchMutationResponse>(body, commandOptions("disqualifyLeadBatch", options));
    return mapBatchMutation("disqualifyLeadBatch", response, body.items.map((item) => item.leadId));
  }

  async applyLeadTagBatch(
    input: ApplyLeadTagBatchInput,
    options: LeadCommandOptions,
  ): Promise<ApplyLeadTagBatchResult> {
    const tag = input.tag.trim();
    if (!tag) throw contractViolation("applyLeadTagBatch", "tag", "applyLeadTagBatch requires a tag.");
    const body: ApplyLeadTagBatchRequest = {
      items: normalizeTargets("applyLeadTagBatch", input.items),
      tag,
    };
    const response = await this.api.applyLeadTagBatch<LeadBatchMutationResponse>(body, commandOptions("applyLeadTagBatch", options));
    const result = mapBatchMutation("applyLeadTagBatch", response, body.items.map((item) => item.leadId));
    if (result.leads.some((lead) => !(lead.tags ?? []).includes(tag))) {
      throw contractViolation("applyLeadTagBatch", "result.leads", "applyLeadTagBatch must return the applied tag for every Lead.");
    }
    return result;
  }

  async scheduleLeadFollowUpBatch(
    input: ScheduleLeadFollowUpBatchInput,
    options: LeadCommandOptions,
  ): Promise<ScheduleLeadFollowUpBatchResult> {
    const followUpAt = input.followUpAt.trim();
    if (!followUpAt.endsWith("Z") || !Number.isFinite(Date.parse(followUpAt))) {
      throw contractViolation("scheduleLeadFollowUpBatch", "followUpAt", "scheduleLeadFollowUpBatch followUpAt must be a UTC date-time.");
    }
    const note = input.note.trim();
    if (!note) throw contractViolation("scheduleLeadFollowUpBatch", "note", "scheduleLeadFollowUpBatch requires a note.");
    const body: ScheduleLeadFollowUpBatchRequest = {
      items: normalizeTargets("scheduleLeadFollowUpBatch", input.items),
      followUpAt,
      note,
    };
    const response = await this.api.scheduleLeadFollowUpBatch<LeadBatchMutationResponse>(body, commandOptions("scheduleLeadFollowUpBatch", options));
    const result = mapBatchMutation("scheduleLeadFollowUpBatch", response, body.items.map((item) => item.leadId));
    if (result.leads.some((lead) => lead.nextFollowUpAt !== followUpAt)) {
      throw contractViolation("scheduleLeadFollowUpBatch", "result.leads", "scheduleLeadFollowUpBatch must return the authoritative follow-up date for every Lead.");
    }
    return result;
  }

  async claimLeadFromQueue(
    leadId: string,
    input: ClaimLeadFromQueueInput,
    options: LeadVersionedCommandOptions,
  ): Promise<ClaimLeadFromQueueResult> {
    const aggregateId = requireLeadId("claimLeadFromQueue", leadId);
    const body: ClaimLeadFromQueueRequest = { reason: requireReason("claimLeadFromQueue", input.reason) };
    const response = await this.api.claimLeadFromQueue<LeadMutationResponse>(aggregateId, body, versionedOptions("claimLeadFromQueue", options));
    return requireTargetLead("claimLeadFromQueue", aggregateId, response);
  }

  async requestLeadExport(
    input: RequestLeadExportInput,
    options: LeadCommandOptions,
  ): Promise<RequestLeadExportResult> {
    const leadIds = [...new Set(input.leadIds.map((leadId) => requireLeadId("requestLeadExport", leadId)))];
    if (leadIds.length === 0) throw contractViolation("requestLeadExport", "leadIds", "requestLeadExport requires at least one Lead ID.");
    const body: RequestLeadExportRequest = { leadIds, format: input.format };
    const response = await this.api.requestLeadExport<LeadExportResponse>(body, commandOptions("requestLeadExport", options));
    assertEnvelope("requestLeadExport", response);
    const result = response.result;
    if (!result || !result.exportId || !result.fileName || result.mediaType !== "text/csv" || !result.downloadUrl || !result.expiresAt || result.exportedCount !== leadIds.length) {
      throw contractViolation("requestLeadExport", "result", "requestLeadExport must return a complete authoritative export artifact.");
    }
    try { new URL(result.downloadUrl); } catch { throw contractViolation("requestLeadExport", "result.downloadUrl", "requestLeadExport downloadUrl must be an absolute URL."); }
    if (!result.expiresAt.endsWith("Z") || !Number.isFinite(Date.parse(result.expiresAt))) {
      throw contractViolation("requestLeadExport", "result.expiresAt", "requestLeadExport expiresAt must be a UTC date-time.");
    }
    return { artifact: { ...result }, evidence: mapEvidence(response) };
  }

  async anonymizeLead(
    leadId: string,
    input: AnonymizeLeadInput,
    options: LeadVersionedCommandOptions,
  ): Promise<AnonymizeLeadResult> {
    const aggregateId = requireLeadId("anonymizeLead", leadId);
    const body: AnonymizeLeadRequest = { reason: requireReason("anonymizeLead", input.reason) };
    const response = await this.api.anonymizeLead<LeadMutationResponse>(aggregateId, body, versionedOptions("anonymizeLead", options));
    const result = requireTargetLead("anonymizeLead", aggregateId, response);
    if (!result.lead.anonymizedAt || result.lead.archiveReason !== "ANONYMIZED") {
      throw contractViolation("anonymizeLead", "result", "anonymizeLead must return an authoritative anonymized and archived Lead projection.");
    }
    return result;
  }

  async recordLeadConsent(
    leadId: string,
    input: RecordLeadConsentInput,
    options: LeadVersionedCommandOptions,
  ): Promise<RecordLeadConsentResult> {
    const aggregateId = requireLeadId("recordLeadConsent", leadId);
    const source = input.source.trim();
    if (!source) throw contractViolation("recordLeadConsent", "source", "recordLeadConsent requires an evidence source.");
    if (input.expiresAt !== undefined && (!input.expiresAt.endsWith("Z") || !Number.isFinite(Date.parse(input.expiresAt)))) {
      throw contractViolation("recordLeadConsent", "expiresAt", "recordLeadConsent expiresAt must be a UTC date-time.");
    }
    const body: RecordLeadConsentRequest = compact({
      channel: input.channel,
      decision: input.decision,
      source,
      evidence: input.evidence?.trim() || undefined,
      expiresAt: input.expiresAt,
      lawfulBasis: input.lawfulBasis?.trim() || undefined,
    });
    const response = await this.api.recordLeadConsent<LeadMutationResponse>(aggregateId, body, versionedOptions("recordLeadConsent", options));
    const result = requireTargetLead("recordLeadConsent", aggregateId, response);
    const latest = result.lead.consent?.ledger?.[0];
    if (!latest || latest.channel !== input.channel || latest.decision !== input.decision || latest.source !== source) {
      throw contractViolation("recordLeadConsent", "result.consent", "recordLeadConsent must return the appended authoritative consent entry.");
    }
    return result;
  }

  async mergeLeadDuplicates(
    input: MergeLeadDuplicatesInput,
    options: LeadCommandOptions,
  ): Promise<MergeLeadDuplicatesResult> {
    const survivor = normalizeTarget("mergeLeadDuplicates", "survivor", input.survivor);
    const duplicates = normalizeTargets("mergeLeadDuplicates", input.duplicates);
    if (duplicates.some((item) => item.leadId === survivor.leadId)) {
      throw contractViolation("mergeLeadDuplicates", "duplicates", "The survivor cannot also be a duplicate source Lead.");
    }
    const body: MergeLeadDuplicatesRequest = {
      survivor,
      duplicates,
      reason: requireReason("mergeLeadDuplicates", input.reason),
    };
    const response = await this.api.mergeLeadDuplicates<LeadIdentityResolutionResponse>(body, commandOptions("mergeLeadDuplicates", options));
    const result = mapIdentityResolution("mergeLeadDuplicates", response, survivor.leadId, [survivor, ...duplicates].map((item) => item.leadId));
    const survivorLead = result.leads.find((lead) => lead.id === survivor.leadId);
    if (!survivorLead || survivorLead.duplicateResolution?.status !== "MERGED") {
      throw contractViolation("mergeLeadDuplicates", "result", "mergeLeadDuplicates must return the authoritative merged survivor.");
    }
    return result;
  }

  async confirmLeadDuplicatesDistinct(
    input: ConfirmLeadDuplicatesDistinctInput,
    options: LeadCommandOptions,
  ): Promise<ConfirmLeadDuplicatesDistinctResult> {
    const primary = normalizeTarget("confirmLeadDuplicatesDistinct", "primary", input.primary);
    const candidates = normalizeTargets("confirmLeadDuplicatesDistinct", input.candidates);
    if (candidates.some((item) => item.leadId === primary.leadId)) {
      throw contractViolation("confirmLeadDuplicatesDistinct", "candidates", "The primary Lead cannot also be a candidate.");
    }
    const body: ConfirmLeadDuplicatesDistinctRequest = {
      primary,
      candidates,
      reason: requireReason("confirmLeadDuplicatesDistinct", input.reason),
    };
    const response = await this.api.confirmLeadDuplicatesDistinct<LeadIdentityResolutionResponse>(body, commandOptions("confirmLeadDuplicatesDistinct", options));
    const result = mapIdentityResolution("confirmLeadDuplicatesDistinct", response, primary.leadId, [primary, ...candidates].map((item) => item.leadId));
    if (result.leads.some((lead) => lead.duplicateResolution?.status !== "CONFIRMED_DISTINCT")) {
      throw contractViolation("confirmLeadDuplicatesDistinct", "result", "confirmLeadDuplicatesDistinct must return authoritative distinct decisions for the complete cluster.");
    }
    return result;
  }
}

function commandOptions(operationId: string, options: LeadCommandOptions) {
  return {
    idempotencyKey: requireIdempotencyKey(operationId, options.idempotencyKey),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
    retry: "idempotent" as const,
  };
}

function versionedOptions(operationId: LeadMutationOperationId, options: LeadVersionedCommandOptions) {
  if (!Number.isInteger(options.expectedVersion) || options.expectedVersion < 0) {
    throw contractViolation(operationId, "expectedVersion", `${operationId} requires a non-negative integer optimistic concurrency version.`);
  }
  return { ...commandOptions(operationId, options), expectedVersion: options.expectedVersion };
}

function requireTargetLead(
  operationId: Exclude<LeadMutationOperationId, "createLead">,
  aggregateId: string,
  response: AuthoritativeLeadResponse,
): LeadMutationResult {
  const result = mapAuthoritativeLeadMutation(operationId, response);
  if (result.lead.id !== aggregateId) {
    throw contractViolation(operationId, "aggregateId", `${operationId} must return the requested Lead aggregate.`);
  }
  return result;
}

function mapAuthoritativeLeadMutation(
  operationId: LeadMutationOperationId,
  response: AuthoritativeLeadResponse,
): LeadMutationResult {
  assertEnvelope(operationId, response);
  if (!response.result || typeof response.result !== "object") {
    throw contractViolation(operationId, "result", `${operationId} response is missing its authoritative Lead result.`);
  }
  const lead = mapLeadDocumentToApplication(response.result);
  if (lead.id !== response.aggregateId) {
    throw contractViolation(operationId, "aggregateId", `${operationId} aggregateId must match the authoritative Lead result ID.`);
  }
  if (lead.resourceVersion !== response.version) {
    throw contractViolation(operationId, "version", `${operationId} response version must match the authoritative Lead resource version.`);
  }
  return { lead, evidence: mapEvidence(response) };
}

function mapBatchMutation(
  operationId: LeadBatchOperationId,
  response: LeadBatchMutationResponse,
  expectedLeadIds: readonly string[],
): { leads: ReturnType<typeof mapLeadDocumentToApplication>[]; evidence: LeadMutationEvidence } {
  assertEnvelope(operationId, response);
  if (!response.result || !Array.isArray(response.result.leads)) {
    throw contractViolation(operationId, "result.leads", `${operationId} must return an authoritative Lead batch.`);
  }
  const leads = response.result.leads.map(mapLeadDocumentToApplication);
  assertUniqueLeadIds(operationId, leads.map((lead) => lead.id));
  const actual = leads.map((lead) => lead.id).sort();
  const expected = [...new Set(expectedLeadIds)].sort();
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw contractViolation(operationId, "result.leads", `${operationId} response Lead set does not match the requested batch.`);
  }
  return { leads, evidence: mapEvidence(response) };
}

function mapIdentityResolution(
  operationId: LeadIdentityOperationId,
  response: LeadIdentityResolutionResponse,
  primaryLeadId: string,
  expectedLeadIds: readonly string[],
): LeadIdentityResolutionMutationResult {
  assertEnvelope(operationId, response);
  if (!response.result || response.result.primaryLeadId !== primaryLeadId || !Array.isArray(response.result.leads)) {
    throw contractViolation(operationId, "result", `${operationId} response must identify the requested primary Lead and return the complete cluster.`);
  }
  const leads = response.result.leads.map(mapLeadDocumentToApplication);
  assertUniqueLeadIds(operationId, leads.map((lead) => lead.id));
  const actual = [...leads.map((lead) => lead.id)].sort();
  const expected = [...new Set(expectedLeadIds)].sort();
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw contractViolation(operationId, "result.leads", `${operationId} response Lead cluster does not match the requested cluster.`);
  }
  const primary = leads.find((lead) => lead.id === primaryLeadId);
  if (!primary || response.aggregateId !== primaryLeadId || primary.resourceVersion !== response.version) {
    throw contractViolation(operationId, "version", `${operationId} response version must match the authoritative primary Lead version.`);
  }
  return { primaryLeadId, leads, evidence: mapEvidence(response) };
}

function assertEnvelope(operationId: string, response: MutationEnvelope): void {
  if (!response || typeof response !== "object") throw contractViolation(operationId, "response", `${operationId} response must be an object.`);
  for (const field of ["commandId", "correlationId", "aggregateId", "aggregateType", "occurredAt"] as const) {
    if (typeof response[field] !== "string" || !response[field].trim()) {
      throw contractViolation(operationId, field, `${operationId} response is missing authoritative ${field}.`);
    }
  }
  if (!Number.isFinite(response.version)) throw contractViolation(operationId, "version", `${operationId} response is missing an authoritative numeric resource version.`);
  if (response.outcome !== "COMMITTED" && response.outcome !== "REPLAYED") {
    throw contractViolation(operationId, "outcome", `${operationId} response outcome must be COMMITTED or REPLAYED.`);
  }
  if (!response.occurredAt.endsWith("Z") || !Number.isFinite(Date.parse(response.occurredAt))) {
    throw contractViolation(operationId, "occurredAt", `${operationId} response occurredAt must be a UTC date-time.`);
  }
  for (const [field, values] of [["warnings", response.warnings], ["emittedEventIds", response.emittedEventIds], ["auditEvidenceIds", response.auditEvidenceIds]] as const) {
    if (values !== undefined && (!Array.isArray(values) || values.some((value) => typeof value !== "string"))) {
      throw contractViolation(operationId, field, `${operationId} response ${field} must contain strings only.`);
    }
  }
}

function mapEvidence(response: MutationEnvelope): LeadMutationEvidence {
  return {
    authority: "backend",
    commandId: response.commandId,
    correlationId: response.correlationId,
    aggregateId: response.aggregateId,
    aggregateType: response.aggregateType,
    version: response.version,
    occurredAt: response.occurredAt,
    outcome: response.outcome,
    warnings: response.warnings ?? [],
    emittedEventIds: response.emittedEventIds ?? [],
    auditEvidenceIds: response.auditEvidenceIds ?? [],
  };
}

function normalizeTargets(operationId: string, values: readonly { leadId: string; expectedVersion: number }[]) {
  if (!Array.isArray(values) || values.length === 0) throw contractViolation(operationId, "targets", `${operationId} requires at least one Lead target.`);
  const targets = values.map((value, index) => normalizeTarget(operationId, `targets[${index}]`, value));
  assertUniqueLeadIds(operationId, targets.map((target) => target.leadId));
  return targets;
}

function normalizeTarget(operationId: string, field: string, value: { leadId: string; expectedVersion: number }) {
  const leadId = requireLeadId(operationId, value.leadId);
  if (!Number.isInteger(value.expectedVersion) || value.expectedVersion < 1) {
    throw contractViolation(operationId, `${field}.expectedVersion`, `${operationId} requires a positive expectedVersion for every Lead.`);
  }
  return { leadId, expectedVersion: value.expectedVersion };
}

function assertUniqueLeadIds(operationId: string, leadIds: readonly string[]): void {
  if (new Set(leadIds).size !== leadIds.length) throw contractViolation(operationId, "leadIds", `${operationId} cannot contain duplicate Lead IDs.`);
}

function requireReason(operationId: string, value: string): string {
  const reason = value.trim();
  if (!reason) throw contractViolation(operationId, "reason", `${operationId} requires a reason.`);
  return reason;
}

function requireLeadId(operationId: string, value: string): string {
  const leadId = value.trim();
  if (!leadId) throw contractViolation(operationId, "leadId", `${operationId} requires a Lead ID.`);
  return leadId;
}

function requireIdempotencyKey(operationId: string, value: string): string {
  const idempotencyKey = value.trim();
  if (!idempotencyKey) throw contractViolation(operationId, "idempotencyKey", `The production ${operationId} operation requires Idempotency-Key.`);
  return idempotencyKey;
}

function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

function contractViolation(operationId: string, field: string, message: string): ApiClientError {
  return new ApiClientError({
    code: "CONNECTED_CONTRACT_VIOLATION",
    message,
    retryable: false,
    details: { operationId, field, authority: "docs/api/openapi.json" },
  });
}
