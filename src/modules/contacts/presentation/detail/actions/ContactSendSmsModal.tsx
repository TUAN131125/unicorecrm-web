import React from "react";
import { SmsActivityCreateModal, type SmsActivityDraft } from "@/modules/tasks";

interface ContactSendSmsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (sms: { phone: string; body: string }) => void;
  prefilledPhone: string;
  isDoNotContact?: boolean;
}

export const ContactSendSmsModal: React.FC<ContactSendSmsModalProps> = ({ isOpen, onClose, onSend, prefilledPhone, isDoNotContact }) => (
  <SmsActivityCreateModal
    isOpen={isOpen}
    onClose={onClose}
    formId="contact-send-sms-form"
    defaults={{ phone: prefilledPhone }}
    contactPolicy={{ restricted: isDoNotContact }}
    onSubmit={(draft: SmsActivityDraft) => onSend(draft)}
  />
);
