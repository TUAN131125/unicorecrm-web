import type { ContactApiRuntime, ContactRelationshipLinkedCounts } from "../application/ports/ContactApiRuntime";
import type { ContactRepository } from "../application/ports/ContactRepository";

const ZERO_COUNTS: ContactRelationshipLinkedCounts = {
  tasks: 0,
  activities: 0,
  deals: 0,
  quotes: 0,
  orders: 0,
  invoices: 0,
  payments: 0,
  shipping: 0,
  returns: 0,
  supportCases: 0,
};

export function createContactDemoApiRuntime(repository: ContactRepository): ContactApiRuntime {
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
      async get(contactId) {
        const contact = repository.getById(contactId);
        if (!contact) throw new Error(`CONTACT_NOT_FOUND:${contactId}`);
        return contact;
      },
      async getRelationshipSummary(contactId) {
        const contact = repository.getById(contactId);
        if (!contact) throw new Error(`CONTACT_NOT_FOUND:${contactId}`);
        return {
          contact,
          organizationIds: (contact.organizationRelationships ?? [])
            .filter((relationship) => !relationship.effectiveTo)
            .map((relationship) => relationship.organizationAccountId),
          customerIds: [],
          linkedRecords: [],
          linkedRecordCounts: { ...ZERO_COUNTS, activities: contact.activities?.length ?? 0 },
          allowedActions: [],
          projectionVersion: contact.resourceVersion ?? 1,
          generatedAt: new Date().toISOString(),
        };
      },
    },
  };
}
