import type { BuyerRef, RelationshipRef } from "@/platform/identity";

export type CustomerState = "NONE" | "ACTIVE" | "INACTIVE" | "FORMER";

export type PurchaseEvidenceSourceType = "ORDER" | "EXTERNAL_TRANSACTION";

export type PurchaseEvidenceType =
  | "ORDER_COMPLETED"
  | "EXTERNAL_PURCHASE_CONFIRMED"
  | "HISTORICAL_PURCHASE_IMPORTED";

/** Append-only commercial fact. Existing evidence is never deleted or rewritten. */
export interface PurchaseEvidence {
  evidenceId: string;
  workspaceId: string;
  buyerRef: BuyerRef;
  sourceType: PurchaseEvidenceSourceType;
  sourceId: string;
  evidenceType: PurchaseEvidenceType;
  occurredAt: string;
  policyVersion: string;
  correlationId: string;
  amount?: number;
  currency?: string;
  productSummary?: string;
  documentRef?: string;
  note?: string;
  confirmedBy?: string;
  sourceSystem?: string;
  externalCustomerRef?: string;
  /** A reversal is another append-only fact. The original evidence remains intact. */
  reversalOfEvidenceId?: string;
}

export interface CustomerStatePolicy {
  policyVersion: string;
  activeHorizonDays: number;
}

export const DEFAULT_CUSTOMER_STATE_POLICY: CustomerStatePolicy = {
  policyVersion: "customer-state/v1",
  activeHorizonDays: 365,
};

export interface CustomerStateProjection {
  relationshipRef: RelationshipRef;
  customerState: CustomerState;
  calculatedAt: string;
  policyVersion: string;
  historicalPurchaseCount: number;
  latestPurchaseAt?: string;
  activeRelationshipReasons: string[];
}
