import { useState } from "react";
import type React from "react";
import { CONTACT_SAVED_VIEWS } from "../model/contactViews";
import {
  createContactCustomSavedView,
  deleteContactCustomSavedView,
  getDefaultContactColumnWidths,
  getDefaultContactPresentationSnapshot,
  getDefaultContactVisibleColumnIds,
  normalizeContactColumnIds,
  normalizeContactCustomViews,
  resolveContactPresentationSnapshot,
  updateContactCustomSavedView,
  type ContactListPresentationSnapshot,
  type ContactSavedViewItem,
} from "../model/contactSavedViewPreferences";
import { CONTACT_COLUMNS_METADATA } from "../model/contactColumns";
import { getContactPreference, setContactPreference } from "../../public/contacts";

const CUSTOM_VIEWS_KEY = "centrix_contact_custom_views";
const VISIBLE_COLUMNS_KEY = "centrix_contact_list_visible_columns";
const COLUMN_WIDTHS_KEY = "centrix_contact_list_column_widths";

const systemViews: ContactSavedViewItem[] = CONTACT_SAVED_VIEWS.map((view) => ({
  key: view.key,
  labelKey: view.labelKey,
  isShared: true,
  icon: view.icon,
}));

export function useContactListViewSettings() {
  const [activeView, setActiveView] = useState("allContacts");
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const [customViews, setCustomViews] = useState<ContactSavedViewItem[]>(() => [
    ...systemViews,
    ...normalizeContactCustomViews(getContactPreference<ContactSavedViewItem[]>(CUSTOM_VIEWS_KEY, [])),
  ]);

  const [isHeaderMoreOpen, setIsHeaderMoreOpen] = useState(false);
  const [isColumnSettingsOpen, setIsColumnSettingsOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const stored = getContactPreference<string[]>(VISIBLE_COLUMNS_KEY, getDefaultContactVisibleColumnIds());
    const normalized = normalizeContactColumnIds(stored);
    return normalized.length ? normalized : getDefaultContactVisibleColumnIds();
  });
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() =>
    getContactPreference(COLUMN_WIDTHS_KEY, getDefaultContactColumnWidths()),
  );

  const persistCustomViews = (views: readonly ContactSavedViewItem[]) => {
    setContactPreference(CUSTOM_VIEWS_KEY, normalizeContactCustomViews(views));
  };

  const persistVisibleColumns = (columns: string[]) => {
    const normalized = normalizeContactColumnIds(columns);
    const next = normalized.length ? normalized : getDefaultContactVisibleColumnIds();
    setVisibleColumns(next);
    setContactPreference(VISIBLE_COLUMNS_KEY, next);
    return next;
  };

  const persistColumnWidths = (widths: Record<string, number>) => {
    const next = { ...widths };
    setColumnWidths(next);
    setContactPreference(COLUMN_WIDTHS_KEY, next);
  };

  const applyPresentationSnapshot = (snapshot?: Partial<ContactListPresentationSnapshot>) => {
    const resolved = resolveContactPresentationSnapshot(snapshot);
    persistVisibleColumns(resolved.orderedColumnIds);
    persistColumnWidths(resolved.columnWidths ?? getDefaultContactColumnWidths());
    return resolved;
  };

  const applyDefaultPresentation = () => applyPresentationSnapshot(getDefaultContactPresentationSnapshot());

  const selectSavedView = (key: string) => {
    const selected = customViews.find((view) => view.key === key);
    setIsViewDropdownOpen(false);

    if (!selected) {
      setActiveView("allContacts");
      return applyDefaultPresentation();
    }

    setActiveView(selected.key);
    if (!selected.isShared) return applyPresentationSnapshot(selected.presentation);
    return applyDefaultPresentation();
  };

  const createCustomView = (
    name: string,
    presentation: ContactListPresentationSnapshot,
  ): { ok: true; key: string } | { ok: false; error: "empty" | "duplicate" } => {
    const result = createContactCustomSavedView(customViews, name, presentation);
    if ("error" in result) return { ok: false, error: result.error };

    persistCustomViews(result.views);
    setCustomViews(result.views);
    setActiveView(result.view.key);
    return { ok: true, key: result.view.key };
  };

  const updateCustomView = (
    key: string,
    name: string,
    presentation: ContactListPresentationSnapshot,
  ): { ok: true } | { ok: false; error: "empty" | "duplicate" | "missing" } => {
    const result = updateContactCustomSavedView(customViews, key, name, presentation);
    if ("error" in result) return { ok: false, error: result.error };

    persistCustomViews(result.views);
    setCustomViews(result.views);
    setActiveView(result.view.key);
    return { ok: true };
  };

  const deleteCustomView = (key: string): ContactListPresentationSnapshot | undefined => {
    const result = deleteContactCustomSavedView(customViews, key);
    if (!result.deleted) return undefined;

    persistCustomViews(result.views);
    setCustomViews(result.views);
    if (activeView !== key) return undefined;

    setActiveView("allContacts");
    return applyDefaultPresentation();
  };

  const saveColumnSettings = (columns: any[]) => {
    const keys = columns.map((column) => typeof column === "string" ? column : column.key);
    persistVisibleColumns(keys);
    setIsColumnSettingsOpen(false);
  };

  const resetColumnSettings = () => {
    applyDefaultPresentation();
    setIsColumnSettingsOpen(false);
  };

  const resizeColumn = (event: React.MouseEvent, columnKey: string) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = columnWidths[columnKey] || 150;
    const onMove = (moveEvent: MouseEvent) => {
      const minimum = CONTACT_COLUMNS_METADATA.find((column) => column.key === columnKey)?.minWidth || 50;
      const width = Math.max(minimum, startWidth + moveEvent.clientX - startX);
      setColumnWidths((current) => {
        const next = { ...current, [columnKey]: width };
        setContactPreference(COLUMN_WIDTHS_KEY, next);
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
    const width = CONTACT_COLUMNS_METADATA.find((column) => column.key === columnKey)?.minWidth || 150;
    setColumnWidths((current) => {
      const next = { ...current, [columnKey]: width };
      setContactPreference(COLUMN_WIDTHS_KEY, next);
      return next;
    });
  };

  return {
    activeView,
    selectSavedView,
    isViewDropdownOpen,
    setIsViewDropdownOpen,
    customViews,
    isHeaderMoreOpen,
    setIsHeaderMoreOpen,
    isColumnSettingsOpen,
    setIsColumnSettingsOpen,
    visibleColumns,
    columnWidths,
    createCustomView,
    updateCustomView,
    deleteCustomView,
    saveColumnSettings,
    resetColumnSettings,
    resizeColumn,
    resetColumnWidth,
  };
}
