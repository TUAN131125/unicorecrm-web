import type { QuoteLineItem } from "../../domain/model/quote.types";

export interface QuoteDraftValidationMessages {
  minOneLineItem: string;
  productRequired: string;
  rowNumber: (row: number) => string;
  quantityInvalid: string;
  unitPriceInvalid: string;
  discountInvalid: string;
  titleRequired: string;
}

export function validateQuoteDraft(
  title: string,
  lineItems: readonly QuoteLineItem[],
  messages: QuoteDraftValidationMessages,
): string | null {
  if (lineItems.length === 0) return messages.minOneLineItem;

  for (let index = 0; index < lineItems.length; index += 1) {
    const line = lineItems[index];
    const row = messages.rowNumber(index + 1);
    const productName = line.productNameSnapshot ?? line.productName ?? "";
    const unitPrice = line.unitPriceSnapshot ?? line.unitPrice ?? 0;

    if (!productName.trim()) return `${messages.productRequired} (${row})`;
    if (line.quantity <= 0) return `${messages.quantityInvalid} (${productName || row})`;
    if (unitPrice < 0) return `${messages.unitPriceInvalid} (${productName || row})`;
    if (line.discountPercent < 0 || line.discountPercent > 100) {
      return `${messages.discountInvalid} (${productName || row})`;
    }
  }

  return title.trim() ? null : messages.titleRequired;
}
