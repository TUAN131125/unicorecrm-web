import React from "react";
import { EmailActivityCreateModal, type EmailActivityDraft } from "@/modules/tasks";

interface ContactSendEmailModalProps {
  targetId?: string;
  isOpen: boolean;
  onClose: () => void;
  onSend: (email: { to: string; subject: string; body: string; attachProposal?: boolean }) => Promise<boolean>;
  prefilledEmail: string;
  isDoNotContact?: boolean;
}

export const ContactSendEmailModal: React.FC<ContactSendEmailModalProps> = ({ targetId, isOpen, onClose, onSend, prefilledEmail, isDoNotContact }) => (
  <EmailActivityCreateModal
    targetId={targetId}
    recordingOnly
    guardChanges
    isOpen={isOpen}
    onClose={onClose}
    formId="contact-send-email-form"
    defaults={{ to: prefilledEmail }}
    contactPolicy={{ restricted: isDoNotContact }}
    onSubmit={async () => {}}
    onSave={(draft: EmailActivityDraft) => onSend(draft)}
  />
);
