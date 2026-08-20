import type { OrganizationApiRuntime } from "../application/ports/OrganizationApiRuntime";
import type { OrganizationAccountRepository } from "../application/ports/OrganizationAccountRepository";

export function createOrganizationDemoApiRuntime(repository: OrganizationAccountRepository): OrganizationApiRuntime {
  return {
    mode: "demo",
    queries: {
      async list() {
        const items = repository.list();
        return {
          items,
          pageInfo: { hasNextPage: false, totalCount: items.length },
          authority: "demo",
          loadedAt: new Date().toISOString(),
        };
      },
      async get(organizationId) {
        const organization = repository.findById(organizationId);
        if (!organization) throw new Error(`ORGANIZATION_NOT_FOUND:${organizationId}`);
        return organization;
      },
      async getOverview(organizationId) {
        const organization = repository.findById(organizationId);
        if (!organization) throw new Error(`ORGANIZATION_NOT_FOUND:${organizationId}`);
        return {
          organization,
          contactIds: organization.contactRefs.map((contact) => contact.id),
          metrics: {
            representativeCount: organization.contactRefs.length,
            openDealsCount: 0,
            completedOrdersCount: 0,
          },
          linkedRecords: [],
          allowedActions: [],
          projectionVersion: organization.resourceVersion ?? 1,
          generatedAt: new Date().toISOString(),
        };
      },
    },
  };
}
