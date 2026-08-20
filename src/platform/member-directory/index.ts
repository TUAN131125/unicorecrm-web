import { getAuthSessionSnapshot, isProvisionedUserAccount, listDevelopmentAccounts } from "@/platform/identity-auth";
import { getWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { getWorkspacePeopleSnapshot, listWorkspaceMembershipDirectory } from "@/platform/workspace-membership";

export interface WorkspaceMemberDirectoryEntry {
  memberId: string;
  membershipId?: string;
  accountId?: string;
  displayName: string;
  email?: string;
  accountSource: "seed" | "direct" | "invitation" | "external" | "unknown";
  accountStatus?: "ACTIVE" | "SUSPENDED";
  roleLabel?: string;
  provisionedAt?: string;
}

export function listWorkspaceMemberDirectory(): WorkspaceMemberDirectoryEntry[] {
  return listWorkspaceMemberDirectoryFor(getWorkspaceContextSnapshot().workspaceId);
}

export function listWorkspaceMemberDirectoryFor(workspaceId: string): WorkspaceMemberDirectoryEntry[] {
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
