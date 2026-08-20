import type { CRMActivity } from "@/shared/domain";
import { CAPABILITIES, assertRuntimeCapability } from "@/platform/access-control";
import { appendRecordOwnershipAudit, enforceCreateOwner } from "@/platform/record-ownership";
import type { Lead } from "../../domain/model/lead.types";
import { LeadWorkState } from "../../domain/model/leadLifecycle.canonical";
import { assertValidLeadContactData } from "../../domain/rules/leadContactData";
import { assertLeadProgressiveProfileForState } from "../../domain/rules/leadLifecycle";
import type { LeadCsvImportCandidate, LeadCsvImportPlan } from "../import/leadCsvImport";
import type { LeadRepository } from "../ports/LeadRepository";

export interface ImportLeadBatchOptions {
  defaultOwnerId?: string;
  actorName: string;
  now?: string;
  idFactory?: (candidate: LeadCsvImportCandidate, index: number) => string;
}

function normalizeContact(value: string | undefined): string {
  return String(value || "").trim().toLocaleLowerCase().replace(/[^a-z0-9+@.]/g, "");
}

export function importLeadCsvPlanAtomically(
  repository: LeadRepository,
  plan: LeadCsvImportPlan,
  options: ImportLeadBatchOptions,
): Lead[] {
  assertRuntimeCapability(CAPABILITIES.LEADS_CREATE);
  assertRuntimeCapability(CAPABILITIES.LEADS_BULK);
  if (plan.version !== 1 || !plan.checksum) throw new Error("Lead import plan is invalid.");
  if (plan.invalidRowCount > 0 || plan.candidates.length !== plan.rows.length) {
    throw new Error("Lead import contains invalid rows. Resolve every row before importing.");
  }
  if (plan.candidates.length === 0) throw new Error("Lead import contains no valid rows.");

  const current = repository.list();
  const existingContacts = new Set<string>();
  current.forEach((lead) => {
    if (lead.email) existingContacts.add(`email:${normalizeContact(lead.email)}`);
    if (lead.phone) existingContacts.add(`phone:${normalizeContact(lead.phone)}`);
    if (lead.workPhone) existingContacts.add(`phone:${normalizeContact(lead.workPhone)}`);
  });

  const now = new Date(options.now || new Date().toISOString());
  if (Number.isNaN(now.getTime())) throw new Error("Lead import timestamp is invalid.");
  const occurredAt = now.toISOString();
  const ownershipAssignments: Array<ReturnType<typeof enforceCreateOwner>> = [];
  const created = plan.candidates.map((candidate, index) => {
    const requestedOwnerId = candidate.ownerId || options.defaultOwnerId;
    const assignment = enforceCreateOwner("leads", CAPABILITIES.LEADS_ASSIGN, requestedOwnerId);
    ownershipAssignments.push(assignment);
    const emailKey = candidate.email ? `email:${normalizeContact(candidate.email)}` : "";
    const phoneKey = candidate.phone || candidate.workPhone
      ? `phone:${normalizeContact(candidate.phone || candidate.workPhone)}`
      : "";
    if ((emailKey && existingContacts.has(emailKey)) || (phoneKey && existingContacts.has(phoneKey))) {
      throw new Error(`CSV row ${candidate.rowNumber} matches an existing Lead contact.`);
    }
    if (emailKey) existingContacts.add(emailKey);
    if (phoneKey) existingContacts.add(phoneKey);

    const activity: CRMActivity = {
      id: `activity_import_${index}_${now.getTime()}`,
      title: "Lead imported from CSV",
      description: `Imported from CSV row ${candidate.rowNumber}.`,
      createdAt: occurredAt,
      author: options.actorName,
      type: "system",
    };
    const lead: Lead = {
      id: options.idFactory?.(candidate, index) || `lead_import_${now.getTime()}_${index + 1}`,
      name: candidate.name.trim(),
      title: candidate.title?.trim() || "",
      companyName: candidate.companyName?.trim() || "",
      email: candidate.email?.trim() || "",
      phone: candidate.phone?.trim() || "",
      workPhone: candidate.workPhone?.trim() || undefined,
      source: candidate.source?.trim() || "CSV Import",
      score: 0,
      leadWorkState: LeadWorkState.NEW,
      ownerId: assignment.ownerId,
      interestedProducts: [],
      nextFollowUpAt: candidate.nextFollowUpAt?.trim() || undefined,
      createdAt: occurredAt,
      createdBy: options.actorName,
      updatedAt: occurredAt,
      activities: [activity],
      painPoint: candidate.painPoint?.trim() || undefined,
      preferredChannel: candidate.preferredChannel || (candidate.phone || candidate.workPhone ? "phone" : "email"),
    };
    assertValidLeadContactData(lead);
    assertLeadProgressiveProfileForState(lead, LeadWorkState.NEW);
    return lead;
  });

  // Commit once after every row, permission, ownership assignment, duplicate and
  // domain validation has completed successfully.
  repository.replace([...created, ...current]);
  created.forEach((lead, index) => {
    appendRecordOwnershipAudit({
      resourceKey: "leads",
      recordId: lead.id,
      action: "CREATED",
      nextOwnerId: lead.ownerId,
      reason: `Lead created by atomic CSV import (${plan.checksum}).`,
    }, ownershipAssignments[index].context);
  });
  return structuredClone(created);
}
