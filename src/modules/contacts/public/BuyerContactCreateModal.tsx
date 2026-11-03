import { ContactCreateModal } from "../presentation/list/ContactCreateModal";
import { buildContactCreateCommand } from "../presentation/model/contactFormCommands";
import { createContactViaApi } from "./contacts";
import type { Contact } from "../domain/model/contact.types";

/** Reuses the Contact-owned form, intent and command; no commercial workflow side effects. */
export function BuyerContactCreateModal({ onClose, onCreated }: { onClose(): void; onCreated(contact: Contact): void }) {
  return <ContactCreateModal show onClose={onClose} onSave={async (draft, options) => {
    const contact = await createContactViaApi(buildContactCreateCommand(draft), options);
    onCreated(contact);
  }}/>;
}
