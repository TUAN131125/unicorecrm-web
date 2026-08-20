import { relationshipRefKey, type RelationshipRef } from "@/platform/identity";
import type { CustomerRepository } from "../ports/CustomerRepository";

export function getCustomer(repository: CustomerRepository, customerIdOrAlias: string) {
  return repository.getByAlias(customerIdOrAlias);
}

export function findCustomerByRelationshipRef(repository: CustomerRepository, workspaceId: string, relationshipRef: RelationshipRef) {
  return repository.findByRelationship(workspaceId, relationshipRef);
}

export function queryCustomers(repository: CustomerRepository, input: {
  type?: "B2C" | "B2B" | "all";
  status?: string | "all";
  relationshipRef?: RelationshipRef;
} = {}) {
  const relationshipKey = input.relationshipRef ? relationshipRefKey(input.relationshipRef) : undefined;
  return repository.list().filter((customer) => {
    if (input.type && input.type !== "all" && customer.type !== input.type) return false;
    if (input.status && input.status !== "all" && customer.status !== input.status) return false;
    if (relationshipKey && relationshipRefKey(customer.relationshipRef) !== relationshipKey) return false;
    return true;
  });
}

export function getCustomerCareCards(repository: CustomerRepository, customerId: string) {
  return repository.listCareCards().filter((card) => card.customerId === customerId);
}
