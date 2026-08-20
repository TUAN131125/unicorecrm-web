import { useState } from "react";
import { getQuotePreference, removeQuotePreference, setQuotePreference } from "../../public/quotes";

const STORAGE_KEY = "centrix_quote_list_layout";

export function useQuoteListColumns(defaultColumns: readonly string[]) {
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = getQuotePreference<string[] | null>(STORAGE_KEY, null);
    if (!Array.isArray(saved)) return [...defaultColumns];
    const oldDefault = ["quoteNumber", "title", "status", "linkedOpportunity", "customer", "grandTotal", "validUntil", "owner", "actions"];
    const isOldDefault = saved.length === oldDefault.length && saved.every((value, index) => value === oldDefault[index]);
    if (isOldDefault) {
      const migrated = [...defaultColumns];
      setQuotePreference(STORAGE_KEY, migrated);
      return migrated;
    }
    return saved;
  });

  const saveColumnSettings = (columns: string[]) => {
    const next = columns.includes("actions") ? [...columns] : [...columns, "actions"];
    setVisibleColumns(next);
    setQuotePreference(STORAGE_KEY, next);
  };

  const resetColumnSettings = () => {
    const next = [...defaultColumns];
    setVisibleColumns(next);
    removeQuotePreference(STORAGE_KEY);
  };

  return { visibleColumns, saveColumnSettings, resetColumnSettings };
}
