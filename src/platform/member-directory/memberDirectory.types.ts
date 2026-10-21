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
