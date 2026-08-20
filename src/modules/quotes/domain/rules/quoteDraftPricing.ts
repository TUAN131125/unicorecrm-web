import type { QuoteLineItem, SalesDocumentAdjustment } from "../model/quote.types";
import { calculateQuotePricing } from "./quoteCalculations";

export interface QuoteDraftTotals {
  lineItems: QuoteLineItem[];
  subtotal: number;
  discountTotal: number;
  feeTotal: number;
  taxTotal: number;
  grandTotal: number;
  adjustments: SalesDocumentAdjustment[];
}

export function calculateQuoteDraftTotals(
  lineItems: readonly QuoteLineItem[],
  adjustments: readonly SalesDocumentAdjustment[],
): QuoteDraftTotals {
  const pricing = calculateQuotePricing(lineItems, adjustments);
  return {
    lineItems: pricing.lineItems,
    subtotal: pricing.subtotal,
    discountTotal: pricing.discountTotal,
    feeTotal: pricing.feeTotal,
    taxTotal: pricing.taxTotal,
    grandTotal: pricing.grandTotal,
    adjustments: pricing.adjustments,
  };
}
