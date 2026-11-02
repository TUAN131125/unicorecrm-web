import type { QuoteVersionedCommandOptions } from "../ports/QuoteCommandMetadata";
export interface AcceptanceCase {
  caseId: string; quoteId: string; rootQuoteId: string; quoteRevision: number; documentId: string;
  commercialContentFingerprint: string; pdfSha256: string; buyerRef: { type: "CONTACT" | "ORGANIZATION_ACCOUNT"; id: string };
  caseStatus: "COLLECTING_PROOFS" | "QUARANTINED"; createdAt: string; createdBy: string; resourceVersion: number;
}
export type ProofEvidenceType = "CUSTOMER_CONSENT" | "IDENTITY" | "DELEGATION" | "SUPPORTING_DOCUMENT";
export type ProofScanStatus = "SCAN_PENDING" | "SCANNING" | "CLEAN" | "UNSAFE" | "INVALID_PDF" | "SCAN_FAILED" | "NEEDS_INTERVENTION";
export interface AcceptanceProof {
  proofId: string; caseId: string; quoteId: string; uploadedBy: string; evidenceType: ProofEvidenceType; fileName: string;
  mediaType: "application/pdf"; fileSize: number; sha256: string; storageStatus: "QUARANTINED"; scanStatus: ProofScanStatus;
  uploadedAt: string; resourceVersion: number; retention: string; contentAvailable: boolean;
  structuralStatus: string; malwareVerdict: string; scanReasonCode: string; scannedAt?: string; scanPolicyVersion?: string; reviewable: boolean;
}
export interface ProofScanHistoryItem {
  attemptId: string; attemptNumber: number; status: ProofScanStatus; reasonCode: string; structuralStatus: string; malwareVerdict: string;
  startedAt: string; completedAt?: string; policyVersion: string; inputSha256: string; engineVersion?: string; signatureVersion?: string; signatureUpdatedAt?: string;
}
export interface AcceptanceProofPort {
  cases(quoteId: string, cursor?: string, signal?: AbortSignal): Promise<{ items: AcceptanceCase[]; nextCursor?: string }>;
  proofs(quoteId: string, caseId: string, cursor?: string, signal?: AbortSignal): Promise<{ items: AcceptanceProof[]; nextCursor?: string }>;
  history(quoteId: string, caseId: string, proofId: string, cursor?: string, signal?: AbortSignal): Promise<{ items: ProofScanHistoryItem[]; nextCursor?: string }>;
  download(quoteId: string, caseId: string, proofId: string, signal?: AbortSignal): Promise<{ blob: Blob; fileName: string }>;
  create(quoteId: string, binding: { documentId: string; quoteRevision: number; pdfSha256: string; commercialContentFingerprint: string }, options: QuoteVersionedCommandOptions): Promise<AcceptanceCase>;
  upload(quoteId: string, caseId: string, file: File, evidenceType: ProofEvidenceType, options: QuoteVersionedCommandOptions): Promise<{ case: AcceptanceCase; proof?: AcceptanceProof }>;
}
