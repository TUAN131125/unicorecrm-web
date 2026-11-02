export interface SalesAcceptance {
  autoConfirmRequested?: boolean;
  acceptanceId: string; quoteId: string; source: "CUSTOMER_LINK" | "STAFF_RECORDED"; assuranceLevel: "ORDINARY_SALES_UNVERIFIED";
  acceptedAt: string; recordedBy: string; channel: string; evidence: string; documentId: string; commercialFingerprint: string;
  conversionStatus: "PENDING" | "BLOCKED" | "COMPLETED"; orderId?: string | null; lastErrorCode?: string | null; operationalApprovalRequired: boolean;
}
