import type { RelationshipRef } from "@/platform/identity";

/** Canonical Lead work progression. This does not encode the qualification decision. */
export const LeadWorkState = {
  NEW: "NEW",
  CONTACTING: "CONTACTING",
  VERIFYING: "VERIFYING",
  CLOSED: "CLOSED",
} as const;

export type LeadWorkState = typeof LeadWorkState[keyof typeof LeadWorkState];

/** Canonical business decision that resolves qualification. */
export const QualificationOutcome = {
  DISQUALIFIED: "DISQUALIFIED",
  NURTURE: "NURTURE",
  OPPORTUNITY: "OPPORTUNITY",
  CUSTOMER: "CUSTOMER",
  DIRECT_SALE: "DIRECT_SALE",
} as const;

export type QualificationOutcome = typeof QualificationOutcome[keyof typeof QualificationOutcome];

export interface CanonicalLeadLifecycleState {
  leadWorkState: LeadWorkState;
  qualificationOutcome?: QualificationOutcome;
  relationshipRef?: RelationshipRef;
  dealRef?: string;
}

export function validateCanonicalLeadLifecycle(
  state: CanonicalLeadLifecycleState,
): string[] {
  const errors: string[] = [];

  if (state.leadWorkState === LeadWorkState.CLOSED && !state.qualificationOutcome) {
    errors.push("CLOSED Lead requires qualificationOutcome.");
  }

  if (state.qualificationOutcome && state.leadWorkState !== LeadWorkState.CLOSED) {
    errors.push("qualificationOutcome may only be committed when Lead is CLOSED.");
  }

  if (
    state.qualificationOutcome &&
    state.qualificationOutcome !== QualificationOutcome.DISQUALIFIED &&
    state.qualificationOutcome !== QualificationOutcome.CUSTOMER &&
    !state.relationshipRef
  ) {
    errors.push(`${state.qualificationOutcome} requires relationshipRef.`);
  }

  if (state.qualificationOutcome === QualificationOutcome.OPPORTUNITY && !state.dealRef) {
    errors.push("OPPORTUNITY requires dealRef.");
  }

  if (state.qualificationOutcome !== QualificationOutcome.OPPORTUNITY && state.dealRef) {
    errors.push("dealRef is only valid for OPPORTUNITY outcome.");
  }

  return errors;
}

export function isLeadClosed(state: Pick<CanonicalLeadLifecycleState, "leadWorkState">): boolean {
  return state.leadWorkState === LeadWorkState.CLOSED;
}

export function isLeadActive(state: Pick<CanonicalLeadLifecycleState, "leadWorkState">): boolean {
  return !isLeadClosed(state);
}

export function isPositiveQualificationOutcome(
  outcome?: QualificationOutcome,
): outcome is Exclude<QualificationOutcome, "DISQUALIFIED"> {
  return Boolean(outcome && outcome !== QualificationOutcome.DISQUALIFIED);
}

export type LeadLifecycleDisplayKey = LeadWorkState | QualificationOutcome;

/**
 * Single display key for compact list badges. Active Leads show work progress;
 * closed Leads show the committed qualification outcome.
 */
export function getLeadLifecycleDisplayKey(
  state: Pick<CanonicalLeadLifecycleState, "leadWorkState" | "qualificationOutcome">,
): LeadLifecycleDisplayKey {
  return state.leadWorkState === LeadWorkState.CLOSED && state.qualificationOutcome
    ? state.qualificationOutcome
    : state.leadWorkState;
}
