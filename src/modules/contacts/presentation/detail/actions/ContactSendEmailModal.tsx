import React from "react";
import { EmailActivityCreateModal, type EmailActivityDraft } from "@/modules/tasks";

interface ContactSendEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (email: { to: string; subject: string; body: string; attachProposal?: boolean }) => void;
  prefilledEmail: string;
  isDoNotContact?: boolean;
}

export const ContactSendEmailModal: React.FC<ContactSendEmailModalProps> = ({ isOpen, onClose, onSend, prefilledEmail, isDoNotContact }) => (
  <EmailActivityCreateModal
    isOpen={isOpen}
    onClose={onClose}
    formId="contact-send-email-form"
    defaults={{ to: prefilledEmail }}
    contactPolicy={{ restricted: isDoNotContact }}
    onSubmit={(draft: EmailActivityDraft) => onSend(draft)}
  />
);
