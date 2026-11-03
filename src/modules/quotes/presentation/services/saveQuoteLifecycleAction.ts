import { archiveQuoteCommand, createQuoteRevisionCommand, expireQuoteCommand } from "../../public/quotes";

export type QuoteLifecycleAction = "revise" | "expire" | "archive";
export function saveQuoteLifecycleAction(action: QuoteLifecycleAction, quoteId: string, expectedVersion: number,
  identity: string, reason: string, actorId: string) {
  const metadata = { expectedVersion, idempotencyKey: `quote.${action}:${identity}` };
  if (action === "revise") return createQuoteRevisionCommand(quoteId, undefined, metadata);
  if (action === "expire") return expireQuoteCommand(quoteId, reason ? { reason } : {}, metadata);
  return archiveQuoteCommand(quoteId, { reason, actorId }, metadata);
}
