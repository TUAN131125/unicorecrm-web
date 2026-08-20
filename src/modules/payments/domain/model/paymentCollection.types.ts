import type { BuyerRef } from "@/platform/identity";
import type { ExchangeRateSnapshot, MoneyDto } from "@/shared/money";

export type PaymentMethodAvailability = "ACTIVE" | "HISTORICAL_ONLY";
export type PaymentMethodKind = "BANK_TRANSFER" | "CASH" | "CARD" | "E_WALLET" | "COD" | "DIRECT_DEBIT" | "EXTERNAL_GATEWAY" | "OTHER";
export type PaymentIntentState = "CREATED" | "REQUIRES_ACTION" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "EXPIRED";
export type RefundIntentState = "CREATED" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
export type RefundProviderAttemptState = "QUEUED" | "SUBMITTED" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELLATION_REQUESTED" | "CANCELLED" | "CANCELLATION_REJECTED" | "UNKNOWN";
export type PaymentRecordState = "CREATED" | "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "EXPIRED" | "REVERSED";
export type PaymentAllocationState = "EFFECTIVE" | "REVERSED";
export type CustomerCreditState = "AVAILABLE" | "PARTIALLY_ALLOCATED" | "ALLOCATED" | "REVERSED";
export type CodCustomerCollectionState = "NOT_REQUESTED" | "REQUESTED" | "COLLECTED" | "FAILED";
export type CodMerchantRemittanceState = "NOT_APPLICABLE" | "PENDING" | "REMITTED" | "FAILED";

export interface PaymentProviderCatalogItem {
  code: string;
  displayName: string;
  enabled: boolean;
  channel: "ONLINE_GATEWAY" | "BANK" | "POS" | "CARRIER" | "OFFLINE";
  supportedMethodCodes: string[];
  supportedCurrencies: string[];
  checkoutOrigins?: string[];
}

export interface PaymentMethodCatalogItem {
  code: string;
  kind: PaymentMethodKind;
  displayNameVi: string;
  displayNameEn: string;
  enabled: boolean;
  channels: Array<"BANK" | "ONLINE_GATEWAY" | "POS" | "CARRIER" | "OFFLINE" | "EXTERNAL">;
  supportedCurrencies: string[];
  providerCodes?: string[];
  requiresPhysicalShipping?: boolean;
  supportsIntent: boolean;
  supportsManualRecording: boolean;
  supportsRefund: boolean;
  supportsReconciliation: boolean;
  requiresReference: boolean;
  requiresEvidence: boolean;
  displayOrder: number;
  availability: PaymentMethodAvailability;
}

export interface PaymentIntent {
  id: string;
  workspaceId?: string;
  buyerRef: BuyerRef;
  orderId?: string;
  invoiceIds: string[];
  scheduleLineIds: string[];
  amount: MoneyDto;
  methodCode: string;
  providerCode: string;
  state: PaymentIntentState;
  checkoutUrl?: string;
  clientPayload?: Record<string, unknown>;
  expiresAt: string;
  version: number;
  /** Command-processing metadata; intentionally absent from authoritative read projections. */
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
  failureCode?: string;
  purpose?: "DEPOSIT" | "FULL_PAYMENT" | "INSTALLMENT" | "OVERDUE_REMINDER" | "OTHER";
  communicationHistory?: PaymentRequestDelivery[];
}

export interface PaymentRequestDelivery {
  id: string;
  channel: "COPY" | "LINK" | "QR" | "EMAIL" | "SMS" | "ZALO" | "DOWNLOAD";
  recipient?: string;
  state: "SENDING" | "SENT" | "FAILED";
  templateKey: string;
  renderedContent: string;
  sentAt?: string;
  failureCode?: string;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  workspaceId?: string;
  buyerRef: BuyerRef;
  orderId?: string;
  intentId?: string;
  kind: "PAYMENT" | "REFUND";
  state: PaymentRecordState;
  amount: MoneyDto;
  exchangeRateSnapshot?: ExchangeRateSnapshot;
  methodCode: string;
  channel: "BANK" | "ONLINE_GATEWAY" | "POS" | "CARRIER" | "OFFLINE" | "EXTERNAL";
  providerCode?: string;
  refundOfPaymentRecordId?: string;
  refundOfCustomerCreditId?: string;
  refundIntentId?: string;
  occurredAt: string;
  externalReference?: string;
  evidenceMetadata?: Record<string, string>;
  evidence?: import("@/shared/evidence").EvidenceItem[];
  reconciliationState: "UNRECONCILED" | "MATCHED" | "MISMATCH";
  codCustomerCollectionState?: CodCustomerCollectionState;
  codMerchantRemittanceState?: CodMerchantRemittanceState;
  effectiveForReceivables?: boolean;
  /** Command-processing metadata; intentionally absent from authoritative read projections. */
  idempotencyKey?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface RefundIntent {
  id: string;
  workspaceId?: string;
  sourceReturnId?: string;
  buyerRef: BuyerRef;
  orderId?: string;
  invoiceIds: string[];
  paymentRecordId?: string;
  customerCreditId?: string;
  amount: MoneyDto;
  exchangeRateSnapshot?: ExchangeRateSnapshot;
  state: RefundIntentState;
  refundPaymentRecordId?: string;
  providerCode?: string;
  latestProviderAttemptId?: string;
  reasonCode: string;
  reason: string;
  version: number;
  /** Command-processing metadata; intentionally absent from authoritative read projections. */
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
  failureCode?: string;
}

export interface RefundProviderAttempt {
  id: string;
  workspaceId?: string;
  refundIntentId: string;
  providerCode: string;
  sequenceNumber: number;
  state: RefundProviderAttemptState;
  retryOfAttemptId?: string;
  providerReference?: string;
  failureCode?: string;
  cancellationReasonCode?: string;
  cancellationReason?: string;
  cancellationRequestedAt?: string;
  cancellationAcknowledgedAt?: string;
  submittedAt?: string;
  completedAt?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface InvoicePaymentAllocation {
  id: string;
  workspaceId?: string;
  buyerRef: BuyerRef;
  invoiceId: string;
  paymentRecordId?: string;
  customerCreditId?: string;
  scheduleLineId?: string;
  amount: MoneyDto;
  state: PaymentAllocationState;
  /** Command-processing metadata; intentionally absent from authoritative read projections. */
  idempotencyKey?: string;
  version: number;
  createdAt: string;
  reversedAt?: string;
  reversalReasonCode?: string;
  reversalReason?: string;
  reversedBy?: string;
}

export interface CustomerCredit {
  id: string;
  workspaceId?: string;
  buyerRef: BuyerRef;
  sourcePaymentRecordId: string;
  originalAmount: MoneyDto;
  availableAmount: MoneyDto;
  state: CustomerCreditState;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CodEvidenceProjection {
  paymentRecordId: string;
  customerPaymentEvidenceState: CodCustomerCollectionState;
  merchantRemittanceState: CodMerchantRemittanceState;
  effectiveForReceivables: boolean;
}
