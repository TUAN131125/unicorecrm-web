import { ApplicationError } from "@/shared/domain";
import type { CustomerOrder } from "../model/order.types";

function commercialPayload(order: CustomerOrder): string {
  return JSON.stringify({
    orderNumber: order.orderNumber,
    orderDate: order.orderDate,
    buyerRef: order.buyerRef,
    customerId: order.customerId,
    customerName: order.customerName,
    contactId: order.contactId,
    contactName: order.contactName,
    sourceLeadId: order.sourceLeadId,
    sourceQuoteId: order.sourceQuoteId,
    sourceQuoteNumber: order.sourceQuoteNumber,
    sourceDealId: order.sourceDealId,
    sourceDealName: order.sourceDealName,
    items: order.items,
    adjustments: order.adjustments,
    subtotal: order.subtotal,
    discountTotal: order.discountTotal,
    taxTotal: order.taxTotal,
    grandTotal: order.grandTotal,
    totalAmount: order.totalAmount,
    currency: order.currency,
    expectedDeliveryDate: order.expectedDeliveryDate,
    recipientName: order.recipientName,
    recipientPhone: order.recipientPhone,
    recipientEmail: order.recipientEmail,
    shippingAddress: order.shippingAddress,
    paymentInstruction: order.paymentInstruction,
    ownerId: order.ownerId,
    ownerName: order.ownerName,
    notes: order.notes,
    internalNotes: order.internalNotes,
  });
}

export function assertOrderCommercialMutationAllowed(previous: CustomerOrder, next: CustomerOrder): void {
  if (previous.state === "DRAFT" && next.state === "DRAFT") return;
  if (commercialPayload(previous) !== commercialPayload(next)) {
    throw new ApplicationError({
      code: "ORDER_COMMERCIAL_IMMUTABLE",
      category: "BUSINESS_RULE",
      message: "Confirmed Order commercial content is immutable. Cancel the Order and create a replacement instead.",
      blockers: ["Cancel the confirmed Order and create a replacement Order."],
    });
  }
}
