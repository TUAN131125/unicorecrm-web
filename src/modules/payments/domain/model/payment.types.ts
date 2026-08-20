import type { BuyerRef } from "@/platform/identity";

export type PaymentTransactionKind = "PAYMENT" | "REFUND";
export type PaymentTransactionStatus = "CREATED" | "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "EXPIRED";
export type PaymentSource = "IMPORTED_LEGACY" | "MANUAL" | "GATEWAY" | "BANK_FEED" | "CARRIER" | "EXTERNAL";
export type PaymentReconciliationState = "UNRECONCILED" | "MATCHED" | "MISMATCH";
export type PaymentMethod = "BANK_TRANSFER" | "COD" | "CASH" | "CARD" | "E_WALLET" | "OTHER";

/** Payment agreement vocabulary shared with Order creation and obligation projection. */
export type PaymentTerm = "DEPOSIT" | "PREPAID" | "POSTPAID";
export type PaymentPlanType = "FULL_PAYMENT" | "DEPOSIT_AND_BALANCE" | "INSTALLMENT" | "CUSTOM";
export type PaymentTiming = "PREPAID" | "ON_DELIVERY" | "POSTPAID";
export type PaymentPurpose = "FULL" | "DEPOSIT" | "BALANCE" | "INSTALLMENT" | "OTHER";
export type PaymentDueRuleType = "FIXED_DATE" | "BEFORE_BOOKING" | "BEFORE_FULFILLMENT" | "ON_DELIVERY" | "DAYS_AFTER_DELIVERY" | "MILESTONE";
export type PaymentFulfillmentGate = "NONE" | "BEFORE_BOOKING" | "BEFORE_COMPLETION";
export type PaymentObligationStatus = "OPEN" | "PARTIAL" | "SETTLED" | "OVERDUE" | "VOIDED";
export type CodCollectionState = "REQUESTED" | "COLLECTED" | "REMITTED";

export interface PaymentDueRule {
  type: PaymentDueRuleType;
  fixedDate?: string;
  daysAfterDelivery?: number;
  milestoneLabel?: string;
}

export interface PaymentObligation {
  id: string;
  workspaceId?: string;
  orderId: string;
  buyerRef: BuyerRef;
  planId?: string;
  planVersion?: number;
  planType?: PaymentPlanType;
  sequence?: number;
  label?: string;
  purpose?: PaymentPurpose;
  timing?: PaymentTiming;
  amountDue: number;
  amountPaid: number;
  amountOutstanding: number;
  currency: string;
  method: PaymentMethod;
  allowedMethods?: PaymentMethod[];
  term: PaymentTerm;
  dueRule?: PaymentDueRule;
  dueDate?: string;
  fulfillmentGate?: PaymentFulfillmentGate;
  status: PaymentObligationStatus;
  idempotencyKey: string;
  voidedAt?: string;
  voidReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentAllocation {
  obligationId: string;
  amount: number;
}

export interface PaymentTransaction {
  id: string;
  workspaceId?: string;
  orderId: string;
  buyerRef: BuyerRef;
  kind: PaymentTransactionKind;
  status: PaymentTransactionStatus;
  amount: number;
  currency: string;
  occurredAt: string;
  source: PaymentSource;
  method?: PaymentMethod;
  termSnapshot?: PaymentTerm;
  allocations?: PaymentAllocation[];
  unappliedAmount?: number;
  externalReference?: string;
  providerId?: string;
  paymentChannelId?: string;
  refundOfTransactionId?: string;
  retryOfTransactionId?: string;
  failureReason?: string;
  reconciliationState?: PaymentReconciliationState;
  reconciledAt?: string;
  reconciledBy?: string;
  reconciliationNote?: string;
  codCollectionState?: CodCollectionState;
  codCollectedAt?: string;
  codRemittedAt?: string;
  carrierReference?: string;
  correlationId?: string;
  idempotencyKey?: string;
}

export interface PaymentMigrationReview {
  orderId: string;
  legacyState: "PARTIAL" | "OVERDUE" | "REFUNDED" | "UNKNOWN";
  rule: string;
  message: string;
}

export type PaymentSummaryState =
  | "UNPAID"
  | "PARTIAL"
  | "PAID"
  | "OVERDUE"
  | "REFUNDED"
  | "FAILED"
  | "REVIEW";

export interface PaymentSummary {
  orderId: string;
  state: PaymentSummaryState;
  currency: string;
  paidAmount: number;
  refundedAmount: number;
  netPaidAmount: number;
  allocatedAmount: number;
  unappliedAmount: number;
  dueAmount: number;
  outstandingAmount: number;
  transactionCount: number;
  obligationCount: number;
  methods: PaymentMethod[];
  terms: PaymentTerm[];
  overdueCount: number;
}

export interface PaymentCompletionReadiness {
  ready: boolean;
  blockers: string[];
}
