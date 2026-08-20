import type { ShippingBooking } from "../../domain/model/shipping.types";
import type { ShippingProvider } from "../../domain/model/shippingProvider";

export const SHIPPING_ACTION_IDS = ["view", "sync", "retry", "change-provider", "cancel", "label"] as const;
export type ShippingActionId = (typeof SHIPPING_ACTION_IDS)[number];

export interface ShippingActionPermissions {
  canView: boolean;
  canSync: boolean;
  canRetry: boolean;
  canCancel: boolean;
}

export function resolveShippingActionIds(
  booking: Pick<ShippingBooking, "bookingStatus" | "externalBookingId">,
  permissions: ShippingActionPermissions,
  provider?: Pick<ShippingProvider, "capabilities">,
): ShippingActionId[] {
  const actions: ShippingActionId[] = [];
  const capabilities = provider?.capabilities;
  if (permissions.canView) actions.push("view");
  if (permissions.canSync && capabilities?.sync !== false && booking.externalBookingId && booking.bookingStatus === "BOOKED") actions.push("sync");
  if (permissions.canRetry && booking.bookingStatus === "FAILED") actions.push("retry", "change-provider");
  if (permissions.canCancel && capabilities?.cancel !== false && ["PENDING", "BOOKED", "FAILED"].includes(booking.bookingStatus)) actions.push("cancel");
  if (capabilities?.label && booking.bookingStatus === "BOOKED") actions.push("label");
  return actions;
}

export function resolveShippingHeaderActionIds(
  booking: Pick<ShippingBooking, "bookingStatus" | "externalBookingId">,
  permissions: ShippingActionPermissions,
  provider?: Pick<ShippingProvider, "capabilities">,
): ShippingActionId[] {
  return resolveShippingActionIds(booking, permissions, provider).filter((id) => id !== "view");
}
