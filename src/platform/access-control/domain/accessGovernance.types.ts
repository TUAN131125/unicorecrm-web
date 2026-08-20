import { capabilityForAction, readCapabilityForModule } from "./capabilityCatalog";
import type {
  AccessControlSnapshot,
  DataScope,
  DataScopePolicy,
  EffectiveAccess,
  FieldAccess,
  FieldSecurityPolicy,
  RoleAssignment,
  RoleDefinition,
} from "./accessControl.types";
import type {
  WorkspaceInvitationRecord,
  WorkspaceMembership,
  WorkspaceMembershipStatus,
} from "@/platform/workspace-membership";
import type { WorkspaceMemberDirectoryEntry } from "@/platform/member-directory";

export type AccessGovernanceRuntimeMode = "demo" | "connected" | "test";

export interface AuthorizationContextProjection {
  workspaceId: string;
  membershipId: string;
  memberId: string;
  accountId: string;
  roleIds: string[];
  roleTemplateIds: string[];
  capabilities: string[];
  productSpaces: Array<"crm" | "studio" | "people">;
  dataScopes: Record<string, DataScope>;
  fieldSecurity: Record<string, Record<string, FieldAccess>>;
  /** Demo projections use the local policy default; connected projections remain fail-closed when a field is omitted. */
  unlistedFieldAccess?: FieldAccess;
  evaluatedAt: string;
}

export interface WorkspaceAccessDirectory {
  workspaceId: string;
  revision: number;
  generatedAt: string;
  members: WorkspaceMembership[];
  memberDetails: WorkspaceMemberDirectoryEntry[];
  invitations: WorkspaceInvitationRecord[];
  roles: RoleDefinition[];
  assignments: RoleAssignment[];
  dataScopes: DataScopePolicy[];
  fieldSecurity: FieldSecurityPolicy[];
}

export interface AccessGovernanceSnapshot {
  workspaceId: string;
  revision: number;
  authorization: AuthorizationContextProjection;
  directory: WorkspaceAccessDirectory;
}

export interface AccessCommandOptions {
  signal?: AbortSignal;
  idempotencyKey: string;
}

export interface VersionedAccessCommandOptions extends AccessCommandOptions {
  expectedVersion: number;
}

export interface InviteWorkspaceMemberInput {
  displayName: string;
  email: string;
  roleIds: string[];
  teamIds: string[];
}

export interface ProvisionWorkspaceMemberInput extends InviteWorkspaceMemberInput {}

export interface ReplaceWorkspaceMemberAccessInput {
  roleIds: string[];
  teamIds: string[];
}

export interface ChangeWorkspaceMemberStatusInput {
  status: Exclude<WorkspaceMembershipStatus, "invited">;
  reason?: string;
}

export interface CreateAccessRoleInput {
  name: string;
  description?: string;
  sourceTemplateId?: string;
  capabilities: string[];
  dataScopes?: Array<Pick<DataScopePolicy, "resourceKey" | "scope" | "allowedOwnerIds">>;
  fieldSecurity?: Array<Pick<FieldSecurityPolicy, "resourceKey" | "fieldKey" | "access">>;
}

export interface ReplaceAccessRoleInput extends CreateAccessRoleInput {
  isActive: boolean;
}

export interface AccessMutationResult {
  commandId: string;
  correlationId: string;
  aggregateId: string;
  aggregateType: string;
  version: number;
  occurredAt: string;
  outcome: "COMMITTED" | "REPLAYED";
  directory: WorkspaceAccessDirectory;
}

export interface EffectiveRecordAccessInput {
  resourceKey: string;
  recordId?: string;
  requestedCommands?: string[];
  requestedFields?: string[];
  includeExport?: boolean;
  includeApproval?: boolean;
}

export interface EffectiveRecordAccessProjection {
  workspaceId: string;
  resourceKey: string;
  recordId?: string;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canExport: boolean;
  canApprove: boolean;
  allowedCommands: string[];
  fieldAccess: Record<string, FieldAccess>;
  decisionReasons: Array<{ code: string; effect: "ALLOW" | "DENY" | "LIMIT"; message?: string; source?: string }>;
  evaluatedAt: string;
  authority: "backend" | "demo";
}

export interface AccessGovernanceQueryPort {
  getAuthorizationContext(workspaceId: string, signal?: AbortSignal): Promise<AuthorizationContextProjection>;
  getDirectory(workspaceId: string, signal?: AbortSignal): Promise<WorkspaceAccessDirectory>;
  evaluateRecordAccess(workspaceId: string, input: EffectiveRecordAccessInput, signal?: AbortSignal): Promise<EffectiveRecordAccessProjection>;
}

export interface AccessGovernanceCommandPort {
  inviteMember(workspaceId: string, input: InviteWorkspaceMemberInput, options: AccessCommandOptions): Promise<AccessMutationResult>;
  resendInvitation(workspaceId: string, invitationId: string, options: AccessCommandOptions): Promise<AccessMutationResult>;
  revokeInvitation(workspaceId: string, invitationId: string, options: AccessCommandOptions): Promise<AccessMutationResult>;
  provisionMember(workspaceId: string, input: ProvisionWorkspaceMemberInput, options: AccessCommandOptions): Promise<AccessMutationResult>;
  replaceMemberAccess(workspaceId: string, membershipId: string, input: ReplaceWorkspaceMemberAccessInput, options: VersionedAccessCommandOptions): Promise<AccessMutationResult>;
  changeMemberStatus(workspaceId: string, membershipId: string, input: ChangeWorkspaceMemberStatusInput, options: VersionedAccessCommandOptions): Promise<AccessMutationResult>;
  rotateManagedMemberPassword(workspaceId: string, membershipId: string, options: AccessCommandOptions): Promise<AccessMutationResult>;
  createRole(workspaceId: string, input: CreateAccessRoleInput, options: AccessCommandOptions): Promise<AccessMutationResult>;
  replaceRole(workspaceId: string, roleId: string, input: ReplaceAccessRoleInput, options: VersionedAccessCommandOptions): Promise<AccessMutationResult>;
  archiveRole(workspaceId: string, roleId: string, reason: string | undefined, options: VersionedAccessCommandOptions): Promise<AccessMutationResult>;
}

export interface AccessGovernanceRuntime {
  readonly mode: AccessGovernanceRuntimeMode;
  readonly queries: AccessGovernanceQueryPort;
  readonly commands: AccessGovernanceCommandPort;
}

export interface AccessGovernanceRuntimeState {
  workspaceId?: string;
  loading: boolean;
  error?: string;
  snapshot?: AccessGovernanceSnapshot;
}

export function projectEffectiveAccess(context: AuthorizationContextProjection): EffectiveAccess {
  const roleIds = new Set(context.roleIds);
  const roleTemplateIds = new Set(context.roleTemplateIds);
  const capabilities = new Set(context.capabilities);
  const productSpaces = new Set(context.productSpaces);
  return {
    workspaceId: context.workspaceId,
    membershipId: context.membershipId,
    memberId: context.memberId,
    accountId: context.accountId,
    roleIds,
    roleTemplateIds,
    capabilities,
    productSpaces,
    can: (capability) => capabilities.has(capability),
    canAccessModule: (moduleKey) => { const capability = readCapabilityForModule(moduleKey); return capability ? capabilities.has(capability) : false; },
    canPerform: (moduleKey, action) => { const capability = capabilityForAction(moduleKey, action); return capability ? capabilities.has(capability) : false; },
    getDataScope: (resourceKey) => context.dataScopes[resourceKey] ?? "CUSTOM",
    canAccessRecord: (resourceKey, record) => {
      const readCapability = readCapabilityForModule(resourceKey) ?? `${resourceKey}.read`;
      if (!capabilities.has(readCapability) || !record || typeof record !== "object") return false;
      const value = record as Record<string, unknown>;
      if (typeof value.workspaceId === "string" && value.workspaceId !== context.workspaceId) return false;
      const scope = context.dataScopes[resourceKey] ?? "CUSTOM";
      if (scope === "WORKSPACE") return true;
      if (scope !== "OWN") return false;
      return [value.ownerId, value.assigneeId, value.createdBy, value.assignedTo].includes(context.memberId);
    },
    getFieldAccess: (resourceKey, fieldKey) => context.fieldSecurity[resourceKey]?.[fieldKey] ?? context.unlistedFieldAccess ?? "HIDDEN",
  };
}

export function directoryToAccessControlSnapshot(directory: WorkspaceAccessDirectory): AccessControlSnapshot {
  return {
    workspaceId: directory.workspaceId,
    revision: directory.revision,
    roles: directory.roles.map((role) => ({ ...role, capabilities: [...role.capabilities] })),
    assignments: directory.assignments.map((item) => ({ ...item })),
    dataScopes: directory.dataScopes.map((item) => ({ ...item, allowedOwnerIds: item.allowedOwnerIds ? [...item.allowedOwnerIds] : undefined })),
    fieldSecurity: directory.fieldSecurity.map((item) => ({ ...item })),
  };
}
