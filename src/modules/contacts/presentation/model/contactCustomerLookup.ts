import { findCustomerByRelationshipRefSnapshot, type Customer } from "@/modules/customers";
import { getOrganizationAccountSnapshot } from "@/modules/organizations";
import type { Contact } from "../../domain/model/contact.types";

export function findCustomerForContact(
  contact: Pick<Contact, "id" | "organizationAccountId">,
): Customer | undefined {
  if (contact.organizationAccountId) {
    const organizationCustomer = findCustomerByRelationshipRefSnapshot({
      type: "ORGANIZATION_ACCOUNT",
      id: contact.organizationAccountId,
    });
    if (organizationCustomer) return organizationCustomer;
  }
  return findCustomerByRelationshipRefSnapshot({ type: "CONTACT", id: contact.id });
}

export function getCustomerIdForContact(
  contact: Pick<Contact, "id" | "organizationAccountId">,
): string | undefined {
  return findCustomerForContact(contact)?.id;
}

export function getCustomerDisplayNameForContact(
  contact: Pick<Contact, "id" | "organizationAccountId" | "fullName" | "name">,
): string | undefined {
  const customer = findCustomerForContact(contact);
  if (!customer) return undefined;
  if (customer.relationshipRef.type === "CONTACT") {
    return contact.fullName || contact.name || customer.customerCode;
  }
  return (
    getOrganizationAccountSnapshot(customer.relationshipRef.id)?.displayName ||
    customer.customerCode
  );
}

export function isCustomerContact(
  contact: Pick<Contact, "id" | "organizationAccountId">,
): boolean {
  return Boolean(findCustomerForContact(contact));
}
