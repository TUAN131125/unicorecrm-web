export * from "./leads";

export { getLead, getLeadQueue, getLeadWorkStateCounts, getLeadOutcomeCounts } from "../application/queries/leadQueries";

export { changeLeadWorkState, closeLeadWithOutcome, disqualifyLead, reopenLead, appendActivityToLead, reassignLead } from "../application/commands/leadCommands";

export type { LeadRepository } from "../application/ports/LeadRepository";

export { LeadWorkState, QualificationOutcome, getLeadLifecycleDisplayKey, isLeadActive, isLeadClosed, isPositiveQualificationOutcome, validateCanonicalLeadLifecycle } from "../domain/model/leadLifecycle.canonical";

export type { LeadWorkState as LeadWorkStateValue, QualificationOutcome as QualificationOutcomeValue, LeadLifecycleDisplayKey } from "../domain/model/leadLifecycle.canonical";

export type { Lead, LeadCampaign, LeadInterestedProduct, LeadSource, LeadSourceLineageEntry, LeadConsentChannel, LeadConsentDecision, LeadConsentLedgerEntry, LeadConsentProfile, LeadDuplicateResolution } from "../domain/model/lead.types";

export type { CanonicalLeadLifecycleState } from "../domain/model/leadLifecycle.canonical";

export { LeadContactChannel, evaluateLeadContactPolicy, assertLeadContactAllowed, getLeadContactPolicyMessage } from "../domain/rules/leadContactPolicy";

export type { LeadContactChannel as LeadContactChannelValue, LeadContactPolicyDecision, LeadContactPolicyReason } from "../domain/rules/leadContactPolicy";

export {
  configureLeadProgressiveProfilePolicy,
  getLeadProgressiveProfilePolicy,
  resetLeadProgressiveProfilePolicy,
} from "../application/policies/leadProgressiveProfilePolicyRuntime";

export type {
  LeadProgressiveProfilePolicy,
  LeadProfileField,
} from "../domain/rules/leadProgressiveProfile";

export { getLeadDuplicateCandidates, getLeadDuplicateMatchKeys } from "../application/queries/leadIdentityResolution";
export { getLeadDetailResource } from "../application/vertical-slice/leadAuthoritativeQueries";
export { useLeadAuthoritativeResource } from "../presentation/hooks/useLeadAuthoritativeResource";
