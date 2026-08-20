import type { LeadRepository } from "../ports/LeadRepository";
import type { Lead } from "../../domain/model/lead.types";
import { LeadWorkState } from "../../domain/model/leadLifecycle.canonical";
import { assertLeadLifecycleFieldsUnchanged, assertLeadProgressiveProfileForState, transitionLeadWorkState } from "../../domain/rules/leadLifecycle";
import { CAPABILITIES, assertRuntimeCommandAccess, assertRuntimeCapability } from "@/platform/access-control";
import { appendRecordOwnershipAudit, enforceCreateOwner, getRecordOwnershipContext } from "@/platform/record-ownership";
import { assertValidLeadContactData } from "../../domain/rules/leadContactData";
import { getLeadProgressiveProfilePolicy } from "../policies/leadProgressiveProfilePolicyRuntime";
import { anonymizedRecordLabel, assertDestructiveActionAllowed, redactEmailForRetention } from "@/shared/application";

export type LeadCollectionUpdater = Lead[] | ((current: Lead[]) => Lead[]);

export function updateLeadCollection(
  repository: LeadRepository,
  updater: LeadCollectionUpdater,
): Lead[] {
  assertRuntimeCapability(CAPABILITIES.LEADS_UPDATE);
  const current = repository.list();
  const next = typeof updater === "function" ? updater(current) : updater;
  const ownership = getRecordOwnershipContext("leads", CAPABILITIES.LEADS_ASSIGN);
  next.forEach(assertValidLeadContactData);
  const currentById = new Map(current.map((lead) => [lead.id, lead]));
  next.forEach((lead) => {
    const previous = currentById.get(lead.id);
    if (!previous) {
      if (ownership) throw new Error("Authenticated Lead creation must use saveLead so ownership is enforced.");
      return;
    }
    assertLeadLifecycleFieldsUnchanged(previous, lead);
    if (ownership && previous.ownerId !== lead.ownerId) {
      throw new Error("Lead ownership changes must use reassignLead with an explicit reason.");
    }
  });
  repository.replace(next);
  return next;
}

export function saveLead(repository: LeadRepository, lead: Lead): Lead {
  assertValidLeadContactData(lead);
  const current = repository.list();
  const previous = current.find((item) => item.id === lead.id);
  assertRuntimeCommandAccess(previous ? CAPABILITIES.LEADS_UPDATE : CAPABILITIES.LEADS_CREATE, "leads", previous);
  if (previous) assertLeadLifecycleFieldsUnchanged(previous, lead);
  if (!previous && lead.leadWorkState !== LeadWorkState.NEW) {
    throw new Error("New Leads must be created in the NEW work state.");
  }
  if (previous && getRecordOwnershipContext("leads", CAPABILITIES.LEADS_ASSIGN) && previous.ownerId !== lead.ownerId) {
    throw new Error("Lead ownership changes must use reassignLead with an explicit reason.");
  }
  const assignment = previous
    ? { ownerId: previous.ownerId, context: null }
    : enforceCreateOwner("leads", CAPABILITIES.LEADS_ASSIGN, lead.ownerId);
  const normalized = { ...structuredClone(lead), ownerId: assignment.ownerId };
  if (!previous) assertLeadProgressiveProfileForState(normalized, LeadWorkState.NEW, getLeadProgressiveProfilePolicy());
  const exists = Boolean(previous);
  repository.replace(
    exists
      ? current.map((item) => item.id === lead.id ? normalized : item)
      : [normalized, ...current],
  );
  if (!previous) {
    appendRecordOwnershipAudit({
      resourceKey: "leads",
      recordId: normalized.id,
      action: "CREATED",
      nextOwnerId: normalized.ownerId,
      reason: "Owner assigned when the Lead was created.",
    }, assignment.context);
  }
  return structuredClone(normalized);
}

export function updateLead(
  repository: LeadRepository,
  leadId: string,
  transform: (lead: Lead) => Lead,
): Lead | undefined {
  let updated: Lead | undefined;
  repository.replace(repository.list().map((lead) => {
    if (lead.id !== leadId) return lead;
    assertRuntimeCommandAccess(CAPABILITIES.LEADS_UPDATE, "leads", lead);
    const nextLead = transform(structuredClone(lead));
    assertValidLeadContactData(nextLead);
    assertLeadLifecycleFieldsUnchanged(lead, nextLead);
    if (getRecordOwnershipContext("leads", CAPABILITIES.LEADS_ASSIGN) && nextLead.ownerId !== lead.ownerId) {
      throw new Error("Lead ownership changes must use reassignLead with an explicit reason.");
    }
    updated = nextLead;
    return nextLead;
  }));
  return updated ? structuredClone(updated) : undefined;
}

export function updateManyLeads(
  repository: LeadRepository,
  leadIds: readonly string[],
  transform: (lead: Lead) => Lead,
): number {
  assertRuntimeCapability(CAPABILITIES.LEADS_BULK);
  const ids = new Set(leadIds);
  const current = repository.list();
  const targets = current.filter((lead) => ids.has(lead.id));

  // Authorize the complete batch before running any caller-provided transform.
  targets.forEach((lead) => {
    assertRuntimeCommandAccess(CAPABILITIES.LEADS_BULK, "leads", lead);
  });

  let updatedCount = 0;
  const next = current.map((lead) => {
    if (!ids.has(lead.id)) return lead;
    updatedCount += 1;
    const updated = transform(structuredClone(lead));
    assertValidLeadContactData(updated);
    assertLeadLifecycleFieldsUnchanged(lead, updated);
    if (getRecordOwnershipContext("leads", CAPABILITIES.LEADS_ASSIGN) && updated.ownerId !== lead.ownerId) {
      throw new Error("Lead ownership changes must use reassignLead with an explicit reason.");
    }
    return updated;
  });
  repository.replace(next);
  return updatedCount;
}

export interface LeadRetentionCommandInput {
  reason: string;
  actorId: string;
  actorName?: string;
  now?: string;
}

function retentionActivity(input: LeadRetentionCommandInput, title: string, description: string): import("@/shared/domain").CRMActivity {
  return {
    id: `lead-retention-${crypto.randomUUID()}`,
    icon: "Archive",
    title,
    description,
    createdAt: input.now ?? new Date().toISOString(),
    author: input.actorName || input.actorId,
    type: "system",
  };
}

export function archiveLead(repository: LeadRepository, leadId: string, input: LeadRetentionCommandInput): Lead {
  const target = repository.getById(leadId);
  if (!target) throw new Error(`Lead ${leadId} not found.`);
  assertRuntimeCommandAccess(CAPABILITIES.LEADS_DELETE, "leads", target);
  assertDestructiveActionAllowed({ recordType: "Lead", retentionClass: "OPERATIONAL", action: "ARCHIVE", reason: input.reason });
  const now = input.now ?? new Date().toISOString();
  const next: Lead = { ...target, archivedAt: now, archiveReason: input.reason.trim(), updatedAt: now, updatedBy: input.actorId, activities: [retentionActivity(input, "LEAD ARCHIVED", input.reason.trim()), ...target.activities] };
  repository.replace(repository.list().map((lead) => lead.id === leadId ? next : lead));
  return structuredClone(next);
}

export function archiveLeads(repository: LeadRepository, leadIds: readonly string[], input: LeadRetentionCommandInput): Lead[] {
  assertRuntimeCapability(CAPABILITIES.LEADS_DELETE);
  const ids = new Set(leadIds);
  const archived: Lead[] = [];
  const next = repository.list().map((lead) => {
    if (!ids.has(lead.id)) return lead;
    assertRuntimeCommandAccess(CAPABILITIES.LEADS_DELETE, "leads", lead);
    assertDestructiveActionAllowed({ recordType: "Lead", retentionClass: "OPERATIONAL", action: "ARCHIVE", reason: input.reason });
    const now = input.now ?? new Date().toISOString();
    const value: Lead = { ...lead, archivedAt: now, archiveReason: input.reason.trim(), updatedAt: now, updatedBy: input.actorId, activities: [retentionActivity(input, "LEAD ARCHIVED", input.reason.trim()), ...lead.activities] };
    archived.push(value);
    return value;
  });
  repository.replace(next);
  return structuredClone(archived);
}

export function anonymizeLead(repository: LeadRepository, leadId: string, input: LeadRetentionCommandInput): Lead {
  const target = repository.getById(leadId);
  if (!target) throw new Error(`Lead ${leadId} not found.`);
  assertRuntimeCommandAccess(CAPABILITIES.LEADS_DELETE, "leads", target);
  assertDestructiveActionAllowed({ recordType: "Lead", retentionClass: "MASTER", action: "ANONYMIZE", reason: input.reason });
  const now = input.now ?? new Date().toISOString();
  const label = anonymizedRecordLabel("Lead", target.id);
  const next: Lead = {
    ...target,
    name: label,
    title: label,
    companyName: "",
    representativeName: undefined,
    email: redactEmailForRetention(target.email) ?? "anonymized@invalid.local",
    phone: "",
    workPhone: undefined,
    otherPhone: undefined,
    personalEmail: undefined,
    companyPhone: undefined,
    zaloId: undefined,
    facebook: undefined,
    address: undefined,
    contactAddress: undefined,
    companyAddress: undefined,
    notes: undefined,
    internalNotes: undefined,
    description: undefined,
    qualificationNotes: undefined,
    painPoint: undefined,
    taxCode: undefined,
    website: undefined,
    archivedAt: now,
    archiveReason: "ANONYMIZED",
    anonymizedAt: now,
    anonymizationReason: input.reason.trim(),
    updatedAt: now,
    updatedBy: input.actorId,
    activities: [retentionActivity(input, "LEAD ANONYMIZED", input.reason.trim()), ...target.activities],
  };
  repository.replace(repository.list().map((lead) => lead.id === leadId ? next : lead));
  return structuredClone(next);
}

export function advanceNewLeadsToContacting(
  repository: LeadRepository,
  leadIds: readonly string[],
): number {
  return transitionEligibleLeads(repository, leadIds, LeadWorkState.NEW, LeadWorkState.CONTACTING);
}

export function advanceEligibleLeadsToVerifying(
  repository: LeadRepository,
  leadIds: readonly string[],
): number {
  return transitionEligibleLeads(repository, leadIds, LeadWorkState.CONTACTING, LeadWorkState.VERIFYING);
}

function transitionEligibleLeads(
  repository: LeadRepository,
  leadIds: readonly string[],
  sourceState: typeof LeadWorkState.NEW | typeof LeadWorkState.CONTACTING,
  targetState: typeof LeadWorkState.CONTACTING | typeof LeadWorkState.VERIFYING,
): number {
  assertRuntimeCapability(CAPABILITIES.LEADS_BULK);
  const ids = new Set(leadIds);
  const current = repository.list();
  const targets = current.filter((lead) => ids.has(lead.id));

  targets.forEach((lead) => {
    assertRuntimeCommandAccess(CAPABILITIES.LEADS_BULK, "leads", lead);
  });

  const eligible = targets.filter((lead) => lead.leadWorkState === sourceState);
  const policy = getLeadProgressiveProfilePolicy();
  const transitionedById = new Map(eligible.map((lead) => [lead.id, transitionLeadWorkState(lead, targetState, undefined, policy)]));
  if (transitionedById.size === 0) return 0;

  repository.replace(current.map((lead) => transitionedById.get(lead.id) ?? lead));
  return transitionedById.size;
}
