import React from "react";
import {
  ContactFormModal,
  type ContactFormDraft,
} from "../components/ContactFormModal";

/** Canonical create payload. Keep this identical to the shared Contact form draft. */
export type ContactCreateInput = ContactFormDraft;

interface ContactCreateModalProps {
  show: boolean;
  onClose(): void;
  onSave(newContact: ContactCreateInput): void;
}

export const ContactCreateModal: React.FC<ContactCreateModalProps> = ({ show, onClose, onSave }) => (
  <ContactFormModal isOpen={show} onClose={onClose} mode="create" onSubmit={onSave} />
);
