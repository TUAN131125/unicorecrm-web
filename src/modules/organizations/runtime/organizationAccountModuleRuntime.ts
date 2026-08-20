import { BrowserEventBus } from "@/platform/events";
import { createWorkspaceScopedRepository } from "@/platform/workspace-scope/createWorkspaceScopedRepository";
import { InMemoryOrganizationAccountRepository } from "../infrastructure/InMemoryOrganizationAccountRepository";
import { ORGANIZATION_ACCOUNT_SEED } from "../infrastructure/organizationAccount.seed";

const events = new BrowserEventBus();
export const organizationAccountRepository = createWorkspaceScopedRepository({
  resourceKey: "organizations",
  createRepository: (workspaceId) => new InMemoryOrganizationAccountRepository(
    ORGANIZATION_ACCOUNT_SEED.map((account) => ({ ...structuredClone(account), workspaceId })),
    events,
  ),
});
