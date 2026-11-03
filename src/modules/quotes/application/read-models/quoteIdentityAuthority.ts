import type { QuoteVersionedCommandOptions } from "../ports/QuoteCommandMetadata";
export interface IdentityAssessment { status: string; identityStatus: string; authorityStatus: string; sourceStatus: string; reasons: string[]; assessedAt: string; policyVersion: string; readyForIndependentReview: boolean; assuranceLevel: string; actualSourceVerification: boolean }
export interface IdentityClaim { effectiveFrom?: string; effectiveUntil?: string; currency?: string; amountLimit?: string; scopeDescription?: string }
export interface IdentityBinding { subjectId: string; party: { contactId: string; displayName: string; contactVersion: number; buyerVersion: number; relationshipId?: string; eligible: boolean }; identityProofs: { proofId: string; sha256: string; evidenceType: string }[]; authorityProofs: { proofId: string; sha256: string; evidenceType: string }[]; authorityClaim: IdentityClaim; sourceId?: string; sourceVersion?: number; recordedBy: string; recordedAt: string; trustStatus: string }
export interface IdentitySourceCheck { outcome: string; attemptedAt: string; actorId: string; verificationMethod: string; policyVersion: string; reasons: string[]; sourceId?: string; sourceVersion?: number; manualCheck?: ManualSourceCheckEvidence }
export interface IdentityCaseView { caseId: string; quoteId: string; resourceVersion: number; buyerRef: { type: string; id: string }; binding?: IdentityBinding; assessment: IdentityAssessment; lastSourceCheck?: IdentitySourceCheck }
export interface IdentityHistoryItem { resourceVersion: number; kind: string; actorId: string; recordedAt: string; reason: string; assessment: IdentityAssessment; subjectId?: string; sourceCheck?: IdentitySourceCheck }
export interface EvidenceSource { sourceId: string; resourceVersion: number; name: string; status: string; issuerReference: string; verificationMethod: string; provenanceReference: string; requirements: string; sourceType: string; recordedBy: string; recordedAt: string; changeReason: string; canApprove: boolean; admissionBlocker: string; evidence?: SourceEvidence; approvedBy?: string; approvedAt?: string; assuranceLevel?: string }
export interface IdentityBindingInput { contactId: string; identityProofIds: string[]; authorityProofIds: string[]; relationshipId?: string; expectedSubjectId?: string; sourceId?: string; sourceVersion?: number; authorityClaim?: IdentityClaim; reason?: string }
export interface EvidenceSourceInput { name: string; sourceType: string; issuerReference: string; verificationMethod: string; provenanceReference: string; requirements: string; reason?: string; evidence?: SourceEvidenceInput }
export interface IdentityPage<T> { items: T[]; nextCursor?: string }
export interface QuoteIdentityAuthorityPort {
 read(q: string, c: string, signal?: AbortSignal): Promise<IdentityCaseView>;
 history(q: string, c: string, cursor?: string, signal?: AbortSignal): Promise<IdentityPage<IdentityHistoryItem>>;
 sources(q: string, cursor?: string, signal?: AbortSignal): Promise<IdentityPage<EvidenceSource>>;
 save(q: string, c: string, input: IdentityBindingInput, options: QuoteVersionedCommandOptions): Promise<IdentityCaseView>;
 assess(q: string, c: string, subjectId: string, options: QuoteVersionedCommandOptions): Promise<IdentityCaseView>;
 check(q: string, c: string, subjectId: string, options: QuoteVersionedCommandOptions, manualCheck?: ManualSourceCheckInput): Promise<IdentityCaseView>;
 approveSource(q: string, sourceId: string, reason: string, options: QuoteVersionedCommandOptions): Promise<EvidenceSource>;
 registerSource(q: string, input: EvidenceSourceInput, options: QuoteVersionedCommandOptions): Promise<EvidenceSource>;
 revokeSource(q: string, sourceId: string, reason: string, options: QuoteVersionedCommandOptions): Promise<EvidenceSource>;
}

export interface SourceProofLink { proofId: string; sha256: string; evidenceType: string }
export interface SourceEvidenceInput { caseId: string; issuerOrganizationId: string; issuerProofIds: string[]; independentChannelProofIds: string[]; channelOriginKind: "PUBLISHED_ORGANIZATION_DIRECTORY" | "PREEXISTING_INDEPENDENT_BUSINESS_RECORD" | "IN_PERSON_ORGANIZATION_OFFICE"; channelOriginDescription: string; independentChannel: string; effectiveFrom: string; effectiveUntil: string }
export interface SourceEvidence { quoteId: string; caseId: string; issuerOrganizationId: string; issuerProofs: SourceProofLink[]; independentChannelProofs: SourceProofLink[]; channelOriginKind: string; channelOriginDescription: string; independentChannel: string; effectiveFrom: string; effectiveUntil: string; subjectFingerprint: string }
export interface ManualSourceCheckInput { reportedOutcome: "CONFIRMED" | "NOT_CONFIRMED" | "UNAVAILABLE" | "INSUFFICIENT"; observedAt: string; confirmationProofIds: string[]; independentChannelUsed: string; confirmationSummary: string; confirmedScope: IdentityClaim }
export interface ManualSourceCheckEvidence { observedAt: string; confirmationProofs: SourceProofLink[]; independentChannelUsed: string; confirmationSummary: string; confirmedScope: IdentityClaim; bindingFingerprint: string; assuranceLevel: string }
