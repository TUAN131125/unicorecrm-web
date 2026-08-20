import {
  createRoleDefinition,
  deleteRoleDefinition,
  getAccessControlSnapshot,
  resolveLocalEffectiveAccess,
  updateDataScope,
  updateFieldSecurity,
  updateRoleCapabilities,
  updateRoleDefinition,
} from "@/platform/access-control/runtime/accessControlRuntime";
import { listWorkspaceMemberDirectoryFor } from "@/platform/member-directory";
import { getWorkspacePeopleSnapshot, listWorkspaceMembershipDirectory } from "@/platform/workspace-membership";
import {
  inviteWorkspaceMemberWithRole,
  provisionWorkspaceEmployeeAccount,
  resendWorkspaceInvitationCommand,
  revokeWorkspaceInvitationCommand,
  rotateWorkspaceEmployeePasswordCommand,
  updateWorkspaceMemberAccessCommand,
  updateWorkspaceMembershipStatusCommand,
} from "../application/peopleAccessCommands";
import type { DataScope, FieldAccess } from "@/platform/access-control/domain/accessControl.types";
import type {
  AccessGovernanceRuntime,
  AccessMutationResult,
  AuthorizationContextProjection,
  WorkspaceAccessDirectory,
} from "@/platform/access-control/domain/accessGovernance.types";

export function createPeopleAccessDemoRuntime(): AccessGovernanceRuntime {
  return {
    mode: "demo",
    queries: {
      getAuthorizationContext: async (workspaceId) => mapAuthorization(workspaceId),
      getDirectory: async (workspaceId) => mapDirectory(workspaceId),
      evaluateRecordAccess: async (workspaceId, input) => {
        const access = resolveLocalEffectiveAccess(workspaceId);
        return {
          workspaceId,
          resourceKey: input.resourceKey,
          ...(input.recordId ? { recordId: input.recordId } : {}),
          canRead: access.canAccessModule(input.resourceKey),
          canUpdate: access.canPerform(input.resourceKey, "update"),
          canDelete: access.canPerform(input.resourceKey, "delete"),
          canExport: access.canPerform(input.resourceKey, "export"),
          canApprove: access.canPerform(input.resourceKey, "approve"),
          allowedCommands: (input.requestedCommands ?? []).filter((command) => access.can(command)),
          fieldAccess: Object.fromEntries((input.requestedFields ?? []).map((field) => [field, access.getFieldAccess(input.resourceKey, field)])),
          decisionReasons: [{ code: "DEMO_ACCESS_EVALUATION", effect: "LIMIT", source: "demo" }],
          evaluatedAt: new Date().toISOString(),
          authority: "demo",
        };
      },
    },
    commands: {
      inviteMember: async (workspaceId, input) => { inviteWorkspaceMemberWithRole({ ...input, workspaceId, invitedByAccountId: "demo" }); return result(workspaceId, "WorkspaceInvitation"); },
      resendInvitation: async (workspaceId, invitationId) => { resendWorkspaceInvitationCommand(workspaceId, invitationId); return result(workspaceId, invitationId); },
      revokeInvitation: async (workspaceId, invitationId) => { revokeWorkspaceInvitationCommand(workspaceId, invitationId); return result(workspaceId, invitationId); },
      provisionMember: async (workspaceId, input) => { provisionWorkspaceEmployeeAccount({ ...input, workspaceId, provisionedByAccountId: "demo" }); return result(workspaceId, "WorkspaceMembership"); },
      replaceMemberAccess: async (workspaceId, membershipId, input) => { updateWorkspaceMemberAccessCommand(workspaceId, membershipId, input.roleIds, input.teamIds); return result(workspaceId, membershipId); },
      changeMemberStatus: async (workspaceId, membershipId, input) => { updateWorkspaceMembershipStatusCommand(workspaceId, membershipId, input.status); return result(workspaceId, membershipId); },
      rotateManagedMemberPassword: async (workspaceId, membershipId) => {
        const member = listWorkspaceMembershipDirectory(workspaceId).find((item) => item.membershipId === membershipId);
        if (!member?.accountId) throw new Error("Managed member account was not found.");
        rotateWorkspaceEmployeePasswordCommand(workspaceId, member.accountId);
        return result(workspaceId, membershipId);
      },
      createRole: async (workspaceId, input) => { const role = createRoleDefinition(input, workspaceId); applyPolicies(workspaceId, role.roleId, input); return result(workspaceId, role.roleId); },
      replaceRole: async (workspaceId, roleId, input) => { updateRoleDefinition(roleId, { name: input.name, description: input.description, isActive: input.isActive }, workspaceId); updateRoleCapabilities(roleId, input.capabilities, workspaceId); applyPolicies(workspaceId, roleId, input); return result(workspaceId, roleId); },
      archiveRole: async (workspaceId, roleId) => { deleteRoleDefinition(roleId, workspaceId); return result(workspaceId, roleId); },
    },
  };
}

function mapAuthorization(workspaceId: string): AuthorizationContextProjection {
  const access = resolveLocalEffectiveAccess(workspaceId);
  const resources = ["leads","contacts","organizations","customers","tasks","products","deals","quotes","orders","payments","invoices","receivables","shipping","returns","support","studio","access","audit"];
  return {
    workspaceId,
    membershipId: access.membershipId,
    memberId: access.memberId,
    accountId: access.accountId,
    roleIds: [...access.roleIds],
    roleTemplateIds: [...access.roleTemplateIds],
    capabilities: [...access.capabilities],
    productSpaces: [...access.productSpaces],
    dataScopes: Object.fromEntries(resources.map((resource) => [resource, access.getDataScope(resource)])),
    fieldSecurity: {},
    unlistedFieldAccess: "READ_WRITE",
    evaluatedAt: new Date().toISOString(),
  };
}
function mapDirectory(workspaceId: string): WorkspaceAccessDirectory {
  const access = getAccessControlSnapshot(workspaceId);
  const people = getWorkspacePeopleSnapshot(workspaceId);
  return {
    workspaceId,
    revision: Math.max(access.revision, people.revision),
    generatedAt: new Date().toISOString(),
    members: listWorkspaceMembershipDirectory(workspaceId),
    memberDetails: listWorkspaceMemberDirectoryFor(workspaceId),
    invitations: people.invitations,
    roles: access.roles,
    assignments: access.assignments,
    dataScopes: access.dataScopes,
    fieldSecurity: access.fieldSecurity,
  };
}
function result(workspaceId: string, aggregateId: string): AccessMutationResult {
  const directory = mapDirectory(workspaceId);
  return { commandId: `demo:${Date.now()}`, correlationId: `demo:${Date.now()}`, aggregateId, aggregateType: "AccessGovernance", version: directory.revision, occurredAt: new Date().toISOString(), outcome: "COMMITTED", directory };
}
function applyPolicies(workspaceId: string, roleId: string, input: { dataScopes?: Array<{ resourceKey: string; scope: DataScope; allowedOwnerIds?: string[] }>; fieldSecurity?: Array<{ resourceKey: string; fieldKey: string; access: FieldAccess }> }) {
  for (const item of input.dataScopes ?? []) updateDataScope(roleId, item.resourceKey, item.scope, workspaceId, item.allowedOwnerIds);
  for (const item of input.fieldSecurity ?? []) updateFieldSecurity(roleId, item.resourceKey, item.fieldKey, item.access, workspaceId);
}
