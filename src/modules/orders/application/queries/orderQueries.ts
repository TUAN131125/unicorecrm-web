import { createDurableId } from "@/shared/ids";
import type { Contact } from "@/modules/contacts";
import type { CustomerOrder, OrderAdjustment, OrderItem } from "../../domain/model/order.types";
import { OrderState } from "../../domain/model/order.types";
import { relationshipRefKey, type BuyerRef } from "@/platform/identity";
import type { OrderCollection, OrderRepository } from "../ports/OrderRepository";
import { resolveOrderLineFulfillmentKind } from "../../domain/rules/orderFulfillment";
import { normalizeOrderItem } from "../../domain/rules/orderCalculations";

export function flattenOrders(orderState: OrderCollection | CustomerOrder[] | undefined): CustomerOrder[] {
  if (!orderState) return [];
  if (Array.isArray(orderState)) return [...orderState].sort((a, b) => b.orderDate.localeCompare(a.orderDate));
  const seen = new Set<string>();
  return Object.values(orderState)
    .flatMap((orders) => orders.map((order) => ({ ...order })))
    .filter((order) => {
      if (seen.has(order.id)) return false;
      seen.add(order.id);
      return true;
    })
    .sort((a, b) => b.orderDate.localeCompare(a.orderDate));
}

export const getOrderById = (state: OrderCollection | CustomerOrder[], orderId: string) => flattenOrders(state).find((order) => order.id === orderId);
export const getOrdersForCustomer = (state: OrderCollection | CustomerOrder[], customerId: string) => flattenOrders(state).filter((order) => order.customerId === customerId);
export const getOrdersForQuote = (state: OrderCollection | CustomerOrder[], quoteId: string) => flattenOrders(state).filter((order) => order.sourceQuoteId === quoteId);
export const getCompletedOrders = (state: OrderCollection | CustomerOrder[]) => flattenOrders(state).filter((order) => order.state === OrderState.COMPLETED);
export const getOrdersForBuyer = (state: OrderCollection | CustomerOrder[], buyerRef: BuyerRef) => flattenOrders(state).filter((order) => relationshipRefKey(order.buyerRef) === relationshipRefKey(buyerRef));
export const getOrdersForContact = (state: OrderCollection | CustomerOrder[], contactId: string) => flattenOrders(state).filter((order) => order.contactId === contactId);

export function getOrdersForDeal(state: OrderCollection | CustomerOrder[], dealId: string, quotes: any[] = []): CustomerOrder[] {
  const all = flattenOrders(state);
  const quoteIds = new Set(quotes.filter((quote) => quote.dealId === dealId || quote.sourceDealId === dealId).map((quote) => quote.id));
  const seen = new Set<string>();
  return all.filter((order: any) => order.sourceDealId === dealId || order.dealId === dealId || order.sourceOpportunityId === dealId || order.opportunityId === dealId || (order.sourceQuoteId && quoteIds.has(order.sourceQuoteId)))
    .filter((order) => !seen.has(order.id) && Boolean(seen.add(order.id)));
}

export function getDisplayOrdersForContact(
  state: OrderCollection | CustomerOrder[],
  contact: Contact,
): Array<{ order: CustomerOrder; relationship: "contact" | "customer" }> {
  const result: Array<{ order: CustomerOrder; relationship: "contact" | "customer" }> = [];
  const relationshipKeys = new Set([
    relationshipRefKey({ type: "CONTACT", id: contact.id }),
    ...(contact.organizationAccountId
      ? [relationshipRefKey({ type: "ORGANIZATION_ACCOUNT", id: contact.organizationAccountId })]
      : []),
  ]);
  for (const order of flattenOrders(state)) {
    if (order.contactId === contact.id) result.push({ order, relationship: "contact" });
    else if (relationshipKeys.has(relationshipRefKey(order.buyerRef)) && !order.contactId) {
      result.push({ order, relationship: "customer" });
    }
  }
  return result;
}

export function queryOrders(repository: OrderRepository, filters: { search?: string; state?: string } = {}) {
  const search = filters.search?.trim().toLowerCase();
  return repository.list().filter((order) => {
    if (filters.state && order.state !== filters.state) return false;
    if (!search) return true;
    return [order.orderNumber, order.customerName, order.contactName, order.sourceDealName, order.sourceQuoteNumber].some((value) => value?.toLowerCase().includes(search));
  });
}

export function getOrderStats(orders: readonly CustomerOrder[]) {
  return {
    total: orders.length,
    draft: orders.filter((order) => order.state === OrderState.DRAFT).length,
    active: orders.filter((order) => order.state === OrderState.CONFIRMED).length,
    completed: orders.filter((order) => order.state === OrderState.COMPLETED).length,
    cancelled: orders.filter((order) => order.state === OrderState.CANCELLED).length,
    value: orders.reduce((sum, order) => sum + (order.grandTotal ?? order.totalAmount ?? 0), 0),
  };
}

export function normalizeSourceLineItemToOrderItem(lineItem: any, products: any[]): OrderItem {
  const productId = lineItem.productId || "";
  const product = products.find((item: any) => item.id === productId);
  const productTypeSnapshot = lineItem.productTypeSnapshot || product?.type || "goods";
  return normalizeOrderItem({
    ...lineItem,
    productId,
    skuSnapshot: lineItem.skuSnapshot || lineItem.sku || product?.sku || "",
    productNameSnapshot: lineItem.productNameSnapshot || lineItem.productName || lineItem.name || product?.name || "Product",
    productTypeSnapshot,
    fulfillmentKind: lineItem.fulfillmentKind || resolveOrderLineFulfillmentKind({ productTypeSnapshot }),
    unitPriceSnapshot: lineItem.unitPriceSnapshot ?? lineItem.unitPrice ?? lineItem.price ?? lineItem.amount ?? product?.listPrice ?? 0,
    // Quote/Order commercial snapshots always win. Product tax is only a fallback for direct catalog selection.
    taxRateSnapshot: lineItem.taxRateSnapshot ?? lineItem.taxRate ?? product?.taxRate ?? 0,
    taxModeSnapshot: lineItem.taxModeSnapshot ?? lineItem.taxMode ?? product?.taxMode ?? "none",
    billingCycleSnapshot: lineItem.billingCycleSnapshot || lineItem.billingCycle || product?.billingCycle,
  });
}

export function normalizeQuoteAdjustmentToOrderAdjustment(adjustment: any): OrderAdjustment {
  const sourceType = String(adjustment?.type || "FEE");
  const type: OrderAdjustment["type"] = sourceType === "DISCOUNT" || sourceType === "VOUCHER" || sourceType === "PROMOTION" || sourceType === "TAX"
    ? sourceType
    : sourceType === "SHIPPING_FEE"
      ? "SHIPPING"
      : "FEE";
  return {
    id: String(adjustment?.id || createDurableId("adjustment")),
    label: String(adjustment?.label || sourceType),
    type,
    calculation: adjustment?.calculation === "PERCENTAGE" ? "PERCENTAGE" : "FIXED_AMOUNT",
    value: Math.max(0, Number(adjustment?.value ?? adjustment?.amount) || 0),
    amount: Math.max(0, Number(adjustment?.amount) || 0),
  };
}

export function resolveOrderSourceFromQuote(quote: any, deals: any[], customers: any[], contacts: any[]) {
  const linkedDeal = deals.find((deal) => deal.id === (quote?.dealId || quote?.sourceDealId));
  const customerId = quote?.customerId || linkedDeal?.customerId || "";
  const contactId = quote?.contactId || linkedDeal?.contactId || "";
  const customer = customers.find((item) => item.id === customerId);
  const contact = contacts.find((item) => item.id === contactId);
  const buyerRef = quote?.buyerRef || linkedDeal?.buyerRef || (contactId ? { type: "CONTACT", id: contactId } : undefined);
  return {
    buyerRef,
    sourceQuoteId: quote?.id || "",
    sourceQuoteNumber: quote?.quoteNumber || "",
    sourceDealId: quote?.dealId || quote?.sourceDealId || linkedDeal?.id || "",
    sourceDealName: quote?.dealName || linkedDeal?.name || "",
    customerId,
    customerName: quote?.customerName || linkedDeal?.customerName || customer?.displayName || customer?.companyName || customer?.individualName || customer?.name || "",
    contactId,
    contactName: quote?.contactName || quote?.customerContact || linkedDeal?.contactName || contact?.fullName || contact?.name || "",
    currency: quote?.currency || "VND",
    ownerId: quote?.ownerId || linkedDeal?.ownerId || "",
    ownerName: quote?.ownerName || "",
    notes: quote?.notes || quote?.termsAndNotes || "",
    adjustments: Array.isArray(quote?.adjustments) ? quote.adjustments.map(normalizeQuoteAdjustmentToOrderAdjustment) : [],
    recipientEmail: quote?.recipientEmail || linkedDeal?.contactEmail || contact?.email || "",
    recipientPhone: quote?.recipientPhone || linkedDeal?.contactPhone || contact?.phone || "",
    shippingAddressLine1: quote?.customerAddress || linkedDeal?.address || customer?.address || "",
  };
}
