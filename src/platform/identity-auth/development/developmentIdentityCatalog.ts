export interface DevelopmentAccountDescriptor {
  accountId: string;
  memberId: string;
  email: string;
  password: string;
  displayName: string;
  roleLabel: string;
  status?: "ACTIVE" | "SUSPENDED";
  provisionedAt?: string;
  provisionedByAccountId?: string;
  mfaRequired?: boolean;
}

/**
 * Development-only identities used by the local authentication adapter.
 *
 * These values are intentionally non-production and must never be imported by
 * connected composition or production identity integrations.
 */
export const DEVELOPMENT_ACCOUNTS: readonly DevelopmentAccountDescriptor[] = [
  { accountId: "acct_admin", memberId: "u1", email: "admin@unicorecrm.local", password: "admin123", displayName: "Nguyễn Văn Admin", roleLabel: "Workspace Owner", mfaRequired: false },
  { accountId: "acct_sales_manager", memberId: "u2", email: "sales.manager@unicorecrm.local", password: "welcome123", displayName: "Trần Minh Sales", roleLabel: "Sales Manager" },
  { accountId: "acct_sales_rep", memberId: "u3", email: "sales.rep@unicorecrm.local", password: "welcome123", displayName: "Lê Hoàng Sales", roleLabel: "Sales Representative" },
  { accountId: "acct_csm", memberId: "u5", email: "csm@unicorecrm.local", password: "welcome123", displayName: "Phạm Anh CSM", roleLabel: "Customer Success" },
  { accountId: "acct_support", memberId: "u4", email: "support@unicorecrm.local", password: "welcome123", displayName: "Nguyễn Hỗ Trợ", roleLabel: "Support" },
  { accountId: "acct_viewer", memberId: "u6", email: "viewer@unicorecrm.local", password: "welcome123", displayName: "Read-only User", roleLabel: "Viewer" },
] as const;

export const DEVELOPMENT_MFA_CODE = "246810";
