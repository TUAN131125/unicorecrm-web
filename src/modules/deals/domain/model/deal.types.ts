import type { BuyerRef } from "@/platform/identity";

export enum DealStage {
  DISCOVERY = "DISCOVERY",
  QUALIFIED = "QUALIFIED",
  SOLUTION = "SOLUTION",
  PROPOSAL = "PROPOSAL",
  NEGOTIATION = "NEGOTIATION",
  WON = "WON",
  LOST = "LOST"
}

export type DealRecycleDecision = "RECYCLE" | "CONDITIONAL" | "DO_NOT_RECYCLE";
export type DealForecastCategory = "COMMIT" | "BEST_CASE" | "PIPELINE";

export interface DealForecastHistoryEntry {
  id: string;
  occurredAt: string;
  actor?: string;
  previousExpectedCloseDate: string;
  nextExpectedCloseDate: string;
  previousProbability: number;
  nextProbability: number;
  previousCategory: DealForecastCategory;
  nextCategory: DealForecastCategory;
}

export interface DealNextActionRef {
  type: "TASK" | "ACTIVITY" | "MANUAL";
  id?: string;
}

export interface DealWinEvidence {
  type: "QUOTE_ACCEPTED" | "ORDER_CONFIRMED";
  sourceId: string;
  occurredAt: string;
}

export interface OpportunityStageConfig {
  id: string;
  code: string;
  labelVi: string;
  labelEn: string;
  descriptionVi?: string;
  descriptionEn?: string;
  order: number;
  color: "blue" | "yellow" | "orange" | "purple" | "green" | "red" | "slate" | "teal";
  category: "open" | "won" | "lost";
  probabilityDefault: number;
  probability?: number;
  isSystem?: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DealPipelineDefinition {
  id: string;
  objectKey: "deal";
  name: { vi: string; en: string };
  description: { vi: string; en: string };
  isDefault: boolean;
  active: boolean;
  stages: OpportunityStageConfig[];
  version: number;
}

export type DealActivityType =
  | "system"
  | "note"
  | "stage"
  | "quote"
  | "won"
  | "lost"
  | "task"
  | "edit";

export type DealActivity = {
  id: string;
  type: DealActivityType;
  title: string;
  description: string;
  createdAt: string;
  author: string;
  metadata?: {
    fromStage?: DealStage | string;
    toStage?: DealStage | string;
    quoteId?: string;
    quoteNumber?: string;
    quoteStatus?: string;
    lostReason?: string;
    lostReasonNote?: string;
    recycleDecision?: DealRecycleDecision;
    noteCategory?: "care" | "internal" | "call_summary" | "consulting";
    pinned?: boolean;
  };
};

export interface Deal {
  /** Backend optimistic-concurrency token. Never derived from pipeline or browser revision state. */
  resourceVersion?: number;
  id: string;
  name: string;
  /** Canonical buyer identity. A Deal is never owned by Customer or Lead. */
  buyerRef: BuyerRef;
  /** @deprecated Display-only legacy compatibility fields. */
  customerId?: string;
  /** @deprecated Display-only legacy compatibility fields. */
  customerName?: string;
  organizationAccountId?: string;
  organizationAccountName?: string;
  contactId?: string;
  contactName?: string;
  contactTitle?: string;
  contactEmail?: string;
  contactPhone?: string;
  stage: DealStage | string;
  amount: number;
  /** Commercial currency inherited by Quotes and direct Orders. */
  currency?: string;
  /** Configured probability/read model only; never lifecycle truth. */
  opportunityScore: number;
  ownerId: string;
  expectedCloseDate: string;
  forecastCategory?: DealForecastCategory;
  forecastHistory?: DealForecastHistoryEntry[];
  stageEnteredAt?: string;
  createdAt: string;
  updatedAt: string;
  interestedProducts: string[];
  lineItems: DealLineItem[];
  riskBadge?: string;
  /** Optional task/activity-backed follow-up for the Deal. */
  nextActionAt?: string;
  nextActionSummary?: string;
  nextActionRef?: DealNextActionRef;
  wonAt?: string;
  lostAt?: string;
  actualCloseDate?: string;
  winEvidence?: DealWinEvidence;
  lostReason?: string;
  lostReasonNote?: string;
  recycleDecision?: DealRecycleDecision;
  recycleEligible?: boolean;
  revisitAt?: string;
  activities?: DealActivity[];
  leadId?: string;
  leadName?: string;
  notes?: string;
  description?: string;
  address?: string;
  migrationReview?: {
    rule: string;
    legacyStage?: string;
    message: string;
  };
  archivedAt?: string;
  archiveReason?: string;
}

export interface DealLineItem {
  id: string;
  productId: string;
  skuSnapshot?: string;
  productNameSnapshot?: string;
  productTypeSnapshot?: string;
  descriptionSnapshot?: string;
  quantity: number;
  unitPriceSnapshot?: number;
  discountPercent: number;
  taxRateSnapshot?: number;
  taxModeSnapshot?: "exclusive" | "inclusive" | "none";
  billingCycleSnapshot?: string;
  lineSubtotal?: number;
  lineDiscountAmount?: number;
  lineTaxAmount?: number;
  lineTotal?: number;

  // Backwards compatibility legacy fields
  productName?: string;
  description?: string;
  unitPrice?: number;
  taxRate?: number;
  taxMode?: "exclusive" | "inclusive" | "none";
  subtotal?: number;
  totalAmount?: number;
}
