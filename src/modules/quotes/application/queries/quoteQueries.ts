import type { QuoteRepository } from "../ports/QuoteRepository";
import { QuoteApprovalStatus, QuoteStatus, type Quote } from "../../domain/model/quote.types";

export interface QuoteQuery {
  search?: string;
  status?: QuoteStatus | "all";
  customerId?: string | "all";
  dealId?: string | "all";
}

export function getQuote(repository: QuoteRepository, quoteId: string): Quote | undefined {
  return repository.getById(quoteId);
}

export function queryQuotes(repository: QuoteRepository, query: QuoteQuery): Quote[] {
  const search = query.search?.trim().toLowerCase();
  return repository.list().filter((quote) => {
    if (query.status && query.status !== "all" && quote.status !== query.status) return false;
    if (query.customerId && query.customerId !== "all" && quote.customerId !== query.customerId) return false;
    if (query.dealId && query.dealId !== "all" && quote.dealId !== query.dealId) return false;
    if (!search) return true;
    return [quote.quoteNumber, quote.title, quote.customerName, quote.dealName]
      .some((value) => value?.toLowerCase().includes(search));
  });
}


export function isQuoteAccepted(status: unknown): boolean {
  if (!status) return false;
  return String(status).toUpperCase() === QuoteStatus.ACCEPTED;
}

export function getQuoteDealId(quote: Pick<Quote, "dealId" | "sourceDealId"> | null | undefined): string | undefined {
  return quote?.dealId || quote?.sourceDealId || undefined;
}

export function getQuoteStats(quotes: readonly Quote[]) {
  return {
    total: quotes.length,
    draft: quotes.filter((q) => q.status === QuoteStatus.DRAFT).length,
    review: quotes.filter((q) => q.status === QuoteStatus.REVIEW || (q.approvalRequired && q.approvalStatus === QuoteApprovalStatus.PENDING && q.approvalRequestedAt)).length,
    sent: quotes.filter((q) => q.status === QuoteStatus.SENT).length,
    accepted: quotes.filter((q) => q.status === QuoteStatus.ACCEPTED).length,
    rejected: quotes.filter((q) => q.status === QuoteStatus.REJECTED).length,
    expired: quotes.filter((q) => q.status === QuoteStatus.EXPIRED).length,
    totalValue: quotes.reduce((sum, q) => sum + q.grandTotal, 0),
    acceptedValue: quotes.filter((q) => q.status === QuoteStatus.ACCEPTED).reduce((sum, q) => sum + q.grandTotal, 0),
  };
}
