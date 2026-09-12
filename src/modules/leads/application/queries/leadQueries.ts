import type { LeadRepository } from "../ports/LeadRepository";
import { canEnterLeadQueue } from "../../domain/rules/leadLifecycle";
import type { Lead } from "../../domain/model/lead.types";
import {
  LeadWorkState,
  QualificationOutcome,
  type LeadWorkState as LeadWorkStateValue,
  type QualificationOutcome as QualificationOutcomeValue,
} from "../../domain/model/leadLifecycle.canonical";

export function getLead(repository: LeadRepository, leadId: string): Lead | undefined {
  return repository.getById(leadId);
}

export function getLeadQueue(repository: LeadRepository): Lead[] {
  return repository.list().filter(canEnterLeadQueue);
}

export function getLeadWorkStateCounts(repository: LeadRepository): Record<LeadWorkStateValue, number> {
  const counts: Record<LeadWorkStateValue, number> = {
    [LeadWorkState.NEW]: 0,
    [LeadWorkState.CONTACTING]: 0,
    [LeadWorkState.VERIFYING]: 0,
    [LeadWorkState.CLOSED]: 0,
  };
  repository.list().forEach((lead) => {
    counts[lead.leadWorkState] += 1;
  });
  return counts;
}

export function getLeadOutcomeCounts(repository: LeadRepository): Record<QualificationOutcomeValue, number> {
  const counts: Record<QualificationOutcomeValue, number> = {
    [QualificationOutcome.DISQUALIFIED]: 0,
    [QualificationOutcome.NURTURE]: 0,
    [QualificationOutcome.OPPORTUNITY]: 0,
    [QualificationOutcome.DIRECT_SALE]: 0,
    [QualificationOutcome.CUSTOMER]: 0,
  };
  repository.list().forEach((lead) => {
    if (lead.qualificationOutcome) counts[lead.qualificationOutcome] += 1;
  });
  return counts;
}
