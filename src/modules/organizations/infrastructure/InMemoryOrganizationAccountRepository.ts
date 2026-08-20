import type { AppEventBus } from "@/platform/events";
import type { OrganizationAccountRepository } from "../application/ports/OrganizationAccountRepository";
import type { OrganizationAccount } from "../domain/model/organizationAccount.types";

export const ORGANIZATION_ACCOUNTS_CHANGED_EVENT = "unicore.organization-accounts.changed";

export class InMemoryOrganizationAccountRepository
  implements OrganizationAccountRepository
{
  private accounts: OrganizationAccount[];

  constructor(
    seed: readonly OrganizationAccount[],
    private readonly events: AppEventBus,
  ) {
    this.accounts = cloneAccounts(seed);
  }

  list(): OrganizationAccount[] {
    return cloneAccounts(this.accounts);
  }

  findById(id: string): OrganizationAccount | undefined {
    const account = this.accounts.find(
      (item) =>
        item.id === id ||
        item.legacyCustomerId === id ||
        item.legacyCustomerCode === id,
    );
    return account ? structuredClone(account) : undefined;
  }

  replace(accounts: OrganizationAccount[]): void {
    this.accounts = cloneAccounts(accounts);
    this.events.publish<OrganizationAccount[]>(
      ORGANIZATION_ACCOUNTS_CHANGED_EVENT,
      this.list(),
    );
  }

  subscribe(listener: (accounts: OrganizationAccount[]) => void): () => void {
    return this.events.subscribe<OrganizationAccount[]>(
      ORGANIZATION_ACCOUNTS_CHANGED_EVENT,
      listener,
    );
  }
}

function cloneAccounts(
  accounts: readonly OrganizationAccount[],
): OrganizationAccount[] {
  return structuredClone([...accounts]);
}
