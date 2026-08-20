import type { BadgeVariant } from "@/shared/components/ui/Badge";
import {
  LeadWorkState,
  QualificationOutcome,
  getLeadLifecycleDisplayKey,
  type LeadLifecycleDisplayKey,
  type LeadWorkState as LeadWorkStateValue,
  type QualificationOutcome as QualificationOutcomeValue,
} from "../domain/model/leadLifecycle.canonical";
import type { Lead } from "../domain/model/lead.types";

export function getLeadWorkStateLabel(state: LeadWorkStateValue, locale: string): string {
  const vi = locale === "vi";
  switch (state) {
    case LeadWorkState.NEW:
      return vi ? "Mới" : "New";
    case LeadWorkState.CONTACTING:
      return vi ? "Đang liên hệ" : "Contacting";
    case LeadWorkState.VERIFYING:
      return vi ? "Đang xác minh" : "Verifying";
    case LeadWorkState.CLOSED:
      return vi ? "Đã giải quyết" : "Closed";
  }
}

export function getQualificationOutcomeLabel(outcome: QualificationOutcomeValue, locale: string): string {
  const vi = locale === "vi";
  switch (outcome) {
    case QualificationOutcome.DISQUALIFIED:
      return vi ? "Không phù hợp" : "Disqualified";
    case QualificationOutcome.NURTURE:
      return vi ? "Chăm sóc" : "Nurture";
    case QualificationOutcome.OPPORTUNITY:
      return vi ? "Cơ hội" : "Opportunity";
    case QualificationOutcome.DIRECT_SALE:
      return vi ? "Bán ngay" : "Direct Sale";
  }
}

export function getLeadLifecycleLabel(lead: Pick<Lead, "leadWorkState" | "qualificationOutcome">, locale: string): string {
  return lead.qualificationOutcome
    ? getQualificationOutcomeLabel(lead.qualificationOutcome, locale)
    : getLeadWorkStateLabel(lead.leadWorkState, locale);
}

export function getLeadLifecycleBadgeVariant(
  key: LeadLifecycleDisplayKey,
): BadgeVariant {
  switch (key) {
    case LeadWorkState.NEW:
      return "info";
    case LeadWorkState.CONTACTING:
      return "warning";
    case LeadWorkState.VERIFYING:
      return "success";
    case LeadWorkState.CLOSED:
      return "secondary";
    case QualificationOutcome.DISQUALIFIED:
      return "danger";
    case QualificationOutcome.NURTURE:
      return "warning";
    case QualificationOutcome.OPPORTUNITY:
    case QualificationOutcome.DIRECT_SALE:
      return "success";
  }
}

export function getLeadBadgeVariant(lead: Pick<Lead, "leadWorkState" | "qualificationOutcome">): BadgeVariant {
  return getLeadLifecycleBadgeVariant(getLeadLifecycleDisplayKey(lead));
}
