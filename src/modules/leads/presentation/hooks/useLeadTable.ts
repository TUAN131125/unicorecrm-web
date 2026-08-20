import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { ColumnKeyType } from "../model/leadTable.types";

import { useEffectiveAccess } from "@/platform/access-control";
import {
  resolveEffectiveView,
  useConfigurationRuntime,
  type RuntimeUserViewPreference,
  type RuntimeViewPolicy,
} from "@/platform/configuration-runtime";
import { getLeadPreference, removeLeadPreference, setLeadPreference } from "../../public/leads";

export const ALL_COLUMN_FIELDS = [
  "tags", "salutation", "name", "lastName", "firstName", "title",
  "phone", "companyPhone", "email", "personalEmail", "companyName",
  "address", "city", "district", "ward", "source", "companyType",
  "industry", "description", "ownerId", "createdBy", "createdAt",
  "updatedBy", "updatedAt", "status", "nextFollowUpAt", "lastInteractionAt",
  "disqualificationReason", "recontactAt", "interestedProducts", "campaignId"
] as const satisfies readonly ColumnKeyType[];

export type { ColumnKeyType } from "../model/leadTable.types";

export const DEFAULT_VISIBLE_COLUMNS: ColumnKeyType[] = [
  "tags", "salutation", "name", "title", "phone", "companyPhone", "email", "personalEmail", "companyName", "address", "city", "district", "ward"
];

const COLUMN_PREFERENCE_KEY = "centrix_lead_list_columns";
const COLUMN_WIDTH_PREFERENCE_KEY = "centrix_lead_list_column_widths";

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  selection: 48,
  tags: 80,
  salutation: 100,
  name: 180,
  lastName: 120,
  firstName: 120,
  title: 180,
  phone: 150,
  companyPhone: 150,
  email: 220,
  personalEmail: 220,
  companyName: 240,
  address: 260,
  status: 140,
  ownerId: 160,
  nextFollowUpAt: 180,
  actions: 120,
  city: 140,
  district: 140,
  ward: 145,
  source: 150,
  companyType: 140,
  industry: 150,
  description: 250,
  createdBy: 140,
  createdAt: 140,
  updatedBy: 140,
  updatedAt: 140,
  lastInteractionAt: 140,
  disqualificationReason: 200,
  recontactAt: 140,
  interestedProducts: 200,
  campaignId: 160
};

function createFallbackPolicy(columns: readonly string[]): RuntimeViewPolicy {
  return {
    id: "lead-runtime-fallback",
    objectType: "lead",
    allowedColumns: [...columns],
    requiredColumns: ["name"],
    defaultColumns: [...DEFAULT_VISIBLE_COLUMNS],
    version: 0,
  };
}

export const useLeadTable = (showToast: (msg: string) => void, t: (key: string, fallback?: string) => string) => {
  const configurationRuntime = useConfigurationRuntime();
  const access = useEffectiveAccess();
  const [isColumnSettingsOpen, setIsColumnSettingsOpen] = useState(false);

  const schemaFields = useMemo(
    () => configurationRuntime.objectSchemas
      .find((schema) => schema.objectType === "lead")
      ?.fields.filter((field) => field.status === "ACTIVE" && !field.hidden) ?? [],
    [configurationRuntime.objectSchemas],
  );
  const schemaColumnKeys = useMemo(
    () => schemaFields
      .map((field) => field.key)
      .filter((fieldKey) => access.getFieldAccess("leads", fieldKey) !== "HIDDEN"),
    [schemaFields, access],
  );
  const knownColumnKeys = useMemo(
    () => Array.from(new Set<string>([...ALL_COLUMN_FIELDS, ...schemaColumnKeys])),
    [schemaColumnKeys],
  );
  const workspacePolicy = useMemo(
    () => configurationRuntime.workspaceViewPolicies.find((policy) => policy.objectType === "lead")
      ?? createFallbackPolicy(knownColumnKeys),
    [configurationRuntime.workspaceViewPolicies, knownColumnKeys],
  );
  const rolePolicy = useMemo(
    () => configurationRuntime.roleViewPolicies.find(
      (policy) => policy.objectType === "lead" && policy.roleId && access.roleIds.has(policy.roleId),
    ),
    [configurationRuntime.roleViewPolicies, access.roleIds],
  );
  const permittedColumns = useMemo(
    () => knownColumnKeys.filter((fieldKey) => access.getFieldAccess("leads", fieldKey) !== "HIDDEN"),
    [knownColumnKeys, access],
  );
  const allColumnFields = useMemo<ColumnKeyType[]>(() => {
    const permitted = new Set(permittedColumns);
    const roleAllowed = rolePolicy?.allowedColumns ?? workspacePolicy.allowedColumns;
    return roleAllowed.filter((column) => permitted.has(column));
  }, [permittedColumns, rolePolicy, workspacePolicy]);

  const readUserPreference = useCallback((): RuntimeUserViewPreference | undefined => {
    const stored = getLeadPreference<ColumnKeyType[] | null>(COLUMN_PREFERENCE_KEY, null);
    if (!stored) return undefined;
    return {
      objectType: "lead",
      visibleColumns: stored,
      customizedAt: new Date(0).toISOString(),
    };
  }, []);

  const resolveColumns = useCallback((userPreference?: RuntimeUserViewPreference) => {
    const result = resolveEffectiveView({
      workspacePolicy,
      rolePolicy,
      userPreference,
      permittedColumns,
    });
    const fallback = result.visibleColumns.length > 0
      ? result.visibleColumns
      : allColumnFields.slice(0, 1);
    return {
      ...result,
      visibleColumns: fallback as ColumnKeyType[],
    };
  }, [workspacePolicy, rolePolicy, permittedColumns, allColumnFields]);

  const initialView = useMemo(() => resolveColumns(readUserPreference()), [resolveColumns, readUserPreference]);
  const [visibleColumns, setVisibleColumns] = useState<ColumnKeyType[]>(initialView.visibleColumns);
  const [viewSource, setViewSource] = useState(initialView.source);
  const [removedColumns, setRemovedColumns] = useState(initialView.removedColumns);

  // Re-evaluate workspace/role policy when the backend schema/configuration revision changes. Existing user
  // preferences remain the selected source, while revoked or deleted fields disappear safely.
  useEffect(() => {
    const next = resolveColumns(readUserPreference());
    setVisibleColumns(next.visibleColumns);
    setViewSource(next.source);
    setRemovedColumns(next.removedColumns);
  }, [configurationRuntime.revision, resolveColumns, readUserPreference]);

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() =>
    getLeadPreference<Record<string, number>>(COLUMN_WIDTH_PREFERENCE_KEY, DEFAULT_COLUMN_WIDTHS),
  );

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [tempColumns, setTempColumns] = useState<ColumnKeyType[]>([...visibleColumns]);
  const [colSearchQuery, setColSearchQuery] = useState("");

  useEffect(() => {
    if (isColumnSettingsOpen) {
      setTempColumns([...visibleColumns]);
      setColSearchQuery("");
    }
  }, [isColumnSettingsOpen, visibleColumns]);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = "move";
    setDraggedIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === index) return;
    setDragOverIndex(index);
  }, [draggedIndex]);

  const handleColumnDrop = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null) return;
    setTempColumns((prev) => {
      const list = [...prev];
      const draggedItem = list[draggedIndex];
      list.splice(draggedIndex, 1);
      list.splice(targetIndex, 0, draggedItem);
      return list;
    });
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [draggedIndex]);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);

  const handleColumnResize = useCallback((e: React.MouseEvent, colKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = columnWidths[colKey] || 150;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const minWidth = colKey === "selection" ? 40 : 60;
      const newWidth = Math.max(minWidth, startWidth + deltaX);
      setColumnWidths((prev) => ({
        ...prev,
        [colKey]: newWidth
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      setColumnWidths((prev) => {
        setLeadPreference(COLUMN_WIDTH_PREFERENCE_KEY, prev);
        return prev;
      });
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [columnWidths]);

  const handleColumnReset = useCallback((colKey: string) => {
    const defaultVal = DEFAULT_COLUMN_WIDTHS[colKey] || 150;
    setColumnWidths((prev) => {
      const next = { ...prev, [colKey]: defaultVal };
      setLeadPreference(COLUMN_WIDTH_PREFERENCE_KEY, next);
      return next;
    });
  }, []);

  const applyVisibleColumns = useCallback((columns: readonly ColumnKeyType[]) => {
    const preference: RuntimeUserViewPreference = {
      objectType: "lead",
      visibleColumns: [...columns],
      customizedAt: new Date().toISOString(),
    };
    const next = resolveColumns(preference);
    setVisibleColumns(next.visibleColumns);
    setViewSource(next.source);
    setRemovedColumns(next.removedColumns);
    setLeadPreference(COLUMN_PREFERENCE_KEY, next.visibleColumns);
    return next.visibleColumns;
  }, [resolveColumns]);

  const handleSaveColumns = useCallback((columns: readonly ColumnKeyType[]) => {
    const resolved = applyVisibleColumns(columns);
    setTempColumns([...resolved]);
    setLeadPreference(COLUMN_WIDTH_PREFERENCE_KEY, columnWidths);
    setIsColumnSettingsOpen(false);
    showToast(t("common.updatedSuccessfully", "Cập nhật hiển thị cột thành công"));
  }, [columnWidths, showToast, t, applyVisibleColumns]);

  const handleResetDefaultColumns = useCallback(() => {
    removeLeadPreference(COLUMN_PREFERENCE_KEY);
    const defaults = resolveColumns(undefined);
    setVisibleColumns(defaults.visibleColumns);
    setViewSource(defaults.source);
    setRemovedColumns(defaults.removedColumns);
    setTempColumns([...defaults.visibleColumns]);
    setColumnWidths({ ...DEFAULT_COLUMN_WIDTHS });
    setLeadPreference(COLUMN_WIDTH_PREFERENCE_KEY, DEFAULT_COLUMN_WIDTHS);
  }, [resolveColumns]);

  return {
    isColumnSettingsOpen,
    setIsColumnSettingsOpen,
    allColumnFields,
    visibleColumns,
    setVisibleColumns,
    viewSource,
    removedColumns,
    applyVisibleColumns,
    columnWidths,
    setColumnWidths,
    draggedIndex,
    dragOverIndex,
    tempColumns,
    setTempColumns,
    colSearchQuery,
    setColSearchQuery,
    handleDragStart,
    handleDragOver,
    handleColumnDrop,
    handleDragEnd,
    handleColumnResize,
    handleColumnReset,
    handleSaveColumns,
    handleResetDefaultColumns,
  };
};
