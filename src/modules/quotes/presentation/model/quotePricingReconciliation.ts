import type { Quote } from "../../domain/model/quote.types";

type PricingField = "subtotal" | "discountTotal" | "taxTotal" | "grandTotal";
export interface QuotePricingDifference { field: PricingField; preview: string; authoritative: string }
export function compareQuotePricing(preview: Quote, authoritative: Quote, precision: number): QuotePricingDifference[] {
  const fields: PricingField[] = ["subtotal", "discountTotal", "taxTotal", "grandTotal"];
  return fields.flatMap(field => {
    const before = (preview[field] ?? 0).toFixed(precision);
    const after = (authoritative[field] ?? 0).toFixed(precision);
    return before === after ? [] : [{ field, preview: before, authoritative: after }];
  });
}
export function quotePricingReconciliationNotice(differences: QuotePricingDifference[], currency: string, locale: string): string {
  const labels: Record<PricingField, string> = locale === "vi"
    ? { subtotal: "Tạm tính", discountTotal: "Chiết khấu", taxTotal: "Thuế", grandTotal: "Tổng tiền" }
    : { subtotal: "Subtotal", discountTotal: "Discount", taxTotal: "Tax", grandTotal: "Grand total" };
  const prefix = locale === "vi" ? "Đã lưu theo tổng tiền máy chủ. Xem trước → chính thức:" : "Saved using server-calculated totals. Preview → official:";
  return `${prefix} ${differences.map(item => `${labels[item.field]} ${item.preview} → ${item.authoritative} ${currency}`).join("; ")}`;
}
