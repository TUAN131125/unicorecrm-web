import type { BuyerRef } from "@/platform/identity";
import type { MoneyDto } from "@/shared/money";
import type { PaymentAgreementSnapshot } from "@/shared/order-to-cash";
import {
  QuoteStatus,
  type Quote,
  type QuoteApprovalReason,
  type QuoteApprovalStatus,
  type QuoteDeliveryRecord,
  type QuoteLineItem,
  type QuoteSourcePath,
  type SalesDocumentAdjustment,
} from "../../domain/model/quote.types";

export interface QuoteActionAvailabilityReadModel { allowed: boolean; blockerCodes: string[] }
export interface QuoteReadActions { accept: QuoteActionAvailabilityReadModel }
export interface QuoteLineReadModel {
  id: string;
  productId?: string;
  skuSnapshot?: string;
  productNameSnapshot: string;
  productTypeSnapshot?: string;
  descriptionSnapshot?: string;
  quantity: string;
  unitPrice: MoneyDto;
  discountRate: string;
  taxRate?: string;
  taxMode: "EXCLUSIVE" | "INCLUSIVE" | "NONE";
  billingCycleSnapshot?: string;
  lineSubtotal: MoneyDto;
  lineDiscountAmount: MoneyDto;
  lineTaxAmount: MoneyDto;
  lineTotal: MoneyDto;
}
export interface CommercialAdjustmentReadModel {
  id: string;
  label: string;
  type: SalesDocumentAdjustment["type"];
  calculation: SalesDocumentAdjustment["calculation"];
  value: string;
  amount: MoneyDto;
}
export interface QuoteApprovalReasonReadModel {
  code: QuoteApprovalReason["code"];
  label: string;
  actual?: string;
  limit?: string;
}
export interface QuoteDeliveryRecordReadModel extends Omit<QuoteDeliveryRecord, "sentBy"> { sentBy?: string; }
export interface QuoteReadModel {
  id: string;
  quoteNumber: string;
  quoteRevision: number;
  rootQuoteId: string;
  revisionOfQuoteId?: string;
  buyerRef: BuyerRef;
  sourcePath: QuoteSourcePath;
  sourceDealId?: string;
  contactId?: string;
  sourceLeadId?: string;
  status: QuoteStatus;
  title: string;
  currency: string;
  ownerId?: string;
  recipientEmail?: string;
  senderName?: string;
  senderAddress?: string;
  senderEmail?: string;
  senderTaxId?: string;
  lineItems: QuoteLineReadModel[];
  adjustments?: CommercialAdjustmentReadModel[];
  subtotal: MoneyDto;
  discountTotal: MoneyDto;
  taxTotal: MoneyDto;
  grandTotal: MoneyDto;
  validUntil?: string;
  approvalStatus?: QuoteApprovalStatus;
  approvalRequired?: boolean;
  approvalReasons?: QuoteApprovalReasonReadModel[];
  approvalRequestedAt?: string;
  approvalRequestedBy?: string;
  approvedAt?: string;
  approvedBy?: string;
  approvalDecisionNote?: string;
  approvalContentFingerprint?: string;
  approvalPolicyVersion?: string;
  paymentAgreement?: PaymentAgreementSnapshot;
  deliveryHistory?: QuoteDeliveryRecordReadModel[];
  reviewRequestedAt?: string;
  sentAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  expiredAt?: string;
  notes?: string;
  archivedAt?: string;
  archiveReason?: string;
  actions: QuoteReadActions;
  resourceVersion: number;
  createdAt: string;
  updatedAt: string;
}

/** UI display projection for existing Quote views; never a pricing authority. */
export function projectQuoteReadModel(record: QuoteReadModel): Quote {
  return {
    id: record.id,
    quoteNumber: record.quoteNumber,
    version: record.quoteRevision,
    rootQuoteId: record.rootQuoteId,
    buyerRef: record.buyerRef,
    sourcePath: record.sourcePath,
    status: record.status,
    title: record.title,
    currency: record.currency,
    lineItems: record.lineItems.map(projectLine),
    subtotal: displayNumber(record.subtotal.amount, "subtotal"),
    discountTotal: displayNumber(record.discountTotal.amount, "discountTotal"),
    taxTotal: displayNumber(record.taxTotal.amount, "taxTotal"),
    grandTotal: displayNumber(record.grandTotal.amount, "grandTotal"),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    resourceVersion: record.resourceVersion,
    authoritativeActions: structuredClone(record.actions),
    ...(record.revisionOfQuoteId === undefined ? {} : { revisionOfQuoteId: record.revisionOfQuoteId }),
    ...(record.sourceDealId === undefined ? {} : { sourceDealId: record.sourceDealId, dealId: record.sourceDealId }),
    ...(record.contactId === undefined ? {} : { contactId: record.contactId }),
    ...(record.sourceLeadId === undefined ? {} : { sourceLeadId: record.sourceLeadId }),
    ...(record.ownerId === undefined ? {} : { ownerId: record.ownerId }),
    ...(record.recipientEmail === undefined ? {} : { recipientEmail: record.recipientEmail }),
    ...(record.senderName === undefined ? {} : { senderName: record.senderName }),
    ...(record.senderAddress === undefined ? {} : { senderAddress: record.senderAddress }),
    ...(record.senderEmail === undefined ? {} : { senderEmail: record.senderEmail }),
    ...(record.senderTaxId === undefined ? {} : { senderTaxId: record.senderTaxId }),
    ...(record.adjustments === undefined ? {} : { adjustments: record.adjustments.map(projectAdjustment) }),
    ...(record.validUntil === undefined ? {} : { validUntil: record.validUntil }),
    ...(record.approvalStatus === undefined ? {} : { approvalStatus: record.approvalStatus }),
    ...(record.approvalRequired === undefined ? {} : { approvalRequired: record.approvalRequired }),
    ...(record.approvalReasons === undefined ? {} : { approvalReasons: structuredClone(record.approvalReasons) }),
    ...(record.approvalRequestedAt === undefined ? {} : { approvalRequestedAt: record.approvalRequestedAt }),
    ...(record.approvalRequestedBy === undefined ? {} : { approvalRequestedBy: record.approvalRequestedBy }),
    ...(record.approvedAt === undefined ? {} : { approvedAt: record.approvedAt }),
    ...(record.approvedBy === undefined ? {} : { approvedBy: record.approvedBy }),
    ...(record.approvalDecisionNote === undefined ? {} : { approvalDecisionNote: record.approvalDecisionNote }),
    ...(record.approvalContentFingerprint === undefined ? {} : { approvalContentFingerprint: record.approvalContentFingerprint }),
    ...(record.approvalPolicyVersion === undefined ? {} : { approvalPolicyVersion: record.approvalPolicyVersion }),
    ...(record.paymentAgreement === undefined ? {} : { paymentAgreement: structuredClone(record.paymentAgreement) }),
    ...(record.deliveryHistory === undefined ? {} : { deliveryHistory: structuredClone(record.deliveryHistory) }),
    ...(record.reviewRequestedAt === undefined ? {} : { reviewRequestedAt: record.reviewRequestedAt }),
    ...(record.sentAt === undefined ? {} : { sentAt: record.sentAt }),
    ...(record.acceptedAt === undefined ? {} : { acceptedAt: record.acceptedAt }),
    ...(record.rejectedAt === undefined ? {} : { rejectedAt: record.rejectedAt }),
    ...(record.expiredAt === undefined ? {} : { expiredAt: record.expiredAt }),
    ...(record.notes === undefined ? {} : { notes: record.notes }),
    ...(record.archivedAt === undefined ? {} : { archivedAt: record.archivedAt }),
    ...(record.archiveReason === undefined ? {} : { archiveReason: record.archiveReason }),
  };
}
function projectLine(line: QuoteLineReadModel): QuoteLineItem {
  return {
    id: line.id,
    productNameSnapshot: line.productNameSnapshot,
    quantity: displayNumber(line.quantity, "quantity"),
    unitPriceSnapshot: displayNumber(line.unitPrice.amount, "unitPrice"),
    discountPercent: displayNumber(line.discountRate, "discountRate"),
    taxModeSnapshot: line.taxMode.toLowerCase() as "exclusive" | "inclusive" | "none",
    lineSubtotal: displayNumber(line.lineSubtotal.amount, "lineSubtotal"),
    lineDiscountAmount: displayNumber(line.lineDiscountAmount.amount, "lineDiscountAmount"),
    lineTaxAmount: displayNumber(line.lineTaxAmount.amount, "lineTaxAmount"),
    lineTotal: displayNumber(line.lineTotal.amount, "lineTotal"),
    ...(line.productId === undefined ? {} : { productId: line.productId }),
    ...(line.skuSnapshot === undefined ? {} : { skuSnapshot: line.skuSnapshot }),
    ...(line.productTypeSnapshot === undefined ? {} : { productTypeSnapshot: line.productTypeSnapshot }),
    ...(line.descriptionSnapshot === undefined ? {} : { descriptionSnapshot: line.descriptionSnapshot }),
    ...(line.taxRate === undefined ? {} : { taxRateSnapshot: displayNumber(line.taxRate, "taxRate") }),
    ...(line.billingCycleSnapshot === undefined ? {} : { billingCycleSnapshot: line.billingCycleSnapshot }),
  };
}
function projectAdjustment(item: CommercialAdjustmentReadModel): SalesDocumentAdjustment {
  return { id: item.id, label: item.label, type: item.type, calculation: item.calculation, value: displayNumber(item.value, "adjustmentValue"), amount: displayNumber(item.amount.amount, "adjustmentAmount") };
}
function displayNumber(value: string, field: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`QUOTE_READ_MODEL_INVALID_DECIMAL:${field}`);
  return parsed;
}
