import React, { useEffect, useState } from "react";
import { queryProductPage, loadProductDetail } from "@/modules/products";
import { isQuoteConnectedMode } from "../../public/quotes";
import { formatApplicationError } from "@/shared/operations";
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
  return quoteLines.filter(line => Boolean(line.productId)).map((line) => {
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

const toQuoteLines = (selected: SelectedPickerItem[], currentLines: QuoteLineItem[], catalogPriceOnly: boolean): QuoteLineItem[] => {
  return selected.map((selection) => {
    const existing = currentLines.find((line) => line.productId === selection.product.id);
    const unitPrice = catalogPriceOnly ? Number(selection.product.listPrice ?? 0) : selection.customPrice ?? Number(selection.product.listPrice ?? 0);
    return normalizeQuoteLineItem({
      id: existing?.id || createDurableId(`qi_${selection.product.id}`),
      productId: selection.product.id,
      productNameSnapshot: selection.product.name,
      skuSnapshot: selection.product.sku || "",
      productTypeSnapshot: selection.product.type || "license",
      billingCycleSnapshot: (catalogPriceOnly ? selection.product.billingCycle : selection.billingCycle) || selection.product.billingCycle || "one_time",
      descriptionSnapshot: existing?.descriptionSnapshot ?? existing?.description ?? selection.product.description ?? "",
      quantity: selection.quantity,
      unitPriceSnapshot: unitPrice,
      ...(catalogPriceOnly && selection.product.unitPrice ? { inputDecimals: { quantity: String(selection.quantity), unitPrice: selection.product.unitPrice.amount, discountRate: String(selection.discountPercent ?? existing?.discountPercent ?? 0), taxRate: String(selection.product.taxRate ?? 0) } } : {}),
      discountPercent: selection.discountPercent ?? existing?.discountPercent ?? 0,
      taxRateSnapshot: selection.product.taxRate ?? existing?.taxRateSnapshot ?? 0,
      taxModeSnapshot: (catalogPriceOnly ? selection.product.taxMode : selection.taxMode) || selection.product.taxMode || existing?.taxModeSnapshot || "none",
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
  const connected = isQuoteConnectedMode();
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!connected || !isOpen) return;
    const abort = new AbortController();
    setLoading(true); setError("");
    const timer = setTimeout(() => {
      void queryProductPage({ search, limit: 50 }, abort.signal)
        .then(page => Promise.all(page.items.map(item => loadProductDetail(item.id, abort.signal))))
        .then(items => { if (!abort.signal.aborted) setCatalog(items.filter(item => item.currency === currency)); })
        .catch(reason => { if (!abort.signal.aborted) setError(formatApplicationError(reason, { locale })); })
        .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    }, 200);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [connected, isOpen, search, currency, locale]);

  return (<>
    <ProductPickerModal
      id="quote_builder_picker"
      onSearchCatalog={connected ? setSearch : undefined}
      catalogLoading={connected && loading}
      catalogError={error}
      catalogPriceOnly={connected}
      isOpen={isOpen}
      onClose={onClose}
      products={(connected ? catalog : products).filter(product => product.currency === currency)}
      context="quote"
      initialSelected={toInitialSelection(connected ? catalog : products, quoteLines, currency)}
      onApply={(selected) => {
        if (selected.some(item => item.product.currency !== currency)) {
          onToast(locale === "vi" ? "Chỉ chọn sản phẩm cùng tiền tệ với báo giá. Chưa hỗ trợ quy đổi." : "Choose products in the Quote currency. Conversion is unavailable.", "error"); return;
        }
        onChangeLines([...quoteLines.filter(line => !line.productId), ...toQuoteLines(selected, quoteLines, connected)]);
        onClose();
        onToast(
          locale === "vi" ? "Cập nhật sản phẩm từ Danh mục thành công!" : "Successfully updated products from Catalog!",
          "success",
        );
      }}
    />
  </>);
};
