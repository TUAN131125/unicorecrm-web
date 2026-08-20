import type { BuyerRef } from "@/platform/identity";
import type { ExchangeRateSnapshot } from "@/shared/money";
import type { CustomerDocumentDeliveryChannel, CustomerDocumentDeliveryRecord } from "@/shared/domain";
import type { PaymentAgreementSnapshot } from "@/shared/order-to-cash";

export type OrderLineFulfillmentKind = "PHYSICAL_SHIPMENT" | "DIGITAL" | "SERVICE" | "NONE";

export interface OrderItem {
  id: string;
  productId: string;
  skuSnapshot?: string;
  productNameSnapshot: string;
  productName?: string;
  productTypeSnapshot?: string;
  fulfillmentKind?: OrderLineFulfillmentKind;
  descriptionSnapshot?: string;
  quantity: number;
  unitPriceSnapshot: number;
  discountPercent: number;
  taxRateSnapshot?: number;
  taxModeSnapshot?: "exclusive" | "inclusive" | "none";
  billingCycleSnapshot?: string;
  lineSubtotal: number;
  lineDiscountAmount: number;
  lineTaxAmount: number;
  lineTotal: number;
  name?: string;
  price?: number;
}

export type OrderLineItem = OrderItem;

export interface OrderAdjustment {
  id: string;
  label: string;
  type: "TAX" | "DISCOUNT" | "FEE" | "SHIPPING" | "VOUCHER" | "PROMOTION";
  calculation: "PERCENTAGE" | "FIXED_AMOUNT";
  value: number;
  amount: number;
}

export type OrderDeliveryChannel = CustomerDocumentDeliveryChannel;
export type OrderDeliveryRecord = CustomerDocumentDeliveryRecord;

export const OrderState = {
  DRAFT: "DRAFT",
  CONFIRMED: "CONFIRMED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;
export type OrderState = typeof OrderState[keyof typeof OrderState];

export interface OrderCompletionAudit {
  policyVersion: string;
  correlationId: string;
  evidenceId: string;
  occurredAt: string;
  shippingEvidenceIds?: string[];
}

export interface OrderCancellationAudit {
  reason: string;
  reasonCode?: string;
  actorId: string;
  actorName?: string;
  occurredAt: string;
  correlationId?: string;
}


export interface OrderPaymentInstruction {
  method: "BANK_TRANSFER" | "COD" | "EXTERNAL_GATEWAY";
  bankAccount?: {
    sourceAccountId: string;
    bankCode: string;
    bankBin: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
  amount: number;
  transferContent: string;
  qrPayload?: string;
  generatedAt: string;
  configurationVersion?: number;
}

export interface OrderShippingAddress {
  line1: string;
  line2?: string;
  ward?: string;
  wardCode?: string;
  district?: string;
  districtCode?: string;
  city: string;
  provinceCode?: string;
  country?: string;
  postalCode?: string;
}

export interface CustomerOrder {
  /** Backend optimistic-concurrency token. Connected commands must not derive this from browser snapshots. */
  resourceVersion?: number;
  /** Backend-projected action hints for presentation only; authorization remains server enforced. */
  authoritativeActions?: { confirm: { allowed: boolean; blockerCodes: string[] }; cancel: { allowed: boolean; blockerCodes: string[] } };
  id: string;
  orderId?: string;
  orderNumber: string;
  orderDate: string;
  /** Canonical buyer identity. Never a Lead or Customer aggregate. */
  buyerRef: BuyerRef;
  /** @deprecated Display/legacy route compatibility only; not buyer ownership. */
  customerId?: string;
  /** @deprecated Display snapshot only. */
  customerName?: string;
  contactId?: string;
  contactName?: string;
  sourceLeadId?: string;
  sourceQuoteId?: string;
  sourceQuoteNumber?: string;
  sourceDealId?: string;
  sourceDealName?: string;
  state: OrderState;
  items: OrderItem[];
  adjustments?: OrderAdjustment[];
  subtotal?: number;
  discountTotal?: number;
  taxTotal?: number;
  grandTotal?: number;
  totalAmount: number;
  currency?: string;
  exchangeRateSnapshot?: ExchangeRateSnapshot;
  confirmedAt?: string;
  completedAt?: string;
  completion?: OrderCompletionAudit;
  cancelledAt?: string;
  cancellation?: OrderCancellationAudit;
  /** Presentation/retention metadata. Archive is not a business state. */
  archivedAt?: string;
  archiveReason?: string;
  expectedDeliveryDate?: string;
  /** Shipping prerequisites. Order owns recipient and commercial delivery data, not carrier execution. */
  recipientName?: string;
  recipientPhone?: string;
  recipientEmail?: string;
  shippingAddress?: OrderShippingAddress;
  /** Immutable payment agreement copied from the accepted Quote or authored on the Order draft. */
  paymentAgreementSnapshot?: PaymentAgreementSnapshot;
  /** Payment guidance generated when the Order is confirmed. */
  paymentInstruction?: OrderPaymentInstruction;
  creditApproval?: { approvedBy: string; approvedByName?: string; approvedAt: string; reason: string; policyRevision?: number; approvedAmount: number; currency: string };
  /** Authoritative, single-use backend credit-approval summary. Never authored from a form or browser repository. */
  creditApprovalEvidence?: { id: string; state: "REQUESTED" | "APPROVED" | "REJECTED" | "REVOKED" | "CONSUMED" | "SUPERSEDED"; amount: { amount: string; currency: string }; policyVersion: string; orderResourceVersion: number; paymentPlanResourceVersion: number; resourceVersion: number };
  /** Customer-facing document delivery evidence. Resending appends evidence without mutating commercial content. */
  deliveryHistory?: OrderDeliveryRecord[];
  sentAt?: string;
  ownerId?: string;
  ownerName?: string;
  ownerAssignment?: {
    assignedAt: string;
    assignedBy: string;
  };
  notes?: string;
  internalNotes?: string;
  createdAt?: string;
  updatedAt?: string;
}
