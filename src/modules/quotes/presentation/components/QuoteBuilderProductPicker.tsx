import React from "react";
import { ProductPickerModal, useProductPickerCatalog, type Product, type SelectedPickerItem } from "@/modules/products";
import { Modal } from "@/shared/components/ui";
import { isQuoteConnectedMode } from "../../public/quotes";
import type { QuoteLineItem } from "../../domain/model/quote.types";
import { normalizeQuoteLineItem } from "../../domain/rules/quoteCalculations";
import { useI18n } from "@/i18n";
import { createDurableId } from "@/shared/ids";

interface QuoteBuilderProductPickerProps {
  isOpen: boolean; onClose(): void; products: Product[]; quoteLines: QuoteLineItem[]; currency: string;
  onChangeLines(lines: QuoteLineItem[]): void; onToast(message: string, type?: "success" | "info" | "error"): void;
  suggestedProductId?: string;
}
export function toInitialQuoteProductSelection(products: readonly Product[], lines: readonly QuoteLineItem[]): SelectedPickerItem[] {
  return lines.flatMap(line => {
    const product = products.find(p => p.id === line.productId);
    return product ? [{ product, quantity: line.quantity, customPrice: line.unitPrice, discountPercent: line.discountPercent, billingCycle: line.billingCycleSnapshot as Product["billingCycle"], taxMode: line.taxModeSnapshot }] : [];
  });
}
export const QuoteBuilderProductPicker: React.FC<QuoteBuilderProductPickerProps> = ({ isOpen, onClose, products, quoteLines, currency, onChangeLines, onToast, suggestedProductId }) => {
  const { locale } = useI18n(); const vi = locale === "vi"; const connected = isQuoteConnectedMode();
  const catalog = useProductPickerCatalog(isOpen && connected, [...quoteLines.flatMap(x => x.productId ? [x.productId] : []), ...(suggestedProductId ? [suggestedProductId] : [])]);
  const initial = toInitialQuoteProductSelection(connected ? catalog.selected : products, quoteLines);
  const suggestion = catalog.selected.find(p => p.id === suggestedProductId && p.status === "active" && p.currency === currency);
  if (suggestion && !initial.some(x => x.product.id === suggestion.id)) initial.push({ product: suggestion, quantity: 1, discountPercent: 0 });
  if (isOpen && connected && catalog.preparing) return <Modal isOpen onClose={onClose} title={vi ? "Chọn sản phẩm" : "Choose products"}><p>{vi ? "Đang tải danh mục…" : "Loading catalog…"}</p></Modal>;
  return <ProductPickerModal id="quote_builder_picker" isOpen={isOpen} onClose={onClose} mode="commercial" context="quote" currency={currency}
    products={connected ? catalog.products : products} initialSelected={initial} catalogLoading={connected && catalog.loading} catalogError={catalog.error} catalogPriceOnly={connected}
    onSearchCatalog={connected ? catalog.search : undefined} hasMore={connected && Boolean(catalog.next)} onLoadMore={catalog.more} onRetryCatalog={catalog.retry}
    catalogNotice={catalog.missing.length ? (vi ? "Một số dòng lịch sử không thể xác minh. Các dòng này được giữ nguyên; có thể bỏ dòng trực tiếp tại bảng báo giá." : "Some historical lines cannot be verified. They remain unchanged; remove them explicitly from the Quote table if needed.") : undefined}
    onApply={selected => {
      if (selected.some(x => !quoteLines.some(line => line.productId === x.product.id) && (x.product.currency !== currency || x.product.status !== "active" || connected && !x.product.unitPrice))) {
        onToast(vi ? "Chỉ thêm sản phẩm hoạt động, có đơn giá được phép đọc và cùng tiền tệ báo giá." : "Choose active products with readable prices in the Quote currency.", "error"); return;
      }
      // Unavailable historical lines stay untouched; removing them is an explicit builder action.
      const resolvedIds = new Set(initial.map(x => x.product.id));
      const preserved = quoteLines.filter(x => !x.productId || !resolvedIds.has(x.productId));
      const lines = selected.map(x => {
        const old = quoteLines.find(line => line.productId === x.product.id);
        // Choosing another product must not silently replace an existing commercial snapshot.
        if (old) return normalizeQuoteLineItem({ ...old, quantity: x.quantity, discountPercent: x.discountPercent ?? old.discountPercent,
          ...(old.inputDecimals ? { inputDecimals: { ...old.inputDecimals, quantity: String(x.quantity), discountRate: String(x.discountPercent ?? old.discountPercent ?? 0) } } : {}) });
        const price = connected ? x.product.listPrice : x.customPrice ?? x.product.listPrice;
        return normalizeQuoteLineItem({ id: createDurableId("quote-line"), productId: x.product.id,
          productNameSnapshot: x.product.name, skuSnapshot: x.product.sku, productTypeSnapshot: x.product.type,
          descriptionSnapshot: x.product.description ?? "", quantity: x.quantity, unitPriceSnapshot: price,
          discountPercent: x.discountPercent ?? 0, taxRateSnapshot: x.product.taxRate, taxModeSnapshot: x.product.taxMode,
          billingCycleSnapshot: x.product.billingCycle,
          ...(connected && x.product.unitPrice ? { inputDecimals: { quantity: String(x.quantity), unitPrice: x.product.unitPrice.amount, discountRate: String(x.discountPercent ?? 0), taxRate: String(x.product.taxRate) } } : {}) });
      });
      onChangeLines([...preserved, ...lines]); onClose();
      onToast(vi ? "Đã áp dụng lựa chọn sản phẩm. Lưu nháp để xác minh giá với máy chủ." : "Selection applied. Save the draft to verify prices with the server.", "info");
    }}/>
};
