export type WorkspaceMembershipStatus = "active" | "suspended" | "invited";
export type WorkspaceMembershipSource = "seed" | "invitation" | "direct_provisioning" | "external_identity";

export interface WorkspaceMembership {
  membershipId?: string;
  accountId?: string;
  memberId?: string;
  workspaceId: string;
  workspaceKey: string;
  name: string;
  status: WorkspaceMembershipStatus;
  logoText: string;
  teamIds?: string[];
  roleAssignmentIds?: string[];
  source?: WorkspaceMembershipSource;
  createdAt?: string;
  createdByAccountId?: string;
  /** Authoritative resource version in connected mode. */
  resourceVersion?: number;
}

export interface WorkspaceDefinition {
  workspaceId: string;
  workspaceKey: string;
  name: string;
  logoText: string;
}

export type WorkspaceInvitationStatus = "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";

export interface WorkspaceInvitationRecord {
  invitationId: string;
  membershipId: string;
  workspaceId: string;
  email: string;
  displayName: string;
  /** Compatibility field for older snapshots. */
  roleId?: string;
  roleIds: string[];
  teamIds: string[];
  status: WorkspaceInvitationStatus;
  invitedByAccountId: string;
  createdAt: string;
  lastSentAt: string;
  expiresAt: string;
  acceptedAt?: string;
  revokedAt?: string;
  /** Authoritative resource version in connected mode. */
  resourceVersion?: number;
}

export interface WorkspacePeopleSnapshot {
  schemaVersion: 2;
  workspaceId: string;
  revision: number;
  invitations: WorkspaceInvitationRecord[];
  additionalMemberships: WorkspaceMembership[];
  membershipStatusOverrides: Record<string, WorkspaceMembershipStatus>;
  membershipTeamOverrides: Record<string, string[]>;
}

export interface InviteWorkspaceMemberCommand {
  workspaceId: string;
  email: string;
  displayName: string;
  roleIds: string[];
  teamIds: string[];
  invitedByAccountId: string;
}

export interface CreateActiveWorkspaceMembershipCommand {
  workspaceId: string;
  accountId: string;
  memberId: string;
  teamIds: string[];
  createdByAccountId: string;
}
