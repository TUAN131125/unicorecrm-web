import { QuoteLineItem, SalesDocumentAdjustment, SalesDocumentAdjustmentType } from "../model/quote.types";
import { createDurableId } from "@/shared/ids";

const DEFAULT_MONEY_PRECISION = 2;

function roundMoney(value: number, precision = DEFAULT_MONEY_PRECISION): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** Math.max(0, precision);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function finiteNonNegative(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function clampPercent(value: unknown): number {
  return Math.min(100, finiteNonNegative(value));
}

function adjustmentAmount(adjustment: SalesDocumentAdjustment, basis: number, precision = DEFAULT_MONEY_PRECISION): number {
  const value = finiteNonNegative(adjustment.value ?? adjustment.amount);
  return adjustment.calculation === "PERCENTAGE"
    ? roundMoney(Math.max(0, basis) * clampPercent(value) / 100, precision)
    : roundMoney(value, precision);
}

export function normalizeQuoteLineItem(item: any): QuoteLineItem {
  const productNameSnapshot = String(item.productNameSnapshot ?? item.productName ?? "");
  const unitPriceSnapshot = finiteNonNegative(item.unitPriceSnapshot ?? item.unitPrice);
  const descriptionSnapshot = String(item.descriptionSnapshot ?? item.description ?? "");
  const quantity = finiteNonNegative(item.quantity, 1);
  const discountPercent = clampPercent(item.discountPercent);
  const taxRateSnapshot = finiteNonNegative(item.taxRateSnapshot ?? item.taxRate ?? item.taxPercent);
  const taxModeCandidate = item.taxModeSnapshot ?? item.taxMode ?? "none";
  const taxModeSnapshot: QuoteLineItem["taxModeSnapshot"] = ["exclusive", "inclusive", "none"].includes(taxModeCandidate)
    ? taxModeCandidate
    : "none";

  return calculateQuoteLineTotals({
    id: item.id || createDurableId("line"),
    productId: item.productId || "",
    skuSnapshot: item.skuSnapshot || "",
    productNameSnapshot,
    productTypeSnapshot: item.productTypeSnapshot || "license",
    descriptionSnapshot,
    quantity,
    unitPriceSnapshot,
    discountPercent,
    taxRateSnapshot,
    taxModeSnapshot,
    billingCycleSnapshot: item.billingCycleSnapshot || "one_time",
    productName: productNameSnapshot,
    unitPrice: unitPriceSnapshot,
    description: descriptionSnapshot,
  });
}

export function calculateQuoteLineTotals(item: QuoteLineItem, precision = DEFAULT_MONEY_PRECISION): QuoteLineItem {
  const quantity = finiteNonNegative(item.quantity);
  const unitPrice = finiteNonNegative(item.unitPriceSnapshot ?? item.unitPrice);
  const discountPercent = clampPercent(item.discountPercent);
  const taxRate = finiteNonNegative(item.taxRateSnapshot);
  const taxMode = item.taxModeSnapshot ?? "none";

  const lineSubtotal = roundMoney(unitPrice * quantity, precision);
  const lineDiscountAmount = roundMoney(lineSubtotal * discountPercent / 100, precision);
  const discountedAmount = roundMoney(Math.max(0, lineSubtotal - lineDiscountAmount), precision);
  const lineTaxAmount = taxMode === "exclusive"
    ? roundMoney(discountedAmount * taxRate / 100, precision)
    : taxMode === "inclusive" && taxRate > 0
      ? roundMoney(discountedAmount - discountedAmount / (1 + taxRate / 100), precision)
      : 0;
  const lineTotal = taxMode === "exclusive"
    ? roundMoney(discountedAmount + lineTaxAmount, precision)
    : discountedAmount;

  return {
    ...item,
    quantity,
    unitPriceSnapshot: unitPrice,
    discountPercent,
    taxRateSnapshot: taxRate,
    taxModeSnapshot: taxMode,
    lineSubtotal,
    lineDiscountAmount,
    lineTaxAmount,
    lineTotal,
    productName: item.productNameSnapshot ?? item.productName ?? "",
    unitPrice,
    description: item.descriptionSnapshot ?? item.description ?? "",
  };
}

export interface QuotePricingResult {
  lineItems: QuoteLineItem[];
  subtotal: number;
  lineDiscountTotal: number;
  documentDiscountTotal: number;
  discountTotal: number;
  feeTotal: number;
  taxTotal: number;
  grandTotal: number;
  adjustments: SalesDocumentAdjustment[];
}

export function calculateQuotePricing(
  lines: readonly QuoteLineItem[],
  adjustments: readonly SalesDocumentAdjustment[] = [],
  discountTotalParam = 0,
  precision = DEFAULT_MONEY_PRECISION,
): QuotePricingResult {
  const lineItems = lines.map((line) => calculateQuoteLineTotals(normalizeQuoteLineItem(line), precision));
  const subtotal = roundMoney(lineItems.reduce((sum, line) => sum + (line.lineSubtotal ?? 0), 0), precision);
  const lineDiscountTotal = roundMoney(lineItems.reduce((sum, line) => sum + (line.lineDiscountAmount ?? 0), 0), precision);
  const lineAmountAfterDiscount = roundMoney(Math.max(0, subtotal - lineDiscountTotal), precision);
  const lineTaxTotal = roundMoney(lineItems.reduce((sum, line) => sum + (line.lineTaxAmount ?? 0), 0), precision);
  const lineGrossTotal = roundMoney(lineItems.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0), precision);

  const discountTypes = new Set([
    SalesDocumentAdjustmentType.DISCOUNT,
    SalesDocumentAdjustmentType.VOUCHER,
    SalesDocumentAdjustmentType.PROMOTION,
  ]);

  const documentDiscountTotal = roundMoney(adjustments
    .filter((adjustment) => discountTypes.has(adjustment.type))
    .reduce((sum, adjustment) => sum + adjustmentAmount(adjustment, lineAmountAfterDiscount, precision), finiteNonNegative(discountTotalParam)), precision);

  const feeTotal = roundMoney(adjustments
    .filter((adjustment) => !discountTypes.has(adjustment.type) && adjustment.type !== SalesDocumentAdjustmentType.TAX)
    .reduce((sum, adjustment) => sum + adjustmentAmount(adjustment, lineAmountAfterDiscount, precision), 0), precision);

  const documentTaxBasis = roundMoney(Math.max(0, lineAmountAfterDiscount + feeTotal - documentDiscountTotal), precision);
  const documentTaxTotal = roundMoney(adjustments
    .filter((adjustment) => adjustment.type === SalesDocumentAdjustmentType.TAX)
    .reduce((sum, adjustment) => sum + adjustmentAmount(adjustment, documentTaxBasis, precision), 0), precision);

  const normalizedAdjustments = adjustments.map((adjustment) => {
    const basis = adjustment.type === SalesDocumentAdjustmentType.TAX
      ? documentTaxBasis
      : lineAmountAfterDiscount;
    return { ...adjustment, amount: adjustmentAmount(adjustment, basis, precision) };
  });

  return {
    lineItems,
    subtotal,
    lineDiscountTotal,
    documentDiscountTotal,
    discountTotal: roundMoney(lineDiscountTotal + documentDiscountTotal, precision),
    feeTotal,
    taxTotal: roundMoney(lineTaxTotal + documentTaxTotal, precision),
    grandTotal: roundMoney(Math.max(0, lineGrossTotal + feeTotal - documentDiscountTotal + documentTaxTotal), precision),
    adjustments: normalizedAdjustments,
  };
}

export function calculateQuoteTotals(
  lines: QuoteLineItem[],
  adjustments: SalesDocumentAdjustment[] = [],
  discountTotalParam = 0,
): Pick<QuotePricingResult, "subtotal" | "discountTotal" | "taxTotal" | "grandTotal" | "adjustments"> {
  const result = calculateQuotePricing(lines, adjustments, discountTotalParam);
  return {
    subtotal: result.subtotal,
    discountTotal: result.discountTotal,
    taxTotal: result.taxTotal,
    grandTotal: result.grandTotal,
    adjustments: result.adjustments,
  };
}

export function withCanonicalQuotePricing<T extends import("../model/quote.types").Quote>(quote: T): T {
  // Retain historical imported totals when the legacy record has no commercial lines.
  // New and edited Quotes are validated to require lines before persistence.
  if ((quote.lineItems ?? []).length === 0 && (quote.adjustments ?? []).length === 0) return structuredClone(quote);
  const pricing = calculateQuotePricing(quote.lineItems ?? [], quote.adjustments ?? []);
  return {
    ...quote,
    lineItems: pricing.lineItems,
    subtotal: pricing.subtotal,
    discountTotal: pricing.discountTotal,
    discountAmountToTotal: pricing.discountTotal,
    taxTotal: pricing.taxTotal,
    grandTotal: pricing.grandTotal,
    adjustments: pricing.adjustments,
  };
}
