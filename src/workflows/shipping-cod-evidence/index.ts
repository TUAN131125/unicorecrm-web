import { getOrderSnapshot } from "@/modules/orders";
import { recordPayment, type PaymentTransaction } from "@/modules/payments";
import {
  getShippingBookingSnapshot,
  getShippingApiRuntime,
  syncShippingBookingCommandBoundary,
  type ShippingBooking,
} from "@/modules/shipping";

export interface ShippingCodEvidenceSyncResult {
  booking: ShippingBooking;
  payment?: PaymentTransaction;
}

/**
 * Connected mode executes only the Shipping command boundary. The command is
 * currently blocked until an authoritative Shipping sync operation exists, so
 * this workflow cannot silently coordinate Shipping and Payment in the browser.
 *
 * Demo/local mode may project carrier collection evidence after the local
 * Shipping command commits. That projection is explicitly non-production and
 * never represents merchant remittance or receivables effectiveness.
 */
export async function syncShippingAndPaymentCodEvidence(
  bookingId: string,
  input: { actorId: string; actorName?: string; now?: string },
): Promise<ShippingCodEvidenceSyncResult> {
  const existing = getShippingBookingSnapshot(bookingId);
  if (!existing) throw new Error(`Shipping booking ${bookingId} not found.`);

  const outcome = await syncShippingBookingCommandBoundary(bookingId, input, {
    expectedVersion: existing.version,
    actor: { id: input.actorId, name: input.actorName },
  });
  const booking = outcome.data;
  if (getShippingApiRuntime().mode === "connected") return { booking };
  const collected = booking.codCollectedAmount;
  const collectedAmount = collected ? Number(collected.amount) : 0;
  if (!collected || !Number.isFinite(collectedAmount) || collectedAmount <= 0 || booking.sourceType !== "ORDER") return { booking };

  const order = getOrderSnapshot(booking.sourceId);
  if (!order) throw new Error("COD collection evidence references an unknown Order.");
  const occurredAt = booking.codCollectedAt ?? booking.providerUpdatedAt ?? input.now ?? new Date().toISOString();
  const payment = recordPayment({
    id: `demo_cod_collection_${booking.id}`,
    orderId: order.id,
    buyerRef: order.buyerRef,
    amount: collectedAmount,
    currency: collected.currency,
    occurredAt,
    method: "COD",
    source: "CARRIER",
    externalReference: booking.id,
    providerId: booking.providerId,
    carrierReference: booking.trackingCode ?? booking.externalBookingId,
    codCollectionState: "COLLECTED",
    correlationId: booking.correlationId,
    idempotencyKey: `demo:shipping-cod-collected:${booking.id}:${occurredAt}:${collected.amount}`,
    actorId: input.actorId,
    actorName: input.actorName,
  });
  return { booking, payment };
}
