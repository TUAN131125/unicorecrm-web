import type { DataScope } from "@/platform/access-control";

export type OwnershipScopeView = "MINE" | "TEAM" | "ALLOWED";
export type OwnershipResourceKey = "leads" | "deals" | "contacts";
export type OwnershipAuditAction = "CREATED" | "REASSIGNED";

export interface OwnershipMemberOption {
  memberId: string;
  displayName: string;
  email?: string;
  teamIds: string[];
  isCurrent: boolean;
}

export interface RecordOwnershipContext {
  workspaceId: string;
  accountId: string;
  memberId: string;
  displayName: string;
  teamIds: string[];
  dataScope: DataScope;
  canAssign: boolean;
  visibleOwners: OwnershipMemberOption[];
  assignableOwners: OwnershipMemberOption[];
}

export interface RecordOwnershipAuditEntry {
  auditId: string;
  workspaceId: string;
  resourceKey: OwnershipResourceKey;
  recordId: string;
  action: OwnershipAuditAction;
  previousOwnerId?: string;
  nextOwnerId: string;
  actorAccountId: string;
  actorMemberId: string;
  reason: string;
  occurredAt: string;
}
