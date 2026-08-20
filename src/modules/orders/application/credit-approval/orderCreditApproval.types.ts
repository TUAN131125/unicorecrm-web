import type { MoneyDto } from "@/shared/money";

export type OrderCreditApprovalState =
  | "REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "REVOKED"
  | "CONSUMED"
  | "SUPERSEDED";

/**
 * Authoritative backend evidence for a single Order confirmation attempt.
 *
 * The approval is bound to the evaluated Order/Payment Plan/policy versions,
 * is never inferred from a role label, and cannot be reused after consumption
 * or after any binding version changes.
 */
export interface OrderCreditApprovalDocument {
  id: string;
  orderId: string;
  orderResourceVersion: number;
  paymentPlanId: string;
  paymentPlanResourceVersion: number;
  amount: MoneyDto;
  policyVersion: string;
  evaluationFingerprint: string;
  state: OrderCreditApprovalState;
  requestReason: string;
  requestedBy: string;
  requestedAt: string;
  decisionBy?: string;
  decisionAt?: string;
  decisionNote?: string;
  revokedBy?: string;
  revokedAt?: string;
  revocationReason?: string;
  consumedAt?: string;
  consumedByCommandId?: string;
  resourceVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrderCreditApprovalMutationResult {
  approval: OrderCreditApprovalDocument;
}
