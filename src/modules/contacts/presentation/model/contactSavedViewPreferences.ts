import { CONTACT_COLUMNS_METADATA } from "./contactColumns";

export interface ContactListFilterSnapshot {
  searchTerm: string;
  statusFilter: string;
  linkFilter: string;
  sourceFilter: string;
  ownerFilter: string;
  priorityFilter: string;
  relationshipLevelFilter: string;
  decisionRoleFilter: string;
  nextFollowUpAtFilter: string;
  lastInteractionAtFilter: string;
  doNotContactFilter: boolean | null;
}

export interface ContactListPresentationSnapshot {
  visibleColumnIds: string[];
  orderedColumnIds: string[];
  columnWidths?: Record<string, number>;
  filters?: Partial<ContactListFilterSnapshot>;
  sortBy?: string;
  viewMode?: "card" | "table";
}

export interface ContactCustomSavedView {
  key: string;
  labelKey: string;
  isShared: false;
  icon?: string;
  presentation: ContactListPresentationSnapshot;
  createdAt: string;
  updatedAt: string;
}

export type ContactSavedViewItem = {
  key: string;
  labelKey: string;
  isShared: boolean;
  icon?: string;
  presentation?: ContactListPresentationSnapshot;
  createdAt?: string;
  updatedAt?: string;
};

export type ContactSavedViewValidationError = "empty" | "duplicate" | "missing";

const DEFAULT_VISIBLE_COLUMN_IDS = CONTACT_COLUMNS_METADATA
  .filter((column) => column.defaultVisible)
  .map((column) => column.key);

const COLUMN_CATALOG = new Set(CONTACT_COLUMNS_METADATA.map((column) => column.key));
const COLUMN_WIDTH_CATALOG = new Set([...COLUMN_CATALOG, "selection", "actions"]);

const DEFAULT_FILTERS: ContactListFilterSnapshot = {
  searchTerm: "",
  statusFilter: "all",
  linkFilter: "all",
  sourceFilter: "all",
  ownerFilter: "all",
  priorityFilter: "all",
  relationshipLevelFilter: "all",
  decisionRoleFilter: "all",
  nextFollowUpAtFilter: "",
  lastInteractionAtFilter: "",
  doNotContactFilter: null,
};

export function getDefaultContactVisibleColumnIds(): string[] {
  return [...DEFAULT_VISIBLE_COLUMN_IDS];
}

export function getDefaultContactColumnWidths(): Record<string, number> {
  const defaults: Record<string, number> = { selection: 48, actions: 80 };
  CONTACT_COLUMNS_METADATA.forEach((column) => {
    defaults[column.key] = column.minWidth || 150;
  });
  return defaults;
}

export function getDefaultContactFilters(): ContactListFilterSnapshot {
  return { ...DEFAULT_FILTERS };
}

export function getDefaultContactPresentationSnapshot(): ContactListPresentationSnapshot {
  const visibleColumnIds = getDefaultContactVisibleColumnIds();
  return {
    visibleColumnIds,
    orderedColumnIds: [...visibleColumnIds],
    columnWidths: getDefaultContactColumnWidths(),
    filters: getDefaultContactFilters(),
    sortBy: "recentlyUpdated",
    viewMode: "table",
  };
}

export function normalizeContactColumnIds(columnIds: readonly string[] | undefined): string[] {
  const normalized: string[] = [];
  for (const columnId of columnIds ?? []) {
    if (!COLUMN_CATALOG.has(columnId) || normalized.includes(columnId)) continue;
    normalized.push(columnId);
  }
  return normalized;
}

function normalizeColumnWidths(widths: Record<string, number> | undefined): Record<string, number> | undefined {
  if (!widths) return undefined;
  const normalized: Record<string, number> = {};
  Object.entries(widths).forEach(([columnId, width]) => {
    if (!COLUMN_WIDTH_CATALOG.has(columnId) || !Number.isFinite(width) || width <= 0) return;
    normalized[columnId] = width;
  });
  return Object.keys(normalized).length ? normalized : undefined;
}

export function normalizeContactPresentationSnapshot(
  snapshot: Partial<ContactListPresentationSnapshot> | undefined,
  fallbackColumnIds: readonly string[] = DEFAULT_VISIBLE_COLUMN_IDS,
): ContactListPresentationSnapshot {
  const fallback = normalizeContactColumnIds(fallbackColumnIds);
  const safeFallback = fallback.length ? fallback : getDefaultContactVisibleColumnIds();
  const orderedColumnIds = normalizeContactColumnIds(
    snapshot?.orderedColumnIds?.length
      ? snapshot.orderedColumnIds
      : snapshot?.visibleColumnIds?.length
        ? snapshot.visibleColumnIds
        : safeFallback,
  );
  const visibleColumnIds = normalizeContactColumnIds(
    snapshot?.visibleColumnIds?.length ? snapshot.visibleColumnIds : orderedColumnIds,
  );
  const visibleSet = new Set(visibleColumnIds);
  const effectiveColumnIds = orderedColumnIds.filter((columnId) => visibleSet.has(columnId));
  const normalizedIds = effectiveColumnIds.length ? effectiveColumnIds : safeFallback;

  return {
    visibleColumnIds: [...normalizedIds],
    orderedColumnIds: [...normalizedIds],
    columnWidths: normalizeColumnWidths(snapshot?.columnWidths),
    filters: snapshot?.filters ? { ...snapshot.filters } : undefined,
    sortBy: snapshot?.sortBy,
    viewMode: snapshot?.viewMode === "card" || snapshot?.viewMode === "table" ? snapshot.viewMode : undefined,
  };
}

export function resolveContactPresentationSnapshot(
  snapshot: Partial<ContactListPresentationSnapshot> | undefined,
): ContactListPresentationSnapshot {
  const normalized = normalizeContactPresentationSnapshot(snapshot);
  return {
    ...normalized,
    columnWidths: {
      ...getDefaultContactColumnWidths(),
      ...(normalized.columnWidths ?? {}),
    },
    filters: {
      ...getDefaultContactFilters(),
      ...(normalized.filters ?? {}),
    },
    sortBy: normalized.sortBy || "recentlyUpdated",
    viewMode: normalized.viewMode || "table",
  };
}

export function createContactPresentationSnapshot(input: {
  visibleColumns: readonly string[];
  orderedColumns?: readonly string[];
  columnWidths?: Record<string, number>;
  filters?: Partial<ContactListFilterSnapshot>;
  sortBy?: string;
  viewMode?: "card" | "table";
}): ContactListPresentationSnapshot {
  return normalizeContactPresentationSnapshot({
    visibleColumnIds: [...input.visibleColumns],
    orderedColumnIds: [...(input.orderedColumns ?? input.visibleColumns)],
    columnWidths: input.columnWidths ? { ...input.columnWidths } : undefined,
    filters: input.filters ? { ...input.filters } : undefined,
    sortBy: input.sortBy,
    viewMode: input.viewMode,
  });
}

export function normalizeContactCustomViews(views: readonly ContactSavedViewItem[]): ContactCustomSavedView[] {
  return views
    .filter((view) => !view.isShared && view.key.startsWith("custom_"))
    .map((view) => {
      const now = view.updatedAt || view.createdAt || new Date(0).toISOString();
      return {
        key: view.key,
        labelKey: view.labelKey,
        isShared: false,
        icon: view.icon || "default",
        presentation: normalizeContactPresentationSnapshot(view.presentation),
        createdAt: view.createdAt || now,
        updatedAt: view.updatedAt || now,
      };
    });
}

export function isDuplicateContactViewName(
  views: readonly ContactSavedViewItem[],
  name: string,
  excludeKey?: string,
): boolean {
  const normalized = name.trim().toLocaleLowerCase();
  return views.some((view) => (
    !view.isShared &&
    view.key !== excludeKey &&
    view.labelKey.trim().toLocaleLowerCase() === normalized
  ));
}

function nextContactCustomViewKey(views: readonly ContactSavedViewItem[], seed: number): string {
  let candidate = Math.max(0, Math.trunc(seed));
  while (views.some((view) => view.key === `custom_${candidate}`)) candidate += 1;
  return `custom_${candidate}`;
}

export function createContactCustomSavedView(
  views: readonly ContactSavedViewItem[],
  name: string,
  presentation: ContactListPresentationSnapshot,
  now = new Date(),
):
  | { ok: true; views: ContactSavedViewItem[]; view: ContactCustomSavedView }
  | { ok: false; error: Extract<ContactSavedViewValidationError, "empty" | "duplicate"> } {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "empty" };
  if (isDuplicateContactViewName(views, trimmed)) return { ok: false, error: "duplicate" };

  const timestamp = now.toISOString();
  const view: ContactCustomSavedView = {
    key: nextContactCustomViewKey(views, now.getTime()),
    labelKey: trimmed,
    isShared: false,
    icon: "default",
    presentation: normalizeContactPresentationSnapshot(presentation),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return { ok: true, views: [...views, view], view };
}

export function updateContactCustomSavedView(
  views: readonly ContactSavedViewItem[],
  key: string,
  name: string,
  presentation: ContactListPresentationSnapshot,
  now = new Date(),
):
  | { ok: true; views: ContactSavedViewItem[]; view: ContactCustomSavedView }
  | { ok: false; error: ContactSavedViewValidationError } {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "empty" };
  if (isDuplicateContactViewName(views, trimmed, key)) return { ok: false, error: "duplicate" };

  const existing = views.find((view) => view.key === key && !view.isShared);
  if (!existing) return { ok: false, error: "missing" };

  const updated: ContactCustomSavedView = {
    key: existing.key,
    labelKey: trimmed,
    isShared: false,
    icon: existing.icon || "default",
    presentation: normalizeContactPresentationSnapshot(presentation),
    createdAt: existing.createdAt || now.toISOString(),
    updatedAt: now.toISOString(),
  };
  return {
    ok: true,
    views: views.map((view) => view.key === key ? updated : view),
    view: updated,
  };
}

export function deleteContactCustomSavedView(
  views: readonly ContactSavedViewItem[],
  key: string,
): { deleted: boolean; views: ContactSavedViewItem[] } {
  const existing = views.find((view) => view.key === key);
  if (!existing || existing.isShared) return { deleted: false, views: [...views] };
  return { deleted: true, views: views.filter((view) => view.key !== key) };
}
