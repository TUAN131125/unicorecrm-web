import React from "react";
import { CallActivityCreateModal, type CallActivityDraft } from "@/modules/tasks";
import type { Lead } from "../../domain/model/lead.types";
import type { LeadDetailDialogs } from "../hooks/useLeadDetailDialogs";

interface LeadCallActivityModalProps {
  dialogs: LeadDetailDialogs;
  lead: Lead;
  handleSavePhoneCall(draft: CallActivityDraft, deferClose?: boolean): void | boolean | Promise<void | boolean>;
}

export function LeadCallActivityModal({ dialogs, lead, handleSavePhoneCall }: LeadCallActivityModalProps) {
  const { showCallModal, setShowCallModal, callForm } = dialogs;
  return (
      <CallActivityCreateModal
        guardChanges
        isOpen={showCallModal}
        onClose={() => setShowCallModal(false)}
        formId="lead-quick-call-form"
        defaults={{
          subject: callForm.title,
          recipient: callForm.phone || lead.phone || "",
          direction: callForm.callType === "Inbound" ? "inbound" : "outbound",
          result: callForm.status === "Hoàn thành" ? "connected" : "callback",
          occurredAt: `${callForm.startDate}T${callForm.startTime}`,
          durationMinutes: Number(callForm.duration) || 10,
          body: [callForm.callResult, callForm.desc].filter(Boolean).join(" — "),
        }}
        targetId={lead.id}
        recordingOnly
        onSave={async (draft) => (await handleSavePhoneCall(draft, true)) === true}
        onBindSave={showCallModal ? dialogs.bindSave : undefined}
        onPendingChange={showCallModal ? dialogs.setActiveInteractionPending : undefined}
        onSubmit={async (draft) => { await handleSavePhoneCall(draft); }}
      />
  );
}
