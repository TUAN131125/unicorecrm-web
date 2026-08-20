import type { BuyerRef } from "@/platform/identity";
import type { ExchangeRateSnapshot } from "@/shared/money";
import type { PaymentAgreementSnapshot } from "@/shared/order-to-cash";

export enum SalesDocumentAdjustmentType {
  DISCOUNT = "DISCOUNT",
  VOUCHER = "VOUCHER",
  PROMOTION = "PROMOTION",
  TAX = "TAX",
  SERVICE_FEE = "SERVICE_FEE",
  SHIPPING_FEE = "SHIPPING_FEE",
  INSTALLATION_FEE = "INSTALLATION_FEE",
  CONSULTATION_FEE = "CONSULTATION_FEE",
  SURCHARGE = "SURCHARGE"
}

export type SalesDocumentAdjustmentCalculation = "FIXED_AMOUNT" | "PERCENTAGE";

export interface SalesDocumentAdjustment {
  id: string;
  type: SalesDocumentAdjustmentType;
  label: string;
  calculation: SalesDocumentAdjustmentCalculation;
  value: number;
  amount: number;
}

export enum QuoteStatus {
  DRAFT = "DRAFT",
  REVIEW = "REVIEW",
  SENT = "SENT",
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
  EXPIRED = "EXPIRED"
}

export type QuoteSourcePath = "DEAL" | "DIRECT_SALE";

export enum QuoteApprovalStatus {
  NOT_REQUIRED = "NOT_REQUIRED",
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  CHANGES_REQUESTED = "CHANGES_REQUESTED",
}

export type QuoteApprovalReasonCode =
  | "LINE_DISCOUNT_LIMIT"
  | "TOTAL_DISCOUNT_LIMIT"
  | "GRAND_TOTAL_LIMIT"
  | "POSTPAID_DAYS_LIMIT"
  | "CUSTOM_PAYMENT_TERMS"
  | "MANUAL_REVIEW";

export interface QuoteApprovalReason {
  code: QuoteApprovalReasonCode;
  label: string;
  actual?: string | number;
  limit?: string | number;
}

export type QuotePaymentTiming = "PREPAID" | "ON_DELIVERY" | "POSTPAID" | "CUSTOM";
export type QuotePaymentMethod = "BANK_TRANSFER" | "COD" | "CASH" | "CARD" | "E_WALLET" | "OTHER";

export type QuoteDeliveryChannel =
  | "GMAIL"
  | "EMAIL"
  | "ZALO"
  | "CHAT_APP"
  | "SMS"
  | "OTHER"
  | "PDF";

export interface QuoteDeliveryRecord {
  id: string;
  channel: QuoteDeliveryChannel;
  evidenceType?: "USER_CONFIRMED_SENT" | "PROVIDER_ACCEPTED" | "PROVIDER_DELIVERED";
  recipientEmail?: string;
  recipient?: string;
  note?: string;
  sentAt: string;
  sentBy?: string;
  fileName?: string;
  contentFingerprint: string;
}

export interface Quote {
  /** Backend optimistic-concurrency token, distinct from the business quote revision. */
  resourceVersion?: number;
  /** Backend-projected action hints for presentation only; authorization remains server enforced. */
  authoritativeActions?: { accept: { allowed: boolean; blockerCodes: string[] } };
  id: string;
  quoteNumber: string;
  version: number;
  rootQuoteId: string;
  revisionOfQuoteId?: string;
  buyerRef: BuyerRef;
  sourcePath: QuoteSourcePath;
  /** Optional because Direct Sale may bypass Deal. */
  dealId?: string;
  dealName?: string;
  /** Canonical Deal source alias retained for integration compatibility. */
  sourceDealId?: string;
  /** @deprecated Presentation compatibility only. */
  customerId?: string;
  /** @deprecated Presentation compatibility only. */
  customerName?: string;
  customerAddress?: string;
  customerContact?: string;
  contactId?: string;
  leadId?: string;
  leadName?: string;
  senderName?: string;
  senderAddress?: string;
  senderEmail?: string;
  senderTaxId?: string;
  status: QuoteStatus;
  approvalStatus?: QuoteApprovalStatus;
  approvalRequired?: boolean;
  approvalReasons?: QuoteApprovalReason[];
  approvalRequestedAt?: string;
  approvalRequestedBy?: string;
  approvedAt?: string;
  approvedBy?: string;
  approvalDecisionNote?: string;
  approvalContentFingerprint?: string;
  approvalPolicyVersion?: string;
  recipientEmail?: string;
  paymentTiming?: QuotePaymentTiming;
  paymentDueDays?: number;
  paymentMethod?: QuotePaymentMethod;
  /** Versioned commercial payment commitment. Legacy timing/method fields remain read compatibility only. */
  paymentAgreement?: PaymentAgreementSnapshot;
  deliveryHistory?: QuoteDeliveryRecord[];
  title: string;
  currency?: string;
  exchangeRateSnapshot?: ExchangeRateSnapshot;
  ownerId?: string;
  ownerName?: string;
  lineItems: QuoteLineItem[];
  subtotal: number;
  discountTotal?: number;
  taxTotal?: number;
  grandTotal: number;
  validUntil?: string;
  createdAt: string;
  updatedAt?: string;
  expiryDate?: string;
  reviewRequestedAt?: string;
  sentAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  expiredAt?: string;
  notes?: string;
  taxPercent?: number;
  discountAmountToTotal?: number;
  termsAndNotes?: string;
  adjustments?: SalesDocumentAdjustment[];
  sourceLeadId?: string;
  archivedAt?: string;
  archiveReason?: string;
}

export interface QuoteLineItem {
  id: string;
  productId?: string;
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
}
