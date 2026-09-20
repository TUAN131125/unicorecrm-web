import type { RelationshipRef } from "@/platform/identity";
import type { RecordRef } from "@/modules/tasks";

export type CustomerType = "B2C" | "B2B";

export type CustomerStatus =
  | "NEW"
  | "ACTIVE"
  | "AT_RISK"
  | "INACTIVE"
  | "CHURNED"
  | "DO_NOT_CONTACT"
  | "ARCHIVED";

export type CustomerHealth = "GOOD" | "WATCH" | "RISK";
export type CustomerHealthBand = "UNKNOWN" | "HEALTHY" | "WATCH" | "AT_RISK" | "CRITICAL";
export type CustomerChurnRisk = "UNKNOWN" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type CustomerHealthConfidence = "NONE" | "LOW" | "MEDIUM" | "HIGH";
export interface CustomerHealthAssessment {
  score: number | null;
  healthBand: CustomerHealthBand;
  churnRisk: CustomerChurnRisk;
  confidence: CustomerHealthConfidence;
  purchaseCount: number;
  lastPurchaseAt: string | null;
  expectedPurchaseCadenceDays: number | null;
  daysSinceLastPurchase: number | null;
  reasonCode: "NO_PURCHASE_EVIDENCE" | "PURCHASE_RECENCY_HEALTHY" | "PURCHASE_WITHIN_EXPECTED_CADENCE" | "PURCHASE_CADENCE_SLIPPING" | "PURCHASE_OVER_EXPECTED_CADENCE" | "PURCHASE_SEVERELY_OVERDUE";
  algorithmVersion: "CUSTOMER_HEALTH_PURCHASE_RECENCY_V1";
  evaluatedAt: string;
}
export type CustomerOnboardingStatus = "PENDING" | "COMPLETED";
export type CustomerTier = "STANDARD" | "SILVER" | "GOLD" | "PLATINUM" | "STRATEGIC";
export type CustomerServiceLevel = "STANDARD" | "PRIORITY" | "PREMIUM" | "ENTERPRISE";

export interface Customer {
  id: string;
  workspaceId: string;
  customerCode: string;
  type: CustomerType;
  relationshipRef: RelationshipRef;
  status: CustomerStatus;
  health: CustomerHealth | null;
  healthAssessment?: CustomerHealthAssessment;
  calculatedHealth?: CustomerHealth;
  manualHealthOverride?: CustomerHealth;
  onboardingStatus?: CustomerOnboardingStatus;
  onboardingCompletedAt?: string;
  createdFromEvidenceId?: string;
  conversionPolicyVersion?: string;
  conversionCorrelationId?: string;
  sourceSystem?: string;
  externalCustomerRef?: string;
  tier?: CustomerTier;
  serviceLevel?: CustomerServiceLevel;
  careCadenceDays?: number;
  firstPurchaseAt: string | null;
  lastPurchaseAt: string | null;
  ownerId?: string | null;
  careOwnerId?: string;
  segment?: string;
  tags: string[];
  nextCareAt?: string;
  lastCareAt?: string;
  legacyAliases?: string[];
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  archiveReason?: string;
  anonymizedAt?: string;
  anonymizationReason?: string;
  /** Authoritative optimistic-concurrency version from the backend projection. */
  resourceVersion?: number;
}

export type CustomerCareCardType =
  | "ONBOARDING"
  | "FOLLOW_UP"
  | "HEALTH_CHECK"
  | "RENEWAL"
  | "PAYMENT_REMINDER"
  | "UPSELL"
  | "SUPPORT_RECOVERY"
  | "MANUAL";

export type CustomerCareCardStatus = "OPEN" | "IN_PROGRESS" | "WAITING" | "COMPLETED" | "CANCELLED";
export type CustomerCareCardPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export interface CustomerCareCard {
  id: string;
  workspaceId: string;
  customerId: string;
  type: CustomerCareCardType;
  title: string;
  description?: string;
  status: CustomerCareCardStatus;
  priority: CustomerCareCardPriority;
  ownerId: string;
  dueAt?: string;
  relatedRecordRef?: RecordRef;
  primaryTaskId?: string;
  taskIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomerRepositorySnapshot {
  customers: Customer[];
  careCards: CustomerCareCard[];
}
