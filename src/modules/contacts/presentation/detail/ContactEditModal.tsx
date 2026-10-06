import React from "react";
import type { Contact } from "../../domain/model/contact.types";
import type { ContactUpdateCommand, ContactCommandOptions } from "../../application/ports/ContactApiRuntime";
import { ContactFormModal, type ContactFormDraft } from "../components/ContactFormModal";

interface ContactEditModalProps {
  isOpen: boolean;
  onClose(): void;
  contact: Contact;
  onSave(updated: ContactUpdateCommand, options?: ContactCommandOptions): Promise<void>;
}

export const ContactEditModal: React.FC<ContactEditModalProps> = ({ isOpen, onClose, contact, onSave }) => {
  const submit = async (draft: ContactFormDraft, opening: { contact: Contact | undefined; draft: ContactFormDraft; intentId: string }) => {
    const patch = buildContactEditCommand(draft, opening);
    if (!patch) return false;
    await onSave(patch, { idempotencyKey: opening.intentId });
  };

  return <ContactFormModal guardChanges isOpen={isOpen} onClose={onClose} mode="edit" contact={contact} onSubmit={submit} />;
};

export function buildContactEditCommand(draft: ContactFormDraft, opening: { contact: Contact | undefined; draft: ContactFormDraft }): ContactUpdateCommand | undefined {
    const target = opening.contact;
    if (!target || target.resourceVersion === undefined) throw new Error("CONTACT_RESOURCE_VERSION_REQUIRED");
    const patch: ContactUpdateCommand = { contactId: target.id, expectedVersion: target.resourceVersion };
    const before = opening.draft;
    if (!draft.name.trim()) throw new Error("CONTACT_FULL_NAME_REQUIRED");
    if (draft.name.trim() !== before.name.trim()) patch.fullName = draft.name.trim();
    if (draft.ownerId !== before.ownerId) patch.ownerId = draft.ownerId.trim() || null;
    const values = {
      jobTitle: [draft.title, before.title], department: [draft.department, before.department],
      workEmail: [draft.email, before.email], mobilePhone: [draft.phone, before.phone],
      zaloId: [draft.zaloId, before.zaloId], address: [draft.address, before.address],
      source: [draft.source, before.source], notes: [draft.notes, before.notes],
    };
    for (const key of Object.keys(values) as Array<keyof typeof values>) {
      const pair = values[key];
      if (pair[0]?.trim() !== pair[1]?.trim()) patch[key] = pair[0]?.trim() || null;
    }
    if (draft.preferredChannel !== before.preferredChannel) patch.preferredContactChannel = draft.preferredChannel || null;
    if (draft.decisionRole !== before.decisionRole) patch.decisionRole = draft.decisionRole || null;
    const tags = (value: string) => value.split(",").map(tag => tag.trim()).filter(Boolean);
    if (JSON.stringify(tags(draft.tagsString)) !== JSON.stringify(tags(before.tagsString))) {
      patch.tags = tags(draft.tagsString).length ? tags(draft.tagsString) : null;
    }
    if (Object.keys(patch).length === 2) return undefined;
    return patch;
}
