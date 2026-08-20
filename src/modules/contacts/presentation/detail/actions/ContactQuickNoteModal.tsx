import React from "react";
import { NoteActivityCreateModal, type NoteActivityDraft } from "@/modules/tasks";

interface Note {
  id: string;
  title: string;
  body: string;
  date: string;
  pinned?: boolean;
}

interface ContactQuickNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (note: Omit<Note, "id" | "date"> & { type: string; occurredAt: string }) => void;
}

export const ContactQuickNoteModal: React.FC<ContactQuickNoteModalProps> = ({ isOpen, onClose, onSave }) => (
  <NoteActivityCreateModal
    isOpen={isOpen}
    onClose={onClose}
    formId="contact-quick-note-form"
    onSubmit={(draft: NoteActivityDraft) => onSave({ title: draft.title, body: draft.body, type: draft.category, pinned: draft.pinned, occurredAt: new Date(draft.occurredAt).toISOString() })}
  />
);
