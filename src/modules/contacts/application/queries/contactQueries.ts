import type { ContactRepository } from "../ports/ContactRepository";
import type { Contact, ContactStatus } from "../../domain/model/contact.types";
import { isContactLinkedToOrganization } from "../../domain/model/contactOrganizationRelationships";

export interface ContactQuery {
  search?: string;
  status?: ContactStatus | "all";
  ownerId?: string | "all";
}

export function getContact(repository: ContactRepository, contactId: string): Contact | undefined {
  return repository.getById(contactId);
}

export function queryContacts(repository: ContactRepository, query: ContactQuery): Contact[] {
  const search = query.search?.trim().toLowerCase();
  return repository.list().filter((contact) => {
    if (query.status && query.status !== "all" && contact.status !== query.status) return false;
    if (query.ownerId && query.ownerId !== "all" && contact.ownerId !== query.ownerId) return false;
    if (!search) return true;
    return [
      contact.name,
      contact.fullName,
      contact.email,
      contact.phone,
      contact.companyName,
      contact.contactCode,
    ].some((value) => value?.toLowerCase().includes(search));
  });
}

export function getContactStatusCounts(repository: ContactRepository): Record<string, number> {
  return repository.list().reduce<Record<string, number>>((counts, contact) => {
    counts[contact.status] = (counts[contact.status] ?? 0) + 1;
    counts.all = (counts.all ?? 0) + 1;
    return counts;
  }, { all: 0 });
}

export function findContactsByOrganizationAccountId(
  contacts: readonly Contact[],
  organizationAccountId: string,
): Contact[] {
  return contacts.filter((contact) => isContactLinkedToOrganization(contact, organizationAccountId));
}
