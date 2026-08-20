import type { OrganizationAccount } from "../../domain/model/organizationAccount.types";

export interface OrganizationAccountRepository {
  list(): OrganizationAccount[];
  findById(id: string): OrganizationAccount | undefined;
  replace(accounts: OrganizationAccount[]): void;
  subscribe(listener: (accounts: OrganizationAccount[]) => void): () => void;
}
