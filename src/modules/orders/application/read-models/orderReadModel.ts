import type { BuyerRef } from "@/platform/identity";
import type { MoneyDto } from "@/shared/money";
import type { CustomerOrder, OrderAdjustment, OrderItem, OrderState } from "../../domain/model/order.types";

export interface OrderActionAvailabilityReadModel { allowed: boolean; blockerCodes: string[] }
export interface OrderReadActions { confirm: OrderActionAvailabilityReadModel; cancel: OrderActionAvailabilityReadModel }
export interface OrderLineReadModel {
  id: string;
  productId: string;
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
export interface OrderAdjustmentReadModel { id: string; label: string; type: OrderAdjustment["type"]; calculation: OrderAdjustment["calculation"]; value: string; amount: MoneyDto }
export interface OrderShippingAddressReadModel { line1: string; line2?: string; ward?: string; district?: string; city: string; country?: string; postalCode?: string }
export interface CreditPolicyEvaluationReadModel { status: "NOT_REQUIRED" | "APPROVAL_REQUIRED"; blockerCodes: string[]; policyVersion?: string; evaluatedAt?: string }
export interface OrderCreditApprovalSummaryReadModel { id: string; state: "REQUESTED" | "APPROVED" | "REJECTED" | "REVOKED" | "CONSUMED" | "SUPERSEDED"; amount: MoneyDto; policyVersion: string; orderResourceVersion: number; paymentPlanResourceVersion: number; resourceVersion: number }
export interface OrderReadModel {
  id: string;
  orderNumber: string;
  orderDate: string;
  buyerRef: BuyerRef;
  contactId?: string;
  sourceLeadId?: string;
  sourceQuoteId?: string;
  sourceQuoteNumber?: string;
  sourceDealId?: string;
  state: OrderState;
  lineItems: OrderLineReadModel[];
  adjustments?: OrderAdjustmentReadModel[];
  subtotal: MoneyDto;
  discountTotal: MoneyDto;
  taxTotal: MoneyDto;
  grandTotal: MoneyDto;
  currency: string;
  confirmedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  expectedDeliveryDate?: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientEmail?: string;
  shippingAddress?: OrderShippingAddressReadModel;
  ownerId?: string;
  notes?: string;
  creditPolicyEvaluation?: CreditPolicyEvaluationReadModel;
  creditApproval?: OrderCreditApprovalSummaryReadModel;
  actions: OrderReadActions;
  archivedAt?: string;
  archiveReason?: string;
  resourceVersion: number;
  createdAt: string;
  updatedAt: string;
}

/** UI display projection for existing Order views; never a financial authority. */
export function projectOrderReadModel(record: OrderReadModel): CustomerOrder {
  return {
    id: record.id,
    orderNumber: record.orderNumber,
    orderDate: record.orderDate,
    buyerRef: record.buyerRef,
    state: record.state,
    items: record.lineItems.map(projectLine),
    ...(record.adjustments === undefined ? {} : { adjustments: record.adjustments.map(projectAdjustment) }),
    subtotal: displayNumber(record.subtotal.amount, "subtotal"),
    discountTotal: displayNumber(record.discountTotal.amount, "discountTotal"),
    taxTotal: displayNumber(record.taxTotal.amount, "taxTotal"),
    grandTotal: displayNumber(record.grandTotal.amount, "grandTotal"),
    totalAmount: displayNumber(record.grandTotal.amount, "grandTotal"),
    currency: record.currency,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    resourceVersion: record.resourceVersion,
    authoritativeActions: structuredClone(record.actions),
    ...(record.contactId === undefined ? {} : { contactId: record.contactId }),
    ...(record.sourceLeadId === undefined ? {} : { sourceLeadId: record.sourceLeadId }),
    ...(record.sourceQuoteId === undefined ? {} : { sourceQuoteId: record.sourceQuoteId }),
    ...(record.sourceQuoteNumber === undefined ? {} : { sourceQuoteNumber: record.sourceQuoteNumber }),
    ...(record.sourceDealId === undefined ? {} : { sourceDealId: record.sourceDealId }),
    ...(record.confirmedAt === undefined ? {} : { confirmedAt: record.confirmedAt }),
    ...(record.completedAt === undefined ? {} : { completedAt: record.completedAt }),
    ...(record.cancelledAt === undefined ? {} : { cancelledAt: record.cancelledAt }),
    ...(record.expectedDeliveryDate === undefined ? {} : { expectedDeliveryDate: record.expectedDeliveryDate }),
    ...(record.recipientName === undefined ? {} : { recipientName: record.recipientName }),
    ...(record.recipientPhone === undefined ? {} : { recipientPhone: record.recipientPhone }),
    ...(record.recipientEmail === undefined ? {} : { recipientEmail: record.recipientEmail }),
    ...(record.shippingAddress === undefined ? {} : { shippingAddress: structuredClone(record.shippingAddress) }),
    ...(record.ownerId === undefined ? {} : { ownerId: record.ownerId }),
    ...(record.notes === undefined ? {} : { notes: record.notes }),
    ...(record.creditApproval === undefined ? {} : { creditApprovalEvidence: structuredClone(record.creditApproval) }),
    ...(record.archivedAt === undefined ? {} : { archivedAt: record.archivedAt }),
    ...(record.archiveReason === undefined ? {} : { archiveReason: record.archiveReason }),
  };
}
function projectLine(line: OrderLineReadModel): OrderItem {
  return {
    id: line.id,
    productId: line.productId,
    productNameSnapshot: line.productNameSnapshot,
    quantity: displayNumber(line.quantity, "quantity"),
    unitPriceSnapshot: displayNumber(line.unitPrice.amount, "unitPrice"),
    discountPercent: displayNumber(line.discountRate, "discountRate"),
    taxModeSnapshot: line.taxMode.toLowerCase() as "exclusive" | "inclusive" | "none",
    lineSubtotal: displayNumber(line.lineSubtotal.amount, "lineSubtotal"),
    lineDiscountAmount: displayNumber(line.lineDiscountAmount.amount, "lineDiscountAmount"),
    lineTaxAmount: displayNumber(line.lineTaxAmount.amount, "lineTaxAmount"),
    lineTotal: displayNumber(line.lineTotal.amount, "lineTotal"),
    ...(line.skuSnapshot === undefined ? {} : { skuSnapshot: line.skuSnapshot }),
    ...(line.productTypeSnapshot === undefined ? {} : { productTypeSnapshot: line.productTypeSnapshot }),
    ...(line.descriptionSnapshot === undefined ? {} : { descriptionSnapshot: line.descriptionSnapshot }),
    ...(line.taxRate === undefined ? {} : { taxRateSnapshot: displayNumber(line.taxRate, "taxRate") }),
    ...(line.billingCycleSnapshot === undefined ? {} : { billingCycleSnapshot: line.billingCycleSnapshot }),
  };
}
function projectAdjustment(item: OrderAdjustmentReadModel): OrderAdjustment {
  return { id: item.id, label: item.label, type: item.type, calculation: item.calculation, value: displayNumber(item.value, "adjustmentValue"), amount: displayNumber(item.amount.amount, "adjustmentAmount") };
}
function displayNumber(value: string, field: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`ORDER_READ_MODEL_INVALID_DECIMAL:${field}`);
  return parsed;
}
