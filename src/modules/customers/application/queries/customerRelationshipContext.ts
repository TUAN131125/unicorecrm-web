import { relationshipRefKey, type RelationshipRef } from "@/platform/identity";
import type { CustomerRepository } from "../ports/CustomerRepository";
import type { Customer } from "../../domain/model/customer.types";

export interface CustomerRelationshipContext {
  customer: Customer;
  relationshipRef: RelationshipRef;
  relationshipKey: string;
  aliases: string[];
}

export function resolveCustomerRelationshipContext(
  repository: CustomerRepository,
  customerIdOrAlias: string,
): CustomerRelationshipContext | undefined {
  const customer = repository.getByAlias(customerIdOrAlias);
  if (!customer) return undefined;
  return {
    customer,
    relationshipRef: customer.relationshipRef,
    relationshipKey: relationshipRefKey(customer.relationshipRef),
    aliases: [customer.id, customer.customerCode, ...(customer.legacyAliases ?? [])],
  };
}

export function assertCustomerRelationshipContext(
  repository: CustomerRepository,
  customerIdOrAlias: string,
): CustomerRelationshipContext {
  const context = resolveCustomerRelationshipContext(repository, customerIdOrAlias);
  if (!context) throw new Error(`Customer ${customerIdOrAlias} was not found.`);
  return context;
}
