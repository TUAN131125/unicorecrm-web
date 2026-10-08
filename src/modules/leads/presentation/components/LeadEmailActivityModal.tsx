import React from "react";
import { EmailActivityCreateModal, type EmailActivityDraft } from "@/modules/tasks";
import type { Lead } from "../../domain/model/lead.types";
import type { LeadDetailDialogs } from "../hooks/useLeadDetailDialogs";

interface LeadEmailActivityModalProps {
  dialogs: LeadDetailDialogs;
  lead: Lead;
  locale: string;
  handleLogExternalEmail(draft: EmailActivityDraft, deferClose?: boolean): void | boolean | Promise<void | boolean>;
}

export function LeadEmailActivityModal({ dialogs, lead, locale, handleLogExternalEmail }: LeadEmailActivityModalProps) {
  const { showEmailModal, setShowEmailModal, emailForm } = dialogs;
  return (
      <EmailActivityCreateModal
        guardChanges
        titleOverride={locale === "vi" ? "Ghi nhận Email ngoài CRM" : "Log external Email"}
        submitLabelOverride={locale === "vi" ? "Lưu hoạt động" : "Save activity"}
        helperTextOverride={locale === "vi" ? "Chỉ dùng khi Email đã được gửi hoặc nhận ngoài UniCoreCRM." : "Use only for Email already sent or received outside UniCoreCRM."}
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        formId="lead-quick-email-form"
        defaults={{ to: emailForm.to || lead.email || "", subject: emailForm.subject, body: emailForm.content }}
        targetId={lead.id}
        recordingOnly
        onSave={async (draft) => (await handleLogExternalEmail(draft, true)) === true}
        onBindSave={showEmailModal ? dialogs.bindSave : undefined}
        onPendingChange={showEmailModal ? dialogs.setActiveInteractionPending : undefined}
        onSubmit={async (draft) => { await handleLogExternalEmail(draft); }}
      />
  );
}
