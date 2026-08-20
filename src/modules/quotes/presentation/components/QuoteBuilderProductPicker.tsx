import React from "react";
import { ProductPickerModal, type Product, type SelectedPickerItem } from "@/modules/products";
import type { QuoteLineItem } from "../../domain/model/quote.types";
import { normalizeQuoteLineItem } from "../../domain/rules/quoteCalculations";
import { useI18n } from "@/i18n";
import { createDurableId } from "@/shared/ids";

type ToastType = "success" | "info" | "error";

interface QuoteBuilderProductPickerProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  quoteLines: QuoteLineItem[];
  currency: string;
  onChangeLines: (lines: QuoteLineItem[]) => void;
  onToast: (message: string, type?: ToastType) => void;
}

const toInitialSelection = (products: Product[], quoteLines: QuoteLineItem[], currency: string): SelectedPickerItem[] => {
  return quoteLines.map((line) => {
    const originalProduct = products.find((product) => product.id === line.productId || product.name === line.productName);

    return {
      product: originalProduct || {
        id: line.productId || createDurableId("prod"),
        name: line.productName || "",
        sku: line.skuSnapshot || "",
        type: (line.productTypeSnapshot || "license") as Product["type"],
        status: "active",
        category: "",
        unit: "",
        listPrice: line.unitPrice || 0,
        currency: currency as Product["currency"],
        taxRate: line.taxRateSnapshot || 0,
        taxMode: line.taxModeSnapshot || "none",
        billingCycle: (line.billingCycleSnapshot || "one_time") as Product["billingCycle"],
        isSubscription: false,
        isRenewable: false,
        tags: [],
        createdAt: "",
        updatedAt: "",
      },
      quantity: line.quantity || 1,
      discountPercent: line.discountPercent,
      billingCycle: line.billingCycleSnapshot as Product["billingCycle"] | undefined,
      taxMode: line.taxModeSnapshot,
    };
  });
};

const toQuoteLines = (selected: SelectedPickerItem[], currentLines: QuoteLineItem[]): QuoteLineItem[] => {
  return selected.map((selection) => {
    const existing = currentLines.find((line) => line.productId === selection.product.id);
    const unitPrice = selection.customPrice ?? Number(selection.product.listPrice ?? 0);
    return normalizeQuoteLineItem({
      id: existing?.id || createDurableId(`qi_${selection.product.id}`),
      productId: selection.product.id,
      productNameSnapshot: selection.product.name,
      skuSnapshot: selection.product.sku || "",
      productTypeSnapshot: selection.product.type || "license",
      billingCycleSnapshot: selection.billingCycle || selection.product.billingCycle || "one_time",
      descriptionSnapshot: existing?.descriptionSnapshot ?? existing?.description ?? selection.product.description ?? "",
      quantity: selection.quantity,
      unitPriceSnapshot: unitPrice,
      discountPercent: selection.discountPercent ?? existing?.discountPercent ?? 0,
      taxRateSnapshot: selection.product.taxRate ?? existing?.taxRateSnapshot ?? 0,
      taxModeSnapshot: selection.taxMode || selection.product.taxMode || existing?.taxModeSnapshot || "none",
    });
  });
};

export const QuoteBuilderProductPicker: React.FC<QuoteBuilderProductPickerProps> = ({
  isOpen,
  onClose,
  products,
  quoteLines,
  currency,
  onChangeLines,
  onToast,
}) => {
  const { locale } = useI18n();

  return (
    <ProductPickerModal
      id="quote_builder_picker"
      isOpen={isOpen}
      onClose={onClose}
      products={products}
      context="quote"
      initialSelected={toInitialSelection(products, quoteLines, currency)}
      onApply={(selected) => {
        onChangeLines(toQuoteLines(selected, quoteLines));
        onClose();
        onToast(
          locale === "vi" ? "Cập nhật sản phẩm từ Danh mục thành công!" : "Successfully updated products from Catalog!",
          "success",
        );
      }}
    />
  );
};
