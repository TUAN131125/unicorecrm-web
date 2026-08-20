export type EvidenceType =
  | "PAYMENT_PROOF"
  | "COD_REMITTANCE"
  | "INVOICE_ISSUE_RESULT"
  | "DELIVERY_POD"
  | "RETURN_INSPECTION"
  | "REFUND"
  | "REPLACEMENT_DELIVERY"
  | "OTHER";

export type EvidenceVerificationState = "UNVERIFIED" | "VERIFIED" | "REJECTED";

export interface EvidenceItem {
  id: string;
  type: EvidenceType;
  fileName?: string;
  mimeType?: string;
  url?: string;
  externalReference?: string;
  capturedAt: string;
  capturedBy: string;
  verificationState: EvidenceVerificationState;
  notes?: string;
  lockedByBusinessEvent?: boolean;
  createdAt: string;
}
