import type { OrganizationAccount } from "../../domain/model/organizationAccount.types";

export function getOrganizationAccountContactIds(
  account: OrganizationAccount,
): string[] {
  return account.contactRefs.map((ref) => ref.id);
}
