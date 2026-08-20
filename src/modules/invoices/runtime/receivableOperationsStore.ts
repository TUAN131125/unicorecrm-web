import { getWorkspaceContextSnapshot } from "@/platform/workspace-context";

import type { ReceivableCollectionActivity } from "../application/ports/ReceivableOperationsPort";
const STORAGE_PREFIX = "unicore.receivable-operations.v1";
const listeners = new Set<(snapshot: ReceivableCollectionActivity[]) => void>();
let cachedWorkspaceId = "";
let cachedEntries: ReceivableCollectionActivity[] = [];

const storageKey = (workspaceId: string) => `${STORAGE_PREFIX}:${workspaceId}`;

function load(workspaceId: string): ReceivableCollectionActivity[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(workspaceId));
    const parsed = raw ? JSON.parse(raw) as ReceivableCollectionActivity[] : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function ensureWorkspace(): void {
  const workspaceId = getWorkspaceContextSnapshot().workspaceId;
  if (workspaceId === cachedWorkspaceId) return;
  cachedWorkspaceId = workspaceId;
  cachedEntries = load(workspaceId);
}

function persist(): void {
  if (typeof window === "undefined" || !cachedWorkspaceId) return;
  window.localStorage.setItem(storageKey(cachedWorkspaceId), JSON.stringify(cachedEntries));
}

function emit(): void {
  const snapshot = getReceivableCollectionActivities();
  listeners.forEach((listener) => listener(snapshot));
}

export const getReceivableCollectionActivities = (filter?: { invoiceId?: string; buyerId?: string }): ReceivableCollectionActivity[] => {
  ensureWorkspace();
  return cachedEntries
    .filter((entry) => !filter?.invoiceId || entry.invoiceId === filter.invoiceId)
    .filter((entry) => !filter?.buyerId || entry.buyerId === filter.buyerId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
};

export const saveReceivableCollectionActivity = (
  input: Omit<ReceivableCollectionActivity, "id" | "workspaceId" | "createdAt"> & Partial<Pick<ReceivableCollectionActivity, "id" | "createdAt">>,
): ReceivableCollectionActivity => {
  ensureWorkspace();
  const createdAt = input.createdAt ?? new Date().toISOString();
  const entry: ReceivableCollectionActivity = {
    ...input,
    id: input.id ?? `receivable_activity_${crypto.randomUUID()}`,
    workspaceId: cachedWorkspaceId,
    createdAt,
  };
  cachedEntries = [entry, ...cachedEntries.filter((item) => item.id !== entry.id)];
  persist();
  emit();
  return structuredClone(entry);
};

export const updateReceivableCollectionActivityState = (
  activityId: string,
  state: ReceivableCollectionActivity["state"],
): ReceivableCollectionActivity => {
  ensureWorkspace();
  const current = cachedEntries.find((entry) => entry.id === activityId);
  if (!current) throw new Error("RECEIVABLE_ACTIVITY_NOT_FOUND");
  const next = { ...current, state };
  cachedEntries = cachedEntries.map((entry) => entry.id === activityId ? next : entry);
  persist();
  emit();
  return structuredClone(next);
};

export const subscribeToReceivableCollectionActivities = (listener: (snapshot: ReceivableCollectionActivity[]) => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
