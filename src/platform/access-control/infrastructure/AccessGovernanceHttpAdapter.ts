import {
  AccessGovernanceApiClient,
  type AccessMutationResponse,
  type AuthorizationContextDocument,
  type CreateAccessRoleRequest,
  type EffectiveRecordAccessDocument,
  type ReplaceAccessRoleRequest,
  type WorkspaceAccessDirectoryDocument,
} from "@/platform/api/generated/accessGovernanceApi";
import type {
  AccessGovernanceRuntime,
  AccessMutationResult,
  AuthorizationContextProjection,
  CreateAccessRoleInput,
  EffectiveRecordAccessInput,
  EffectiveRecordAccessProjection,
  ReplaceAccessRoleInput,
  WorkspaceAccessDirectory,
} from "../domain/accessGovernance.types";

export class AccessGovernanceHttpAdapter implements AccessGovernanceRuntime {
  readonly mode = "connected" as const;

  constructor(private readonly api: AccessGovernanceApiClient) {}

  readonly queries = {
    getAuthorizationContext: async (_workspaceId: string, signal?: AbortSignal) => mapAuthorizationContext(await this.api.getCurrentAuthorizationContext({}, signal)),
    getDirectory: async (_workspaceId: string, signal?: AbortSignal) => mapDirectory(await this.api.getWorkspaceAccessDirectory({}, signal)),
    evaluateRecordAccess: async (_workspaceId: string, input: EffectiveRecordAccessInput, signal?: AbortSignal) => mapRecordAccess(await this.api.evaluateEffectiveRecordAccess(toRecordAccessRequest(input), { signal })),
  };

  readonly commands = {
    inviteMember: async (_workspaceId: string, input: Parameters<AccessGovernanceRuntime["commands"]["inviteMember"]>[1], options: Parameters<AccessGovernanceRuntime["commands"]["inviteMember"]>[2]) => mapMutation(await this.api.inviteWorkspaceMember(input, { ...options, retry: "never" })),
    resendInvitation: async (_workspaceId: string, invitationId: string, options: Parameters<AccessGovernanceRuntime["commands"]["resendInvitation"]>[2]) => mapMutation(await this.api.resendWorkspaceInvitation(invitationId, {}, { ...options, retry: "never" })),
    revokeInvitation: async (_workspaceId: string, invitationId: string, options: Parameters<AccessGovernanceRuntime["commands"]["revokeInvitation"]>[2]) => mapMutation(await this.api.revokeWorkspaceInvitation(invitationId, {}, { ...options, retry: "never" })),
    provisionMember: async (_workspaceId: string, input: Parameters<AccessGovernanceRuntime["commands"]["provisionMember"]>[1], options: Parameters<AccessGovernanceRuntime["commands"]["provisionMember"]>[2]) => mapMutation(await this.api.provisionWorkspaceMember(input, { ...options, retry: "never" })),
    replaceMemberAccess: async (_workspaceId: string, membershipId: string, input: Parameters<AccessGovernanceRuntime["commands"]["replaceMemberAccess"]>[2], options: Parameters<AccessGovernanceRuntime["commands"]["replaceMemberAccess"]>[3]) => mapMutation(await this.api.replaceWorkspaceMemberAccess(membershipId, input, { ...options, retry: "never" })),
    changeMemberStatus: async (_workspaceId: string, membershipId: string, input: Parameters<AccessGovernanceRuntime["commands"]["changeMemberStatus"]>[2], options: Parameters<AccessGovernanceRuntime["commands"]["changeMemberStatus"]>[3]) => mapMutation(await this.api.changeWorkspaceMemberStatus(membershipId, input, { ...options, retry: "never" })),
    rotateManagedMemberPassword: async (_workspaceId: string, membershipId: string, options: Parameters<AccessGovernanceRuntime["commands"]["rotateManagedMemberPassword"]>[2]) => mapMutation(await this.api.rotateManagedMemberPassword(membershipId, {}, { ...options, retry: "never" })),
    createRole: async (_workspaceId: string, input: CreateAccessRoleInput, options: Parameters<AccessGovernanceRuntime["commands"]["createRole"]>[2]) => mapMutation(await this.api.createAccessRole(toCreateRoleRequest(input), { ...options, retry: "never" })),
    replaceRole: async (_workspaceId: string, roleId: string, input: ReplaceAccessRoleInput, options: Parameters<AccessGovernanceRuntime["commands"]["replaceRole"]>[3]) => mapMutation(await this.api.replaceAccessRole(roleId, toReplaceRoleRequest(input), { ...options, retry: "never" })),
    archiveRole: async (_workspaceId: string, roleId: string, reason: string | undefined, options: Parameters<AccessGovernanceRuntime["commands"]["archiveRole"]>[3]) => mapMutation(await this.api.archiveAccessRole(roleId, reason ? { reason } : {}, { ...options, retry: "never" })),
  };
}

function mapAuthorizationContext(value: AuthorizationContextDocument): AuthorizationContextProjection {
  const dataScopes: AuthorizationContextProjection["dataScopes"] = {};
  for (const item of value.dataScopes) dataScopes[item.resourceKey] = item.scope;
  const fieldSecurity: AuthorizationContextProjection["fieldSecurity"] = {};
  for (const item of value.fieldSecurity) {
    const resource = fieldSecurity[item.resourceKey] ?? {};
    resource[item.fieldKey] = item.access;
    fieldSecurity[item.resourceKey] = resource;
  }
  return {
    workspaceId: value.workspaceId,
    membershipId: value.membershipId,
    memberId: value.memberId,
    accountId: value.accountId,
    roleIds: [...value.roleIds],
    roleTemplateIds: [...value.roleTemplateIds],
    capabilities: [...value.capabilities],
    productSpaces: [...value.productSpaces],
    dataScopes,
    fieldSecurity,
    evaluatedAt: value.evaluatedAt,
  };
}

function mapDirectory(value: WorkspaceAccessDirectoryDocument): WorkspaceAccessDirectory {
  return {
    workspaceId: value.workspaceId,
    revision: value.revision,
    generatedAt: value.generatedAt,
    members: value.members.map((item) => ({
      membershipId: item.membershipId,
      ...(item.accountId ? { accountId: item.accountId } : {}),
      memberId: item.memberId,
      workspaceId: item.workspaceId,
      workspaceKey: item.workspaceKey,
      name: item.name,
      status: item.status,
      logoText: item.logoText,
      teamIds: [...item.teamIds],
      roleAssignmentIds: item.roleIds.map((roleId) => `server:${item.membershipId}:${roleId}`),
      source: item.source,
      ...(item.createdAt ? { createdAt: item.createdAt } : {}),
      resourceVersion: item.version,
    })),
    memberDetails: value.memberProfiles.map((item) => ({
      memberId: item.memberId,
      membershipId: item.membershipId,
      ...(item.accountId ? { accountId: item.accountId } : {}),
      displayName: item.displayName,
      ...(item.email ? { email: item.email } : {}),
      accountSource: item.accountSource,
      ...(item.accountStatus ? { accountStatus: item.accountStatus } : {}),
      ...(item.roleLabel ? { roleLabel: item.roleLabel } : {}),
      ...(item.provisionedAt ? { provisionedAt: item.provisionedAt } : {}),
    })),
    invitations: value.invitations.map((item) => ({
      invitationId: item.invitationId,
      membershipId: item.membershipId,
      workspaceId: item.workspaceId,
      email: item.email,
      displayName: item.displayName,
      roleIds: [...item.roleIds],
      teamIds: [...item.teamIds],
      status: item.status,
      invitedByAccountId: "backend",
      createdAt: item.createdAt,
      lastSentAt: item.lastSentAt,
      expiresAt: item.expiresAt,
      ...(item.acceptedAt ? { acceptedAt: item.acceptedAt } : {}),
      ...(item.revokedAt ? { revokedAt: item.revokedAt } : {}),
      resourceVersion: item.version,
    })),
    roles: value.roles.map((item) => ({
      roleId: item.roleId,
      workspaceId: item.workspaceId,
      name: item.name,
      ...(item.description ? { description: item.description } : {}),
      ...(item.sourceTemplateId ? { sourceTemplateId: item.sourceTemplateId } : {}),
      isActive: item.isActive,
      capabilities: [...item.capabilities],
      version: item.version,
    })),
    assignments: value.assignments.map((item) => ({ ...item })),
    dataScopes: value.dataScopes.map((item) => ({ ...item, ...(item.allowedOwnerIds ? { allowedOwnerIds: [...item.allowedOwnerIds] } : {}) })),
    fieldSecurity: value.fieldSecurity.map((item) => ({ ...item })),
  };
}

function mapMutation(value: AccessMutationResponse): AccessMutationResult {
  return {
    commandId: value.commandId,
    correlationId: value.correlationId,
    aggregateId: value.aggregateId,
    aggregateType: value.aggregateType,
    version: value.version,
    occurredAt: value.occurredAt,
    outcome: value.outcome,
    directory: mapDirectory(value.result),
  };
}

function mapRecordAccess(value: EffectiveRecordAccessDocument): EffectiveRecordAccessProjection {
  return {
    workspaceId: value.workspaceId,
    resourceKey: value.resourceKey,
    ...(value.recordId ? { recordId: value.recordId } : {}),
    canRead: value.canRead,
    canUpdate: value.canUpdate,
    canDelete: value.canDelete,
    canExport: value.canExport,
    canApprove: value.canApprove,
    allowedCommands: [...value.allowedCommands],
    fieldAccess: { ...value.fieldAccess },
    decisionReasons: value.decisionReasons.map((item) => ({ ...item })),
    evaluatedAt: value.evaluatedAt,
    authority: "backend",
  };
}

function toRecordAccessRequest(input: EffectiveRecordAccessInput) {
  return {
    resourceKey: input.resourceKey,
    ...(input.recordId ? { recordId: input.recordId } : {}),
    ...(input.requestedCommands ? { requestedCommands: [...input.requestedCommands] } : {}),
    ...(input.requestedFields ? { requestedFields: [...input.requestedFields] } : {}),
    ...(input.includeExport === undefined ? {} : { includeExport: input.includeExport }),
    ...(input.includeApproval === undefined ? {} : { includeApproval: input.includeApproval }),
  };
}

function toCreateRoleRequest(input: CreateAccessRoleInput): CreateAccessRoleRequest {
  return {
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    ...(input.sourceTemplateId ? { sourceTemplateId: input.sourceTemplateId } : {}),
    capabilities: [...input.capabilities],
    dataScopes: (input.dataScopes ?? []).map((item) => ({ ...item, ...(item.allowedOwnerIds ? { allowedOwnerIds: [...item.allowedOwnerIds] } : {}) })),
    fieldSecurity: (input.fieldSecurity ?? []).map((item) => ({ ...item })),
  };
}

function toReplaceRoleRequest(input: ReplaceAccessRoleInput): ReplaceAccessRoleRequest {
  return { ...toCreateRoleRequest(input), isActive: input.isActive };
}
