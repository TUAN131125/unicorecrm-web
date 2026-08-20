import { useState, type MouseEvent as ReactMouseEvent } from "react";
import { getProductPreference, removeProductPreference, setProductPreference } from "../../public/catalog";

/**
 * Product list layout v2 deliberately keeps the default table compact.
 * SKU, category and tags are rendered inside the product identity cell, so
 * users get the same information density as Customer List without creating a
 * document-level horizontal scrollbar.
 */
export const PRODUCT_LIST_DEFAULT_COLUMNS = [
  "productName",
  "type",
  "price",
  "billingCycle",
  "status",
  "updatedAt",
];

export const PRODUCT_LIST_ALL_COLUMNS = [
  "productName",
  "type",
  "category",
  "price",
  "billingCycle",
  "tax",
  "status",
  "warranty",
  "updatedAt",
];

const PRODUCT_LAYOUT_KEY = "centrix_product_list_layout_v2";
const PRODUCT_WIDTHS_KEY = "centrix_product_list_column_widths_v2";

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  selection: 48,
  actions: 76,
  productName: 300,
  type: 150,
  category: 150,
  price: 150,
  billingCycle: 110,
  tax: 100,
  status: 112,
  warranty: 118,
  updatedAt: 112,
};

const normalizeColumns = (value: unknown): string[] => {
  if (!Array.isArray(value)) return PRODUCT_LIST_DEFAULT_COLUMNS;
  const normalized = value.filter(
    (column): column is string =>
      typeof column === "string" && PRODUCT_LIST_ALL_COLUMNS.includes(column),
  );
  return normalized.length > 0 ? normalized : PRODUCT_LIST_DEFAULT_COLUMNS;
};

const normalizeWidths = (value: unknown): Record<string, number> => {
  if (!value || typeof value !== "object") return DEFAULT_COLUMN_WIDTHS;
  const candidate = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(DEFAULT_COLUMN_WIDTHS).map(([key, fallback]) => {
      const raw = candidate[key];
      const valueNumber = typeof raw === "number" && Number.isFinite(raw) ? raw : fallback;
      const max = key === "productName" ? 440 : 240;
      return [key, Math.min(max, Math.max(key === "selection" ? 44 : 72, valueNumber))];
    }),
  );
};

interface UseProductListColumnsOptions {
  notify: (message: string, type?: "success" | "error" | "info") => void;
  tx: (key: string, fallback: string) => string;
}

export function useProductListColumns({ notify, tx }: UseProductListColumnsOptions) {
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() =>
    normalizeColumns(getProductPreference(PRODUCT_LAYOUT_KEY, PRODUCT_LIST_DEFAULT_COLUMNS)),
  );
  const [isColumnSettingsOpen, setIsColumnSettingsOpen] = useState(false);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() =>
    normalizeWidths(getProductPreference(PRODUCT_WIDTHS_KEY, DEFAULT_COLUMN_WIDTHS)),
  );

  const handleSaveColumns = (columns: string[]) => {
    const normalized = normalizeColumns(columns);
    setVisibleColumns(normalized);
    setProductPreference(PRODUCT_LAYOUT_KEY, normalized);
    notify(tx("products.toast.updateSuccess", "Cấu hình cột hiển thị đã được cập nhật thành công!"));
  };

  const handleResetDefaultColumns = () => {
    setVisibleColumns(PRODUCT_LIST_DEFAULT_COLUMNS);
    removeProductPreference(PRODUCT_LAYOUT_KEY);
    notify(tx("products.toast.updateSuccess", "Bố cục cột đã được khôi phục về mặc định!"));
  };

  const handleResetColumnWidths = () => {
    setColumnWidths(DEFAULT_COLUMN_WIDTHS);
    removeProductPreference(PRODUCT_WIDTHS_KEY);
    notify(tx("products.more.resetColumnsSuccess", "Đã khôi phục mặc định độ rộng cột."));
  };

  const handleColumnResize = (event: ReactMouseEvent, columnKey: string) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = columnWidths[columnKey] || DEFAULT_COLUMN_WIDTHS[columnKey] || 150;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      setColumnWidths((current) => {
        const maximum = columnKey === "productName" ? 440 : 240;
        const next = {
          ...current,
          [columnKey]: Math.min(maximum, Math.max(72, startWidth + deltaX)),
        };
        setProductPreference(PRODUCT_WIDTHS_KEY, next);
        return next;
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleColumnReset = (columnKey: string) => {
    setColumnWidths((current) => {
      const next = {
        ...current,
        [columnKey]: DEFAULT_COLUMN_WIDTHS[columnKey] || 150,
      };
      setProductPreference(PRODUCT_WIDTHS_KEY, next);
      return next;
    });
  };

  return {
    visibleColumns,
    isColumnSettingsOpen,
    setIsColumnSettingsOpen,
    handleSaveColumns,
    handleResetDefaultColumns,
    columnWidths,
    handleResetColumnWidths,
    handleColumnResize,
    handleColumnReset,
  };
}
