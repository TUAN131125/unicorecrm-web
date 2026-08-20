import type { ShippingRepository } from "../ports/ShippingRepository";
import type { ShippingBooking } from "../../domain/model/shipping.types";
import { isShippingWorkQueueItem } from "../../domain/rules/shippingRules";
import { isPositiveMoney } from "@/shared/money";
const recordsOf = (source: ShippingRepository | readonly ShippingBooking[]) => "list" in source ? source.list() : [...source];

export function getShippingBookingsForSource(source: ShippingRepository | readonly ShippingBooking[], sourceType: string, sourceId: string) {
  return recordsOf(source).filter((item) => item.sourceType === sourceType && item.sourceId === sourceId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function queryShippingBookings(source: ShippingRepository | readonly ShippingBooking[], input: { search?: string; view?: string; providerId?: string; purpose?: string } = {}) {
  const search = input.search?.trim().toLowerCase() ?? "";
  const view = input.view ?? "ALL";
  return recordsOf(source).filter((item) => {
    if (view === "NOT_READY" && item.readiness?.ready !== false) return false;
    if (view === "ACTION_REQUIRED" && !isShippingWorkQueueItem(item)) return false;
    if (view === "PENDING_BOOKING" && item.bookingStatus !== "PENDING") return false;
    if (view === "BOOKING_FAILED" && item.bookingStatus !== "FAILED") return false;
    if (view === "WAITING_PICKUP" && item.externalStatus !== "WAITING_PICKUP") return false;
    if (view === "IN_TRANSIT" && !["PICKED_UP", "IN_TRANSIT"].includes(item.externalStatus)) return false;
    if (view === "DELIVERY_FAILED" && item.externalStatus !== "DELIVERY_FAILED") return false;
    if (view === "DELIVERED" && item.externalStatus !== "DELIVERED") return false;
    if (view === "RETURNED" && item.externalStatus !== "RETURNED") return false;
    if (view === "SYNC_ERROR" && !item.lastErrorCode && !item.lastErrorMessage) return false;
    if (view === "COD_RECONCILIATION" && (!item.codAmount || !isPositiveMoney(item.codAmount) || !item.codCollectedAt)) return false;
    if (view === "BOOKED" && item.bookingStatus !== "BOOKED") return false;
    if (view === "FAILED" && item.bookingStatus !== "FAILED") return false;
    if (view === "CANCELLED" && item.bookingStatus !== "CANCELLED") return false;
    if (input.providerId && input.providerId !== "ALL" && item.providerId !== input.providerId) return false;
    if (input.purpose && input.purpose !== "ALL" && item.purpose !== input.purpose) return false;
    return !search || [item.code, item.sourceId, item.providerNameSnapshot, item.trackingCode, item.externalBookingId, item.recipientSnapshot.name, item.recipientSnapshot.phone].filter(Boolean).some((value) => String(value).toLowerCase().includes(search));
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getShippingKpis(source: ShippingRepository | readonly ShippingBooking[]) {
  const records = recordsOf(source);
  const today = new Date().toISOString().slice(0, 10);
  return {
    total: records.length,
    actionRequired: records.filter(isShippingWorkQueueItem).length,
    notReady: records.filter((item) => item.readiness?.ready === false).length,
    inTransit: records.filter((item) => ["WAITING_PICKUP", "PICKED_UP", "IN_TRANSIT"].includes(item.externalStatus)).length,
    deliveredToday: records.filter((item) => item.deliveredAt?.startsWith(today)).length,
    syncErrors: records.filter((item) => Boolean(item.lastErrorCode || item.lastErrorMessage)).length,
    codPendingReconciliation: records.filter((item) => item.codAmount && isPositiveMoney(item.codAmount) && item.codCollectedAt && !item.codCollectedAmount).length,
  };
}
