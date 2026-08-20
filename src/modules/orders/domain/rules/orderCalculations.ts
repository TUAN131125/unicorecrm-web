import { createDurableId } from "@/shared/ids";
import type { CustomerOrder, OrderAdjustment, OrderItem } from "../model/order.types";

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

function adjustmentAmount(adjustment: OrderAdjustment, basis: number, precision = DEFAULT_MONEY_PRECISION): number {
  const value = finiteNonNegative(adjustment.value ?? adjustment.amount);
  return adjustment.calculation === "PERCENTAGE"
    ? roundMoney(Math.max(0, basis) * clampPercent(value) / 100, precision)
    : roundMoney(value, precision);
}

export function calculateOrderLineTotals(item: OrderItem, precision = DEFAULT_MONEY_PRECISION): OrderItem {
  const quantity = finiteNonNegative(item.quantity);
  const unitPrice = finiteNonNegative(item.unitPriceSnapshot ?? item.price);
  const discountPercent = clampPercent(item.discountPercent);
  const taxRate = finiteNonNegative(item.taxRateSnapshot);
  const taxMode = item.taxModeSnapshot ?? "none";
  const lineSubtotal = roundMoney(quantity * unitPrice, precision);
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
    productName: item.productNameSnapshot,
    name: item.productNameSnapshot,
    price: unitPrice,
  };
}

export function normalizeOrderItem(item: any): OrderItem {
  const productNameSnapshot = String(item.productNameSnapshot ?? item.productName ?? item.name ?? "");
  const taxModeCandidate = item.taxModeSnapshot ?? item.taxMode ?? "none";
  const taxModeSnapshot: OrderItem["taxModeSnapshot"] = ["exclusive", "inclusive", "none"].includes(taxModeCandidate)
    ? taxModeCandidate
    : "none";
  return calculateOrderLineTotals({
    id: item.id || createDurableId("item"),
    productId: String(item.productId ?? ""),
    skuSnapshot: String(item.skuSnapshot ?? item.sku ?? ""),
    productNameSnapshot,
    productName: productNameSnapshot,
    productTypeSnapshot: String(item.productTypeSnapshot ?? item.productType ?? item.type ?? "goods"),
    fulfillmentKind: item.fulfillmentKind,
    descriptionSnapshot: String(item.descriptionSnapshot ?? item.description ?? ""),
    quantity: finiteNonNegative(item.quantity, 1),
    unitPriceSnapshot: finiteNonNegative(item.unitPriceSnapshot ?? item.unitPrice ?? item.price ?? item.amount),
    discountPercent: clampPercent(item.discountPercent),
    taxRateSnapshot: finiteNonNegative(item.taxRateSnapshot ?? item.taxRate),
    taxModeSnapshot,
    billingCycleSnapshot: item.billingCycleSnapshot ?? item.billingCycle,
    lineSubtotal: 0,
    lineDiscountAmount: 0,
    lineTaxAmount: 0,
    lineTotal: 0,
    name: productNameSnapshot,
    price: finiteNonNegative(item.unitPriceSnapshot ?? item.unitPrice ?? item.price ?? item.amount),
  });
}

export interface OrderPricingResult {
  items: OrderItem[];
  subtotal: number;
  lineDiscountTotal: number;
  documentDiscountTotal: number;
  discountTotal: number;
  feeTotal: number;
  taxTotal: number;
  grandTotal: number;
  adjustments: OrderAdjustment[];
}

export function calculateOrderPricing(
  items: readonly OrderItem[],
  adjustments: readonly OrderAdjustment[] = [],
  precision = DEFAULT_MONEY_PRECISION,
): OrderPricingResult {
  const normalizedItems = items.map((item) => calculateOrderLineTotals(normalizeOrderItem(item), precision));
  const subtotal = roundMoney(normalizedItems.reduce((sum, item) => sum + item.lineSubtotal, 0), precision);
  const lineDiscountTotal = roundMoney(normalizedItems.reduce((sum, item) => sum + item.lineDiscountAmount, 0), precision);
  const afterLineDiscount = roundMoney(Math.max(0, subtotal - lineDiscountTotal), precision);
  const lineTaxTotal = roundMoney(normalizedItems.reduce((sum, item) => sum + item.lineTaxAmount, 0), precision);
  const lineGrossTotal = roundMoney(normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0), precision);
  const isDiscount = (adjustment: OrderAdjustment) => ["DISCOUNT", "VOUCHER", "PROMOTION"].includes(adjustment.type);
  const documentDiscountTotal = roundMoney(adjustments
    .filter(isDiscount)
    .reduce((sum, adjustment) => sum + adjustmentAmount(adjustment, afterLineDiscount, precision), 0), precision);
  const feeTotal = roundMoney(adjustments
    .filter((adjustment) => !isDiscount(adjustment) && adjustment.type !== "TAX")
    .reduce((sum, adjustment) => sum + adjustmentAmount(adjustment, afterLineDiscount, precision), 0), precision);
  const documentTaxBasis = roundMoney(Math.max(0, afterLineDiscount + feeTotal - documentDiscountTotal), precision);
  const documentTaxTotal = roundMoney(adjustments
    .filter((adjustment) => adjustment.type === "TAX")
    .reduce((sum, adjustment) => sum + adjustmentAmount(adjustment, documentTaxBasis, precision), 0), precision);
  const normalizedAdjustments = adjustments.map((adjustment) => ({
    ...adjustment,
    amount: adjustmentAmount(adjustment, adjustment.type === "TAX" ? documentTaxBasis : afterLineDiscount, precision),
  }));

  return {
    items: normalizedItems,
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

export function withCanonicalOrderPricing<T extends CustomerOrder>(order: T): T {
  const pricing = calculateOrderPricing(order.items ?? [], order.adjustments ?? []);
  return {
    ...order,
    items: pricing.items,
    subtotal: pricing.subtotal,
    discountTotal: pricing.discountTotal,
    taxTotal: pricing.taxTotal,
    grandTotal: pricing.grandTotal,
    totalAmount: pricing.grandTotal,
    adjustments: pricing.adjustments,
  };
}
