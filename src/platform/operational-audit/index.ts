import { appendTamperEvidentAuditRecord, sanitizeSensitiveValue } from "@/platform/enterprise-security";
import { BrowserStorageAdapter } from "@/platform/persistence";
import { getWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { subscribeToWorkspaceScope } from "@/platform/workspace-scope/workspaceScopeRuntime";

export interface OperationalAuditEntry {
  id: string;
  workspaceId: string;
  moduleKey: string;
  recordId: string;
  action: string;
  actorId: string;
  actorName?: string;
  occurredAt: string;
  reason?: string;
  correlationId?: string;
  before?: unknown;
  after?: unknown;
}

type Listener = (entries: OperationalAuditEntry[]) => void;

const entriesByWorkspace = new Map<string, OperationalAuditEntry[]>();
const listeners = new Set<Listener>();
const storage = new BrowserStorageAdapter();
const MAX_ENTRIES_PER_WORKSPACE = 500;
const keyFor = (workspaceId: string) => `unicore_operational_activity_v1:${workspaceId}`;

function currentWorkspaceId(): string {
  return getWorkspaceContextSnapshot().workspaceId;
}

function emit(): void {
  const snapshot = getOperationalAuditSnapshot();
  listeners.forEach((listener) => listener(snapshot));
}

function readWorkspaceEntries(workspaceId: string): OperationalAuditEntry[] {
  const cached = entriesByWorkspace.get(workspaceId);
  if (cached) return cached;
  const stored = storage.get<OperationalAuditEntry[]>(keyFor(workspaceId));
  const entries = Array.isArray(stored)
    ? stored.filter((entry) => isOperationalAuditEntry(entry, workspaceId)).slice(0, MAX_ENTRIES_PER_WORKSPACE)
    : [];
  entriesByWorkspace.set(workspaceId, entries);
  return entries;
}

function isOperationalAuditEntry(value: unknown, workspaceId: string): value is OperationalAuditEntry {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entry = value as Partial<OperationalAuditEntry>;
  return entry.workspaceId === workspaceId
    && typeof entry.id === "string"
    && typeof entry.moduleKey === "string"
    && typeof entry.recordId === "string"
    && typeof entry.action === "string"
    && typeof entry.actorId === "string"
    && typeof entry.occurredAt === "string"
    && !Number.isNaN(Date.parse(entry.occurredAt));
}

export function recordOperationalAudit(
  entry: Omit<OperationalAuditEntry, "id" | "workspaceId" | "occurredAt"> & {
    id?: string;
    workspaceId?: string;
    occurredAt?: string;
  },
): OperationalAuditEntry {
  const workspaceId = entry.workspaceId ?? currentWorkspaceId();
  const occurredAt = entry.occurredAt ?? new Date().toISOString();
  const saved: OperationalAuditEntry = {
    ...entry,
    ...(entry.before !== undefined ? { before: sanitizeSensitiveValue(entry.before) } : {}),
    ...(entry.after !== undefined ? { after: sanitizeSensitiveValue(entry.after) } : {}),
    id: entry.id ?? `audit_${entry.moduleKey}_${entry.recordId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    workspaceId,
    occurredAt,
  };
  const current = readWorkspaceEntries(workspaceId);
  const next = [saved, ...current].slice(0, MAX_ENTRIES_PER_WORKSPACE);
  entriesByWorkspace.set(workspaceId, next);
  storage.set(keyFor(workspaceId), next);
  appendTamperEvidentAuditRecord({
    scopeId: workspaceId,
    category: entry.moduleKey === "access-control" ? "AUTHORIZATION" : entry.moduleKey === "studio" ? "CONFIGURATION" : entry.moduleKey === "backup" ? "BACKUP" : entry.moduleKey === "identity" ? "IDENTITY" : "DATA_CHANGE",
    action: entry.action,
    actorId: entry.actorId,
    subjectId: `${entry.moduleKey}:${entry.recordId}`,
    occurredAt,
    metadata: sanitizeSensitiveValue({
      moduleKey: entry.moduleKey,
      recordId: entry.recordId,
      actorName: entry.actorName,
      reason: entry.reason,
      correlationId: entry.correlationId,
      before: entry.before,
      after: entry.after,
    }) as Record<string, unknown>,
  });
  if (workspaceId === currentWorkspaceId()) emit();
  return structuredClone(saved);
}

export function getOperationalAuditSnapshot(moduleKey?: string, recordId?: string): OperationalAuditEntry[] {
  const entries = readWorkspaceEntries(currentWorkspaceId());
  return structuredClone(entries.filter((entry) => {
    if (moduleKey && entry.moduleKey !== moduleKey) return false;
    if (recordId && entry.recordId !== recordId) return false;
    return true;
  }));
}

export function subscribeToOperationalAudit(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

subscribeToWorkspaceScope((event) => {
  if (event.phase === "READY") emit();
});
