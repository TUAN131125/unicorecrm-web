import { invalidateModuleQueries, runBackendProjection } from "@/shared/application";
import { createTaskSnapshot, reassignTaskSnapshot } from "@/modules/tasks";
import { ApplicationError } from "@/shared/domain";
import { money } from "@/shared/money";
import type {
  AdvanceLeadWorkStateBatchResult,
  AdvanceLeadWorkStateInput,
  AdvanceLeadWorkStateResult,
  AnonymizeLeadResult,
  ApplyLeadTagBatchResult,
  ArchiveLeadBatchResult,
  ArchiveLeadResult,
  AssignLeadOwnerBatchResult,
  AssignLeadOwnerResult,
  ClaimLeadFromQueueResult,
  CreateLeadResult,
  DisqualifyLeadBatchResult,
  DisqualifyLeadInput,
  DisqualifyLeadResult,
  ConfirmLeadDuplicatesDistinctResult,
  HandoverLeadWithTasksResult,
  ImportLeadBatchResult,
  LeadIdentityResolutionMutationResult,
  LeadMutationResult,
  LeadProfileInput,
  MergeLeadDuplicatesResult,
  RecordLeadConsentInput,
  RecordLeadConsentResult,
  RequestLeadExportResult,
  ReopenDisqualifiedLeadResult,
  ScheduleLeadFollowUpBatchResult,
  ReplaceLeadProfileResult,
} from "../ports/LeadApiRuntime";
import { getLeadApiRuntime, leadRepository } from "../composition/leadApplicationServices";
import type { Lead } from "../../domain/model/lead.types";
import type { LeadCsvImportPlan } from "../import/leadCsvImport";
import { saveLead } from "./leadRepositoryCommands";

export async function createLeadFromFormViaApi(input: Partial<Lead>): Promise<CreateLeadResult> {
  const profile = toLeadProfileInput(input, false);
  const result = await getLeadApiRuntime().commands.createLead(profile, {
    idempotencyKey: createAttemptKey("lead:create"),
  });
  await projectAndInvalidate(result, "lead.create");
  return result;
}

export async function replaceLeadProfileFromFormViaApi(
  leadId: string,
  input: Partial<Lead>,
): Promise<ReplaceLeadProfileResult> {
  const current = leadRepository.getById(leadId);
  const expectedVersion = input.resourceVersion ?? current?.resourceVersion;
  if (expectedVersion === undefined) {
    throw new ApplicationError({
      code: "LEAD_PROFILE_VERSION_REQUIRED",
      message: "Lead profile replacement requires the authoritative resource version.",
      category: "CONFLICT",
      retryable: false,
      userMessage: "Không thể lưu Lead vì thiếu phiên bản dữ liệu. Hãy tải lại hồ sơ rồi thử lại.",
      details: { module: "leads", operationId: "replaceLeadProfile", leadId },
    });
  }
  const profile = toLeadProfileInput({ ...current, ...input, id: leadId, resourceVersion: expectedVersion }, true);
  const result = await getLeadApiRuntime().commands.replaceLeadProfile(leadId, profile, {
    idempotencyKey: createAttemptKey(`lead:replace-profile:${leadId}`),
    expectedVersion,
  });
  await projectAndInvalidate(result, "lead.update");
  return result;
}

export async function advanceLeadWorkStateViaApi(
  leadId: string,
  input: AdvanceLeadWorkStateInput,
): Promise<AdvanceLeadWorkStateResult> {
  const expectedVersion = requireLeadVersion(leadId, "advanceLeadWorkState");
  const result = await getLeadApiRuntime().commands.advanceLeadWorkState(leadId, input, {
    idempotencyKey: createAttemptKey(`lead:advance-work-state:${leadId}:${input.targetWorkState}`),
    expectedVersion,
  });
  await projectAndInvalidate(result, "lead.change-work-state");
  return result;
}

export async function disqualifyLeadViaApi(
  leadId: string,
  input: DisqualifyLeadInput,
): Promise<DisqualifyLeadResult> {
  const expectedVersion = requireLeadVersion(leadId, "disqualifyLead");
  const result = await getLeadApiRuntime().commands.disqualifyLead(leadId, input, {
    idempotencyKey: createAttemptKey(`lead:disqualify:${leadId}`),
    expectedVersion,
  });
  await projectAndInvalidate(result, "lead.disqualify");
  return result;
}

export async function reopenDisqualifiedLeadViaApi(leadId: string): Promise<ReopenDisqualifiedLeadResult> {
  const expectedVersion = requireLeadVersion(leadId, "reopenDisqualifiedLead");
  const result = await getLeadApiRuntime().commands.reopenDisqualifiedLead(leadId, {
    idempotencyKey: createAttemptKey(`lead:reopen:${leadId}`),
    expectedVersion,
  });
  await projectAndInvalidate(result, "lead.reopen");
  return result;
}


export async function replaceLeadViaTransformViaApi(
  leadId: string,
  transform: (lead: Lead) => Lead,
): Promise<ReplaceLeadProfileResult> {
  const current = leadRepository.getById(leadId);
  if (!current) throw profileViolation("leadId", `Lead ${leadId} was not found in the authoritative projection.`);
  return replaceLeadProfileFromFormViaApi(leadId, transform(structuredClone(current)));
}

export async function advanceLeadWorkStateBatchViaApi(
  leadIds: readonly string[],
  targetWorkState: "CONTACTING" | "VERIFYING",
): Promise<Lead[]> {
  const items = versionedLeadTargets(leadIds, "advanceLeadWorkStateBatch");
  const result: AdvanceLeadWorkStateBatchResult = await getLeadApiRuntime().commands.advanceLeadWorkStateBatch({ items, targetWorkState }, {
    idempotencyKey: createAttemptKey(`lead:advance-work-state-batch:${targetWorkState}:${items.map((item) => item.leadId).sort().join(",")}`),
  });
  await projectManyAndInvalidate(result.leads, result.evidence.occurredAt, "lead.change-work-state-batch", result.evidence.aggregateId);
  return result.leads;
}

export async function assignLeadOwnerBatchViaApi(
  leadIds: readonly string[],
  input: { ownerId: string; reason: string },
): Promise<AssignLeadOwnerBatchResult> {
  const items = versionedLeadTargets(leadIds, "assignLeadOwnerBatch");
  const result = await getLeadApiRuntime().commands.assignLeadOwnerBatch({ items, ownerId: input.ownerId, reason: input.reason }, {
    idempotencyKey: createAttemptKey(`lead:assign-owner-batch:${input.ownerId}:${items.map((item) => item.leadId).sort().join(",")}`),
  });
  await projectManyAndInvalidate(result.leads, result.evidence.occurredAt, "lead.assign-owner-batch", result.evidence.aggregateId);
  return result;
}

export async function disqualifyLeadBatchViaApi(
  leadIds: readonly string[],
  input: { reason: string; evidence: string },
): Promise<DisqualifyLeadBatchResult> {
  const items = versionedLeadTargets(leadIds, "disqualifyLeadBatch");
  const result = await getLeadApiRuntime().commands.disqualifyLeadBatch({ items, reason: input.reason, evidence: input.evidence }, {
    idempotencyKey: createAttemptKey(`lead:disqualify-batch:${items.map((item) => item.leadId).sort().join(",")}`),
  });
  await projectManyAndInvalidate(result.leads, result.evidence.occurredAt, "lead.disqualify-batch", result.evidence.aggregateId);
  return result;
}

export async function applyLeadTagBatchViaApi(
  leadIds: readonly string[],
  tag: string,
): Promise<ApplyLeadTagBatchResult> {
  const items = versionedLeadTargets(leadIds, "applyLeadTagBatch");
  const result = await getLeadApiRuntime().commands.applyLeadTagBatch({ items, tag }, {
    idempotencyKey: createAttemptKey(`lead:apply-tag-batch:${tag}:${items.map((item) => item.leadId).sort().join(",")}`),
  });
  await projectManyAndInvalidate(result.leads, result.evidence.occurredAt, "lead.apply-tag-batch", result.evidence.aggregateId);
  return result;
}

export async function scheduleLeadFollowUpBatchViaApi(
  leadIds: readonly string[],
  input: { followUpAt: string; note: string },
): Promise<ScheduleLeadFollowUpBatchResult> {
  const items = versionedLeadTargets(leadIds, "scheduleLeadFollowUpBatch");
  const result = await getLeadApiRuntime().commands.scheduleLeadFollowUpBatch({ items, followUpAt: input.followUpAt, note: input.note }, {
    idempotencyKey: createAttemptKey(`lead:schedule-follow-up-batch:${input.followUpAt}:${items.map((item) => item.leadId).sort().join(",")}`),
  });
  await projectManyAndInvalidate(result.leads, result.evidence.occurredAt, "lead.schedule-follow-up-batch", result.evidence.aggregateId);
  return result;
}

export async function claimLeadFromQueueViaApi(leadId: string, reason: string): Promise<ClaimLeadFromQueueResult> {
  const expectedVersion = requireLeadVersion(leadId, "claimLeadFromQueue");
  const result = await getLeadApiRuntime().commands.claimLeadFromQueue(leadId, { reason }, {
    idempotencyKey: createAttemptKey(`lead:claim-from-queue:${leadId}`),
    expectedVersion,
  });
  await projectAndInvalidate(result, "lead.claim-from-queue");
  return result;
}

export async function requestLeadExportViaApi(leadIds: readonly string[]): Promise<RequestLeadExportResult> {
  const normalized = uniqueLeadIds(leadIds);
  if (normalized.length === 0) throw profileViolation("leadIds", "Lead export requires at least one Lead ID.");
  return getLeadApiRuntime().commands.requestLeadExport({ leadIds: normalized, format: "CSV" }, {
    idempotencyKey: createAttemptKey(`lead:export:${normalized.slice().sort().join(",")}`),
  });
}

export async function assignLeadOwnerViaApi(
  leadId: string,
  input: { ownerId: string; reason: string },
): Promise<AssignLeadOwnerResult> {
  const expectedVersion = requireLeadVersion(leadId, "assignLeadOwner");
  const result = await getLeadApiRuntime().commands.assignLeadOwner(leadId, input, {
    idempotencyKey: createAttemptKey(`lead:assign-owner:${leadId}:${input.ownerId}`),
    expectedVersion,
  });
  await projectAndInvalidate(result, "lead.assign-owner");
  return result;
}

export async function handoverLeadWithTasksViaApi(
  leadId: string,
  input: {
    nextOwnerId: string;
    reason: string;
    taskTargets: readonly { taskId: string; expectedVersion: number }[];
    actorId: string;
    actorName?: string;
    leadName: string;
  },
): Promise<HandoverLeadWithTasksResult> {
  const expectedVersion = requireLeadVersion(leadId, "handoverLeadWithTasks");
  const runtime = getLeadApiRuntime();
  const result = await runtime.commands.handoverLeadWithTasks(leadId, {
    nextOwnerId: input.nextOwnerId,
    reason: input.reason,
    taskTargets: input.taskTargets,
  }, {
    idempotencyKey: createAttemptKey(`lead:handover:${leadId}:${input.nextOwnerId}`),
    expectedVersion,
  });
  runBackendProjection("leads", () => saveLead(leadRepository, result.lead));
  if (runtime.mode === "demo") {
    const now = result.evidence.occurredAt;
    for (const target of input.taskTargets) {
      reassignTaskSnapshot(target.taskId, { assigneeId: input.nextOwnerId, actorId: input.actorId, actorName: input.actorName, now });
    }
    createTaskSnapshot({
      id: result.handoverTaskId,
      title: `Take over Lead: ${input.leadName}`,
      description: input.reason,
      priority: "HIGH",
      assigneeId: input.nextOwnerId,
      dueAt: new Date(Date.parse(now) + 24 * 60 * 60 * 1000).toISOString(),
      recordRef: { moduleKey: "leads", recordId: leadId, label: input.leadName },
      sourceRef: { type: "LEAD_HANDOVER", id: leadId, evidence: input.reason },
      dedupeKey: `lead-handover:${leadId}:${input.nextOwnerId}:${now}`,
      actorId: input.actorId,
      actorName: input.actorName,
      now,
    });
  }
  await invalidateModuleQueries({ moduleKeys: ["leads", "tasks"], commandType: "lead.handover", aggregateId: leadId, occurredAt: result.evidence.occurredAt });
  return result;
}

export async function importLeadCsvPlanViaApi(
  plan: LeadCsvImportPlan,
  options: { defaultOwnerId?: string },
): Promise<ImportLeadBatchResult> {
  if (plan.version !== 1 || !plan.checksum || plan.invalidRowCount > 0 || plan.candidates.length !== plan.rows.length || plan.candidates.length === 0) {
    throw profileViolation("importPlan", "Lead CSV import plan must be complete and valid before calling the backend.");
  }
  const items = plan.candidates.map((candidate) => {
    const ownerId = (candidate.ownerId || options.defaultOwnerId || "").trim();
    if (!ownerId) throw profileViolation(`row:${candidate.rowNumber}:ownerId`, "Every imported Lead requires an owner.");
    return compact({
      displayName: candidate.name.trim(),
      phone: candidate.phone?.trim() || undefined,
      workPhone: candidate.workPhone?.trim() || undefined,
      email: candidate.email?.trim() || undefined,
      companyName: candidate.companyName?.trim() || undefined,
      title: candidate.title?.trim() || undefined,
      source: candidate.source?.trim() || "CSV Import",
      ownerId,
      painPoint: candidate.painPoint?.trim() || undefined,
      nextFollowUpAt: candidate.nextFollowUpAt?.trim() || undefined,
      preferredChannel: candidate.preferredChannel,
    });
  });
  const result = await getLeadApiRuntime().commands.importLeadBatch({ checksum: plan.checksum, items }, {
    idempotencyKey: `lead:import:${plan.checksum}`,
  });
  await projectManyAndInvalidate(result.leads, result.evidence.occurredAt, "lead.import-batch", result.evidence.aggregateId);
  return result;
}

export async function archiveLeadViaApi(leadId: string, reason: string): Promise<ArchiveLeadResult> {
  const expectedVersion = requireLeadVersion(leadId, "archiveLead");
  const result = await getLeadApiRuntime().commands.archiveLead(leadId, { reason }, {
    idempotencyKey: createAttemptKey(`lead:archive:${leadId}`),
    expectedVersion,
  });
  await projectAndInvalidate(result, "lead.archive");
  return result;
}

export async function archiveLeadsViaApi(leadIds: readonly string[], reason: string): Promise<ArchiveLeadBatchResult> {
  const items = uniqueLeadIds(leadIds).map((leadId) => ({ leadId, expectedVersion: requireLeadVersion(leadId, "archiveLeadBatch") }));
  const result = await getLeadApiRuntime().commands.archiveLeadBatch({ items, reason }, {
    idempotencyKey: createAttemptKey(`lead:archive-batch:${items.map((item) => item.leadId).sort().join(",")}`),
  });
  await projectManyAndInvalidate(result.leads, result.evidence.occurredAt, "lead.archive-many", result.evidence.aggregateId);
  return result;
}

export async function anonymizeLeadViaApi(leadId: string, reason: string): Promise<AnonymizeLeadResult> {
  const expectedVersion = requireLeadVersion(leadId, "anonymizeLead");
  const result = await getLeadApiRuntime().commands.anonymizeLead(leadId, { reason }, {
    idempotencyKey: createAttemptKey(`lead:anonymize:${leadId}`),
    expectedVersion,
  });
  await projectAndInvalidate(result, "lead.anonymize");
  return result;
}

export async function recordLeadConsentViaApi(
  leadId: string,
  input: RecordLeadConsentInput,
): Promise<RecordLeadConsentResult> {
  const expectedVersion = requireLeadVersion(leadId, "recordLeadConsent");
  const result = await getLeadApiRuntime().commands.recordLeadConsent(leadId, input, {
    idempotencyKey: createAttemptKey(`lead:consent:${leadId}:${input.channel}:${input.decision}`),
    expectedVersion,
  });
  await projectAndInvalidate(result, "lead.record-consent");
  return result;
}

export async function mergeLeadDuplicatesViaApi(input: {
  survivorLeadId: string;
  duplicateLeadIds: readonly string[];
  reason: string;
}): Promise<MergeLeadDuplicatesResult> {
  const survivor = { leadId: input.survivorLeadId, expectedVersion: requireLeadVersion(input.survivorLeadId, "mergeLeadDuplicates") };
  const duplicates = uniqueLeadIds(input.duplicateLeadIds).filter((leadId) => leadId !== input.survivorLeadId)
    .map((leadId) => ({ leadId, expectedVersion: requireLeadVersion(leadId, "mergeLeadDuplicates") }));
  const result = await getLeadApiRuntime().commands.mergeLeadDuplicates({ survivor, duplicates, reason: input.reason }, {
    idempotencyKey: createAttemptKey(`lead:merge-duplicates:${[survivor.leadId, ...duplicates.map((item) => item.leadId)].sort().join(",")}`),
  });
  await projectIdentityResolution(result, "lead.merge-duplicates");
  return result;
}

export async function confirmLeadDuplicatesDistinctViaApi(input: {
  leadId: string;
  candidateLeadIds: readonly string[];
  reason: string;
}): Promise<ConfirmLeadDuplicatesDistinctResult> {
  const primary = { leadId: input.leadId, expectedVersion: requireLeadVersion(input.leadId, "confirmLeadDuplicatesDistinct") };
  const candidates = uniqueLeadIds(input.candidateLeadIds).filter((leadId) => leadId !== input.leadId)
    .map((leadId) => ({ leadId, expectedVersion: requireLeadVersion(leadId, "confirmLeadDuplicatesDistinct") }));
  const result = await getLeadApiRuntime().commands.confirmLeadDuplicatesDistinct({ primary, candidates, reason: input.reason }, {
    idempotencyKey: createAttemptKey(`lead:confirm-distinct:${[primary.leadId, ...candidates.map((item) => item.leadId)].sort().join(",")}`),
  });
  await projectIdentityResolution(result, "lead.confirm-duplicates-distinct");
  return result;
}

/** Transitional entry point retained for internal callers during the migration. */
export async function saveLeadForRuntime(lead: Lead): Promise<Lead> {
  const existing = leadRepository.getById(lead.id);
  if (existing) return (await replaceLeadProfileFromFormViaApi(lead.id, lead)).lead;
  return (await createLeadFromFormViaApi(lead)).lead;
}

async function projectAndInvalidate(result: LeadMutationResult, commandType: string): Promise<void> {
  runBackendProjection("leads", () => saveLead(leadRepository, result.lead));
  await invalidateModuleQueries({
    moduleKeys: ["leads"],
    commandType,
    aggregateId: result.lead.id,
    occurredAt: result.evidence.occurredAt,
  });
}


async function projectIdentityResolution(result: LeadIdentityResolutionMutationResult, commandType: string): Promise<void> {
  await projectManyAndInvalidate(result.leads, result.evidence.occurredAt, commandType, result.primaryLeadId);
}

async function projectManyAndInvalidate(
  leads: readonly Lead[],
  occurredAt: string,
  commandType: string,
  aggregateId: string,
): Promise<void> {
  runBackendProjection("leads", () => {
    for (const lead of leads) saveLead(leadRepository, lead);
  });
  await invalidateModuleQueries({ moduleKeys: ["leads"], commandType, aggregateId, occurredAt });
}

function versionedLeadTargets(leadIds: readonly string[], operationId: string): Array<{ leadId: string; expectedVersion: number }> {
  return uniqueLeadIds(leadIds).map((leadId) => ({ leadId, expectedVersion: requireLeadVersion(leadId, operationId) }));
}

function uniqueLeadIds(values: readonly string[]): string[] {
  const normalized = values.map((value) => value.trim()).filter(Boolean);
  return [...new Set(normalized)];
}

function requireLeadVersion(leadId: string, operationId: string): number {
  const version = leadRepository.getById(leadId)?.resourceVersion;
  if (!Number.isInteger(version) || Number(version) < 1) {
    throw new ApplicationError({
      code: "LEAD_LIFECYCLE_VERSION_REQUIRED",
      message: `${operationId} requires the authoritative Lead resource version.`,
      category: "CONFLICT",
      retryable: false,
      userMessage: "Không thể cập nhật trạng thái Lead vì thiếu phiên bản dữ liệu. Hãy tải lại hồ sơ rồi thử lại.",
      details: { module: "leads", operationId, leadId },
    });
  }
  return Number(version);
}

function toLeadProfileInput(input: Partial<Lead>, requireOwner: false): LeadProfileInput;
function toLeadProfileInput(input: Partial<Lead>, requireOwner: true): LeadProfileInput & { ownerId: string };
function toLeadProfileInput(input: Partial<Lead>, requireOwner: boolean): LeadProfileInput {
  const displayName = input.name?.trim() ?? "";
  const source = input.source?.trim() || undefined;
  const ownerId = input.ownerId?.trim() || undefined;
  if (!displayName) throw profileViolation("displayName", "Lead form must provide a name before calling the API.");
  if (requireOwner && !ownerId) throw profileViolation("ownerId", "Lead profile replacement requires an owner.");
  if (!requireOwner && ![input.phone, input.workPhone, input.otherPhone, input.email, input.personalEmail, input.zaloId, input.facebook]
    .some((value) => value?.trim())) {
    throw profileViolation("contactChannel", "Lead form must provide at least one contact channel.");
  }
  const estimatedValue = input.estimatedValue;
  const preferredChannel = normalizePreferredChannel(input.preferredChannel);
  return compact({
    displayName,
    salutation: input.salutation,
    title: input.title,
    department: input.department,
    phone: input.phone,
    workPhone: input.workPhone,
    otherPhone: input.otherPhone,
    email: input.email,
    personalEmail: input.personalEmail,
    zaloId: input.zaloId,
    facebook: input.facebook,
    preferredChannel,
    doNotCall: input.doNotCall,
    doNotEmail: input.doNotEmail,
    companyName: input.companyName,
    companySize: input.companySize,
    industry: input.industry,
    businessType: input.businessType,
    website: input.website,
    taxCode: input.taxCode,
    companyAddress: input.companyAddress,
    country: input.country,
    province: input.province,
    district: input.district,
    ward: input.ward,
    contactAddress: input.contactAddress ?? input.address,
    source,
    campaignId: input.campaignId,
    ownerId,
    assignedTeam: input.assignedTeam,
    decisionRole: input.decisionRole,
    priority: input.priority,
    interestedProducts: input.interestedProducts?.map((item) => compact({
      productId: item.productId,
      interestLevel: item.interestLevel,
      estimatedQuantity: item.estimatedQuantity,
      expectedBudget: item.expectedBudgetMoney
        ?? (item.expectedBudget === undefined || estimatedValue === undefined
          ? undefined
          : money(String(item.expectedBudget), estimatedValue.currency)),
      note: item.note,
    })),
    estimatedValue,
    budgetRange: input.budgetRange,
    purchaseTimeline: input.purchaseTimeline,
    painPoint: input.painPoint,
    nextFollowUpAt: input.nextFollowUpAt,
    followUpNote: input.followUpNote,
    tags: input.tags,
    description: input.description,
    internalNotes: input.internalNotes,
    customFields: input.customFields,
  });
}

function normalizePreferredChannel(value: string | undefined): LeadProfileInput["preferredChannel"] {
  if (value === undefined || value === "") return undefined;
  if (["phone", "email", "zalo", "facebook", "other"].includes(value)) {
    return value as LeadProfileInput["preferredChannel"];
  }
  throw profileViolation("preferredChannel", `Unsupported Lead preferred channel: ${value}`);
}

function createAttemptKey(scope: string): string {
  const randomId = globalThis.crypto?.randomUUID?.();
  if (randomId) return `${scope}:${randomId}`;
  return `${scope}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

function profileViolation(field: string, message: string): ApplicationError {
  return new ApplicationError({
    code: "LEAD_PROFILE_CONTRACT_VIOLATION",
    message,
    category: "VALIDATION",
    retryable: false,
    userMessage: "Dữ liệu Lead chưa đáp ứng hợp đồng API. Hãy kiểm tra các trường bắt buộc.",
    details: { module: "leads", field, authority: "docs/api/openapi.json" },
  });
}
