import { QuoteStatus, type Quote } from "../model/quote.types";

export const IMMUTABLE_QUOTE_STATUSES = new Set<QuoteStatus>([
  QuoteStatus.SENT,
  QuoteStatus.ACCEPTED,
  QuoteStatus.REJECTED,
  QuoteStatus.EXPIRED,
]);

export function isQuoteVersionImmutable(status: QuoteStatus): boolean {
  return IMMUTABLE_QUOTE_STATUSES.has(status);
}

export function canTransitionQuoteStatus(from: QuoteStatus, to: QuoteStatus): boolean {
  if (from === to) return true;
  const allowed: Record<QuoteStatus, QuoteStatus[]> = {
    [QuoteStatus.DRAFT]: [QuoteStatus.REVIEW, QuoteStatus.SENT],
    [QuoteStatus.REVIEW]: [QuoteStatus.DRAFT, QuoteStatus.SENT],
    [QuoteStatus.SENT]: [QuoteStatus.ACCEPTED, QuoteStatus.REJECTED, QuoteStatus.EXPIRED],
    [QuoteStatus.ACCEPTED]: [],
    [QuoteStatus.REJECTED]: [],
    [QuoteStatus.EXPIRED]: [],
  };
  return allowed[from].includes(to);
}

export function quoteContentFingerprint(quote: Quote): string {
  return JSON.stringify({
    buyerRef: quote.buyerRef,
    sourcePath: quote.sourcePath,
    dealId: quote.dealId,
    sourceDealId: quote.sourceDealId,
    contactId: quote.contactId,
    title: quote.title,
    lineItems: quote.lineItems,
    subtotal: quote.subtotal,
    discountTotal: quote.discountTotal,
    taxTotal: quote.taxTotal,
    grandTotal: quote.grandTotal,
    validUntil: quote.validUntil,
    expiryDate: quote.expiryDate,
    notes: quote.notes,
    taxPercent: quote.taxPercent,
    discountAmountToTotal: quote.discountAmountToTotal,
    termsAndNotes: quote.termsAndNotes,
    adjustments: quote.adjustments,
    recipientEmail: quote.recipientEmail,
    paymentTiming: quote.paymentTiming,
    paymentDueDays: quote.paymentDueDays,
    paymentMethod: quote.paymentMethod,
    paymentAgreement: quote.paymentAgreement,
  });
}

export function assertQuoteMutationAllowed(previous: Quote, next: Quote): Quote {
  if (isQuoteVersionImmutable(previous.status) && quoteContentFingerprint(previous) !== quoteContentFingerprint(next)) {
    throw new Error("SENT or terminal Quote versions are immutable. Create a revision instead.");
  }
  return next;
}

export function validateQuoteInvariant(quote: Quote): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(quote.version) || quote.version < 1) errors.push("Quote version must be a positive integer.");
  if (!quote.rootQuoteId) errors.push("Quote requires rootQuoteId.");
  if (!quote.buyerRef?.id) errors.push("Quote requires buyerRef.");
  if (quote.sourcePath === "DEAL" && !quote.dealId && !quote.sourceDealId) errors.push("Deal-path Quote requires Deal source.");
  if (quote.sourcePath === "DIRECT_SALE" && (quote.dealId || quote.sourceDealId)) errors.push("Direct Sale Quote must not require a Deal.");
  if (quote.revisionOfQuoteId === quote.id) errors.push("Quote revision cannot reference itself.");
  if (quote.paymentDueDays != null && (!Number.isFinite(quote.paymentDueDays) || quote.paymentDueDays < 0)) errors.push("Quote paymentDueDays must be non-negative.");
  if (quote.paymentAgreement) {
    if (quote.paymentAgreement.lines.length === 0) errors.push("Quote Payment Agreement requires at least one line.");
    if (quote.paymentAgreement.currency !== (quote.currency ?? "VND")) errors.push("Quote Payment Agreement currency must match Quote currency.");
  }
  if (quote.approvalRequired && !quote.approvalStatus) errors.push("Approval-required Quote needs approvalStatus.");
  return errors;
}

export function assertQuoteInvariant(quote: Quote): Quote {
  const errors = validateQuoteInvariant(quote);
  if (errors.length) throw new Error(errors.join(" "));
  return quote;
}
