import type { ExchangeRateSnapshot, MoneyDto } from "@/shared/money";

export type PaymentPlanKind = "FULL_PAYMENT" | "DEPOSIT_AND_BALANCE" | "INSTALLMENT" | "MILESTONE" | "CUSTOM";
export type PaymentPurpose = "FULL" | "DEPOSIT" | "BALANCE" | "INSTALLMENT" | "MILESTONE" | "OTHER";
export type PaymentTiming = "PREPAYMENT" | "ON_DELIVERY" | "POSTPAYMENT" | "MILESTONE" | "FIXED_DATE";
export type PaymentChannel = "BANK" | "ONLINE_GATEWAY" | "POS" | "CARRIER" | "OFFLINE" | "EXTERNAL";
export type PaymentFulfillmentGate = "NONE" | "BEFORE_BOOKING" | "BEFORE_DISPATCH" | "BEFORE_COMPLETION";

export type PaymentAmountRule =
  | { type: "FIXED"; amount: MoneyDto }
  | { type: "PERCENTAGE"; percentage: string }
  | { type: "REMAINDER" };

export type PaymentDueRule =
  | { type: "FIXED_DATE"; date: string }
  | { type: "EVENT_RELATIVE"; event: "ORDER_CONFIRMED" | "INVOICE_ISSUED" | "DELIVERY_CONFIRMED" | "ACCEPTANCE_CONFIRMED"; offsetDays: number; dayBasis: "CALENDAR" | "BUSINESS" }
  | { type: "OPERATIONAL_PRECONDITION"; operation: "BOOKING" | "DISPATCH" | "COMPLETION"; leadDays: number }
  | { type: "MILESTONE"; milestoneCode: string; offsetDays: number }
  | { type: "RECURRING_FINITE"; firstDueDate: string; interval: "WEEKLY" | "MONTHLY" | "QUARTERLY"; count: number };

export interface PaymentAgreementLineSnapshot {
  id: string;
  sequence: number;
  label: string;
  purpose: PaymentPurpose;
  amountRule: PaymentAmountRule;
  previewAmount: MoneyDto;
  dueRule: PaymentDueRule;
  allowedMethodCodes: string[];
  preferredMethodCode?: string;
  channel?: PaymentChannel;
  fulfillmentGate: PaymentFulfillmentGate;
  invoicePolicyCode?: string;
}

/** Immutable commercial commitment copied from Quote to Order on conversion. */
export interface PaymentAgreementSnapshot {
  version: number;
  kind: PaymentPlanKind;
  currency: string;
  exchangeRateSnapshot?: ExchangeRateSnapshot;
  lines: PaymentAgreementLineSnapshot[];
  acceptedAt?: string;
  sourceQuoteId?: string;
  policyVersion?: string;
}

export function clonePaymentAgreement(agreement: PaymentAgreementSnapshot): PaymentAgreementSnapshot {
  return structuredClone(agreement);
}
