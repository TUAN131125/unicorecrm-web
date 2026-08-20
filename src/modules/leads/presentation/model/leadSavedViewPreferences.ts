import type { OwnershipScopeView } from "@/platform/record-ownership";
import type { LeadFiltersState, LeadSortState } from "../hooks/useLeadFilters";
import type { ColumnKeyType } from "../hooks/useLeadTable";

export interface LeadListPresentationSnapshot {
  version: 1;
  searchTerm: string;
  filters: LeadFiltersState;
  sort: LeadSortState;
  orderedColumnIds: ColumnKeyType[];
  layout: "table" | "kanban";
  ownershipScope: OwnershipScopeView;
}

export interface LeadSavedViewItem {
  key: string;
  labelKey: string;
  isShared: boolean;
  icon?: string;
  presentation?: LeadListPresentationSnapshot;
}

export type LeadCustomSavedView = LeadSavedViewItem & {
  isShared: false;
  presentation: LeadListPresentationSnapshot;
};

export const LEAD_SYSTEM_SAVED_VIEWS: LeadSavedViewItem[] = [
  { key: "all", labelKey: "allLeads", isShared: true, icon: "all" },
  { key: "my_leads", labelKey: "myLeads", isShared: true, icon: "my" },
  { key: "team_leads", labelKey: "teamLeads", isShared: true, icon: "team" },
  { key: "converted", labelKey: "convertedLeads", isShared: true, icon: "converted" },
  { key: "default", labelKey: "defaultView", isShared: false, icon: "default" },
  { key: "new", labelKey: "newLeads", isShared: false, icon: "new" },
  { key: "contacted", labelKey: "contactedLeads", isShared: false, icon: "contacted" },
  { key: "qualified", labelKey: "qualifiedLeads", isShared: false, icon: "qualified" },
  { key: "contact_today", labelKey: "needContactToday", isShared: false, icon: "today" },
  { key: "overdue", labelKey: "overdueContact", isShared: false, icon: "overdue" },
  { key: "nurture", labelKey: "nurtureLeads", isShared: false, icon: "temp" },
  { key: "disqualified", labelKey: "disqualifiedLeads", isShared: false, icon: "perm" },
  { key: "duplicates", labelKey: "duplicates", isShared: false, icon: "dup" },
];

const LEGACY_VIEW_KEY_MAP: Record<string, string> = {
  unqualified_recontact: "nurture",
  unqualified_closed: "disqualified",
};

export function normalizeSavedViewLabelKey(labelKey: string): string {
  return labelKey
    .replace(/^leads\.customViews\.views\./, "")
    .replace(/^leads\.customViews\./, "");
}

function isPresentationSnapshot(value: unknown): value is LeadListPresentationSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<LeadListPresentationSnapshot>;
  return snapshot.version === 1
    && typeof snapshot.searchTerm === "string"
    && Boolean(snapshot.filters && typeof snapshot.filters === "object")
    && Boolean(snapshot.sort && typeof snapshot.sort === "object")
    && Array.isArray(snapshot.orderedColumnIds)
    && (snapshot.layout === "table" || snapshot.layout === "kanban")
    && ["MINE", "TEAM", "ALLOWED"].includes(String(snapshot.ownershipScope));
}

export function normalizeLeadCustomSavedViews(
  input: readonly unknown[],
  fallbackSnapshot: LeadListPresentationSnapshot,
): LeadCustomSavedView[] {
  const seen = new Set<string>();
  const systemKeys = new Set(LEAD_SYSTEM_SAVED_VIEWS.map((view) => view.key));
  const result: LeadCustomSavedView[] = [];

  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Partial<LeadSavedViewItem>;
    const originalKey = typeof item.key === "string" ? item.key : "";
    const key = LEGACY_VIEW_KEY_MAP[originalKey] ?? originalKey;
    if (!key.startsWith("custom_") || systemKeys.has(key) || seen.has(key)) continue;
    const labelKey = normalizeSavedViewLabelKey(String(item.labelKey || key)).trim();
    if (!labelKey) continue;
    seen.add(key);
    result.push({
      key,
      labelKey,
      isShared: false,
      icon: item.icon || "default",
      presentation: isPresentationSnapshot(item.presentation)
        ? structuredClone(item.presentation)
        : structuredClone(fallbackSnapshot),
    });
  }
  return result;
}

export function createLeadCustomSavedView(
  views: readonly LeadSavedViewItem[],
  name: string,
  presentation: LeadListPresentationSnapshot,
  seed = Date.now(),
): { ok: true; view: LeadCustomSavedView; views: LeadSavedViewItem[] } | { ok: false; error: "empty" | "duplicate" } {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "empty" };
  if (views.some((view) => view.key.startsWith("custom_") && view.labelKey.trim().toLocaleLowerCase() === trimmed.toLocaleLowerCase())) {
    return { ok: false, error: "duplicate" };
  }
  let key = `custom_${seed}`;
  let suffix = 1;
  const keys = new Set(views.map((view) => view.key));
  while (keys.has(key)) key = `custom_${seed}_${suffix++}`;
  const view: LeadCustomSavedView = {
    key,
    labelKey: trimmed,
    isShared: false,
    icon: "default",
    presentation: structuredClone(presentation),
  };
  return { ok: true, view, views: [...views, view] };
}

export function updateLeadCustomSavedView(
  views: readonly LeadSavedViewItem[],
  key: string,
  name: string,
  presentation: LeadListPresentationSnapshot,
): { ok: true; view: LeadCustomSavedView; views: LeadSavedViewItem[] } | { ok: false; error: "empty" | "duplicate" | "missing" } {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "empty" };
  const existing = views.find((view) => view.key === key && view.key.startsWith("custom_"));
  if (!existing) return { ok: false, error: "missing" };
  if (views.some((view) => view.key !== key && view.key.startsWith("custom_") && view.labelKey.trim().toLocaleLowerCase() === trimmed.toLocaleLowerCase())) {
    return { ok: false, error: "duplicate" };
  }
  const view: LeadCustomSavedView = {
    ...existing,
    labelKey: trimmed,
    isShared: false,
    presentation: structuredClone(presentation),
  };
  return {
    ok: true,
    view,
    views: views.map((item) => item.key === key ? view : item),
  };
}
