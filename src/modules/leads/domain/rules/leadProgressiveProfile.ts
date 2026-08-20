import type { Lead } from "../model/lead.types";
import {
  LeadWorkState,
  type LeadWorkState as LeadWorkStateValue,
} from "../model/leadLifecycle.canonical";

export type LeadCreateMode = "QUICK" | "COMPLETE";
export type LeadProfileField =
  | "name"
  | "contactChannel"
  | "companyName"
  | "source"
  | "ownerId"
  | "nextFollowUpAt"
  | "painPoint";

export interface LeadProgressiveProfilePolicy {
  requiredFieldsByState: Partial<Record<LeadWorkStateValue, readonly LeadProfileField[]>>;
}

/**
 * The frontend currently has no published backend configuration contract for transition-specific
 * required fields. Optional enrichment fields therefore remain fail-open by
 * default. A future settings adapter can supply a policy without changing Lead
 * pages, Kanban, commands, or form composition.
 */
export const DEFAULT_LEAD_PROGRESSIVE_PROFILE_POLICY: LeadProgressiveProfilePolicy = {
  requiredFieldsByState: {},
};

export function getRequiredLeadProfileFields(
  state: Lead["leadWorkState"] = LeadWorkState.NEW,
  mode: LeadCreateMode = "COMPLETE",
  policy: LeadProgressiveProfilePolicy = DEFAULT_LEAD_PROGRESSIVE_PROFILE_POLICY,
): LeadProfileField[] {
  const required: LeadProfileField[] = ["name", "contactChannel", "ownerId"];
  if (mode === "QUICK") required.push("source", "nextFollowUpAt");
  required.push(...(policy.requiredFieldsByState[state] ?? []));
  return [...new Set(required)];
}

export function validateLeadProgressiveProfile(
  lead: Partial<Lead>,
  state: Lead["leadWorkState"] = LeadWorkState.NEW,
  mode: LeadCreateMode = "COMPLETE",
  policy: LeadProgressiveProfilePolicy = DEFAULT_LEAD_PROGRESSIVE_PROFILE_POLICY,
): LeadProfileField[] {
  return getRequiredLeadProfileFields(state, mode, policy).filter((field) => {
    if (field === "contactChannel") {
      return ![lead.phone, lead.workPhone, lead.otherPhone, lead.email, lead.personalEmail, lead.zaloId, lead.facebook]
        .some((value) => Boolean(value?.trim()));
    }
    return !String(lead[field] ?? "").trim();
  });
}
