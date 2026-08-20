import type { CRMActivity } from "@/shared/domain";
import type { RelationshipRef } from "@/platform/identity";
import type { Lead } from "../model/lead.types";
import {
  LeadWorkState,
  QualificationOutcome,
  validateCanonicalLeadLifecycle,
  type CanonicalLeadLifecycleState,
  type LeadWorkState as LeadWorkStateValue,
  type QualificationOutcome as QualificationOutcomeValue,
} from "../model/leadLifecycle.canonical";
import {
  DEFAULT_LEAD_PROGRESSIVE_PROFILE_POLICY,
  validateLeadProgressiveProfile,
  type LeadProgressiveProfilePolicy,
  type LeadProfileField,
} from "./leadProgressiveProfile";

const ACTIVE_TRANSITIONS: Record<Exclude<LeadWorkStateValue, "CLOSED">, readonly LeadWorkStateValue[]> = {
  [LeadWorkState.NEW]: [LeadWorkState.CONTACTING],
  [LeadWorkState.CONTACTING]: [LeadWorkState.VERIFYING],
  [LeadWorkState.VERIFYING]: [],
};

export function appendLeadActivity(lead: Lead, activity: CRMActivity): Lead {
  return {
    ...lead,
    activities: [activity, ...(lead.activities ?? [])],
  };
}

export function canTransitionLeadWorkState(
  lead: Pick<Lead, "leadWorkState">,
  target: Exclude<LeadWorkStateValue, "CLOSED">,
): boolean {
  if (lead.leadWorkState === target) return true;
  if (lead.leadWorkState === LeadWorkState.CLOSED) return false;
  return ACTIVE_TRANSITIONS[lead.leadWorkState].includes(target);
}

export function assertLeadProgressiveProfileForState(
  lead: Partial<Lead>,
  target: Exclude<LeadWorkStateValue, "CLOSED">,
  policy: LeadProgressiveProfilePolicy = DEFAULT_LEAD_PROGRESSIVE_PROFILE_POLICY,
): void {
  const missing = validateLeadProgressiveProfile(lead, target, "COMPLETE", policy);
  if (missing.length === 0) return;
  throw new Error(`Lead profile is incomplete for ${target}: ${missing.join(", ")}.`);
}

export function getLeadProgressiveProfileBlockers(
  lead: Partial<Lead>,
  target: Exclude<LeadWorkStateValue, "CLOSED">,
  policy: LeadProgressiveProfilePolicy = DEFAULT_LEAD_PROGRESSIVE_PROFILE_POLICY,
): LeadProfileField[] {
  return validateLeadProgressiveProfile(lead, target, "COMPLETE", policy);
}

export function transitionLeadWorkState(
  lead: Lead,
  target: Exclude<LeadWorkStateValue, "CLOSED">,
  activity?: CRMActivity,
  policy: LeadProgressiveProfilePolicy = DEFAULT_LEAD_PROGRESSIVE_PROFILE_POLICY,
): Lead {
  if (!canTransitionLeadWorkState(lead, target)) {
    throw new Error(`Invalid Lead lifecycle transition: ${lead.leadWorkState} -> ${target}.`);
  }
  assertLeadProgressiveProfileForState(lead, target, policy);

  const next: Lead = {
    ...lead,
    leadWorkState: target,
    qualificationOutcome: undefined,
    relationshipRef: undefined,
    dealRef: undefined,
    migrationReview: undefined,
  };
  return activity ? appendLeadActivity(next, activity) : next;
}

export function reopenLeadWorkState(lead: Lead, activity?: CRMActivity): Lead {
  if (lead.leadWorkState !== LeadWorkState.CLOSED) {
    throw new Error("Only a CLOSED Lead can be reopened.");
  }
  if (lead.qualificationOutcome !== QualificationOutcome.DISQUALIFIED) {
    throw new Error("Only a DISQUALIFIED Lead can be reopened in the Lead workspace.");
  }

  const next: Lead = {
    ...lead,
    leadWorkState: LeadWorkState.CONTACTING,
    qualificationOutcome: undefined,
    relationshipRef: undefined,
    dealRef: undefined,
    migrationReview: undefined,
    disqualifiedAt: undefined,
    disqualifiedBy: undefined,
    disqualificationType: undefined,
    disqualificationReason: undefined,
    disqualificationNote: undefined,
    recontactStatus: "reopened",
  };
  assertLeadProgressiveProfileForState(next, LeadWorkState.CONTACTING);
  return activity ? appendLeadActivity(next, activity) : next;
}

export function assertLeadLifecycleFieldsUnchanged(previous: Lead, next: Lead): void {
  const fields: Array<keyof Lead> = ["leadWorkState", "qualificationOutcome", "relationshipRef", "dealRef"];
  const changed = fields.some((field) => JSON.stringify(previous[field]) !== JSON.stringify(next[field]));
  if (changed) {
    throw new Error("Lead lifecycle changes must use the dedicated transition, close, disqualify, or reopen command.");
  }
}

export interface CloseLeadInput {
  outcome: QualificationOutcomeValue;
  progressiveProfilePolicy?: LeadProgressiveProfilePolicy;
  relationshipRef?: RelationshipRef;
  dealRef?: string;
  activity?: CRMActivity;
}

export function closeLead(lead: Lead, input: CloseLeadInput): Lead {
  if (lead.leadWorkState === LeadWorkState.CLOSED) {
    throw new Error("Lead is already CLOSED.");
  }
  if (input.outcome !== QualificationOutcome.DISQUALIFIED) {
    if (lead.leadWorkState !== LeadWorkState.VERIFYING) {
      throw new Error("Lead must be VERIFYING before a positive qualification outcome can be committed.");
    }
    assertLeadProgressiveProfileForState(lead, LeadWorkState.VERIFYING, input.progressiveProfilePolicy);
  }

  const lifecycle: CanonicalLeadLifecycleState = {
    leadWorkState: LeadWorkState.CLOSED,
    qualificationOutcome: input.outcome,
    relationshipRef: input.relationshipRef,
    dealRef: input.dealRef,
  };
  const errors = validateCanonicalLeadLifecycle(lifecycle);
  if (errors.length > 0) {
    throw new Error(errors.join(" "));
  }

  const next: Lead = {
    ...lead,
    ...lifecycle,
    migrationReview: undefined,
    ...(input.outcome === QualificationOutcome.DISQUALIFIED
      ? {}
      : {
          disqualifiedAt: undefined,
          disqualifiedBy: undefined,
          disqualificationType: undefined,
          disqualificationReason: undefined,
          disqualificationNote: undefined,
        }),
  };
  return input.activity ? appendLeadActivity(next, input.activity) : next;
}

export function canEnterLeadQueue(lead: Lead): boolean {
  return lead.leadWorkState !== LeadWorkState.CLOSED && (lead.ownerId === "unassigned" || lead.ownerId === "");
}
