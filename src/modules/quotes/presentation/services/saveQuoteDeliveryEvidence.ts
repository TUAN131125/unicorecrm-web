import { recordQuoteDeliveryCommand } from "../../public/quotes";
import type { QuoteDeliveryConfirmationValue } from "../components/QuoteDeliveryConfirmationModal";

/** Persist the opening Quote version and replay the same delivery identity on retry. */
export async function saveQuoteDeliveryEvidence(
  quoteId: string,
  expectedVersion: number | undefined,
  value: QuoteDeliveryConfirmationValue,
  deliveryId: string,
  actorId: string,
): Promise<boolean> {
  if (!quoteId || expectedVersion === undefined || !Number.isSafeInteger(expectedVersion) || expectedVersion < 0) return false;
  const outcome = await recordQuoteDeliveryCommand(quoteId, {
    id: deliveryId, ...value, evidenceType: "USER_CONFIRMED_SENT", sentBy: actorId,
  }, { idempotencyKey: `quote.send:${quoteId}:${deliveryId}`, expectedVersion });
  return outcome.data.id === quoteId
    && (outcome.outcome === "COMMITTED" || outcome.outcome === "REPLAYED" || outcome.outcome === "DEMO_COMMITTED");
}
