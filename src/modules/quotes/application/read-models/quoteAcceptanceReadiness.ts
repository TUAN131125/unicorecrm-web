export interface QuoteAcceptanceReadiness {
  quoteId: string; resourceVersion: number; quoteStatus: string;
  status: "BLOCKED_CONTRACT"; verificationStatus: "NOT_VERIFIED"; lifecycleCommitted: boolean;
  proofCollectionAllowed?: boolean;
  blockerCodes: readonly string[]; policyVersion?: string; authorityFreshnessHours?: number;
  binding?: { documentId: string; quoteId: string; rootQuoteId: string; quoteRevision: number;
    sourceResourceVersion: number; resultResourceVersion: number; commercialContentFingerprint: string;
    pdfSha256: string; buyerRef: { type: "CONTACT" | "ORGANIZATION_ACCOUNT"; id: string } };
}
export interface QuoteAcceptanceReadPort {
  acceptanceReadiness(quoteId: string, documentId?: string, signal?: AbortSignal): Promise<QuoteAcceptanceReadiness>;
}
