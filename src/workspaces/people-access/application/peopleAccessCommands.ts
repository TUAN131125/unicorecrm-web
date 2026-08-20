import {
  assertAccessConfigurationAllowed,
  assertMembershipStatusChangeAllowed,
  getAccessControlSnapshot,
  replaceRoleAssignments,
} from "@/platform/access-control/runtime/accessControlRuntime";
import {
  isProvisionedUserAccount,
  provisionUserAccount,
  removeProvisionedUserAccount,
  rotateProvisionedUserPassword,
  revokeAccountSessions,
  getAuthSessionSnapshot,
  type ProvisionedAccountDescriptor,
} from "@/platform/identity-auth";
import {
  createActiveWorkspaceMembership,
  inviteWorkspaceMember,
  removeAdditionalWorkspaceMembership,
  resendWorkspaceInvitation,
  revokeWorkspaceInvitation,
  updateWorkspaceMembershipStatus,
  updateWorkspaceMembershipTeams,
  getWorkspacePeopleSnapshot,
  listWorkspaceMembershipDirectory,
  type InviteWorkspaceMemberCommand,
  type WorkspaceInvitationRecord,
  type WorkspaceMembership,
  type WorkspaceMembershipStatus,
} from "@/platform/workspace-membership";
import { recordOperationalAudit } from "@/platform/operational-audit";

function currentActor() {
  const session = getAuthSessionSnapshot();
  return {
    actorId: session?.principal.accountId ?? "system",
    actorName: session?.principal.displayName,
  };
}

function roleDescriptors(workspaceId: string, roleIds: string[]) {
  const roles = getAccessControlSnapshot(workspaceId).roles;
  return roleIds.map((roleId) => ({
    roleId,
    roleName: roles.find((role) => role.roleId === roleId)?.name ?? roleId,
  }));
}

function recordPeopleActivity(input: {
  workspaceId: string;
  recordId: string;
  action: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
}): void {
  const actor = currentActor();
  recordOperationalAudit({
    workspaceId: input.workspaceId,
    moduleKey: "access-control",
    recordId: input.recordId,
    action: input.action,
    actorId: actor.actorId,
    actorName: actor.actorName,
    ...(input.before !== undefined ? { before: input.before } : {}),
    ...(input.after !== undefined ? { after: input.after } : {}),
    ...(input.reason ? { reason: input.reason } : {}),
  });
}

function assertAssignableRoles(workspaceId: string, roleIds: string[]): string[] {
  const normalizedRoleIds = [...new Set(roleIds.filter(Boolean))];
  if (normalizedRoleIds.length === 0) throw new Error("At least one role is required.");
  const roles = getAccessControlSnapshot(workspaceId).roles;
  for (const roleId of normalizedRoleIds) {
    const role = roles.find((candidate) => candidate.roleId === roleId);
    if (!role) throw new Error("Role was not found in the active workspace.");
    if (!role.isActive) throw new Error(`Inactive role cannot be assigned: ${role.name}.`);
  }
  return normalizedRoleIds;
}

/** The compatibility name is retained while the command now supports multiple initial roles. */
export function inviteWorkspaceMemberWithRole(command: InviteWorkspaceMemberCommand): WorkspaceInvitationRecord {
  assertAccessConfigurationAllowed(command.workspaceId);
  const roleIds = assertAssignableRoles(command.workspaceId, command.roleIds);
  const invitation = inviteWorkspaceMember({ ...command, roleIds });
  try {
    replaceRoleAssignments(invitation.membershipId, roleIds, command.workspaceId, { skipAudit: true });
    recordPeopleActivity({
      workspaceId: command.workspaceId,
      recordId: invitation.invitationId,
      action: "MemberInvitationCreated",
      after: {
        invitationId: invitation.invitationId,
        membershipId: invitation.membershipId,
        displayName: invitation.displayName,
        email: invitation.email,
        roles: roleDescriptors(command.workspaceId, roleIds),
        teamIds: invitation.teamIds,
        status: invitation.status,
      },
    });
    return invitation;
  } catch (error) {
    revokeWorkspaceInvitation(command.workspaceId, invitation.invitationId);
    throw error;
  }
}

export interface ProvisionWorkspaceEmployeeCommand {
  workspaceId: string;
  displayName: string;
  email: string;
  roleIds: string[];
  teamIds: string[];
  initialPassword?: string;
  provisionedByAccountId: string;
}

export interface ProvisionWorkspaceEmployeeResult {
  account: ProvisionedAccountDescriptor;
  membership: WorkspaceMembership;
  temporaryPassword: string;
}

export function provisionWorkspaceEmployeeAccount(command: ProvisionWorkspaceEmployeeCommand): ProvisionWorkspaceEmployeeResult {
  assertAccessConfigurationAllowed(command.workspaceId);
  const roleIds = assertAssignableRoles(command.workspaceId, command.roleIds);
  const provisioned = provisionUserAccount({
    displayName: command.displayName,
    email: command.email,
    initialPassword: command.initialPassword,
    provisionedByAccountId: command.provisionedByAccountId,
  });
  let membership: WorkspaceMembership | undefined;
  try {
    membership = createActiveWorkspaceMembership({
      workspaceId: command.workspaceId,
      accountId: provisioned.account.accountId,
      memberId: provisioned.account.memberId,
      teamIds: command.teamIds,
      createdByAccountId: command.provisionedByAccountId,
    });
    if (!membership.membershipId) throw new Error("Provisioned membership did not receive an identifier.");
    replaceRoleAssignments(membership.membershipId, roleIds, command.workspaceId, { skipAudit: true });
    recordPeopleActivity({
      workspaceId: command.workspaceId,
      recordId: membership.membershipId,
      action: "WorkspaceMemberAdded",
      after: {
        membershipId: membership.membershipId,
        accountId: membership.accountId,
        memberId: membership.memberId,
        displayName: command.displayName,
        email: command.email,
        roles: roleDescriptors(command.workspaceId, roleIds),
        teamIds: membership.teamIds ?? [],
        status: membership.status,
      },
    });
    return { account: provisioned.account, membership, temporaryPassword: provisioned.temporaryPassword };
  } catch (error) {
    if (membership?.membershipId) removeAdditionalWorkspaceMembership(command.workspaceId, membership.membershipId);
    removeProvisionedUserAccount(provisioned.account.accountId);
    throw error;
  }
}

export function updateWorkspaceMemberAccessCommand(
  workspaceId: string,
  membershipId: string,
  roleIds: string[],
  teamIds: string[],
): void {
  assertAccessConfigurationAllowed(workspaceId);
  const normalizedRoleIds = assertAssignableRoles(workspaceId, roleIds);
  const target = listWorkspaceMembershipDirectory(workspaceId).find((membership) => membership.membershipId === membershipId);
  if (!target) throw new Error("Workspace membership was not found.");
  const snapshot = getAccessControlSnapshot(workspaceId);
  const previousRoleIds = snapshot.assignments.filter((assignment) => assignment.membershipId === membershipId).map((assignment) => assignment.roleId);
  const previousTeamIds = target.teamIds ?? [];
  replaceRoleAssignments(membershipId, normalizedRoleIds, workspaceId, { skipAudit: true });
  updateWorkspaceMembershipTeams(workspaceId, membershipId, teamIds);
  recordPeopleActivity({
    workspaceId,
    recordId: membershipId,
    action: "MemberAccessChanged",
    before: {
      membershipId,
      roles: roleDescriptors(workspaceId, previousRoleIds),
      teamIds: previousTeamIds,
    },
    after: {
      membershipId,
      roles: roleDescriptors(workspaceId, normalizedRoleIds),
      teamIds: [...new Set(teamIds.filter(Boolean))],
    },
  });
}

export function rotateWorkspaceEmployeePasswordCommand(workspaceId: string, accountId: string): string {
  assertAccessConfigurationAllowed(workspaceId);
  if (!isProvisionedUserAccount(accountId)) throw new Error("This account is managed by another identity provider.");
  const temporaryPassword = rotateProvisionedUserPassword(accountId);
  recordPeopleActivity({ workspaceId, recordId: accountId, action: "MemberPasswordReset" });
  return temporaryPassword;
}

export function resendWorkspaceInvitationCommand(workspaceId: string, invitationId: string): void {
  assertAccessConfigurationAllowed(workspaceId);
  const invitation = getWorkspacePeopleSnapshot(workspaceId).invitations.find((item) => item.invitationId === invitationId);
  resendWorkspaceInvitation(workspaceId, invitationId);
  recordPeopleActivity({
    workspaceId,
    recordId: invitationId,
    action: "MemberInvitationResent",
    after: invitation ? { invitationId, email: invitation.email, displayName: invitation.displayName } : { invitationId },
  });
}

export function revokeWorkspaceInvitationCommand(workspaceId: string, invitationId: string): void {
  assertAccessConfigurationAllowed(workspaceId);
  const invitation = getWorkspacePeopleSnapshot(workspaceId).invitations.find((item) => item.invitationId === invitationId);
  revokeWorkspaceInvitation(workspaceId, invitationId);
  recordPeopleActivity({
    workspaceId,
    recordId: invitationId,
    action: "MemberInvitationRevoked",
    before: invitation ? { invitationId, email: invitation.email, displayName: invitation.displayName, status: invitation.status } : { invitationId },
    after: invitation ? { invitationId, email: invitation.email, displayName: invitation.displayName, status: "REVOKED" } : { invitationId, status: "REVOKED" },
  });
}

export function updateWorkspaceMembershipStatusCommand(
  workspaceId: string,
  membershipId: string,
  status: Exclude<WorkspaceMembershipStatus, "invited">,
): void {
  assertMembershipStatusChangeAllowed(membershipId, status, workspaceId);
  const target = listWorkspaceMembershipDirectory(workspaceId).find((membership) => membership.membershipId === membershipId);
  if (!target) throw new Error("Workspace membership was not found.");
  const previousStatus = target.status;
  updateWorkspaceMembershipStatus(workspaceId, membershipId, status);
  recordPeopleActivity({
    workspaceId,
    recordId: membershipId,
    action: status === "suspended" ? "WorkspaceMemberSuspended" : "WorkspaceMemberReactivated",
    before: { status: previousStatus, accountId: target.accountId },
    after: { status, accountId: target.accountId },
  });
  if (status === "suspended" && target.accountId) revokeAccountSessions(target.accountId, `WORKSPACE_MEMBERSHIP_SUSPENDED:${workspaceId}`);
}
