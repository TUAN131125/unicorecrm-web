import React from "react";
import { CallActivityCreateModal, type CallActivityDraft } from "@/modules/tasks";

interface ContactLogCallModalProps {
  targetId?: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (call: {
    direction: string;
    result: string;
    summary: string;
    nextFollowUpDate?: string;
    createFollowUpTask?: boolean;
  }) => void | Promise<void>;
  isDoNotContact?: boolean;
}

export const ContactLogCallModal: React.FC<ContactLogCallModalProps> = ({ targetId, isOpen, onClose, onSave, isDoNotContact }) => (
  <CallActivityCreateModal
    targetId={targetId}
    recordingOnly
    guardChanges
    isOpen={isOpen}
    onClose={onClose}
    formId="contact-log-call-form"
    defaults={{ subject: "Cuộc gọi với Contact" }}
    contactPolicy={{ restricted: isDoNotContact }}
    onSubmit={(draft: CallActivityDraft) => onSave({
      direction: draft.direction,
      result: draft.result,
      summary: [draft.subject, draft.recipient, `${draft.durationMinutes} min`, draft.body].filter(Boolean).join(" — "),
      nextFollowUpDate: draft.nextFollowUpAt,
      createFollowUpTask: draft.createFollowUpTask,
    })}
  />
);
