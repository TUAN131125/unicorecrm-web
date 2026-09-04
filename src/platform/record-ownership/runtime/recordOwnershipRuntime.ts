import { getAuthSessionSnapshot } from "@/platform/identity-auth";
import { listDevelopmentAccounts } from "@/platform/identity-auth";
import { assertRuntimeCommandAccess, resolveEffectiveAccess, type Capability } from "@/platform/access-control";
import { getWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { listWorkspaceMembershipDirectory } from "@/platform/workspace-membership";
import { BrowserStorageAdapter } from "@/platform/persistence";
import {
  assertReassignmentAllowed,
  filterByOwnershipScope,
  isSelfClaimReassignment,
  resolveCreateOwnerId,
} from "../domain/recordOwnership.rules";
import type {
  OwnershipResourceKey,
  OwnershipScopeView,
  RecordOwnershipAuditEntry,
  RecordOwnershipContext,
} from "../domain/recordOwnership.types";

const storage = new BrowserStorageAdapter();
const AUDIT_KEY_PREFIX = "unicore_record_ownership_audit_v1";
const MAX_AUDIT_ENTRIES = 1000;

function auditKey(workspaceId: string): string {
  return `${AUDIT_KEY_PREFIX}:${workspaceId}`;
}

export function getRecordOwnershipContext(
  resourceKey: OwnershipResourceKey,
  assignCapability: Capability,
): RecordOwnershipContext | null {
  const session = getAuthSessionSnapshot();
  if (!session) return null;
  const membership = getWorkspaceContextSnapshot();
  const workspaceId = membership.workspaceId;
  if (!membership?.memberId || membership.status !== "active") return null;

  const access = resolveEffectiveAccess(workspaceId);
  const accounts = new Map(listDevelopmentAccounts().map((account) => [account.accountId, account]));
  const members = listWorkspaceMembershipDirectory(workspaceId)
    .filter((candidate) => candidate.status === "active" && Boolean(candidate.memberId))
    .map((candidate) => ({
      memberId: candidate.memberId!,
      displayName: candidate.accountId
        ? accounts.get(candidate.accountId)?.displayName || candidate.memberId!
        : candidate.memberId!,
      email: candidate.accountId ? accounts.get(candidate.accountId)?.email : undefined,
      teamIds: [...(candidate.teamIds || [])],
      isCurrent: candidate.memberId === session.principal.memberId,
    }));

  const canAssign = access.can(assignCapability);
  const visibleOwners = members.filter((candidate) =>
    candidate.memberId === session.principal.memberId
    || access.canAccessRecord(resourceKey, { ownerId: candidate.memberId }),
  );
  const assignableOwners = visibleOwners.filter((candidate) =>
    candidate.memberId === session.principal.memberId || canAssign,
  );

  if (!visibleOwners.some((candidate) => candidate.memberId === session.principal.memberId)) {
    const currentOwner = {
      memberId: session.principal.memberId,
      displayName: session.principal.displayName,
      email: session.principal.email,
      teamIds: [...(membership.teamIds || [])],
      isCurrent: true,
    };
    visibleOwners.unshift(currentOwner);
    assignableOwners.unshift(currentOwner);
  }

  return {
    workspaceId,
    accountId: session.principal.accountId,
    memberId: session.principal.memberId,
    displayName: session.principal.displayName,
    teamIds: [...(membership.teamIds || [])],
    dataScope: access.getDataScope(resourceKey),
    canAssign,
    visibleOwners,
    assignableOwners,
  };
}

export function enforceCreateOwner(
  resourceKey: OwnershipResourceKey,
  assignCapability: Capability,
  requestedOwnerId?: string,
): { ownerId: string; context: RecordOwnershipContext | null } {
  const context = getRecordOwnershipContext(resourceKey, assignCapability);
  return { ownerId: resolveCreateOwnerId(requestedOwnerId, context), context };
}

export function assertOwnerReassignment(
  resourceKey: OwnershipResourceKey,
  assignCapability: Capability,
  updateCapability: Capability,
  record: { ownerId?: string } | undefined,
  nextOwnerId: string,
  reason: string,
): RecordOwnershipContext | null {
  const context = getRecordOwnershipContext(resourceKey, assignCapability);
  const previousOwnerId = record?.ownerId;
  if (context && isSelfClaimReassignment(previousOwnerId, nextOwnerId, context)) {
    // An unassigned work-queue record may be claimed by the current member.
    // This is an update to the actor's own queue, not reassignment to another person.
    assertRuntimeCommandAccess(updateCapability);
  } else if (previousOwnerId === nextOwnerId) {
    assertRuntimeCommandAccess(updateCapability, resourceKey, record);
  } else {
    assertRuntimeCommandAccess(assignCapability, resourceKey, record);
  }
  assertReassignmentAllowed(previousOwnerId, nextOwnerId, reason, context);
  return context;
}

export function filterRuntimeRecordsByOwnership<T extends { ownerId?: string }>(
  resourceKey: OwnershipResourceKey,
  assignCapability: Capability,
  records: readonly T[],
  view: OwnershipScopeView,
): T[] {
  const context = getRecordOwnershipContext(resourceKey, assignCapability);
  if (!context) return [...records];
  const access = resolveEffectiveAccess(context.workspaceId);
  return filterByOwnershipScope(records, view, context, (record) => access.canAccessRecord(resourceKey, record));
}

export function appendRecordOwnershipAudit(
  input: Omit<RecordOwnershipAuditEntry, "auditId" | "workspaceId" | "actorAccountId" | "actorMemberId" | "occurredAt">,
  context: RecordOwnershipContext | null,
): RecordOwnershipAuditEntry | null {
  if (!context) return null;
  const entry: RecordOwnershipAuditEntry = {
    ...input,
    auditId: `ownership_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    workspaceId: context.workspaceId,
    actorAccountId: context.accountId,
    actorMemberId: context.memberId,
    occurredAt: new Date().toISOString(),
  };
  const current = storage.get<RecordOwnershipAuditEntry[]>(auditKey(context.workspaceId)) || [];
  storage.set(auditKey(context.workspaceId), [entry, ...current].slice(0, MAX_AUDIT_ENTRIES));
  return entry;
}

export function getRecordOwnershipAuditSnapshot(workspaceId = getWorkspaceContextSnapshot().workspaceId): RecordOwnershipAuditEntry[] {
  return (storage.get<RecordOwnershipAuditEntry[]>(auditKey(workspaceId)) || []).map((entry) => ({ ...entry }));
}

export function getRecordOwnershipAuditForRecord(
  resourceKey: OwnershipResourceKey,
  recordId: string,
  workspaceId = getWorkspaceContextSnapshot().workspaceId,
): RecordOwnershipAuditEntry[] {
  return getRecordOwnershipAuditSnapshot(workspaceId)
    .filter((entry) => entry.resourceKey === resourceKey && entry.recordId === recordId);
}
