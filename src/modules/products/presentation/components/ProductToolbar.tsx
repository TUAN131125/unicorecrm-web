import React, { useState } from "react";
import { RotateCw } from "lucide-react";
import { useI18n } from "@/i18n";
import { getConfiguredProductTypes } from "../../public/configuration";
import { getProductStatusLabel, formatBillingCycle } from "../../domain/rules/product.helpers";
import { Input, Select } from "@/shared/components/ui";
import { ListControlBar } from "@/components/crm/ListControlBar";
import { ListFilterGrid, ListFilterPopover } from "@/components/crm/list-archetype";

interface ProductToolbarProps {
  id: string;
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  viewMode: "table" | "card";
  setViewMode: (mode: "table" | "card") => void;
  filters: {
    type: string;
    status: string;
    category: string;
    billingCycle: string;
    tag: string;
    minPrice?: number;
    maxPrice?: number;
  };
  setFilters: React.Dispatch<React.SetStateAction<{
    type: string;
    status: string;
    category: string;
    billingCycle: string;
    tag: string;
    minPrice?: number;
    maxPrice?: number;
  }>>;
  categories: string[];
  tags: string[];
  onRefresh: () => void;
  onResetFilters: () => void;
  onOpenColumnSettings?: () => void;
}

export const ProductToolbar: React.FC<ProductToolbarProps> = ({
  id,
  searchTerm,
  setSearchTerm,
  viewMode,
  setViewMode,
  filters,
  setFilters,
  categories,
  tags,
  onRefresh,
  onResetFilters,
  onOpenColumnSettings,
}) => {
  const { tx, locale } = useI18n();
  const productTypes = getConfiguredProductTypes();
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const isVi = locale === "vi";

  const activeFiltersCount = [
    filters.type !== "all",
    filters.status !== "all",
    filters.category !== "all",
    filters.billingCycle !== "all",
    filters.tag !== "all",
    filters.minPrice !== undefined,
    filters.maxPrice !== undefined,
  ].filter(Boolean).length;

  const handlePriceChange = (field: "minPrice" | "maxPrice", rawValue: string) => {
    const value = rawValue === "" ? undefined : Number(rawValue);
    setFilters((current) => ({ ...current, [field]: value }));
  };

  return (
    <div id={id} className="min-w-0 font-sans">
      <ListControlBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={tx("products.filters.searchHint", isVi ? "Tìm theo SKU, tên, mô tả..." : "Search SKU, name, description...")}
        viewMode={viewMode}
        onViewModeChange={(value) => setViewMode(value as "table" | "card")}
        viewOptions={[
          { value: "table", label: tx("catalog.viewList", isVi ? "Dạng bảng" : "Table view") },
          { value: "card", label: tx("catalog.viewGrid", isVi ? "Dạng thẻ" : "Card view") },
        ]}
        showFilters
        onOpenFilters={() => setIsFiltersOpen((open) => !open)}
        onCloseFilters={() => setIsFiltersOpen(false)}
        filtersOpen={isFiltersOpen}
        filtersPanel={(
          <ListFilterPopover
            isOpen={isFiltersOpen}
            onClose={() => setIsFiltersOpen(false)}
            onReset={onResetFilters}
            ariaLabel={isVi ? "Bộ lọc sản phẩm" : "Product filters"}
            resetLabel={tx("products.filters.clear", isVi ? "Đặt lại" : "Reset")}
            doneLabel={tx("common.done", isVi ? "Hoàn tất" : "Done")}
          >
            <ListFilterGrid>
              <Select label={tx("products.fields.status", isVi ? "Trạng thái" : "Status")} value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
                <option value="all">{isVi ? "Tất cả" : "All"}</option>
                <option value="active">{getProductStatusLabel("active", tx)}</option>
                <option value="inactive">{getProductStatusLabel("inactive", tx)}</option>
                <option value="draft">{getProductStatusLabel("draft", tx)}</option>
                <option value="archived">{getProductStatusLabel("archived", tx)}</option>
              </Select>

              <Select label={tx("products.fields.type", isVi ? "Loại sản phẩm" : "Product type")} value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}>
                <option value="all">{isVi ? "Tất cả" : "All"}</option>
                {productTypes.filter((type) => type.status === "active").map((type) => (
                  <option key={type.id} value={type.code}>{type.displayNameVi || type.displayNameEn || type.code}</option>
                ))}
              </Select>

              <Select label={tx("products.fields.category", isVi ? "Phân loại" : "Category")} value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}>
                <option value="all">{isVi ? "Tất cả" : "All"}</option>
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </Select>

              <Select label={tx("products.fields.billingCycle", isVi ? "Chu kỳ thanh toán" : "Billing cycle")} value={filters.billingCycle} onChange={(event) => setFilters((current) => ({ ...current, billingCycle: event.target.value }))}>
                <option value="all">{isVi ? "Tất cả" : "All"}</option>
                <option value="one_time">{formatBillingCycle("one_time", tx)}</option>
                <option value="monthly">{formatBillingCycle("monthly", tx)}</option>
                <option value="quarterly">{formatBillingCycle("quarterly", tx)}</option>
                <option value="yearly">{formatBillingCycle("yearly", tx)}</option>
              </Select>

              <Select label={tx("products.filters.tag", isVi ? "Thẻ" : "Tag")} value={filters.tag} onChange={(event) => setFilters((current) => ({ ...current, tag: event.target.value }))}>
                <option value="all">{isVi ? "Tất cả" : "All"}</option>
                {tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
              </Select>

              <Input label={isVi ? "Giá từ" : "Minimum price"} type="number" value={filters.minPrice ?? ""} onChange={(event) => handlePriceChange("minPrice", event.target.value)} inputMode="decimal" />
              <Input label={isVi ? "Giá đến" : "Maximum price"} type="number" value={filters.maxPrice ?? ""} onChange={(event) => handlePriceChange("maxPrice", event.target.value)} inputMode="decimal" />
            </ListFilterGrid>
          </ListFilterPopover>
        )}
        showColumns={viewMode === "table" && Boolean(onOpenColumnSettings)}
        onOpenColumns={onOpenColumnSettings}
        activeFilterCount={activeFiltersCount}
        hasActiveFilters={activeFiltersCount > 0}
        filtersLabel={isVi ? "Bộ lọc" : "Filters"}
        columnsLabel={isVi ? "Cột" : "Columns"}
        rightSlot={(
          <button
            type="button"
            onClick={onRefresh}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-xs transition hover:bg-slate-50 hover:text-violet-700"
            title={tx("customerList.toolbar.refresh", isVi ? "Làm mới" : "Refresh")}
          >
            <RotateCw size={14} />
          </button>
        )}
      />
    </div>
  );
};
