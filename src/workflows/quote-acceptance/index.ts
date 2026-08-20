import {
  getQuoteSnapshot,
  getQuotesSnapshot,
  replaceQuotes,
  transitionQuoteStatus,
  QuoteStatus,
  type Quote,
} from "@/modules/quotes";
import {
  closeDealWon,
  getDealSnapshot,
  getDealsSnapshot,
  replaceDeals,
  type Deal,
  type DealActivity,
} from "@/modules/deals";
import {
  createMutationMetadata,
  executeMutationCommand,
  type MutationCommandMetadata,
  type MutationOutcome,
} from "@/shared/application";

export interface AcceptQuoteCommand {
  quoteId: string;
}

interface DemoAcceptQuoteCommand extends AcceptQuoteCommand {
  occurredAt?: string;
  dealActivity?: DealActivity;
}

interface DemoAcceptQuoteResult {
  quote: Quote;
  deal?: Deal;
}

export interface AcceptQuoteTransactionResult {
  quoteId: string;
  quoteStatus: "ACCEPTED";
  acceptedAt: string;
  orderCreated: false;
  dealId?: string;
  dealOutcome?: "WON";
}

function acceptQuoteAndCloseDeal(command: DemoAcceptQuoteCommand): DemoAcceptQuoteResult {
  const quote = getQuoteSnapshot(command.quoteId);
  if (!quote) throw new Error(`QUOTE_NOT_FOUND:${command.quoteId}`);
  const now = command.occurredAt ?? new Date().toISOString();
  const quoteSnapshot = getQuotesSnapshot();
  const dealSnapshot = getDealsSnapshot();
  try {
    const accepted = transitionQuoteStatus(command.quoteId, QuoteStatus.ACCEPTED, now);
    if (!accepted) throw new Error(`QUOTE_ACCEPTANCE_FAILED:${command.quoteId}`);
    const dealId = accepted.sourceDealId || accepted.dealId;
    if (!dealId) return { quote: accepted };
    const currentDeal = getDealSnapshot(dealId);
    if (!currentDeal) throw new Error(`DEAL_NOT_FOUND:${dealId}`);
    const closed = closeDealWon(dealId, {
      type: "QUOTE_ACCEPTED",
      sourceId: accepted.id,
      occurredAt: accepted.acceptedAt ?? now,
    }, command.dealActivity);
    if (!closed) throw new Error(`DEAL_WON_TRANSITION_FAILED:${dealId}`);
    return { quote: accepted, deal: closed };
  } catch (error) {
    replaceQuotes(quoteSnapshot);
    replaceDeals(dealSnapshot);
    throw error;
  }
}

export function acceptQuoteAndCloseDealCommand(
  command: AcceptQuoteCommand,
  metadata: Partial<MutationCommandMetadata> = {},
): Promise<MutationOutcome<AcceptQuoteTransactionResult>> {
  return executeMutationCommand(
    {
      commandType: "quote.accept-and-close-deal",
      aggregateType: "quote",
      aggregateId: command.quoteId,
      payload: command,
    },
    createMutationMetadata(`quote.accept:${command.quoteId}`, metadata),
    () => {
      const result = acceptQuoteAndCloseDeal(command);
      return {
        quoteId: result.quote.id,
        quoteStatus: "ACCEPTED",
        acceptedAt: result.quote.acceptedAt ?? new Date().toISOString(),
        orderCreated: false,
        ...(result.deal === undefined ? {} : { dealId: result.deal.id, dealOutcome: "WON" as const }),
      };
    },
  );
}
