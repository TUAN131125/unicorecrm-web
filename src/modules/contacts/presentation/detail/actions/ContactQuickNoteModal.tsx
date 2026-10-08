import React from "react";
import { resolveActivityRecordingDate, NoteActivityCreateModal, type NoteActivityDraft } from "@/modules/tasks";

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
  onSave: (note: Omit<Note, "id" | "date"> & { type: string; occurredAt?: string }) => Promise<boolean>;
}

export const ContactQuickNoteModal: React.FC<ContactQuickNoteModalProps> = ({ targetId, isOpen, onClose, onSave }) => (
  <NoteActivityCreateModal
    targetId={targetId}
    recordingOnly
    guardChanges
    isOpen={isOpen}
    onClose={onClose}
    formId="contact-quick-note-form"
    onSubmit={async () => {}}
    onSave={(draft: NoteActivityDraft) => onSave({ title: draft.title, body: draft.body, type: draft.category, pinned: draft.pinned, occurredAt: resolveActivityRecordingDate(draft) })}
  />
);
