import type { Lead } from "../../domain/model/lead.types";
import type { LeadWorkState } from "../../domain/model/leadLifecycle.canonical";
import {
  DEFAULT_LEAD_PROGRESSIVE_PROFILE_POLICY,
  validateLeadProgressiveProfile,
  type LeadProgressiveProfilePolicy,
  type LeadProfileField,
} from "../../domain/rules/leadProgressiveProfile";

let activePolicy: LeadProgressiveProfilePolicy = DEFAULT_LEAD_PROGRESSIVE_PROFILE_POLICY;

const clonePolicy = (policy: LeadProgressiveProfilePolicy): LeadProgressiveProfilePolicy => ({
  requiredFieldsByState: Object.fromEntries(
    Object.entries(policy.requiredFieldsByState).map(([state, fields]) => [state, [...(fields ?? [])]]),
  ) as LeadProgressiveProfilePolicy["requiredFieldsByState"],
});

export function getLeadProgressiveProfilePolicy(): LeadProgressiveProfilePolicy {
  return clonePolicy(activePolicy);
}

/**
 * Settings integration point. Backend configuration can publish a policy
 * here later without coupling presentation components to storage or transport.
 */
export function configureLeadProgressiveProfilePolicy(policy: LeadProgressiveProfilePolicy): void {
  activePolicy = clonePolicy(policy);
}

export function resetLeadProgressiveProfilePolicy(): void {
  activePolicy = DEFAULT_LEAD_PROGRESSIVE_PROFILE_POLICY;
}

export function getConfiguredLeadProfileBlockers(
  lead: Partial<Lead>,
  target: Exclude<LeadWorkState, "CLOSED">,
): LeadProfileField[] {
  const configuredFields = activePolicy.requiredFieldsByState[target] ?? [];
  const configuredSet = new Set(configuredFields);
  return validateLeadProgressiveProfile(lead, target, "COMPLETE", activePolicy)
    .filter((field) => configuredSet.has(field));
}
