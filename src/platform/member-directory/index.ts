import { getAuthSessionSnapshot, isConnectedAuthRuntime, isProvisionedUserAccount, listDevelopmentAccounts } from "@/platform/identity-auth";
import { getAccessGovernanceRuntimeBinding, isAccessGovernanceRuntimeConfigured } from "@/platform/access-control/application/accessGovernanceBinding";
import { getActiveWorkspaceId, getWorkspaceContextSnapshot, isConnectedWorkspaceRuntime } from "@/platform/workspace-context";
import { getWorkspacePeopleSnapshot, listWorkspaceMembershipDirectory } from "@/platform/workspace-membership";

import type { WorkspaceMemberDirectoryEntry } from "./memberDirectory.types";
export type { WorkspaceMemberDirectoryEntry } from "./memberDirectory.types";

export function listWorkspaceMemberDirectory(): WorkspaceMemberDirectoryEntry[] {
  if (isConnectedAuthRuntime() || isConnectedWorkspaceRuntime()) return getConnectedMemberDirectory(getActiveWorkspaceId() ?? "").members;
  return listWorkspaceMemberDirectoryFor(getWorkspaceContextSnapshot().workspaceId);
}

export function listWorkspaceMemberDirectoryFor(workspaceId: string): WorkspaceMemberDirectoryEntry[] {
  if (isConnectedAuthRuntime() || isConnectedWorkspaceRuntime()) return getConnectedMemberDirectory(workspaceId).members;
  const accounts = new Map(listDevelopmentAccounts().map((account) => [account.accountId, account]));
  const invitations = new Map(getWorkspacePeopleSnapshot(workspaceId).invitations.map((invite) => [invite.membershipId, invite]));
  const session = getAuthSessionSnapshot();
  return listWorkspaceMembershipDirectory(workspaceId)
    .filter((membership) => Boolean(membership.memberId))
    .map((membership) => {
      const account = membership.accountId ? accounts.get(membership.accountId) : undefined;
      const invitation = membership.membershipId ? invitations.get(membership.membershipId) : undefined;
      const provisioned = isProvisionedUserAccount(membership.accountId);
      return {
        memberId: membership.memberId!,
        membershipId: membership.membershipId,
        accountId: membership.accountId,
        displayName: account?.displayName || invitation?.displayName || (session && membership.memberId === session.principal.memberId ? session.principal.displayName : "—"),
        email: account?.email || invitation?.email,
        accountSource: invitation ? "invitation" : provisioned ? "direct" : account ? "seed" : "unknown",
        accountStatus: account?.status,
        roleLabel: account?.roleLabel,
        provisionedAt: account?.provisionedAt,
      } satisfies WorkspaceMemberDirectoryEntry;
    });
}

export interface ConnectedMemberDirectory {
  status: "ready" | "loading" | "empty" | "error";
  members: WorkspaceMemberDirectoryEntry[];
}

/** The existing context admits only the caller's identity, never a colleague directory. */
export function getConnectedMemberDirectory(workspaceId: string): ConnectedMemberDirectory {
  const session = getAuthSessionSnapshot();
  if (!isConnectedAuthRuntime() || !session || !workspaceId || workspaceId !== getActiveWorkspaceId())
    return { status: "empty", members: [] };
  if (!isAccessGovernanceRuntimeConfigured()) return { status: "error", members: [] };
  const binding = getAccessGovernanceRuntimeBinding();
  const state = binding.getState();
  if (state.workspaceId !== workspaceId || state.loading) return { status: "loading", members: [] };
  if (state.error) return { status: "error", members: [] };
  // getEffectiveAccess also verifies session ownership and retires stale authority.
  const actor = binding.getEffectiveAccess(workspaceId);
  if (!actor || actor.accountId !== session.principal.accountId || actor.workspaceId !== workspaceId
    || !actor.memberId || !actor.membershipId) return { status: "empty", members: [] };
  return { status: "ready", members: [{ memberId: actor.memberId, membershipId: actor.membershipId,
    accountId: actor.accountId, displayName: session.principal.displayName, accountSource: "external" }] };
}

export function resolveWorkspaceMemberName(memberId?: string): string {
  if (!memberId) return "—";
  return listWorkspaceMemberDirectory().find((member) => member.memberId === memberId)?.displayName || "—";
}

export function resolveWorkspaceMemberLabel(memberId: string | undefined, locale: "vi" | "en"): string {
  if (!memberId || memberId === "unassigned") return locale === "vi" ? "Chưa phân công" : "Unassigned";
  const resolved = listWorkspaceMemberDirectory().find((member) => member.memberId === memberId)?.displayName;
  return resolved && resolved !== "—" ? resolved : (locale === "vi" ? "Không tìm thấy thành viên" : "Member not found");
}

export interface WorkspaceMemberOption {
  id: string;
  name: string;
  email?: string;
  avatarUrl: string;
  roleId?: string;
}

export function getWorkspaceMemberOptions(): WorkspaceMemberOption[] {
  return listWorkspaceMemberDirectory()
    .filter((member) => member.displayName !== "—")
    .map((member) => ({
      id: member.memberId,
      name: member.displayName,
      email: member.email,
      avatarUrl: "",
      roleId: member.roleLabel,
    }));
}
