import type { CustomerApiRuntime } from "../application/ports/CustomerApiRuntime";
import type { CustomerRepository } from "../application/ports/CustomerRepository";

export function createCustomerDemoApiRuntime(repository: CustomerRepository): CustomerApiRuntime {
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
      async get(customerId) {
        const customer = repository.getById(customerId) ?? repository.getByAlias(customerId);
        if (!customer) throw new Error(`CUSTOMER_NOT_FOUND:${customerId}`);
        return customer;
      },
      async get360(customerId) {
        const customer = repository.getById(customerId) ?? repository.getByAlias(customerId);
        if (!customer) throw new Error(`CUSTOMER_NOT_FOUND:${customerId}`);
        const identity = customer.relationshipRef.type === "CONTACT"
          ? { displayName: customer.customerCode, contactId: customer.relationshipRef.id }
          : { displayName: customer.customerCode, organizationId: customer.relationshipRef.id };
        return {
          customer,
          identity,
          metrics: {
            leadCount: 0,
            openDealCount: 0,
            quoteCount: 0,
            orderCount: 0,
            openTaskCount: 0,
            openSupportCount: 0,
            openInvoiceCount: 0,
            overdueReceivableCount: 0,
            activeReturnCount: 0,
          },
          linkedRecords: [],
          allowedActions: [],
          projectionVersion: customer.resourceVersion ?? 1,
          generatedAt: new Date().toISOString(),
        };
      },
    },
  };
}
