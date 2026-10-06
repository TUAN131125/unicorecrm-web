import type { ContactCommandOptions } from "../../application/ports/ContactApiRuntime";
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
  onSave(newContact: ContactCreateInput, options?: ContactCommandOptions): void | Promise<void>;
}

export const ContactCreateModal: React.FC<ContactCreateModalProps> = ({ show, onClose, onSave }) => (
  <ContactFormModal guardChanges isOpen={show} onClose={onClose} mode="create" onSubmit={(draft, opening) => onSave(draft, { idempotencyKey: opening.intentId })} />
);
