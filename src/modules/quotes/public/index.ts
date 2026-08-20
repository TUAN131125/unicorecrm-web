export * from "./quotes";

export { allocateQuoteIdentity, archiveQuote, archiveQuotes, saveQuote, updateQuote, updateManyQuotes } from "../application/commands/quoteRepositoryCommands";

export { approveQuote, changeQuoteStatus, duplicateQuote, recordQuoteDelivery, requestQuoteApproval, requestQuoteApprovalChanges, reviseQuote } from "../application/commands/quoteCommands";

export { getQuote, queryQuotes, getQuoteStats, isQuoteAccepted, getQuoteDealId } from "../application/queries/quoteQueries";

export { normalizeQuoteLineItem, calculateQuoteLineTotals, calculateQuotePricing, calculateQuoteTotals, withCanonicalQuotePricing } from "../domain/rules/quoteCalculations";

export { calculateQuoteDraftTotals } from "../domain/rules/quoteDraftPricing";

export { assertQuoteConvertible, getQuoteConversionIssues, isQuotePastValidity } from "../domain/rules/quoteConversion";

export {
  isQuoteVersionImmutable,
  canTransitionQuoteStatus,
  quoteContentFingerprint,
  assertQuoteMutationAllowed,
  validateQuoteInvariant,
  assertQuoteInvariant,
} from "../domain/rules/quoteVersioning";

export { applyQuoteApprovalAssessment, canQuoteBeSent, DEFAULT_QUOTE_APPROVAL_POLICY, evaluateQuoteApproval, isQuoteApprovalCurrent } from "../domain/rules/quoteApprovalPolicy";

export { validateQuoteDraft } from "../application/queries/quoteDraftValidation";

export { QuoteApprovalStatus, QuoteStatus, SalesDocumentAdjustmentType } from "../domain/model/quote.types";

export type {
  Quote,
  QuoteApprovalReason,
  QuoteDeliveryRecord,
  QuoteDeliveryChannel,
  QuoteLineItem,
  QuotePaymentMethod,
  QuotePaymentTiming,
  QuoteSourcePath,
  SalesDocumentAdjustment,
  SalesDocumentAdjustmentCalculation,
} from "../domain/model/quote.types";

export type { QuoteRepository } from "../application/ports/QuoteRepository";
