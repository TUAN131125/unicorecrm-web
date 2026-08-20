import type { BuyerRef } from "@/platform/identity";
import type { MoneyDto } from "@/shared/money";

export type {
  PaymentAgreementLineSnapshot,
  PaymentAgreementSnapshot,
  PaymentAmountRule,
  PaymentChannel,
  PaymentDueRule,
  PaymentFulfillmentGate,
  PaymentPlanKind,
  PaymentPurpose,
  PaymentTiming,
} from "@/shared/order-to-cash";
import type {
  PaymentAgreementSnapshot,
  PaymentAmountRule,
  PaymentChannel,
  PaymentDueRule,
  PaymentFulfillmentGate,
  PaymentPlanKind,
  PaymentPurpose,
} from "@/shared/order-to-cash";

export type PaymentPlanState = "DRAFT" | "ACTIVE" | "SUPERSEDED" | "CANCELLED" | "COMPLETED";
export type PaymentScheduleLineState = "SCHEDULED" | "NOT_DUE" | "DUE" | "PARTIAL" | "SATISFIED" | "OVERDUE" | "VOIDED";

export interface PaymentPlan {
  id: string;
  workspaceId?: string;
  orderId: string;
  buyerRef: BuyerRef;
  version: number;
  kind: PaymentPlanKind;
  state: PaymentPlanState;
  currency: string;
  agreementSnapshot: PaymentAgreementSnapshot;
  scheduleLineIds: string[];
  supersedesPlanId?: string;
  supersededByPlanId?: string;
  evidenceCount: number;
  /** Demo/local command metadata; absent from authoritative production reads. */
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
  activatedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
}

export interface PaymentScheduleLine {
  id: string;
  workspaceId?: string;
  planId: string;
  planVersion: number;
  orderId: string;
  buyerRef: BuyerRef;
  sequence: number;
  label: string;
  purpose: PaymentPurpose;
  amountRule: PaymentAmountRule;
  amount: MoneyDto;
  dueRule: PaymentDueRule;
  resolvedDueDate?: string;
  allowedMethodCodes: string[];
  preferredMethodCode?: string;
  channel?: PaymentChannel;
  fulfillmentGate: PaymentFulfillmentGate;
  invoicePolicyCode?: string;
  state: PaymentScheduleLineState;
  satisfiedAmount: MoneyDto;
  outstandingAmount: MoneyDto;
  /** Demo/local command metadata; absent from authoritative production reads. */
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentPlanIssue {
  code: string;
  messageKey: string;
  fieldPath?: string;
  detail?: string;
}

export interface PaymentPlanPreview {
  ready: boolean;
  orderAmount: MoneyDto;
  scheduledAmount: MoneyDto;
  remainingAmount: MoneyDto;
  resolvedLines: PaymentScheduleLine[];
  warnings: PaymentPlanIssue[];
  blockers: PaymentPlanIssue[];
  version: number;
}
