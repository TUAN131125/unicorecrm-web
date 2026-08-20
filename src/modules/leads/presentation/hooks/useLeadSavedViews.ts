import { useMemo, useState } from "react";
import { getLeadPreference, removeLeadPreference, setLeadPreference } from "../../public/leads";
import {
  LEAD_SYSTEM_SAVED_VIEWS,
  createLeadCustomSavedView,
  normalizeLeadCustomSavedViews,
  updateLeadCustomSavedView,
  type LeadListPresentationSnapshot,
  type LeadSavedViewItem,
} from "../model/leadSavedViewPreferences";

const STORAGE_KEY = "centrix_custom_misa_views";

export type LeadSavedView = LeadSavedViewItem;

export function useLeadSavedViews(defaultSnapshot: LeadListPresentationSnapshot) {
  const [activeView, setActiveView] = useState("all");
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const [isAddViewOpen, setIsAddViewOpen] = useState(false);
  const [editingViewKey, setEditingViewKey] = useState<string | null>(null);
  const [customOnly, setCustomOnly] = useState(() => {
    const raw = getLeadPreference<unknown>(STORAGE_KEY, []);
    const source = Array.isArray(raw) ? raw : [];
    const normalized = normalizeLeadCustomSavedViews(source, defaultSnapshot);
    setLeadPreference(STORAGE_KEY, normalized);
    return normalized;
  });

  const customViews = useMemo<LeadSavedViewItem[]>(
    () => [...LEAD_SYSTEM_SAVED_VIEWS, ...customOnly],
    [customOnly],
  );

  const persist = (views: typeof customOnly) => {
    setCustomOnly(views);
    setLeadPreference(STORAGE_KEY, views);
  };

  const selectSavedView = (key: string): LeadListPresentationSnapshot | undefined => {
    const selected = customViews.find((view) => view.key === key);
    setIsViewDropdownOpen(false);
    if (!selected) {
      setActiveView("all");
      return undefined;
    }
    setActiveView(selected.key);
    return selected.presentation ? structuredClone(selected.presentation) : undefined;
  };

  const openCreateView = () => {
    setEditingViewKey(null);
    setIsAddViewOpen(true);
  };

  const openEditView = (key: string) => {
    if (!key.startsWith("custom_")) return;
    setEditingViewKey(key);
    setIsAddViewOpen(true);
  };

  const saveView = (
    name: string,
    snapshot: LeadListPresentationSnapshot,
  ): { ok: true; key: string; mode: "created" | "updated" } | { ok: false; error: "empty" | "duplicate" | "missing" } => {
    if (editingViewKey) {
      const result = updateLeadCustomSavedView(customViews, editingViewKey, name, snapshot);
      if ("error" in result) return { ok: false, error: result.error };
      persist(result.views.filter((view) => view.key.startsWith("custom_")) as typeof customOnly);
      setActiveView(result.view.key);
      setEditingViewKey(null);
      setIsAddViewOpen(false);
      return { ok: true, key: result.view.key, mode: "updated" };
    }

    const result = createLeadCustomSavedView(customViews, name, snapshot);
    if ("error" in result) return { ok: false, error: result.error };
    persist(result.views.filter((view) => view.key.startsWith("custom_")) as typeof customOnly);
    setActiveView(result.view.key);
    setIsAddViewOpen(false);
    return { ok: true, key: result.view.key, mode: "created" };
  };

  const deleteCustomView = (key: string) => {
    if (!key.startsWith("custom_")) return false;
    const next = customOnly.filter((view) => view.key !== key);
    if (next.length === customOnly.length) return false;
    persist(next);
    if (activeView === key) setActiveView("all");
    if (editingViewKey === key) {
      setEditingViewKey(null);
      setIsAddViewOpen(false);
    }
    return true;
  };

  const editingView = editingViewKey
    ? customOnly.find((view) => view.key === editingViewKey)
    : undefined;

  return {
    activeView,
    customViews,
    selectSavedView,
    isViewDropdownOpen,
    setIsViewDropdownOpen,
    isAddViewOpen,
    setIsAddViewOpen,
    editingViewKey,
    editingView,
    openCreateView,
    openEditView,
    saveView,
    deleteCustomView,
  };
}
