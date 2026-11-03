import type { IdentityCaseView, IdentityPage } from "./quoteIdentityAuthority";
import type { QuoteVersionedCommandOptions } from "../ports/QuoteCommandMetadata";
export type ReviewCriterion="D1"|"D2"|"D3"|"D4"|"D5";
export interface ReviewFinding {criterion:ReviewCriterion;outcome:"PASS"|"FAIL"|"INSUFFICIENT";rationale:string;proofIds:string[]}
export interface ConsentReview {proofIds:string[];acquiredAt:string;originReference:string;statementReference:string;finding:"EXPLICIT_UNCONDITIONAL_SIGNED_ASSENT"|"INSUFFICIENT"|"CONDITIONAL_OR_NEGATIVE"}
export interface ReviewInput {decision:"APPROVE_SIMULATION"|"REQUEST_MORE_EVIDENCE"|"REJECT_REVIEW";reason:string;documentId:string;quoteRevision:number;pdfSha256:string;subjectId:string;identityVersion:number;reviewBindingFingerprint:string;findings:ReviewFinding[];consent?:ConsentReview}
export interface ReviewDecision {reviewDecisionId:string;workspaceId:string;caseId:string;quoteId:string;rootQuoteId:string;documentId:string;quoteRevision:number;pdfSha256:string;commercialFingerprint:string;identitySubjectId:string;identityVersion:number;identityFingerprint:string;authorityBindingVersion:number;sourceCheckId:string;sourceCheckVersion:number;sourceId:string|null;sourceVersion:number|null;sourceCheckFingerprint:string;sourceProvenanceDigest:string;proofs:{proofId:string;sha256:string;evidenceType:string;scanPolicyVersion:string;scannedAt:string}[];findings:ReviewFinding[];consent:ConsentReview|null;decision:string;reason:string;reviewerId:string;reviewedAt:string;reviewPolicyVersion:string;environment:string;assuranceLevel:string;actualSourceVerification:boolean;reviewBindingFingerprint?:string}
export interface ReviewView {caseId:string;quoteId:string;resourceVersion:number;status:string;readyForIndependentReview:boolean;blockers:string[];reviewPolicyVersion:string;reviewBindingFingerprint:string;identity:IdentityCaseView;document:{documentId:string;quoteRevision:number;pdfSha256:string;commercialFingerprint:string};lastDecision?:ReviewDecision;assuranceLevel:string;actualSourceVerification:boolean}
export interface IndependentReviewPort {
 read(q:string,c:string,signal?:AbortSignal):Promise<ReviewView>;
 history(q:string,c:string,cursor?:string,signal?:AbortSignal):Promise<IdentityPage<ReviewDecision>>;
 submit(q:string,c:string,input:ReviewInput,options:QuoteVersionedCommandOptions):Promise<ReviewView>;
}
