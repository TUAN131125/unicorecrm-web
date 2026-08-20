import { orderRequiresShipping as orderContainsPhysicalLines, type CustomerOrder } from "@/modules/orders";
import type { PaymentCompletionReadiness } from "@/modules/payments";
import {
  getShippingRequirementGroup,
  isDeliveredShippingEvidence,
  type ShippingBooking,
} from "@/modules/shipping";

export interface OrderClosingPolicy {
  policyVersion: string;
}

export const STANDARD_ORDER_CLOSING_POLICY: OrderClosingPolicy = {
  policyVersion: "order-closing/fulfillment-evidence-v3",
};

export interface OrderClosingEvaluation {
  ready: boolean;
  blockers: string[];
  shippingEvidenceIds: string[];
}

function outboundBookingsFor(order: CustomerOrder, bookings: readonly ShippingBooking[]): ShippingBooking[] {
  return bookings.filter((booking) => booking.sourceType === "ORDER" && booking.sourceId === order.id && booking.purpose === "ORDER_OUTBOUND");
}

export function orderRequiresShipping(order: CustomerOrder, bookings: readonly ShippingBooking[]): boolean {
  return orderContainsPhysicalLines(order) || outboundBookingsFor(order, bookings).length > 0;
}

function groupOutboundBookings(order: CustomerOrder, bookings: readonly ShippingBooking[]): ShippingBooking[][] {
  const groups = new Map<string, ShippingBooking[]>();
  for (const booking of outboundBookingsFor(order, bookings)) {
    const key = getShippingRequirementGroup(booking);
    groups.set(key, [...(groups.get(key) ?? []), booking]);
  }
  return [...groups.values()];
}

export function evaluateOrderClosingPolicy(
  order: CustomerOrder,
  payment: PaymentCompletionReadiness,
  bookings: readonly ShippingBooking[],
  _policy: OrderClosingPolicy = STANDARD_ORDER_CLOSING_POLICY,
): OrderClosingEvaluation {
  const blockers = [...payment.blockers];
  const shippingEvidenceIds: string[] = [];

  if (orderRequiresShipping(order, bookings)) {
    const groups = groupOutboundBookings(order, bookings);
    if (groups.length === 0) {
      blockers.push("Required outbound ShippingBooking does not exist.");
    } else {
      groups.forEach((attempts, index) => {
        const delivered = attempts.find(isDeliveredShippingEvidence);
        if (delivered) shippingEvidenceIds.push(delivered.id);
        else blockers.push(`Required outbound shipment ${index + 1} is not DELIVERED with deliveredAt evidence.`);
      });
    }
  }

  return { ready: blockers.length === 0, blockers, shippingEvidenceIds };
}
