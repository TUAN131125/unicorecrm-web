import React, { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, Minus, Plus, Search } from "lucide-react";
import { Modal } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import type {
  BillingCycle,
  Product,
  ProductConfiguration,
  SelectedPickerItem,
  TaxMode,
} from "../../domain/model/product.types";
import {
  calculateConfiguredPrice,
  formatProductPrice,
  getConfiguredSnapshotDescription,
  getProductTypeLabel,
} from "../../domain/rules/product.helpers";
import { getConfiguredProductTypes } from "../../public/configuration";

export type { SelectedPickerItem };

const EMPTY_SELECTED_ITEMS: readonly SelectedPickerItem[] = [];

type ProductPickerContext = "lead_interest" | "deal" | "quote" | "order";

interface ProductPickerModalProps {
  id: string;
  isOpen: boolean;
  onClose: () => void;
  onApply: (selectedItems: SelectedPickerItem[]) => void;
  products: Product[];
  initialSelected?: SelectedPickerItem[];
  context?: ProductPickerContext;
}

function defaultConfiguration(product: Product): ProductConfiguration {
  if (product.type === "subscription" || product.isSubscription || product.type === "license") {
    return { billingFrequency: "monthly", userLicenses: 1 };
  }
  if (product.type === "physical_product") {
    return { warrantyPackage: "standard", shippingOption: "sea" };
  }
  if (["service", "implementation", "maintenance", "support_sla"].includes(product.type)) {
    return { manDays: 1, consultantSeniority: "junior" };
  }
  return {};
}

function createSelection(product: Product): SelectedPickerItem {
  const configuration = defaultConfiguration(product);
  return {
    product,
    quantity: 1,
    discountPercent: 0,
    customPrice: calculateConfiguredPrice(product, configuration),
    billingCycle: product.billingCycle || "one_time",
    taxMode: product.taxMode || "none",
    configuration,
  };
}

function isServiceProduct(product: Product): boolean {
  return ["service", "implementation", "maintenance", "support_sla"].includes(product.type);
}

export const ProductPickerModal: React.FC<ProductPickerModalProps> = ({
  id,
  isOpen,
  onClose,
  onApply,
  products,
  initialSelected,
  context = "deal",
}) => {
  const { locale, t } = useI18n();
  const vi = locale === "vi";
  const interestOnly = context === "lead_interest";
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [activeTab, setActiveTab] = useState<"catalog" | "selected">("catalog");
  const [expandedCardIds, setExpandedCardIds] = useState<Record<string, boolean>>({});
  const [selections, setSelections] = useState<Record<string, SelectedPickerItem>>({});

  useEffect(() => {
    if (!isOpen) return;
    const initialMap: Record<string, SelectedPickerItem> = {};
    (initialSelected ?? EMPTY_SELECTED_ITEMS).forEach((item) => {
      initialMap[item.product.id] = {
        ...item,
        configuration: { ...(item.configuration ?? {}) },
      };
    });
    setSelections(initialMap);
    setSearch("");
    setFilterType("all");
    setFilterCategory("all");
    setActiveTab("catalog");
    setExpandedCardIds({});
  }, [isOpen]);

  const configuredTypes = useMemo(() => getConfiguredProductTypes(), [isOpen]);

  const selectableProducts = useMemo(() => products.filter((p) => {
    if (p.status !== "active") return false;
    const typeConfig = configuredTypes.find((candidate) => candidate.code === p.type);
    if (!typeConfig || typeConfig.status === "inactive") return Boolean(!typeConfig);
    if (context === "deal" && !typeConfig.canBeSold) return false;
    if (context === "order" && !typeConfig.canBeSold) return false;
    if (context === "quote" && !typeConfig.canBeQuoted) return false;
    if (context === "lead_interest" && !typeConfig.canBeQuoted && !typeConfig.canBeSold) return false;
    return true;
  }), [configuredTypes, context, products]);

  const categories = useMemo(
    () => Array.from(new Set(selectableProducts.map((product) => product.category).filter(Boolean))).sort(),
    [selectableProducts],
  );

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase(locale);
    return selectableProducts.filter((product) => {
      if (normalizedSearch) {
        const haystack = [product.sku, product.name, product.description, product.category]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase(locale);
        if (!haystack.includes(normalizedSearch)) return false;
      }
      if (filterType !== "all" && product.type !== filterType) return false;
      if (filterCategory !== "all" && product.category !== filterCategory) return false;
      return true;
    });
  }, [filterCategory, filterType, locale, search, selectableProducts]);

  const selectedItems = useMemo(() => Object.values(selections), [selections]);

  const summaryTotals = useMemo(() => selectedItems.reduce<Map<string, number>>((totals, item) => {
    const price = item.customPrice ?? calculateConfiguredPrice(item.product, item.configuration);
    const discount = Math.max(0, Math.min(100, item.discountPercent ?? 0));
    const lineTotal = price * Math.max(1, item.quantity) * (1 - discount / 100);
    totals.set(item.product.currency, (totals.get(item.product.currency) ?? 0) + lineTotal);
    return totals;
  }, new Map()), [selectedItems]);

  const toggleProduct = (product: Product) => {
    setSelections((current) => {
      const next = { ...current };
      if (next[product.id]) delete next[product.id];
      else next[product.id] = createSelection(product);
      return next;
    });
  };

  const updateItem = (productId: string, patch: Partial<SelectedPickerItem>) => {
    setSelections((current) => {
      const item = current[productId];
      if (!item) return current;
      return { ...current, [productId]: { ...item, ...patch } };
    });
  };

  const updateConfiguration = (productId: string, patch: Partial<ProductConfiguration>) => {
    setSelections((current) => {
      const item = current[productId];
      if (!item) return current;
      const configuration = { ...(item.configuration ?? {}), ...patch };
      return {
        ...current,
        [productId]: {
          ...item,
          configuration,
          customPrice: calculateConfiguredPrice(item.product, configuration),
        },
      };
    });
  };

  const apply = () => {
    onApply(selectedItems);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal
      variant="form"
      id={id}
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      scrollBody={false}
      zIndexClass="z-[9500]"
      className="h-[calc(100vh-1rem)] sm:h-[85vh] sm:min-h-[590px] sm:max-h-[860px]"
      bodyClassName="!bg-white !p-0 text-sm"
      title={interestOnly
        ? (vi ? "Chọn sản phẩm quan tâm" : "Select interested products")
        : (vi ? "Chọn sản phẩm và dịch vụ" : "Select products and services")}
      footer={(
        <>
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-6 text-xs font-medium text-slate-700 hover:bg-slate-50 sm:w-auto"
          >
            {vi ? "Hủy" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={apply}
            className="h-10 w-full rounded-lg bg-violet-700 px-6 text-xs font-medium text-white hover:bg-violet-800 sm:w-auto"
          >
            {vi ? `Áp dụng (${selectedItems.length})` : `Apply (${selectedItems.length})`}
          </button>
        </>
      )}
    >
      <div className="flex h-full min-h-0 flex-col gap-4 p-4 sm:p-6">
        <p className="shrink-0 text-xs leading-5 text-slate-600">
          {vi
            ? "Tìm theo tên hoặc mã sản phẩm. Chỉ các sản phẩm đang kinh doanh mới được hiển thị."
            : "Search by product name or SKU. Only active products are shown."}
        </p>

        <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_190px_210px]">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
            <input
              id={`${id}-search`}
              aria-label={vi ? "Tìm sản phẩm" : "Search products"}
              type="search"
              placeholder={vi ? "Tên hoặc mã sản phẩm" : "Product name or SKU"}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              autoFocus
              className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-500/15"
            />
          </div>
          <select
            aria-label={vi ? "Lọc theo loại sản phẩm" : "Filter by product type"}
            value={filterType}
            onChange={(event) => setFilterType(event.target.value)}
            className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-500/15"
          >
            <option value="all">{vi ? "Tất cả loại" : "All types"}</option>
            {configuredTypes.filter((type) => type.status === "active").map((type) => (
              <option key={type.code} value={type.code}>{vi ? type.displayNameVi : type.displayNameEn}</option>
            ))}
          </select>
          <select
            aria-label={vi ? "Lọc theo danh mục" : "Filter by category"}
            value={filterCategory}
            onChange={(event) => setFilterCategory(event.target.value)}
            className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-500/15"
          >
            <option value="all">{vi ? "Tất cả danh mục" : "All categories"}</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </div>

        <div className="inline-flex shrink-0 rounded-lg bg-slate-100 p-1 lg:hidden">
          <button
            type="button"
            onClick={() => setActiveTab("catalog")}
            className={`flex-1 rounded-md px-3 py-2 text-xs font-medium ${activeTab === "catalog" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
          >
            {vi ? "Danh mục" : "Catalog"}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("selected")}
            className={`flex-1 rounded-md px-3 py-2 text-xs font-medium ${activeTab === "selected" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
          >
            {vi ? `Đã chọn (${selectedItems.length})` : `Selected (${selectedItems.length})`}
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.95fr)]">
          <section className={`${activeTab === "catalog" ? "flex" : "hidden"} min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 lg:flex`}>
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="text-xs font-medium text-slate-700">{vi ? "Danh mục sản phẩm" : "Product catalog"} ({filteredProducts.length})</h3>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2 crm-scroll-y">
              {filteredProducts.length === 0 ? (
                <div className="flex min-h-40 items-center justify-center px-4 text-center text-sm text-slate-500">
                  {vi ? "Không có sản phẩm phù hợp với bộ lọc." : "No products match the current filters."}
                </div>
              ) : filteredProducts.map((p) => {
                const isSelected = Boolean(selections[p.id]);
                return (
                  <button
                    key={p.id}
                    id={`picker-product-${p.id}`}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => toggleProduct(p)}
                    className={`mb-2 flex w-full items-center justify-between gap-4 rounded-lg border px-4 py-3 text-left last:mb-0 ${isSelected ? "border-violet-500 bg-violet-50" : "border-slate-200 bg-white hover:border-violet-300"}`}
                  >
                    <span className="min-w-0">
                      <span className="block break-words text-sm font-medium text-slate-900">{p.name}</span>
                      <span className="mt-1 block break-all text-[11px] text-slate-500">
                        {p.sku}{p.category ? ` · ${p.category}` : ""} · {getProductTypeLabel(p.type, t)}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      {!interestOnly && (
                        <span className="hidden whitespace-nowrap text-xs text-slate-700 sm:inline">
                          {formatProductPrice(p.listPrice, p.currency, locale)}
                        </span>
                      )}
                      <span className={`flex h-5 w-5 items-center justify-center rounded border ${isSelected ? "border-violet-700 bg-violet-700 text-white" : "border-slate-300 bg-white"}`}>
                        {isSelected && <Check size={12} />}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className={`${activeTab === "selected" ? "flex" : "hidden"} min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 lg:flex`}>
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <h3 className="text-xs font-medium text-slate-700">{vi ? "Đã chọn" : "Selected"} ({selectedItems.length})</h3>
              {selectedItems.length > 0 && (
                <button type="button" onClick={() => setSelections({})} className="text-[11px] text-slate-600 underline underline-offset-2 hover:text-slate-900">
                  {vi ? "Bỏ chọn tất cả" : "Clear all"}
                </button>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 crm-scroll-y">
              {selectedItems.length === 0 ? (
                <p className="py-8 text-center text-xs leading-5 text-slate-500">
                  {vi ? "Chưa có sản phẩm nào được chọn." : "No products selected."}
                </p>
              ) : (
                <div className="space-y-3">
                  {selectedItems.map((item) => {
                    const expanded = Boolean(expandedCardIds[item.product.id]);
                    const configuredPrice = item.customPrice ?? calculateConfiguredPrice(item.product, item.configuration);
                    const discount = Math.max(0, Math.min(100, item.discountPercent ?? 0));
                    const lineTotal = configuredPrice * Math.max(1, item.quantity) * (1 - discount / 100);
                    return (
                      <article key={item.product.id} className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="break-words text-xs font-medium text-slate-900">{item.product.name}</p>
                            <p className="mt-0.5 break-all text-[10px] text-slate-500">{item.product.sku}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleProduct(item.product)}
                            aria-label={vi ? `Bỏ chọn ${item.product.name}` : `Remove ${item.product.name}`}
                            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          >
                            <Minus size={14} />
                          </button>
                        </div>

                        {!interestOnly && (
                          <>
                            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                              <label className="text-[10px] text-slate-600">
                                <span className="mb-1 block">{vi ? "Số lượng" : "Quantity"}</span>
                                <span className="flex h-9 items-center rounded-lg border border-slate-300 bg-white">
                                  <button type="button" onClick={() => updateItem(item.product.id, { quantity: Math.max(1, item.quantity - 1) })} className="flex h-full w-8 items-center justify-center text-slate-500 hover:bg-slate-50"><Minus size={11} /></button>
                                  <input
                                    type="number"
                                    min={1}
                                    value={item.quantity}
                                    onChange={(event) => updateItem(item.product.id, { quantity: Math.max(1, Number(event.target.value) || 1) })}
                                    className="min-w-0 flex-1 border-0 bg-transparent text-center text-xs outline-none"
                                  />
                                  <button type="button" onClick={() => updateItem(item.product.id, { quantity: item.quantity + 1 })} className="flex h-full w-8 items-center justify-center text-slate-500 hover:bg-slate-50"><Plus size={11} /></button>
                                </span>
                              </label>
                              <label className="text-[10px] text-slate-600">
                                <span className="mb-1 block">{vi ? "Chiết khấu (%)" : "Discount (%)"}</span>
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={discount}
                                  onChange={(event) => updateItem(item.product.id, { discountPercent: Math.max(0, Math.min(100, Number(event.target.value) || 0)) })}
                                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-right text-xs outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-500/15"
                                />
                              </label>
                            </div>

                            <button
                              type="button"
                              onClick={() => setExpandedCardIds((current) => ({ ...current, [item.product.id]: !current[item.product.id] }))}
                              className="mt-3 flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-900"
                            >
                              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                              {expanded ? (vi ? "Ẩn cấu hình" : "Hide configuration") : (vi ? "Cấu hình sản phẩm" : "Configure product")}
                            </button>

                            {expanded && (
                              <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                                {(item.product.type === "subscription" || item.product.isSubscription || item.product.type === "license") && (
                                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <label className="text-[10px] text-slate-600">
                                      <span className="mb-1 block">{vi ? "Tần suất" : "Frequency"}</span>
                                      <select
                                        value={item.configuration?.billingFrequency || "monthly"}
                                        onChange={(event) => updateConfiguration(item.product.id, { billingFrequency: event.target.value as ProductConfiguration["billingFrequency"] })}
                                        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs"
                                      >
                                        <option value="monthly">{vi ? "Tháng" : "Monthly"}</option>
                                        <option value="quarterly">{vi ? "Quý" : "Quarterly"}</option>
                                        <option value="yearly">{vi ? "Năm" : "Yearly"}</option>
                                      </select>
                                    </label>
                                    <label className="text-[10px] text-slate-600">
                                      <span className="mb-1 block">{vi ? "Số giấy phép" : "Licenses"}</span>
                                      <input
                                        type="number"
                                        min={1}
                                        value={item.configuration?.userLicenses || 1}
                                        onChange={(event) => updateConfiguration(item.product.id, { userLicenses: Math.max(1, Number(event.target.value) || 1) })}
                                        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs"
                                      />
                                    </label>
                                    <label className="flex items-center gap-2 text-[10px] text-slate-700">
                                      <input type="checkbox" checked={Boolean(item.configuration?.supportSla)} onChange={(event) => updateConfiguration(item.product.id, { supportSla: event.target.checked })} />
                                      {vi ? "Thêm hỗ trợ SLA" : "Add SLA support"}
                                    </label>
                                    <label className="text-[10px] text-slate-600">
                                      <span className="mb-1 block">{vi ? "Số ngày đào tạo" : "Training days"}</span>
                                      <input
                                        type="number"
                                        min={0}
                                        value={item.configuration?.trainingDays || 0}
                                        onChange={(event) => updateConfiguration(item.product.id, { trainingDays: Math.max(0, Number(event.target.value) || 0) })}
                                        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs"
                                      />
                                    </label>
                                  </div>
                                )}

                                {item.product.type === "physical_product" && (
                                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <label className="text-[10px] text-slate-600">
                                      <span className="mb-1 block">{vi ? "Gói bảo hành" : "Warranty"}</span>
                                      <select
                                        value={item.configuration?.warrantyPackage || "standard"}
                                        onChange={(event) => updateConfiguration(item.product.id, { warrantyPackage: event.target.value as ProductConfiguration["warrantyPackage"] })}
                                        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs"
                                      >
                                        <option value="standard">{vi ? "Tiêu chuẩn" : "Standard"}</option>
                                        <option value="silver">Silver</option>
                                        <option value="gold">Gold</option>
                                        <option value="platinum">Platinum</option>
                                      </select>
                                    </label>
                                    <label className="text-[10px] text-slate-600">
                                      <span className="mb-1 block">{vi ? "Phương thức vận chuyển" : "Shipping option"}</span>
                                      <select
                                        value={item.configuration?.shippingOption || "sea"}
                                        onChange={(event) => updateConfiguration(item.product.id, { shippingOption: event.target.value as ProductConfiguration["shippingOption"] })}
                                        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs"
                                      >
                                        <option value="sea">{vi ? "Tiêu chuẩn" : "Standard"}</option>
                                        <option value="express">Express</option>
                                        <option value="air">Air</option>
                                      </select>
                                    </label>
                                  </div>
                                )}

                                {isServiceProduct(item.product) && (
                                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <label className="text-[10px] text-slate-600">
                                      <span className="mb-1 block">{vi ? "Số ngày công" : "Man-days"}</span>
                                      <input
                                        type="number"
                                        min={1}
                                        value={item.configuration?.manDays || 1}
                                        onChange={(event) => updateConfiguration(item.product.id, { manDays: Math.max(1, Number(event.target.value) || 1) })}
                                        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs"
                                      />
                                    </label>
                                    <label className="text-[10px] text-slate-600">
                                      <span className="mb-1 block">{vi ? "Cấp chuyên gia" : "Consultant level"}</span>
                                      <select
                                        value={item.configuration?.consultantSeniority || "junior"}
                                        onChange={(event) => updateConfiguration(item.product.id, { consultantSeniority: event.target.value as ProductConfiguration["consultantSeniority"] })}
                                        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs"
                                      >
                                        <option value="junior">Junior</option>
                                        <option value="senior">Senior</option>
                                        <option value="principal">Principal</option>
                                      </select>
                                    </label>
                                    <label className="flex items-center gap-2 text-[10px] text-slate-700 sm:col-span-2">
                                      <input type="checkbox" checked={Boolean(item.configuration?.travelExpenseIncluded)} onChange={(event) => updateConfiguration(item.product.id, { travelExpenseIncluded: event.target.checked })} />
                                      {vi ? "Bao gồm chi phí công tác" : "Include travel expenses"}
                                    </label>
                                  </div>
                                )}

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                  <label className="text-[10px] text-slate-600">
                                    <span className="mb-1 block">{vi ? "Chu kỳ thanh toán" : "Billing cycle"}</span>
                                    <select
                                      value={item.billingCycle || item.product.billingCycle || "one_time"}
                                      onChange={(event) => updateItem(item.product.id, { billingCycle: event.target.value as BillingCycle })}
                                      className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs"
                                    >
                                      <option value="one_time">{vi ? "Một lần" : "One-time"}</option>
                                      <option value="monthly">{vi ? "Hàng tháng" : "Monthly"}</option>
                                      <option value="quarterly">{vi ? "Hàng quý" : "Quarterly"}</option>
                                      <option value="yearly">{vi ? "Hàng năm" : "Yearly"}</option>
                                      <option value="custom">{vi ? "Tùy chỉnh" : "Custom"}</option>
                                    </select>
                                  </label>
                                  <label className="text-[10px] text-slate-600">
                                    <span className="mb-1 block">{vi ? "Cách tính thuế" : "Tax mode"}</span>
                                    <select
                                      value={item.taxMode || item.product.taxMode || "none"}
                                      onChange={(event) => updateItem(item.product.id, { taxMode: event.target.value as TaxMode })}
                                      className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs"
                                    >
                                      <option value="none">{vi ? "Không thuế" : "No tax"}</option>
                                      <option value="inclusive">{vi ? "Đã gồm thuế" : "Tax inclusive"}</option>
                                      <option value="exclusive">{vi ? "Chưa gồm thuế" : "Tax exclusive"}</option>
                                    </select>
                                  </label>
                                </div>

                                <p className="text-[10px] leading-4 text-slate-500">
                                  {getConfiguredSnapshotDescription(item.product, item.configuration)}
                                </p>
                              </div>
                            )}

                            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                              <span className="text-slate-500">{vi ? "Thành tiền" : "Line total"}</span>
                              <span className="text-slate-900">{formatProductPrice(lineTotal, item.product.currency, locale)}</span>
                            </div>
                          </>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            {!interestOnly && selectedItems.length > 0 && (
              <div className="flex shrink-0 items-center justify-between border-t border-slate-200 px-4 py-3 text-xs">
                <span className="text-slate-600">{vi ? "Tạm tính" : "Subtotal"}</span>
                <span className="text-sm text-slate-900">
                  {[...summaryTotals].map(([currency, total]) => formatProductPrice(total, currency, locale)).join(" · ")}
                </span>
              </div>
            )}
          </section>
        </div>
      </div>
    </Modal>
  );
};
