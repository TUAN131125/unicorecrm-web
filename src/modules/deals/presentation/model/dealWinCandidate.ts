import type { CustomerOrder } from "@/modules/orders";
import type { Quote } from "@/modules/quotes";
import type { DealWinEvidence } from "../../domain/model/deal.types";

/** A UI candidate only; the owner command verifies the binding on save. */
export function dealWinCandidate(connected: boolean, orders: CustomerOrder[], quotes: Quote[], now: string): DealWinEvidence | undefined {
  const order = orders.find(item => item.state === "CONFIRMED" && Boolean(item.confirmedAt));
  if (order?.confirmedAt) return { type: "ORDER_CONFIRMED", sourceId: order.id, occurredAt: order.confirmedAt };
  if (connected) return undefined;
  const quote = quotes.filter(item => item.status === "ACCEPTED")
    .sort((a, b) => (b.acceptedAt || b.updatedAt || b.createdAt).localeCompare(a.acceptedAt || a.updatedAt || a.createdAt))[0];
  return quote ? { type: "QUOTE_ACCEPTED", sourceId: quote.id, occurredAt: quote.acceptedAt || now } : undefined;
}
