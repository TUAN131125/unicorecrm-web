import type { AppEventBus } from "@/platform/events";
import type { ContactRepository } from "../application/ports/ContactRepository";
import type { Contact } from "../domain/model/contact.types";

export const CONTACTS_CHANGED_EVENT = "unicore.contacts.changed";

export class InMemoryContactRepository implements ContactRepository {
  private contacts: Contact[];

  constructor(
    seed: readonly Contact[],
    private readonly events: AppEventBus,
  ) {
    this.contacts = cloneContacts(seed);
  }

  list(): Contact[] {
    return cloneContacts(this.contacts);
  }

  getById(contactId: string): Contact | undefined {
    const contact = this.contacts.find((item) => item.id === contactId);
    return contact ? structuredClone(contact) : undefined;
  }

  replace(contacts: Contact[]): void {
    this.contacts = cloneContacts(contacts);
    this.events.publish<Contact[]>(CONTACTS_CHANGED_EVENT, this.list());
  }

  subscribe(listener: (contacts: Contact[]) => void): () => void {
    return this.events.subscribe<Contact[]>(CONTACTS_CHANGED_EVENT, listener);
  }
}

function cloneContacts(contacts: readonly Contact[]): Contact[] {
  return structuredClone([...contacts]);
}
