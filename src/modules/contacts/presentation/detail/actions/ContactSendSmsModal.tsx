import React from "react";
import { SmsActivityCreateModal, type SmsActivityDraft } from "@/modules/tasks";

interface ContactSendSmsModalProps {
  targetId?: string;
  isOpen: boolean;
  onClose: () => void;
  onSend: (sms: { phone: string; body: string }) => void | Promise<void>;
  prefilledPhone: string;
  isDoNotContact?: boolean;
}

export const ContactSendSmsModal: React.FC<ContactSendSmsModalProps> = ({ targetId, isOpen, onClose, onSend, prefilledPhone, isDoNotContact }) => (
  <SmsActivityCreateModal
    targetId={targetId}
    recordingOnly
    guardChanges
    isOpen={isOpen}
    onClose={onClose}
    formId="contact-send-sms-form"
    defaults={{ phone: prefilledPhone }}
    contactPolicy={{ restricted: isDoNotContact }}
    onSubmit={(draft: SmsActivityDraft) => onSend(draft)}
  />
);
