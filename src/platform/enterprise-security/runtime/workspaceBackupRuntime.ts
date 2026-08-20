import type { WorkspaceBackupArchive, WorkspaceRestorePlan } from "../domain/enterpriseSecurity.types";
import { canonicalStringify, sha256 } from "./stableHash";

const SECRET_KEY_PATTERN = /(auth_session|last_login|credential|secret|token|password)/i;

export function isWorkspaceBackupKey(key: string, workspaceId: string): boolean {
  return key.startsWith(`workspace:${workspaceId}:`)
    || key.endsWith(`:${workspaceId}`)
    || key.includes(`:${workspaceId}:`);
}

function archivePayload(archive: Omit<WorkspaceBackupArchive, "archiveChecksum">): string {
  return canonicalStringify(archive);
}

export function createWorkspaceBackupArchive(
  workspaceId: string,
  createdByAccountId: string,
  source: Storage = window.localStorage,
): WorkspaceBackupArchive {
  const entries = [];
  const excludedKeys: string[] = [];
  for (let index = 0; index < source.length; index += 1) {
    const key = source.key(index);
    if (!key || !isWorkspaceBackupKey(key, workspaceId)) continue;
    if (SECRET_KEY_PATTERN.test(key)) {
      excludedKeys.push(key);
      continue;
    }
    const value = source.getItem(key) ?? "";
    entries.push({ key, value, checksum: sha256(value) });
  }
  entries.sort((a, b) => a.key.localeCompare(b.key));
  excludedKeys.sort();
  const base: Omit<WorkspaceBackupArchive, "archiveChecksum"> = {
    schemaVersion: 1,
    workspaceId,
    createdAt: new Date().toISOString(),
    createdByAccountId,
    entries,
    excludedKeys,
  };
  return { ...base, archiveChecksum: sha256(archivePayload(base)) };
}

export function verifyWorkspaceBackupArchive(archive: WorkspaceBackupArchive): boolean {
  if (archive.schemaVersion !== 1 || !archive.workspaceId) return false;
  if (archive.entries.some((entry) => sha256(entry.value) !== entry.checksum || !isWorkspaceBackupKey(entry.key, archive.workspaceId) || SECRET_KEY_PATTERN.test(entry.key))) return false;
  const { archiveChecksum: _checksum, ...base } = archive;
  return sha256(archivePayload(base)) === archive.archiveChecksum;
}

export function planWorkspaceRestore(archive: WorkspaceBackupArchive, activeWorkspaceId: string, target: Storage = window.localStorage): WorkspaceRestorePlan {
  const archiveChecksumValid = verifyWorkspaceBackupArchive(archive);
  const rejectedKeys = archive.entries.filter((entry) => !isWorkspaceBackupKey(entry.key, activeWorkspaceId) || SECRET_KEY_PATTERN.test(entry.key)).map((entry) => entry.key);
  const keysToCreate: string[] = [];
  const keysToReplace: string[] = [];
  const keysUnchanged: string[] = [];
  for (const entry of archive.entries) {
    if (rejectedKeys.includes(entry.key)) continue;
    const current = target.getItem(entry.key);
    if (current === null) keysToCreate.push(entry.key);
    else if (current === entry.value) keysUnchanged.push(entry.key);
    else keysToReplace.push(entry.key);
  }
  return {
    workspaceId: activeWorkspaceId,
    archiveChecksumValid,
    keysToCreate,
    keysToReplace,
    keysUnchanged,
    rejectedKeys,
    canApply: archiveChecksumValid && archive.workspaceId === activeWorkspaceId && rejectedKeys.length === 0,
  };
}

export function applyWorkspaceRestore(archive: WorkspaceBackupArchive, activeWorkspaceId: string, target: Storage = window.localStorage): WorkspaceRestorePlan {
  const plan = planWorkspaceRestore(archive, activeWorkspaceId, target);
  if (!plan.canApply) throw new Error("Workspace restore rejected: checksum, tenant, or protected-key validation failed.");
  for (const entry of archive.entries) target.setItem(entry.key, entry.value);
  return plan;
}
