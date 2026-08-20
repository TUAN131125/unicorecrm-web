import { validateEmail, validatePhone } from "@/shared/lib/contactDataValidation";
import type { CustomerOrder, OrderItem, OrderLineFulfillmentKind } from "../model/order.types";

const PHYSICAL_PRODUCT_TYPES = new Set(["physical_product", "goods", "package"]);
const DIGITAL_PRODUCT_TYPES = new Set(["digital", "subscription", "license"]);
const SERVICE_PRODUCT_TYPES = new Set(["service", "implementation", "maintenance", "support_sla", "addon"]);

export type OrderFulfillmentFieldErrors = Partial<Record<
  "recipientName" | "recipientPhone" | "recipientEmail" | "shippingAddress.line1" | "shippingAddress.city",
  string
>>;

export class OrderFulfillmentValidationError extends Error {
  readonly code = "ORDER_FULFILLMENT_INVALID";

  constructor(readonly fieldErrors: OrderFulfillmentFieldErrors) {
    super(`Physical or mixed Order is missing valid shipping data: ${Object.values(fieldErrors).join(" ")}`);
    this.name = "OrderFulfillmentValidationError";
  }
}

export function resolveOrderLineFulfillmentKind(item: Pick<OrderItem, "fulfillmentKind" | "productTypeSnapshot">): OrderLineFulfillmentKind {
  if (item.fulfillmentKind) return item.fulfillmentKind;
  const productType = item.productTypeSnapshot?.trim().toLowerCase() ?? "";
  if (PHYSICAL_PRODUCT_TYPES.has(productType)) return "PHYSICAL_SHIPMENT";
  if (DIGITAL_PRODUCT_TYPES.has(productType)) return "DIGITAL";
  if (SERVICE_PRODUCT_TYPES.has(productType)) return "SERVICE";
  return "NONE";
}

export function orderRequiresShipping(
  order: Pick<CustomerOrder, "items"> & Partial<Pick<CustomerOrder, "recipientName" | "recipientPhone" | "shippingAddress">>,
): boolean {
  if (order.items.some((item) => resolveOrderLineFulfillmentKind(item) === "PHYSICAL_SHIPMENT")) return true;
  const allExplicitlyNonPhysical = order.items.length > 0 && order.items.every((item) => {
    const resolved = resolveOrderLineFulfillmentKind(item);
    return resolved === "DIGITAL" || resolved === "SERVICE" || Boolean(item.fulfillmentKind === "NONE");
  });
  if (allExplicitlyNonPhysical) return false;
  return Boolean(order.recipientName?.trim() || order.recipientPhone?.trim() || order.shippingAddress);
}

export function getOrderFulfillmentFieldErrors(
  order: Pick<CustomerOrder, "items" | "recipientName" | "recipientPhone" | "recipientEmail" | "shippingAddress">,
): OrderFulfillmentFieldErrors {
  const errors: OrderFulfillmentFieldErrors = {};
  if (!orderRequiresShipping(order)) return errors;
  if (!order.recipientName?.trim()) errors.recipientName = "Recipient name is required.";
  if (!order.recipientPhone?.trim()) errors.recipientPhone = "Recipient phone is required.";
  else if (!validatePhone(order.recipientPhone).valid) errors.recipientPhone = "Recipient phone is invalid.";
  if (order.recipientEmail && !validateEmail(order.recipientEmail).valid) errors.recipientEmail = "Recipient email is invalid.";
  if (!order.shippingAddress?.line1.trim()) errors["shippingAddress.line1"] = "Delivery address is required.";
  if (!order.shippingAddress?.city.trim()) errors["shippingAddress.city"] = "Delivery city is required.";
  return errors;
}

export function assertOrderFulfillmentPrerequisites(
  order: Pick<CustomerOrder, "items" | "recipientName" | "recipientPhone" | "recipientEmail" | "shippingAddress">,
): void {
  const fieldErrors = getOrderFulfillmentFieldErrors(order);
  if (Object.keys(fieldErrors).length > 0) throw new OrderFulfillmentValidationError(fieldErrors);
}
