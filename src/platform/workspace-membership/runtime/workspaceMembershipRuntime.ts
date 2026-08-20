import { getAuthSessionSnapshot, listDevelopmentAccounts } from "@/platform/identity-auth";
import { BrowserStorageAdapter } from "@/platform/persistence";
import type {
  CreateActiveWorkspaceMembershipCommand,
  InviteWorkspaceMemberCommand,
  WorkspaceDefinition,
  WorkspaceInvitationRecord,
  WorkspaceMembership,
  WorkspaceMembershipStatus,
  WorkspacePeopleSnapshot,
} from "../domain/workspaceMembership.types";

export const DEVELOPMENT_WORKSPACES: readonly WorkspaceDefinition[] = [
  { workspaceId: "ws1", workspaceKey: "unicore-vietnam", name: "Unicore Vietnam", logoText: "UV" },
  { workspaceId: "ws2", workspaceKey: "unicore-global", name: "Unicore Global", logoText: "UG" },
  { workspaceId: "ws3", workspaceKey: "unicore-testing", name: "Unicore Testing", logoText: "UT" },
  { workspaceId: "ws4", workspaceKey: "unicore-enterprise", name: "Unicore Enterprise", logoText: "UE" },
] as const;

const ADMIN_ACCOUNT_ID = "acct_admin";
const storage = new BrowserStorageAdapter();
const listeners = new Set<(snapshot: WorkspacePeopleSnapshot) => void>();
const storageKey = (workspaceId: string) => `unicore_workspace_people_v1:${workspaceId}`;

const baseMemberships: WorkspaceMembership[] = [
  ...DEVELOPMENT_WORKSPACES.map((workspace, index) => ({
    membershipId: `m_admin_${workspace.workspaceId}`,
    accountId: ADMIN_ACCOUNT_ID,
    memberId: "u1",
    ...workspace,
    status: "active" as const,
    teamIds: [index % 2 === 0 ? "team_sales" : "team_admin"],
    roleAssignmentIds: [`ra_admin_${workspace.workspaceId}`],
  })),
  { membershipId: "m_manager_ws1", accountId: "acct_sales_manager", memberId: "u2", ...DEVELOPMENT_WORKSPACES[0], status: "active", teamIds: ["team_sales"], roleAssignmentIds: ["ra_manager_ws1"] },
  { membershipId: "m_manager_ws2", accountId: "acct_sales_manager", memberId: "u2", ...DEVELOPMENT_WORKSPACES[1], status: "active", teamIds: ["team_sales"], roleAssignmentIds: ["ra_manager_ws2"] },
  { membershipId: "m_rep_ws1", accountId: "acct_sales_rep", memberId: "u3", ...DEVELOPMENT_WORKSPACES[0], status: "active", teamIds: ["team_sales"], roleAssignmentIds: ["ra_rep_ws1"] },
  { membershipId: "m_csm_ws1", accountId: "acct_csm", memberId: "u5", ...DEVELOPMENT_WORKSPACES[0], status: "active", teamIds: ["team_care"], roleAssignmentIds: ["ra_csm_ws1"] },
  { membershipId: "m_support_ws1", accountId: "acct_support", memberId: "u4", ...DEVELOPMENT_WORKSPACES[0], status: "active", teamIds: ["team_support"], roleAssignmentIds: ["ra_support_ws1"] },
  { membershipId: "m_viewer_ws1", accountId: "acct_viewer", memberId: "u6", ...DEVELOPMENT_WORKSPACES[0], status: "active", teamIds: [], roleAssignmentIds: ["ra_viewer_ws1"] },
];

function emptyPeopleSnapshot(workspaceId: string): WorkspacePeopleSnapshot {
  return { schemaVersion: 2, workspaceId, revision: 1, invitations: [], additionalMemberships: [], membershipStatusOverrides: {}, membershipTeamOverrides: {} };
}

export function getWorkspacePeopleSnapshot(workspaceId: string): WorkspacePeopleSnapshot {
  const stored = storage.get<WorkspacePeopleSnapshot>(storageKey(workspaceId));
  if (!stored || stored.workspaceId !== workspaceId) return emptyPeopleSnapshot(workspaceId);
  return clonePeopleSnapshot({
    ...emptyPeopleSnapshot(workspaceId),
    ...stored,
    schemaVersion: 2,
    invitations: (stored.invitations || []).map((invitation) => ({
      ...invitation,
      roleIds: invitation.roleIds?.length ? [...invitation.roleIds] : invitation.roleId ? [invitation.roleId] : [],
    })),
    additionalMemberships: stored.additionalMemberships || [],
    membershipStatusOverrides: stored.membershipStatusOverrides || {},
    membershipTeamOverrides: stored.membershipTeamOverrides || {},
  });
}

function replaceWorkspacePeopleSnapshot(snapshot: WorkspacePeopleSnapshot): WorkspacePeopleSnapshot {
  const next = clonePeopleSnapshot({ ...snapshot, revision: snapshot.revision + 1 });
  storage.set(storageKey(snapshot.workspaceId), next);
  listeners.forEach((listener) => listener(clonePeopleSnapshot(next)));
  return next;
}

export function subscribeToWorkspacePeople(listener: (snapshot: WorkspacePeopleSnapshot) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function inviteWorkspaceMember(command: InviteWorkspaceMemberCommand): WorkspaceInvitationRecord {
  const email = command.email.trim().toLowerCase();
  const displayName = command.displayName.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("A valid work email is required.");
  if (!displayName) throw new Error("Member display name is required.");
  const current = getWorkspacePeopleSnapshot(command.workspaceId);
  const duplicate = current.invitations.find((item) => item.email === email && item.status === "PENDING");
  if (duplicate) throw new Error("A pending invitation already exists for this email.");
  const accountEmails = new Map(listDevelopmentAccounts().map((account) => [account.accountId, account.email.trim().toLowerCase()]));
  const existingMember = listWorkspaceMembershipDirectory(command.workspaceId).find((membership) => membership.accountId && accountEmails.get(membership.accountId) === email);
  if (existingMember) throw new Error("This email already belongs to a member of the workspace.");
  const workspace = DEVELOPMENT_WORKSPACES.find((item) => item.workspaceId === command.workspaceId);
  if (!workspace) throw new Error("Workspace definition was not found.");
  const now = new Date();
  const invitationId = `invite_${command.workspaceId}_${now.getTime()}`;
  const membershipId = `membership_${invitationId}`;
  const roleIds = [...new Set(command.roleIds.filter(Boolean))];
  if (roleIds.length === 0) throw new Error("At least one initial role is required.");
  const invitation: WorkspaceInvitationRecord = {
    invitationId,
    membershipId,
    workspaceId: command.workspaceId,
    email,
    displayName,
    roleId: roleIds[0],
    roleIds,
    teamIds: [...new Set(command.teamIds)],
    status: "PENDING",
    invitedByAccountId: command.invitedByAccountId,
    createdAt: now.toISOString(),
    lastSentAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
  replaceWorkspacePeopleSnapshot({
    ...current,
    invitations: [invitation, ...current.invitations],
    additionalMemberships: [{
      membershipId,
      memberId: `pending_${invitationId}`,
      ...workspace,
      status: "invited",
      teamIds: invitation.teamIds,
      roleAssignmentIds: [],
      source: "invitation",
      createdAt: now.toISOString(),
      createdByAccountId: command.invitedByAccountId,
    }, ...current.additionalMemberships],
  });
  return { ...invitation, teamIds: [...invitation.teamIds] };
}

export function createActiveWorkspaceMembership(command: CreateActiveWorkspaceMembershipCommand): WorkspaceMembership {
  const workspace = DEVELOPMENT_WORKSPACES.find((item) => item.workspaceId === command.workspaceId);
  if (!workspace) throw new Error("Workspace definition was not found.");
  const current = getWorkspacePeopleSnapshot(command.workspaceId);
  const existing = listWorkspaceMembershipDirectory(command.workspaceId).find((membership) => membership.accountId === command.accountId);
  if (existing) throw new Error("This account is already a member of the workspace.");
  const now = new Date().toISOString();
  const membership: WorkspaceMembership = {
    membershipId: `membership_${command.workspaceId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    accountId: command.accountId,
    memberId: command.memberId,
    ...workspace,
    status: "active",
    teamIds: [...new Set(command.teamIds.filter(Boolean))],
    roleAssignmentIds: [],
    source: "direct_provisioning",
    createdAt: now,
    createdByAccountId: command.createdByAccountId,
  };
  replaceWorkspacePeopleSnapshot({
    ...current,
    additionalMemberships: [membership, ...current.additionalMemberships],
  });
  return cloneMembership(membership);
}

export function removeAdditionalWorkspaceMembership(workspaceId: string, membershipId: string): void {
  const current = getWorkspacePeopleSnapshot(workspaceId);
  replaceWorkspacePeopleSnapshot({
    ...current,
    additionalMemberships: current.additionalMemberships.filter((membership) => membership.membershipId !== membershipId),
    membershipStatusOverrides: Object.fromEntries(Object.entries(current.membershipStatusOverrides).filter(([key]) => key !== membershipId)),
    membershipTeamOverrides: Object.fromEntries(Object.entries(current.membershipTeamOverrides).filter(([key]) => key !== membershipId)),
  });
}

export function resendWorkspaceInvitation(workspaceId: string, invitationId: string): void {
  const current = getWorkspacePeopleSnapshot(workspaceId);
  const now = new Date();
  replaceWorkspacePeopleSnapshot({
    ...current,
    invitations: current.invitations.map((item) => item.invitationId === invitationId && item.status === "PENDING" ? {
      ...item,
      lastSentAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    } : item),
  });
}

export function revokeWorkspaceInvitation(workspaceId: string, invitationId: string): void {
  const current = getWorkspacePeopleSnapshot(workspaceId);
  const target = current.invitations.find((item) => item.invitationId === invitationId);
  if (!target || target.status !== "PENDING") return;
  const now = new Date().toISOString();
  replaceWorkspacePeopleSnapshot({
    ...current,
    invitations: current.invitations.map((item) => item.invitationId === invitationId ? { ...item, status: "REVOKED", revokedAt: now } : item),
    membershipStatusOverrides: { ...current.membershipStatusOverrides, [target.membershipId]: "suspended" },
  });
}

export function updateWorkspaceMembershipStatus(workspaceId: string, membershipId: string, status: Exclude<WorkspaceMembershipStatus, "invited">): void {
  const current = getWorkspacePeopleSnapshot(workspaceId);
  replaceWorkspacePeopleSnapshot({ ...current, membershipStatusOverrides: { ...current.membershipStatusOverrides, [membershipId]: status } });
}

export function updateWorkspaceMembershipTeams(workspaceId: string, membershipId: string, teamIds: string[]): void {
  const current = getWorkspacePeopleSnapshot(workspaceId);
  replaceWorkspacePeopleSnapshot({
    ...current,
    membershipTeamOverrides: { ...current.membershipTeamOverrides, [membershipId]: [...new Set(teamIds.filter(Boolean))] },
  });
}

export function listWorkspaceMembershipsForAccount(accountId: string): WorkspaceMembership[] {
  return listAllDevelopmentMemberships().filter((membership) => membership.accountId === accountId).map(cloneMembership);
}

export function listCurrentWorkspaceMemberships(): WorkspaceMembership[] {
  const session = getAuthSessionSnapshot();
  if (!session) return typeof window === "undefined" ? listWorkspaceMembershipsForAccount(ADMIN_ACCOUNT_ID) : [];
  return listWorkspaceMembershipsForAccount(session.principal.accountId);
}

export function findCurrentWorkspaceMembership(workspaceKey: string): WorkspaceMembership | undefined {
  return listCurrentWorkspaceMemberships().find((membership) => membership.workspaceKey === workspaceKey);
}

export function getCurrentMembershipForWorkspaceId(workspaceId: string): WorkspaceMembership | undefined {
  return listCurrentWorkspaceMemberships().find((membership) => membership.workspaceId === workspaceId);
}

export function listWorkspaceMembershipDirectory(workspaceId: string): WorkspaceMembership[] {
  const people = getWorkspacePeopleSnapshot(workspaceId);
  return [...baseMemberships.filter((membership) => membership.workspaceId === workspaceId), ...people.additionalMemberships]
    .map((membership) => ({
      ...membership,
      status: people.membershipStatusOverrides[membership.membershipId || ""] || membership.status,
      teamIds: people.membershipTeamOverrides[membership.membershipId || ""] || membership.teamIds,
    }))
    .map(cloneMembership);
}

export function listAllDevelopmentMemberships(): WorkspaceMembership[] {
  return DEVELOPMENT_WORKSPACES.flatMap((workspace) => listWorkspaceMembershipDirectory(workspace.workspaceId));
}

function cloneMembership(membership: WorkspaceMembership): WorkspaceMembership {
  return { ...membership, teamIds: [...(membership.teamIds || [])], roleAssignmentIds: [...(membership.roleAssignmentIds || [])] };
}

function clonePeopleSnapshot(snapshot: WorkspacePeopleSnapshot): WorkspacePeopleSnapshot {
  return {
    ...snapshot,
    invitations: snapshot.invitations.map((item) => ({ ...item, roleIds: [...(item.roleIds || (item.roleId ? [item.roleId] : []))], teamIds: [...item.teamIds] })),
    additionalMemberships: snapshot.additionalMemberships.map(cloneMembership),
    membershipStatusOverrides: { ...snapshot.membershipStatusOverrides },
    membershipTeamOverrides: Object.fromEntries(Object.entries(snapshot.membershipTeamOverrides).map(([membershipId, teamIds]) => [membershipId, [...teamIds]])),
  };
}
