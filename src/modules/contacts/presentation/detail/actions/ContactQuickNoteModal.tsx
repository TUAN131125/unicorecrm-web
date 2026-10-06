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
  targetId?: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (note: Omit<Note, "id" | "date"> & { type: string; occurredAt: string }) => void | Promise<void>;
}

export const ContactQuickNoteModal: React.FC<ContactQuickNoteModalProps> = ({ targetId, isOpen, onClose, onSave }) => (
  <NoteActivityCreateModal
    targetId={targetId}
    recordingOnly
    guardChanges
    isOpen={isOpen}
    onClose={onClose}
    formId="contact-quick-note-form"
    onSubmit={(draft: NoteActivityDraft) => onSave({ title: draft.title, body: draft.body, type: draft.category, pinned: draft.pinned, occurredAt: new Date(draft.occurredAt).toISOString() })}
  />
);
