import type { CRMActivity } from "@/shared/domain";
import type { RelationshipRef } from "@/platform/identity";
import type { LeadRepository } from "../ports/LeadRepository";
import type { Lead } from "../../domain/model/lead.types";
import { LeadWorkState, QualificationOutcome, type LeadWorkState as LeadWorkStateValue } from "../../domain/model/leadLifecycle.canonical";
import { appendLeadActivity, closeLead, reopenLeadWorkState, transitionLeadWorkState } from "../../domain/rules/leadLifecycle";
import { CAPABILITIES, assertRuntimeCommandAccess } from "@/platform/access-control";
import { appendRecordOwnershipAudit, assertOwnerReassignment } from "@/platform/record-ownership";
import { assertLeadContactAllowed, LeadContactChannel } from "../../domain/rules/leadContactPolicy";
import { getLeadProgressiveProfilePolicy } from "../policies/leadProgressiveProfilePolicyRuntime";

export function changeLeadWorkState(
  repository: LeadRepository,
  leadId: string,
  leadWorkState: Exclude<LeadWorkStateValue, "CLOSED">,
  activity?: CRMActivity,
): Lead | undefined {
  const current = repository.list().find((lead) => lead.id === leadId);
  assertRuntimeCommandAccess(CAPABILITIES.LEADS_UPDATE, "leads", current);
  let updated: Lead | undefined;
  repository.replace(repository.list().map((lead) => {
    if (lead.id !== leadId) return lead;
    updated = transitionLeadWorkState(lead, leadWorkState, activity, getLeadProgressiveProfilePolicy());
    return updated;
  }));
  return updated ? structuredClone(updated) : undefined;
}

export function startLeadVerification(
  repository: LeadRepository,
  leadId: string,
  input: {
    companyName?: string;
    painPoint?: string;
    nextFollowUpAt?: string;
    activity?: CRMActivity;
  } = {},
): Lead | undefined {
  const current = repository.list().find((lead) => lead.id === leadId);
  assertRuntimeCommandAccess(CAPABILITIES.LEADS_UPDATE, "leads", current);
  let updated: Lead | undefined;
  repository.replace(repository.list().map((lead) => {
    if (lead.id !== leadId) return lead;
    const prepared: Lead = {
      ...lead,
      companyName: input.companyName?.trim() || lead.companyName,
      painPoint: input.painPoint?.trim() || lead.painPoint,
      nextFollowUpAt: input.nextFollowUpAt || lead.nextFollowUpAt,
      updatedAt: new Date().toISOString(),
    };
    updated = transitionLeadWorkState(prepared, LeadWorkState.VERIFYING, input.activity, getLeadProgressiveProfilePolicy());
    return updated;
  }));
  return updated ? structuredClone(updated) : undefined;
}

export function closeLeadWithOutcome(
  repository: LeadRepository,
  leadId: string,
  input: {
    outcome: QualificationOutcome;
    relationshipRef?: RelationshipRef;
    dealRef?: string;
    activity?: CRMActivity;
  },
): Lead | undefined {
  const current = repository.list().find((lead) => lead.id === leadId);
  assertRuntimeCommandAccess(CAPABILITIES.LEADS_QUALIFY, "leads", current);
  let updated: Lead | undefined;
  repository.replace(repository.list().map((lead) => {
    if (lead.id !== leadId) return lead;
    updated = closeLead(lead, { ...input, progressiveProfilePolicy: getLeadProgressiveProfilePolicy() });
    return updated;
  }));
  return updated ? structuredClone(updated) : undefined;
}

export function appendActivityToLead(
  repository: LeadRepository,
  leadId: string,
  activity: CRMActivity,
): Lead | undefined {
  const current = repository.list().find((lead) => lead.id === leadId);
  assertRuntimeCommandAccess(CAPABILITIES.LEADS_UPDATE, "leads", current);
  if (current && activity.type === "call") assertLeadContactAllowed(current, LeadContactChannel.CALL);
  if (current && activity.type === "email") assertLeadContactAllowed(current, LeadContactChannel.EMAIL);
  if (current && activity.type === "sms") assertLeadContactAllowed(current, LeadContactChannel.SMS);
  let updated: Lead | undefined;
  repository.replace(repository.list().map((lead) => {
    if (lead.id !== leadId) return lead;
    updated = appendLeadActivity(lead, activity);
    return updated;
  }));
  return updated ? structuredClone(updated) : undefined;
}


export function reopenLead(
  repository: LeadRepository,
  leadId: string,
  activity?: CRMActivity,
): Lead | undefined {
  const current = repository.list().find((lead) => lead.id === leadId);
  assertRuntimeCommandAccess(CAPABILITIES.LEADS_UPDATE, "leads", current);
  let updated: Lead | undefined;
  repository.replace(repository.list().map((lead) => {
    if (lead.id !== leadId) return lead;
    updated = reopenLeadWorkState(lead, activity);
    return updated;
  }));
  return updated ? structuredClone(updated) : undefined;
}

export function reassignLead(
  repository: LeadRepository,
  leadId: string,
  input: {
    ownerId: string;
    reason: string;
    leadWorkState?: Exclude<LeadWorkStateValue, "CLOSED">;
    activity?: CRMActivity;
  },
): Lead | undefined {
  const current = repository.list().find((lead) => lead.id === leadId);
  if (!current) return undefined;
  const context = assertOwnerReassignment(
    "leads",
    CAPABILITIES.LEADS_ASSIGN,
    CAPABILITIES.LEADS_UPDATE,
    current,
    input.ownerId,
    input.reason,
  );
  let updated: Lead | undefined;
  repository.replace(repository.list().map((lead) => {
    if (lead.id !== leadId) return lead;
    let next: Lead = input.leadWorkState
      ? (lead.leadWorkState === input.leadWorkState
          ? { ...lead, ownerId: input.ownerId }
          : transitionLeadWorkState({ ...lead, ownerId: input.ownerId }, input.leadWorkState, undefined, getLeadProgressiveProfilePolicy()))
      : { ...lead, ownerId: input.ownerId };
    if (input.activity) next = appendLeadActivity(next, input.activity);
    updated = next;
    return next;
  }));
  if (current.ownerId !== input.ownerId) {
    appendRecordOwnershipAudit({
      resourceKey: "leads",
      recordId: leadId,
      action: "REASSIGNED",
      previousOwnerId: current.ownerId,
      nextOwnerId: input.ownerId,
      reason: input.reason.trim(),
    }, context);
  }
  return updated ? structuredClone(updated) : undefined;
}

export function disqualifyLead(
  repository: LeadRepository,
  leadId: string,
  input: {
    reason: string;
    evidence: string;
    actorId?: string;
    activity?: CRMActivity;
  },
): Lead | undefined {
  const current = repository.list().find((lead) => lead.id === leadId);
  assertRuntimeCommandAccess(CAPABILITIES.LEADS_QUALIFY, "leads", current);
  const reason = input.reason.trim();
  const evidence = input.evidence.trim();
  if (!reason) throw new Error("Disqualification requires a reason.");
  if (!evidence) throw new Error("Disqualification requires evidence.");

  let updated: Lead | undefined;
  repository.replace(repository.list().map((lead) => {
    if (lead.id !== leadId) return lead;
    const closed = closeLead(lead, {
      outcome: QualificationOutcome.DISQUALIFIED,
      activity: input.activity,
    });
    updated = {
      ...closed,
      disqualificationReason: reason,
      disqualificationNote: evidence,
      disqualifiedAt: new Date().toISOString(),
      disqualifiedBy: input.actorId,
    };
    return updated;
  }));
  return updated ? structuredClone(updated) : undefined;
}
