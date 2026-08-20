import type { Contact } from "../../domain/model/contact.types";

export interface ContactRepository {
  list(): Contact[];
  getById(contactId: string): Contact | undefined;
  replace(contacts: Contact[]): void;
  subscribe(listener: (contacts: Contact[]) => void): () => void;
}
