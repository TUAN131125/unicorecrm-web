import React from "react";
import { resolveActivityRecordingDate, CallActivityCreateModal, type CallActivityDraft } from "@/modules/tasks";

interface ContactLogCallModalProps {
  targetId?: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (call: {
    occurredAt?: string;
    direction: string;
    result: string;
    summary: string;
    nextFollowUpDate?: string;
    createFollowUpTask?: boolean;
  }) => Promise<boolean>;
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
    onSubmit={async () => {}}
    onSave={(draft: CallActivityDraft) => onSave({
      occurredAt: resolveActivityRecordingDate(draft),
      direction: draft.direction,
      result: draft.result,
      summary: [draft.subject, draft.recipient, `${draft.durationMinutes} min`, draft.body].filter(Boolean).join(" — "),
      nextFollowUpDate: draft.nextFollowUpAt,
      createFollowUpTask: draft.createFollowUpTask,
    })}
  />
);
