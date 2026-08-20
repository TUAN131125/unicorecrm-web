import { useState } from "react";
import type React from "react";
import { customerPresentationPreferences } from "../customerPresentationPreferences";
import { CUSTOMER_COLUMNS_METADATA } from "../model/customerColumns";
import { CUSTOMER_SAVED_VIEWS } from "../model/customerViews";
import {
  createCustomerCustomSavedView,
  deleteCustomerCustomSavedView,
  getDefaultCustomerColumnWidths,
  getDefaultCustomerPresentationSnapshot,
  getDefaultCustomerVisibleColumnIds,
  normalizeCustomerColumnIds,
  normalizeCustomerCustomViews,
  resolveCustomerPresentationSnapshot,
  updateCustomerCustomSavedView,
} from "../model/customerListPresentationPreferences";
import type { CustomerListPresentationSnapshot, CustomerSavedViewItem } from "../list/customerList.types";

const CUSTOM_VIEWS_KEY = "unicore.customer.list.customViews";
const VISIBLE_COLUMNS_KEY = "unicore.customer.list.visibleColumns";
const COLUMN_WIDTHS_KEY = "unicore.customer.list.columnWidths";

const systemViews: CustomerSavedViewItem[] = CUSTOMER_SAVED_VIEWS.map((view) => ({ ...view }));

export function useCustomerListViewSettings() {
  const [activeView, setActiveView] = useState("allCustomers");
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const [customViews, setCustomViews] = useState<CustomerSavedViewItem[]>(() => [
    ...systemViews,
    ...normalizeCustomerCustomViews(customerPresentationPreferences.get<CustomerSavedViewItem[]>(CUSTOM_VIEWS_KEY, [])),
  ]);
  const [isColumnSettingsOpen, setIsColumnSettingsOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const stored = customerPresentationPreferences.get<string[]>(VISIBLE_COLUMNS_KEY, getDefaultCustomerVisibleColumnIds());
    const normalized = normalizeCustomerColumnIds(stored);
    return normalized.length ? normalized : getDefaultCustomerVisibleColumnIds();
  });
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() =>
    customerPresentationPreferences.get(COLUMN_WIDTHS_KEY, getDefaultCustomerColumnWidths()),
  );

  const persistCustomViews = (views: readonly CustomerSavedViewItem[]) => {
    customerPresentationPreferences.set(CUSTOM_VIEWS_KEY, normalizeCustomerCustomViews(views));
  };

  const persistVisibleColumns = (columns: string[]) => {
    const normalized = normalizeCustomerColumnIds(columns);
    const next = normalized.length ? normalized : getDefaultCustomerVisibleColumnIds();
    setVisibleColumns(next);
    customerPresentationPreferences.set(VISIBLE_COLUMNS_KEY, next);
    return next;
  };

  const persistColumnWidths = (widths: Record<string, number>) => {
    setColumnWidths(widths);
    customerPresentationPreferences.set(COLUMN_WIDTHS_KEY, widths);
  };

  const applyPresentationSnapshot = (snapshot?: Partial<CustomerListPresentationSnapshot>) => {
    const resolved = resolveCustomerPresentationSnapshot(snapshot);
    persistVisibleColumns(resolved.orderedColumnIds);
    persistColumnWidths(resolved.columnWidths ?? getDefaultCustomerColumnWidths());
    return resolved;
  };

  const selectSavedView = (key: string) => {
    const selected = customViews.find((view) => view.key === key);
    setIsViewDropdownOpen(false);
    if (!selected) {
      setActiveView("allCustomers");
      return applyPresentationSnapshot(getDefaultCustomerPresentationSnapshot());
    }
    setActiveView(selected.key);
    return selected.isShared
      ? applyPresentationSnapshot(getDefaultCustomerPresentationSnapshot())
      : applyPresentationSnapshot(selected.presentation);
  };

  const createCustomView = (name: string, presentation: CustomerListPresentationSnapshot) => {
    const result = createCustomerCustomSavedView(customViews, name, presentation);
    if (result.ok === false) return result;
    persistCustomViews(result.views);
    setCustomViews(result.views);
    setActiveView(result.view.key);
    return { ok: true as const, key: result.view.key };
  };

  const updateCustomView = (key: string, name: string, presentation: CustomerListPresentationSnapshot) => {
    const result = updateCustomerCustomSavedView(customViews, key, name, presentation);
    if (result.ok === false) return result;
    persistCustomViews(result.views);
    setCustomViews(result.views);
    setActiveView(result.view.key);
    return { ok: true as const };
  };

  const deleteCustomView = (key: string) => {
    const result = deleteCustomerCustomSavedView(customViews, key);
    if (!result.deleted) return undefined;
    persistCustomViews(result.views);
    setCustomViews(result.views);
    if (activeView !== key) return undefined;
    setActiveView("allCustomers");
    return applyPresentationSnapshot(getDefaultCustomerPresentationSnapshot());
  };

  const saveColumnSettings = (columns: unknown[]) => {
    const keys = columns.map((column) => typeof column === "string" ? column : (column as { key: string }).key);
    persistVisibleColumns(keys);
    setIsColumnSettingsOpen(false);
  };

  const resetColumnSettings = () => {
    applyPresentationSnapshot(getDefaultCustomerPresentationSnapshot());
    setIsColumnSettingsOpen(false);
  };

  const resizeColumn = (event: React.MouseEvent, columnKey: string) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = columnWidths[columnKey] || 150;
    const onMove = (moveEvent: MouseEvent) => {
      const minimum = CUSTOMER_COLUMNS_METADATA.find((column) => column.key === columnKey)?.minWidth || 50;
      const width = Math.max(minimum, startWidth + moveEvent.clientX - startX);
      setColumnWidths((current) => {
        const next = { ...current, [columnKey]: width };
        customerPresentationPreferences.set(COLUMN_WIDTHS_KEY, next);
        return next;
      });
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const resetColumnWidth = (columnKey: string) => {
    const width = CUSTOMER_COLUMNS_METADATA.find((column) => column.key === columnKey)?.minWidth || 150;
    setColumnWidths((current) => {
      const next = { ...current, [columnKey]: width };
      customerPresentationPreferences.set(COLUMN_WIDTHS_KEY, next);
      return next;
    });
  };

  return {
    activeView,
    isViewDropdownOpen,
    setIsViewDropdownOpen,
    customViews,
    isColumnSettingsOpen,
    setIsColumnSettingsOpen,
    visibleColumns,
    columnWidths,
    selectSavedView,
    createCustomView,
    updateCustomView,
    deleteCustomView,
    saveColumnSettings,
    resetColumnSettings,
    resizeColumn,
    resetColumnWidth,
  };
}
