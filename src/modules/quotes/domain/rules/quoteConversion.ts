import { QuoteStatus, type Quote } from "../model/quote.types";
import { calculateQuotePricing } from "./quoteCalculations";

export type QuoteConversionIssueCode =
  | "NOT_ACCEPTED"
  | "EXPIRED"
  | "MISSING_BUYER"
  | "MISSING_LINES"
  | "INVALID_TOTAL";

export interface QuoteConversionIssue {
  code: QuoteConversionIssueCode;
  message: string;
}

function dateOnly(value: Date | string): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

export function isQuotePastValidity(quote: Pick<Quote, "validUntil" | "expiryDate">, now: Date | string = new Date()): boolean {
  const expiry = quote.validUntil || quote.expiryDate;
  if (!expiry || !/^\d{4}-\d{2}-\d{2}/.test(expiry)) return false;
  return expiry.slice(0, 10) < dateOnly(now);
}

export function getQuoteConversionIssues(quote: Quote, now: Date | string = new Date()): QuoteConversionIssue[] {
  const issues: QuoteConversionIssue[] = [];
  if (quote.status !== QuoteStatus.ACCEPTED) {
    issues.push({ code: "NOT_ACCEPTED", message: "Only an accepted Quote can be converted to an Order." });
  }
  if (isQuotePastValidity(quote, now)) {
    issues.push({ code: "EXPIRED", message: "The Quote validity date has passed and it cannot be converted." });
  }
  if (!quote.buyerRef?.id) {
    issues.push({ code: "MISSING_BUYER", message: "The Quote requires a canonical buyer before conversion." });
  }
  if (!quote.lineItems?.length) {
    issues.push({ code: "MISSING_LINES", message: "The Quote requires at least one line item before conversion." });
  }
  if (quote.lineItems?.length) {
    const pricing = calculateQuotePricing(quote.lineItems, quote.adjustments ?? []);
    if (!Number.isFinite(quote.grandTotal) || Math.abs(pricing.grandTotal - quote.grandTotal) > 0.01) {
      issues.push({ code: "INVALID_TOTAL", message: "The Quote total is not consistent with its commercial snapshots." });
    }
  }
  return issues;
}

export function assertQuoteConvertible(quote: Quote, now: Date | string = new Date()): Quote {
  const issues = getQuoteConversionIssues(quote, now);
  if (issues.length) throw new Error(issues.map((issue) => issue.message).join(" "));
  return quote;
}
