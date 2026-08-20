import React from "react";
import { CallActivityCreateModal, type CallActivityDraft } from "@/modules/tasks";

interface ContactLogCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (call: {
    direction: string;
    result: string;
    summary: string;
    nextFollowUpDate?: string;
    createFollowUpTask?: boolean;
  }) => void;
  isDoNotContact?: boolean;
}

export const ContactLogCallModal: React.FC<ContactLogCallModalProps> = ({ isOpen, onClose, onSave, isDoNotContact }) => (
  <CallActivityCreateModal
    isOpen={isOpen}
    onClose={onClose}
    formId="contact-log-call-form"
    defaults={{ subject: "Cuộc gọi với Contact" }}
    contactPolicy={{ restricted: isDoNotContact }}
    onSubmit={(draft: CallActivityDraft) => onSave({
      direction: draft.direction,
      result: draft.result,
      summary: [draft.subject, draft.body].filter(Boolean).join(" — "),
      nextFollowUpDate: draft.nextFollowUpAt,
      createFollowUpTask: draft.createFollowUpTask,
    })}
  />
);
