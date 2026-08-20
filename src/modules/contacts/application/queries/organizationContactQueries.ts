import type { OrganizationAccount } from "@/modules/organizations";
import { getActiveContactOrganizationRelationships, isContactLinkedToOrganization } from "../../domain/model/contactOrganizationRelationships";
import type { Contact } from "../../domain/model/contact.types";

export function resolveOrganizationContacts(
  organizationAccountId: string,
  contacts: readonly Contact[],
  organization?: Pick<OrganizationAccount, "contactRefs" | "primaryContactId">,
): Contact[] {
  const referencedIds = new Set((organization?.contactRefs ?? []).map((ref) => ref.id));
  if (organization?.primaryContactId) referencedIds.add(organization.primaryContactId);
  return contacts.filter((contact) =>
    referencedIds.has(contact.id)
    || isContactLinkedToOrganization(contact, organizationAccountId),
  );
}

export function resolveOrganizationPrimaryContact(
  organizationAccountId: string,
  contacts: readonly Contact[],
  organization?: Pick<OrganizationAccount, "contactRefs" | "primaryContactId">,
): Contact | undefined {
  const organizationContacts = resolveOrganizationContacts(organizationAccountId, contacts, organization);
  return organizationContacts.find((contact) => contact.id === organization?.primaryContactId)
    ?? organizationContacts.find((contact) => getActiveContactOrganizationRelationships(contact)
      .some((relationship) => relationship.organizationAccountId === organizationAccountId && relationship.isPrimaryRepresentative))
    ?? organizationContacts[0];
}
