import React from "react";
import { useI18n } from "@/i18n";
import type { ActivityType } from "../../domain/model/task.types";
import {
  CallActivityCreateModal,
  EmailActivityCreateModal,
  MeetingActivityCreateModal,
  NoteActivityCreateModal,
  SmsActivityCreateModal,
  type CallActivityDraft,
  type EmailActivityDraft,
  type MeetingActivityDraft,
  type NoteActivityDraft,
  type SmsActivityDraft,
} from "./ActivityCreateModals";

export type RelationshipActivityAction = "call" | "meeting" | "email" | "sms" | "note";

export interface RelationshipActivityDraft {
  type: ActivityType;
  subject: string;
  body: string;
  occurredAt: string;
}

export interface RelationshipActivityCreateModalProps {
  action: RelationshipActivityAction | null;
  email?: string;
  phone?: string;
  recordLabel?: string;
  ownerName?: string;
  onClose(): void;
  onSave(draft: RelationshipActivityDraft): void;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function RelationshipActivityCreateModal({ action, email, phone, recordLabel, ownerName, onClose, onSave }: RelationshipActivityCreateModalProps) {
  const { locale } = useI18n();
  const vi = locale === "vi";
  if (!action) return null;
  const label = recordLabel || (vi ? "quan hệ" : "relationship");

  if (action === "call") {
    return (
      <CallActivityCreateModal
        isOpen
        onClose={onClose}
        defaults={{ subject: vi ? `Cuộc gọi với ${label}` : `Call with ${label}`, recipient: phone ?? "" }}
        onSubmit={(draft: CallActivityDraft) => onSave({
          type: "CALL",
          subject: draft.subject,
          occurredAt: new Date(draft.occurredAt).toISOString(),
          body: [
            draft.direction === "outbound" ? "Outbound" : "Inbound",
            draft.result,
            draft.recipient ? `Phone: ${draft.recipient}` : "",
            draft.durationMinutes ? `Duration: ${draft.durationMinutes}m` : "",
            draft.body,
          ].filter(Boolean).join(" · "),
        })}
      />
    );
  }

  if (action === "meeting") {
    return (
      <MeetingActivityCreateModal
        isOpen
        onClose={onClose}
        defaults={{ title: vi ? `Lịch hẹn với ${label}` : `Meeting with ${label}`, owner: ownerName }}
        onSubmit={(draft: MeetingActivityDraft) => onSave({
          type: "MEETING",
          subject: draft.title,
          occurredAt: new Date(draft.startAt).toISOString(),
          body: [draft.channel, draft.location, draft.attendees, draft.owner, draft.agenda].filter(Boolean).join(" · "),
        })}
      />
    );
  }

  if (action === "email") {
    return (
      <EmailActivityCreateModal
        isOpen
        onClose={onClose}
        defaults={{ to: email ?? "", subject: vi ? `Email với ${label}` : `Email with ${label}` }}
        onSubmit={(draft: EmailActivityDraft) => onSave({
          type: "EMAIL",
          subject: draft.subject,
          occurredAt: nowIso(),
          body: [`To: ${draft.to}`, draft.body].filter(Boolean).join(" · "),
        })}
      />
    );
  }

  if (action === "sms") {
    return (
      <SmsActivityCreateModal
        isOpen
        onClose={onClose}
        defaults={{ phone: phone ?? "" }}
        onSubmit={(draft: SmsActivityDraft) => onSave({
          type: "MESSAGE",
          subject: vi ? `SMS với ${label}` : `SMS with ${label}`,
          occurredAt: nowIso(),
          body: [`To: ${draft.phone}`, draft.body].filter(Boolean).join(" · "),
        })}
      />
    );
  }

  return (
    <NoteActivityCreateModal
      isOpen
      onClose={onClose}
      defaults={{ title: vi ? `Ghi chú ${label}` : `${label} note` }}
      onSubmit={(draft: NoteActivityDraft) => onSave({
        type: "NOTE",
        subject: draft.title,
        occurredAt: new Date(draft.occurredAt).toISOString(),
        body: `[${draft.category}] ${draft.body}`,
      })}
    />
  );
}
