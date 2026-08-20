import type { BuyerRef } from "@/platform/identity";
import type { ExchangeRateSnapshot, MoneyDto } from "@/shared/money";
import type { EvidenceItem } from "@/shared/evidence/evidence.types";

export type InvoiceLifecycleState = "DRAFT" | "ISSUING" | "ISSUED" | "ISSUE_FAILED" | "DISCARDED" | "VOIDED";
export type InvoiceDeliveryState = "NOT_SENT" | "SENDING" | "SENT" | "DELIVERY_FAILED";
export type SettlementState = "NOT_DUE" | "UNPAID" | "PARTIAL" | "PAID" | "OVERDUE" | "CREDITED";
export type CreditNoteState = "DRAFT" | "ISSUING" | "ISSUED" | "ISSUE_FAILED" | "DISCARDED" | "VOIDED";

export interface LegalPartySnapshot {
  displayName: string;
  legalName?: string;
  taxId?: string;
  email?: string;
  phone?: string;
  addressLines: string[];
  countryCode?: string;
}

export interface InvoiceLine {
  id: string;
  /** Canonical source line. `orderLineId` is retained for persisted compatibility. */
  sourceOrderLineId?: string;
  orderLineId?: string;
  productId?: string;
  skuSnapshot?: string;
  description: string;
  unitOfMeasure?: string;
  sourceOrderQuantity?: string;
  alreadyInvoicedQuantity?: string;
  invoiceableQuantity?: string;
  quantity: string;
  unitPrice: MoneyDto;
  discountRate?: string;
  discountAmount: MoneyDto;
  taxRate?: string;
  taxAmount: MoneyDto;
  lineTotal: MoneyDto;
  notes?: string;
}

export interface InvoiceTotals {
  subtotal: MoneyDto;
  discountTotal: MoneyDto;
  taxTotal: MoneyDto;
  roundingAdjustment?: MoneyDto;
  grandTotal: MoneyDto;
}

export interface InvoiceSourceLinks {
  orderId?: string;
  paymentScheduleLineIds?: string[];
  shippingBookingIds?: string[];
  returnIds?: string[];
  milestoneCodes?: string[];
}

export interface Invoice {
  id: string;
  workspaceId?: string;
  invoiceNumber?: string;
  buyerRef: BuyerRef;
  sellerSnapshot: LegalPartySnapshot;
  buyerSnapshot: LegalPartySnapshot;
  lifecycleState: InvoiceLifecycleState;
  deliveryState: InvoiceDeliveryState;
  issueDate?: string;
  dueDate?: string;
  currency: string;
  exchangeRateSnapshot?: ExchangeRateSnapshot;
  paymentTerms?: string;
  creationIntentId?: string;
  lines: InvoiceLine[];
  totals: InvoiceTotals;
  sourceLinks: InvoiceSourceLinks;
  version: number;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  issuedAt?: string;
  issueFailureCode?: string;
  issueEvidence?: EvidenceItem[];
  discardedAt?: string;
  voidedAt?: string;
  voidReason?: string;
}

export interface CreditNoteLine {
  id: string;
  invoiceLineId?: string;
  description: string;
  quantity?: string;
  netAmount?: MoneyDto;
  taxAmount?: MoneyDto;
  reasonCode?: string;
  amount: MoneyDto;
}

export interface CreditNote {
  id: string;
  workspaceId?: string;
  creditNoteNumber?: string;
  invoiceId: string;
  sourceReturnId?: string;
  buyerRef: BuyerRef;
  exchangeRateSnapshot?: ExchangeRateSnapshot;
  state: CreditNoteState;
  reasonCode: string;
  reason: string;
  lines: CreditNoteLine[];
  total: MoneyDto;
  version: number;
  /** Command metadata is present in demo writes but omitted from authoritative read projections. */
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
  issuedAt?: string;
  voidedAt?: string;
}

export interface InvoiceDeliveryRecord {
  id: string;
  invoiceId: string;
  channel: "EMAIL" | "GMAIL" | "PDF" | "OTHER";
  recipient?: string;
  state: "PENDING" | "SENT" | "FAILED";
  sentAt?: string;
  failureCode?: string;
  createdAt: string;
}

export interface ReceivableEntry {
  invoiceId: string;
  invoiceNumber: string;
  buyerRef: BuyerRef;
  buyerName: string;
  issueDate: string;
  dueDate?: string;
  originalAmount: MoneyDto;
  allocatedAmount: MoneyDto;
  creditedAmount: MoneyDto;
  outstandingAmount: MoneyDto;
  settlementState: SettlementState;
  agingBucket: "NOT_DUE" | "CURRENT" | "1_30" | "31_60" | "61_90" | "90_PLUS";
  version: number;
}
