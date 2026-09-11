import type { CustomerApiRuntime } from "../application/ports/CustomerApiRuntime";
import type { CustomerRepository } from "../application/ports/CustomerRepository";
import type { Customer } from "../domain/model/customer.types";
import { customerTypeForRelationship } from "../domain/rules/customerRules";

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
          stakeholderContacts: [],
          allowedActions: [],
          projectionVersion: customer.resourceVersion ?? 1,
          generatedAt: new Date().toISOString(),
        };
      },
    },
    commands: {
      async create(input) {
        const now = new Date().toISOString();
        const customer: Customer = {
          id: `customer_${crypto.randomUUID()}`,
          workspaceId: repository.list()[0]?.workspaceId ?? "demo-workspace",
          customerCode: `CU-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          type: customerTypeForRelationship(input.relationshipRef),
          relationshipRef: input.relationshipRef,
          status: "NEW",
          health: "GOOD",
          tier: input.tier,
          serviceLevel: input.serviceLevel,
          firstPurchaseAt: now,
          lastPurchaseAt: now,
          segment: input.segment,
          tags: [...(input.tags ?? [])],
          createdAt: now,
          updatedAt: now,
          resourceVersion: 0,
        };
        return repository.save(customer);
      },
      async update(customerId, input) {
        const current = repository.getById(customerId);
        if (!current) throw new Error(`CUSTOMER_NOT_FOUND:${customerId}`);
        return repository.save({
          ...current,
          ...input,
          tags: input.tags ? [...input.tags] : current.tags,
          updatedAt: new Date().toISOString(),
          resourceVersion: (current.resourceVersion ?? 0) + 1,
        });
      },
      async archive(customerId) {
        const current = repository.getById(customerId);
        if (!current) throw new Error(`CUSTOMER_NOT_FOUND:${customerId}`);
        const now = new Date().toISOString();
        return repository.save({ ...current, status: "ARCHIVED", archivedAt: now, updatedAt: now, resourceVersion: (current.resourceVersion ?? 0) + 1 });
      },
    },
  };
}
