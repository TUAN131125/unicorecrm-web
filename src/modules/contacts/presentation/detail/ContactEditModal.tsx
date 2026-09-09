import React from "react";
import type { Contact } from "../../domain/model/contact.types";
import type { ContactUpdateCommand } from "../../application/ports/ContactApiRuntime";
import { ContactFormModal, type ContactFormDraft } from "../components/ContactFormModal";

interface ContactEditModalProps {
  isOpen: boolean;
  onClose(): void;
  contact: Contact;
  onSave(updated: ContactUpdateCommand): Promise<void>;
}

export const ContactEditModal: React.FC<ContactEditModalProps> = ({ isOpen, onClose, contact, onSave }) => {
  const submit = async (draft: ContactFormDraft) => {
    if (contact.resourceVersion === undefined) throw new Error("CONTACT_RESOURCE_VERSION_REQUIRED");
    const tags = draft.tagsString.split(",").map((tag) => tag.trim()).filter(Boolean);
    await onSave({
      contactId: contact.id,
      expectedVersion: contact.resourceVersion,
      fullName: draft.name.trim(),
      ownerId: draft.ownerId.trim() || undefined,
      jobTitle: draft.title.trim() || undefined,
      department: draft.department.trim() || undefined,
      workEmail: draft.email.trim() || undefined,
      mobilePhone: draft.phone.trim() || undefined,
      zaloId: draft.zaloId.trim() || undefined,
      preferredContactChannel: draft.preferredChannel || undefined,
      address: draft.address.trim() || undefined,
      source: draft.source.trim() || undefined,
      decisionRole: draft.decisionRole || undefined,
      notes: draft.notes.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
    });
  };

  return <ContactFormModal isOpen={isOpen} onClose={onClose} mode="edit" contact={contact} onSubmit={submit} />;
};
