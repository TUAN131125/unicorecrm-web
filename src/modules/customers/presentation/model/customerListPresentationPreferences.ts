import { CUSTOMER_COLUMNS_METADATA } from "./customerColumns";
import type {
  CustomerListFilterSnapshot,
  CustomerListPresentationSnapshot,
  CustomerSavedViewItem,
} from "../list/customerList.types";

const DEFAULT_VISIBLE_COLUMN_IDS = CUSTOMER_COLUMNS_METADATA
  .filter((column) => column.defaultVisible)
  .map((column) => column.key);

const COLUMN_CATALOG = new Set(CUSTOMER_COLUMNS_METADATA.map((column) => column.key));
const COLUMN_WIDTH_CATALOG = new Set([...COLUMN_CATALOG, "selection", "actions"]);

const DEFAULT_FILTERS: CustomerListFilterSnapshot = {
  searchTerm: "",
  typeFilter: "all",
  statusFilter: "all",
  healthFilter: "all",
  ownerFilter: "all",
  segmentFilter: "all",
  nextCareDateFilter: "",
};

export function getDefaultCustomerVisibleColumnIds(): string[] {
  return [...DEFAULT_VISIBLE_COLUMN_IDS];
}

export function getDefaultCustomerColumnWidths(): Record<string, number> {
  const defaults: Record<string, number> = { selection: 48, actions: 80 };
  CUSTOMER_COLUMNS_METADATA.forEach((column) => {
    defaults[column.key] = column.minWidth;
  });
  return defaults;
}

export function getDefaultCustomerFilters(): CustomerListFilterSnapshot {
  return { ...DEFAULT_FILTERS };
}

export function getDefaultCustomerPresentationSnapshot(): CustomerListPresentationSnapshot {
  const visibleColumnIds = getDefaultCustomerVisibleColumnIds();
  return {
    visibleColumnIds,
    orderedColumnIds: [...visibleColumnIds],
    columnWidths: getDefaultCustomerColumnWidths(),
    filters: getDefaultCustomerFilters(),
    viewMode: "table",
  };
}

export function normalizeCustomerColumnIds(columnIds: readonly string[] | undefined): string[] {
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

export function normalizeCustomerPresentationSnapshot(
  snapshot: Partial<CustomerListPresentationSnapshot> | undefined,
): CustomerListPresentationSnapshot {
  const safeFallback = getDefaultCustomerVisibleColumnIds();
  const orderedColumnIds = normalizeCustomerColumnIds(
    snapshot?.orderedColumnIds?.length
      ? snapshot.orderedColumnIds
      : snapshot?.visibleColumnIds?.length
        ? snapshot.visibleColumnIds
        : safeFallback,
  );
  const visibleColumnIds = normalizeCustomerColumnIds(
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
    viewMode: snapshot?.viewMode === "card" || snapshot?.viewMode === "table" ? snapshot.viewMode : undefined,
  };
}

export function resolveCustomerPresentationSnapshot(
  snapshot: Partial<CustomerListPresentationSnapshot> | undefined,
): CustomerListPresentationSnapshot {
  const normalized = normalizeCustomerPresentationSnapshot(snapshot);
  return {
    ...normalized,
    columnWidths: {
      ...getDefaultCustomerColumnWidths(),
      ...(normalized.columnWidths ?? {}),
    },
    filters: {
      ...getDefaultCustomerFilters(),
      ...(normalized.filters ?? {}),
    },
    viewMode: normalized.viewMode || "table",
  };
}

export function captureCustomerPresentationSnapshot(input: {
  visibleColumns: readonly string[];
  columnWidths?: Record<string, number>;
  filters?: Partial<CustomerListFilterSnapshot>;
  viewMode?: "card" | "table";
}): CustomerListPresentationSnapshot {
  return normalizeCustomerPresentationSnapshot({
    visibleColumnIds: [...input.visibleColumns],
    orderedColumnIds: [...input.visibleColumns],
    columnWidths: input.columnWidths ? { ...input.columnWidths } : undefined,
    filters: input.filters ? { ...input.filters } : undefined,
    viewMode: input.viewMode,
  });
}

export function normalizeCustomerCustomViews(views: readonly CustomerSavedViewItem[]): CustomerSavedViewItem[] {
  return views
    .filter((view) => !view.isShared && view.key.startsWith("custom_"))
    .map((view) => {
      const now = view.updatedAt || view.createdAt || new Date(0).toISOString();
      return {
        key: view.key,
        labelVi: view.labelVi,
        labelEn: view.labelEn || view.labelVi,
        isShared: false,
        presentation: normalizeCustomerPresentationSnapshot(view.presentation),
        createdAt: view.createdAt || now,
        updatedAt: now,
      };
    });
}

function isDuplicateViewName(views: readonly CustomerSavedViewItem[], name: string, excludeKey?: string): boolean {
  const normalized = name.trim().toLocaleLowerCase();
  return views.some((view) => (
    !view.isShared
    && view.key !== excludeKey
    && view.labelVi.trim().toLocaleLowerCase() === normalized
  ));
}

function nextCustomViewKey(views: readonly CustomerSavedViewItem[], seed: number): string {
  let candidate = Math.max(0, Math.trunc(seed));
  while (views.some((view) => view.key === `custom_${candidate}`)) candidate += 1;
  return `custom_${candidate}`;
}

export function createCustomerCustomSavedView(
  views: readonly CustomerSavedViewItem[],
  name: string,
  presentation: CustomerListPresentationSnapshot,
  now = new Date(),
): { ok: true; views: CustomerSavedViewItem[]; view: CustomerSavedViewItem } | { ok: false; error: "empty" | "duplicate" } {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "empty" };
  if (isDuplicateViewName(views, trimmed)) return { ok: false, error: "duplicate" };

  const timestamp = now.toISOString();
  const view: CustomerSavedViewItem = {
    key: nextCustomViewKey(views, now.getTime()),
    labelVi: trimmed,
    labelEn: trimmed,
    isShared: false,
    presentation: normalizeCustomerPresentationSnapshot(presentation),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return { ok: true, views: [...views, view], view };
}

export function updateCustomerCustomSavedView(
  views: readonly CustomerSavedViewItem[],
  key: string,
  name: string,
  presentation: CustomerListPresentationSnapshot,
  now = new Date(),
): { ok: true; views: CustomerSavedViewItem[]; view: CustomerSavedViewItem } | { ok: false; error: "empty" | "duplicate" | "missing" } {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "empty" };
  if (isDuplicateViewName(views, trimmed, key)) return { ok: false, error: "duplicate" };
  const existing = views.find((view) => view.key === key && !view.isShared);
  if (!existing) return { ok: false, error: "missing" };

  const updated: CustomerSavedViewItem = {
    ...existing,
    labelVi: trimmed,
    labelEn: trimmed,
    presentation: normalizeCustomerPresentationSnapshot(presentation),
    updatedAt: now.toISOString(),
  };
  return {
    ok: true,
    views: views.map((view) => view.key === key ? updated : view),
    view: updated,
  };
}

export function deleteCustomerCustomSavedView(
  views: readonly CustomerSavedViewItem[],
  key: string,
): { deleted: boolean; views: CustomerSavedViewItem[] } {
  const existing = views.find((view) => view.key === key);
  if (!existing || existing.isShared) return { deleted: false, views: [...views] };
  return { deleted: true, views: views.filter((view) => view.key !== key) };
}
