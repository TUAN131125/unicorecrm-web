import type { AuthoritativePage } from "@/shared/application";
import { moneyToDisplayNumber } from "@/shared/money";
import type {
  AdvanceLeadWorkStateBatchInput,
  AdvanceLeadWorkStateBatchResult,
  AdvanceLeadWorkStateInput,
  AdvanceLeadWorkStateResult,
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
  CreateLeadInput,
  CreateLeadResult,
  DisqualifyLeadBatchInput,
  DisqualifyLeadBatchResult,
  DisqualifyLeadInput,
  DisqualifyLeadResult,
  ConfirmLeadDuplicatesDistinctInput,
  ConfirmLeadDuplicatesDistinctResult,
  HandoverLeadWithTasksInput,
  HandoverLeadWithTasksResult,
  ImportLeadBatchInput,
  ImportLeadBatchResult,
  LeadApiRuntime,
  LeadCommandOptions,
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
  LeadListQuery,
  LeadProfileInput,
  ReplaceLeadProfileOptions,
  ReplaceLeadProfileResult,
} from "../application/ports/LeadApiRuntime";
import type { LeadRepository } from "../application/ports/LeadRepository";
import type { Lead } from "../domain/model/lead.types";
import { LeadWorkState } from "../domain/model/leadLifecycle.canonical";
import { changeLeadWorkState, disqualifyLead, reopenLead, startLeadVerification } from "../application/commands/leadCommands";
import { anonymizeLead, archiveLead, archiveLeads } from "../application/commands/leadRepositoryCommands";
import { confirmLeadDuplicatesDistinct, mergeLeadDuplicates, recordLeadConsent } from "../application/commands/leadIdentityCommands";

export function createLeadDemoApiRuntime(repository: LeadRepository): LeadApiRuntime {
  return {
    mode: "demo",
    queries: {
      async list(_query: LeadListQuery = {}): Promise<AuthoritativePage<Lead>> {
        const items = repository.list().filter((lead) => !lead.archivedAt).map((lead) => structuredClone(lead));
        return {
          items,
          pageInfo: { hasNextPage: false, totalCount: items.length },
          loadedAt: new Date().toISOString(),
          authority: "demo",
        };
      },
      async get(leadId: string): Promise<Lead> {
        const lead = repository.getById(leadId);
        if (!lead) throw new Error(`LEAD_NOT_FOUND:${leadId}`);
        return structuredClone(lead);
      },
    },
    commands: {
      async createLead(input: CreateLeadInput, options: LeadCommandOptions): Promise<CreateLeadResult> {
        const now = new Date().toISOString();
        const id = `lead_demo_${Date.now()}`;
        const ownerId = input.ownerId?.trim();
        if (!ownerId) throw new Error("LEAD_DEMO_OWNER_CONTEXT_REQUIRED");
        const lead: Lead = applyProfile({
          id,
          name: input.displayName,
          title: "",
          companyName: "",
          email: "",
          phone: "",
          source: input.source ?? "",
          score: 0,
          leadWorkState: LeadWorkState.NEW,
          ownerId,
          interestedProducts: [],
          createdAt: now,
          updatedAt: now,
          resourceVersion: 1,
          activities: [],
          activitiesAuthority: "LOCAL_COMPLETE",
        }, input, now);
        repository.replace([lead, ...repository.list().filter((candidate) => candidate.id !== lead.id)]);
        const saved = repository.getById(lead.id) ?? lead;
        return mutationResult(saved, options, now, "demo");
      },
      async replaceLeadProfile(leadId: string, input: LeadProfileInput, options: ReplaceLeadProfileOptions): Promise<ReplaceLeadProfileResult> {
        const current = repository.getById(leadId);
        if (!current) throw new Error(`LEAD_NOT_FOUND:${leadId}`);
        if (String(current.resourceVersion ?? 1) !== String(options.expectedVersion)) throw new Error(`LEAD_VERSION_CONFLICT:${leadId}`);
        const now = new Date().toISOString();
        const updated = applyProfile({ ...current, resourceVersion: (current.resourceVersion ?? 1) + 1, updatedAt: now }, input, now);
        repository.replace([updated, ...repository.list().filter((candidate) => candidate.id !== leadId)]);
        return mutationResult(repository.getById(leadId) ?? updated, options, now, "demo");
      },
      async advanceLeadWorkState(leadId: string, input: AdvanceLeadWorkStateInput, options: LeadVersionedCommandOptions): Promise<AdvanceLeadWorkStateResult> {
        assertVersion(repository, leadId, options.expectedVersion);
        const updated = input.targetWorkState === LeadWorkState.VERIFYING
          ? startLeadVerification(repository, leadId, input.verificationProfile)
          : changeLeadWorkState(repository, leadId, input.targetWorkState);
        if (!updated) throw new Error(`LEAD_NOT_FOUND:${leadId}`);
        const now = new Date().toISOString();
        const versioned = { ...updated, resourceVersion: (updated.resourceVersion ?? options.expectedVersion) + 1, updatedAt: now };
        repository.replace([versioned, ...repository.list().filter((candidate) => candidate.id !== leadId)]);
        return mutationResult(versioned, options, now, "demo");
      },
      async disqualifyLead(leadId: string, input: DisqualifyLeadInput, options: LeadVersionedCommandOptions): Promise<DisqualifyLeadResult> {
        assertVersion(repository, leadId, options.expectedVersion);
        const updated = disqualifyLead(repository, leadId, { reason: input.reason, evidence: input.evidence });
        if (!updated) throw new Error(`LEAD_NOT_FOUND:${leadId}`);
        const now = new Date().toISOString();
        const versioned = { ...updated, resourceVersion: (updated.resourceVersion ?? options.expectedVersion) + 1, updatedAt: now };
        repository.replace([versioned, ...repository.list().filter((candidate) => candidate.id !== leadId)]);
        return mutationResult(versioned, options, now, "demo");
      },
      async reopenDisqualifiedLead(leadId: string, options: LeadVersionedCommandOptions): Promise<ReopenDisqualifiedLeadResult> {
        assertVersion(repository, leadId, options.expectedVersion);
        const updated = reopenLead(repository, leadId);
        if (!updated) throw new Error(`LEAD_NOT_FOUND:${leadId}`);
        const now = new Date().toISOString();
        const versioned = { ...updated, resourceVersion: (updated.resourceVersion ?? options.expectedVersion) + 1, updatedAt: now };
        repository.replace([versioned, ...repository.list().filter((candidate) => candidate.id !== leadId)]);
        return mutationResult(versioned, options, now, "demo");
      },
      async archiveLead(leadId: string, input: ArchiveLeadInput, options: LeadVersionedCommandOptions): Promise<ArchiveLeadResult> {
        assertVersion(repository, leadId, options.expectedVersion);
        const now = new Date().toISOString();
        const updated = archiveLead(repository, leadId, { reason: input.reason, actorId: "demo-actor", now });
        const versioned = bumpLeadVersion(updated, options.expectedVersion, now);
        replaceProjectedLeads(repository, [versioned]);
        return mutationResult(versioned, options, now, "demo");
      },
      async assignLeadOwner(leadId: string, input: AssignLeadOwnerInput, options: LeadVersionedCommandOptions): Promise<AssignLeadOwnerResult> {
        assertVersion(repository, leadId, options.expectedVersion);
        const current = repository.getById(leadId);
        if (!current) throw new Error(`LEAD_NOT_FOUND:${leadId}`);
        const ownerId = input.ownerId.trim();
        if (!ownerId || !input.reason.trim()) throw new Error("LEAD_ASSIGNMENT_INPUT_REQUIRED");
        const now = new Date().toISOString();
        const updated = { ...current, ownerId, resourceVersion: options.expectedVersion + 1, updatedAt: now };
        replaceProjectedLeads(repository, [updated]);
        return mutationResult(updated, options, now, "demo");
      },
      async importLeadBatch(input: ImportLeadBatchInput, options: LeadCommandOptions): Promise<ImportLeadBatchResult> {
        if (!input.checksum.trim() || input.items.length === 0) throw new Error("LEAD_IMPORT_INVALID");
        const now = new Date().toISOString();
        const existing = repository.list();
        const created: Lead[] = input.items.map((profile, index) => ({
          id: `lead_import_${Date.now()}_${index + 1}`,
          name: profile.displayName,
          title: profile.title ?? "",
          companyName: profile.companyName ?? "",
          email: profile.email ?? "",
          phone: profile.phone ?? "",
          workPhone: profile.workPhone,
          source: profile.source,
          score: 0,
          leadWorkState: LeadWorkState.NEW,
          ownerId: profile.ownerId,
          interestedProducts: [],
          painPoint: profile.painPoint,
          nextFollowUpAt: profile.nextFollowUpAt,
          preferredChannel: profile.preferredChannel,
          createdAt: now,
          updatedAt: now,
          resourceVersion: 1,
          activities: [],
          activitiesAuthority: "LOCAL_COMPLETE",
        }));
        repository.replace([...created, ...existing]);
        const evidence = mutationResult(created[0]!, options, now, "demo").evidence;
        return { checksum: input.checksum, importedCount: created.length, leads: structuredClone(created), evidence };
      },
      async handoverLeadWithTasks(leadId: string, input: HandoverLeadWithTasksInput, options: LeadVersionedCommandOptions): Promise<HandoverLeadWithTasksResult> {
        assertVersion(repository, leadId, options.expectedVersion);
        const current = repository.getById(leadId);
        if (!current) throw new Error(`LEAD_NOT_FOUND:${leadId}`);
        if (!input.nextOwnerId.trim() || !input.reason.trim()) throw new Error("LEAD_HANDOVER_INPUT_REQUIRED");
        const now = new Date().toISOString();
        const updated = { ...current, ownerId: input.nextOwnerId.trim(), resourceVersion: options.expectedVersion + 1, updatedAt: now };
        replaceProjectedLeads(repository, [updated]);
        return {
          lead: structuredClone(updated),
          reassignedTaskIds: input.taskTargets.map((target) => target.taskId),
          handoverTaskId: `task_lead_handover_${leadId}_${Date.now()}`,
          evidence: mutationResult(updated, options, now, "demo").evidence,
        };
      },
      async archiveLeadBatch(input: ArchiveLeadBatchInput, options: LeadCommandOptions): Promise<ArchiveLeadBatchResult> {
        input.items.forEach((item) => assertVersion(repository, item.leadId, item.expectedVersion));
        const now = new Date().toISOString();
        const archived = archiveLeads(repository, input.items.map((item) => item.leadId), { reason: input.reason, actorId: "demo-actor", now });
        const expected = new Map(input.items.map((item) => [item.leadId, item.expectedVersion]));
        const versioned = archived.map((lead) => bumpLeadVersion(lead, expected.get(lead.id) ?? 1, now));
        replaceProjectedLeads(repository, versioned);
        return { leads: structuredClone(versioned), evidence: mutationResult(versioned[0]!, options, now, "demo").evidence };
      },
      async advanceLeadWorkStateBatch(input: AdvanceLeadWorkStateBatchInput, options: LeadCommandOptions): Promise<AdvanceLeadWorkStateBatchResult> {
        return withRepositoryRollback(repository, () => {
          input.items.forEach((item) => assertVersion(repository, item.leadId, item.expectedVersion));
          const now = new Date().toISOString();
          const leads = input.items.map((item) => {
            const updated = input.targetWorkState === LeadWorkState.VERIFYING
              ? startLeadVerification(repository, item.leadId)
              : changeLeadWorkState(repository, item.leadId, input.targetWorkState);
            if (!updated) throw new Error(`LEAD_NOT_FOUND:${item.leadId}`);
            const versioned = bumpLeadVersion(updated, item.expectedVersion, now);
            replaceProjectedLeads(repository, [versioned]);
            return versioned;
          });
          return { leads: structuredClone(leads), evidence: batchEvidence(leads, options, now, "lead-work-state-batch") };
        });
      },
      async assignLeadOwnerBatch(input: AssignLeadOwnerBatchInput, options: LeadCommandOptions): Promise<AssignLeadOwnerBatchResult> {
        return withRepositoryRollback(repository, () => {
          input.items.forEach((item) => assertVersion(repository, item.leadId, item.expectedVersion));
          if (!input.ownerId.trim() || !input.reason.trim()) throw new Error("LEAD_BATCH_ASSIGNMENT_INPUT_REQUIRED");
          const now = new Date().toISOString();
          const leads = input.items.map((item) => {
            const current = repository.getById(item.leadId);
            if (!current) throw new Error(`LEAD_NOT_FOUND:${item.leadId}`);
            return { ...current, ownerId: input.ownerId.trim(), resourceVersion: item.expectedVersion + 1, updatedAt: now };
          });
          replaceProjectedLeads(repository, leads);
          return { leads: structuredClone(leads), evidence: batchEvidence(leads, options, now, "lead-owner-batch") };
        });
      },
      async disqualifyLeadBatch(input: DisqualifyLeadBatchInput, options: LeadCommandOptions): Promise<DisqualifyLeadBatchResult> {
        return withRepositoryRollback(repository, () => {
          input.items.forEach((item) => assertVersion(repository, item.leadId, item.expectedVersion));
          if (!input.reason.trim() || !input.evidence.trim()) throw new Error("LEAD_BATCH_DISQUALIFICATION_INPUT_REQUIRED");
          const now = new Date().toISOString();
          const leads = input.items.map((item) => {
            const updated = disqualifyLead(repository, item.leadId, { reason: input.reason, evidence: input.evidence });
            if (!updated) throw new Error(`LEAD_NOT_FOUND:${item.leadId}`);
            const versioned = bumpLeadVersion(updated, item.expectedVersion, now);
            replaceProjectedLeads(repository, [versioned]);
            return versioned;
          });
          return { leads: structuredClone(leads), evidence: batchEvidence(leads, options, now, "lead-disqualify-batch") };
        });
      },
      async applyLeadTagBatch(input: ApplyLeadTagBatchInput, options: LeadCommandOptions): Promise<ApplyLeadTagBatchResult> {
        return withRepositoryRollback(repository, () => {
          input.items.forEach((item) => assertVersion(repository, item.leadId, item.expectedVersion));
          const tag = input.tag.trim();
          if (!tag) throw new Error("LEAD_TAG_REQUIRED");
          const now = new Date().toISOString();
          const leads = input.items.map((item) => {
            const current = repository.getById(item.leadId);
            if (!current) throw new Error(`LEAD_NOT_FOUND:${item.leadId}`);
            return { ...current, tags: [...new Set([...(current.tags ?? []), tag])], resourceVersion: item.expectedVersion + 1, updatedAt: now };
          });
          replaceProjectedLeads(repository, leads);
          return { leads: structuredClone(leads), evidence: batchEvidence(leads, options, now, "lead-tag-batch") };
        });
      },
      async scheduleLeadFollowUpBatch(input: ScheduleLeadFollowUpBatchInput, options: LeadCommandOptions): Promise<ScheduleLeadFollowUpBatchResult> {
        return withRepositoryRollback(repository, () => {
          input.items.forEach((item) => assertVersion(repository, item.leadId, item.expectedVersion));
          if (!input.note.trim() || !Number.isFinite(Date.parse(input.followUpAt))) throw new Error("LEAD_FOLLOW_UP_INPUT_REQUIRED");
          const now = new Date().toISOString();
          const leads = input.items.map((item) => {
            const current = repository.getById(item.leadId);
            if (!current) throw new Error(`LEAD_NOT_FOUND:${item.leadId}`);
            const leadWorkState = current.leadWorkState === LeadWorkState.NEW ? LeadWorkState.CONTACTING : current.leadWorkState;
            return {
              ...current,
              leadWorkState,
              nextFollowUpAt: input.followUpAt,
              followUpNote: input.note,
              lastInteractionAt: now,
              resourceVersion: item.expectedVersion + 1,
              updatedAt: now,
            };
          });
          replaceProjectedLeads(repository, leads);
          return { leads: structuredClone(leads), evidence: batchEvidence(leads, options, now, "lead-follow-up-batch") };
        });
      },
      async claimLeadFromQueue(leadId: string, input: ClaimLeadFromQueueInput, options: LeadVersionedCommandOptions): Promise<ClaimLeadFromQueueResult> {
        assertVersion(repository, leadId, options.expectedVersion);
        if (!input.reason.trim()) throw new Error("LEAD_QUEUE_CLAIM_REASON_REQUIRED");
        const current = repository.getById(leadId);
        if (!current) throw new Error(`LEAD_NOT_FOUND:${leadId}`);
        const now = new Date().toISOString();
        const updated = {
          ...current,
          ownerId: "demo-actor",
          leadWorkState: current.leadWorkState === LeadWorkState.NEW ? LeadWorkState.CONTACTING : current.leadWorkState,
          resourceVersion: options.expectedVersion + 1,
          updatedAt: now,
        };
        replaceProjectedLeads(repository, [updated]);
        return mutationResult(updated, options, now, "demo");
      },
      async requestLeadExport(input: RequestLeadExportInput, options: LeadCommandOptions): Promise<RequestLeadExportResult> {
        const requested = new Set(input.leadIds);
        const leads = repository.list().filter((lead) => requested.has(lead.id));
        if (leads.length !== requested.size) throw new Error("LEAD_EXPORT_SCOPE_DENIED");
        const now = new Date().toISOString();
        const exportId = `lead_export_${Date.now()}`;
        const csv = ["id,name,email,phone,companyName,source,ownerId", ...leads.map((lead) => [lead.id, lead.name, lead.email, lead.phone, lead.companyName, lead.source, lead.ownerId].map(csvCell).join(","))].join("\n");
        return {
          artifact: {
            exportId,
            fileName: `${exportId}.csv`,
            mediaType: "text/csv",
            downloadUrl: `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`,
            expiresAt: new Date(Date.parse(now) + 5 * 60 * 1000).toISOString(),
            exportedCount: leads.length,
          },
          evidence: batchEvidence(leads, options, now, exportId),
        };
      },
      async anonymizeLead(leadId: string, input: ArchiveLeadInput, options: LeadVersionedCommandOptions): Promise<AnonymizeLeadResult> {
        assertVersion(repository, leadId, options.expectedVersion);
        const now = new Date().toISOString();
        const updated = anonymizeLead(repository, leadId, { reason: input.reason, actorId: "demo-actor", now });
        const versioned = bumpLeadVersion(updated, options.expectedVersion, now);
        replaceProjectedLeads(repository, [versioned]);
        return mutationResult(versioned, options, now, "demo");
      },
      async recordLeadConsent(leadId: string, input: RecordLeadConsentInput, options: LeadVersionedCommandOptions): Promise<RecordLeadConsentResult> {
        assertVersion(repository, leadId, options.expectedVersion);
        const now = new Date().toISOString();
        const updated = recordLeadConsent(repository, leadId, { ...input, actorId: "demo-actor", occurredAt: now });
        const versioned = bumpLeadVersion(updated, options.expectedVersion, now);
        replaceProjectedLeads(repository, [versioned]);
        return mutationResult(versioned, options, now, "demo");
      },
      async mergeLeadDuplicates(input: MergeLeadDuplicatesInput, options: LeadCommandOptions): Promise<MergeLeadDuplicatesResult> {
        assertVersion(repository, input.survivor.leadId, input.survivor.expectedVersion);
        input.duplicates.forEach((item) => assertVersion(repository, item.leadId, item.expectedVersion));
        const now = new Date().toISOString();
        const updated = mergeLeadDuplicates(repository, {
          survivorLeadId: input.survivor.leadId,
          duplicateLeadIds: input.duplicates.map((item) => item.leadId),
          reason: input.reason,
          actorId: "demo-actor",
          occurredAt: now,
        });
        const expected = new Map([input.survivor, ...input.duplicates].map((item) => [item.leadId, item.expectedVersion]));
        const versioned = updated.map((lead) => bumpLeadVersion(lead, expected.get(lead.id) ?? 1, now));
        replaceProjectedLeads(repository, versioned);
        const primary = versioned.find((lead) => lead.id === input.survivor.leadId)!;
        return { primaryLeadId: primary.id, leads: structuredClone(versioned), evidence: mutationResult(primary, options, now, "demo").evidence };
      },
      async confirmLeadDuplicatesDistinct(input: ConfirmLeadDuplicatesDistinctInput, options: LeadCommandOptions): Promise<ConfirmLeadDuplicatesDistinctResult> {
        assertVersion(repository, input.primary.leadId, input.primary.expectedVersion);
        input.candidates.forEach((item) => assertVersion(repository, item.leadId, item.expectedVersion));
        const now = new Date().toISOString();
        const updated = confirmLeadDuplicatesDistinct(repository, {
          leadId: input.primary.leadId,
          candidateLeadIds: input.candidates.map((item) => item.leadId),
          reason: input.reason,
          actorId: "demo-actor",
          occurredAt: now,
        });
        const expected = new Map([input.primary, ...input.candidates].map((item) => [item.leadId, item.expectedVersion]));
        const versioned = updated.map((lead) => bumpLeadVersion(lead, expected.get(lead.id) ?? 1, now));
        replaceProjectedLeads(repository, versioned);
        const primary = versioned.find((lead) => lead.id === input.primary.leadId)!;
        return { primaryLeadId: primary.id, leads: structuredClone(versioned), evidence: mutationResult(primary, options, now, "demo").evidence };
      },
    },
  };
}

function applyProfile(base: Lead, input: LeadProfileInput, now: string): Lead {
  return {
    ...base,
    name: input.displayName,
    salutation: input.salutation,
    title: input.title ?? "",
    department: input.department,
    phone: input.phone ?? "",
    workPhone: input.workPhone,
    otherPhone: input.otherPhone,
    email: input.email ?? "",
    personalEmail: input.personalEmail,
    zaloId: input.zaloId,
    facebook: input.facebook,
    preferredChannel: input.preferredChannel,
    doNotCall: input.doNotCall,
    doNotEmail: input.doNotEmail,
    companyName: input.companyName ?? "",
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
    contactAddress: input.contactAddress,
    address: input.contactAddress,
    source: input.source ?? "",
    campaignId: input.campaignId,
    ownerId: input.ownerId ?? base.ownerId,
    assignedTeam: input.assignedTeam,
    decisionRole: input.decisionRole,
    priority: input.priority,
    interestedProducts: (input.interestedProducts ?? []).map((item, index) => ({
      id: `${base.id}:interest:${index + 1}`,
      productId: item.productId,
      productNameSnapshot: item.productId,
      interestLevel: item.interestLevel,
      estimatedQuantity: item.estimatedQuantity,
      expectedBudget: item.expectedBudget === undefined ? undefined : moneyToDisplayNumber(item.expectedBudget),
      expectedBudgetMoney: item.expectedBudget,
      note: item.note,
      createdAt: now,
    })),
    expectedValue: input.estimatedValue === undefined ? undefined : moneyToDisplayNumber(input.estimatedValue),
    estimatedValue: input.estimatedValue,
    budgetRange: input.budgetRange,
    purchaseTimeline: input.purchaseTimeline,
    painPoint: input.painPoint,
    nextFollowUpAt: input.nextFollowUpAt,
    followUpNote: input.followUpNote,
    tags: input.tags === undefined ? undefined : [...input.tags],
    description: input.description,
    internalNotes: input.internalNotes,
    customFields: input.customFields === undefined ? undefined : Object.fromEntries(Object.entries(input.customFields).map(([key, value]) => [key, Array.isArray(value) ? [...(value as readonly string[])] : value])) as Record<string, string | number | boolean | string[]>,
  };
}

function mutationResult(
  lead: Lead,
  options: LeadCommandOptions,
  now: string,
  authority: "demo" | "test",
): CreateLeadResult {
  return {
    lead: structuredClone(lead),
    evidence: {
      authority,
      commandId: `${authority}:${options.idempotencyKey}`,
      correlationId: options.correlationId ?? `${authority}:${options.idempotencyKey}`,
      aggregateId: lead.id,
      aggregateType: "lead",
      version: lead.resourceVersion ?? 1,
      occurredAt: now,
      outcome: "COMMITTED",
      warnings: [],
      emittedEventIds: [],
      auditEvidenceIds: [],
    },
  };
}

function batchEvidence(leads: readonly Lead[], options: LeadCommandOptions, now: string, aggregateId: string) {
  const maxVersion = leads.reduce((max, lead) => Math.max(max, Number(lead.resourceVersion ?? 1)), 1);
  return {
    authority: "demo" as const,
    commandId: `demo:${options.idempotencyKey}`,
    correlationId: options.correlationId ?? `demo:${options.idempotencyKey}`,
    aggregateId,
    aggregateType: "lead-batch",
    version: maxVersion,
    occurredAt: now,
    outcome: "COMMITTED" as const,
    warnings: [],
    emittedEventIds: [],
    auditEvidenceIds: [],
  };
}

function withRepositoryRollback<T>(repository: LeadRepository, action: () => T): T {
  const before = repository.list();
  try {
    return action();
  } catch (error) {
    repository.replace(before);
    throw error;
  }
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function assertVersion(repository: LeadRepository, leadId: string, expectedVersion: number): void {
  const current = repository.getById(leadId);
  if (!current) throw new Error(`LEAD_NOT_FOUND:${leadId}`);
  if (String(current.resourceVersion ?? 1) !== String(expectedVersion)) throw new Error(`LEAD_VERSION_CONFLICT:${leadId}`);
}

function bumpLeadVersion(lead: Lead, expectedVersion: number, now: string): Lead {
  return { ...lead, resourceVersion: expectedVersion + 1, updatedAt: now };
}

function replaceProjectedLeads(repository: LeadRepository, leads: readonly Lead[]): void {
  const incoming = new Map(leads.map((lead) => [lead.id, structuredClone(lead)]));
  repository.replace(repository.list().map((lead) => incoming.get(lead.id) ?? lead));
}
