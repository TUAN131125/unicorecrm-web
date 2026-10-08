import React from "react";
import { getAuthSessionSnapshot } from "@/platform/identity-auth";
import { MeetingActivityCreateModal, type MeetingActivityDraft } from "@/modules/tasks";

interface ContactMeetingModalProps {
  targetId?: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (meeting: {
    title: string;
    startDate: string;
    startTime: string;
    endTime: string;
    channel: string;
    location?: string;
    attendees?: string;
    owner: string;
    agenda?: string;
    reminder?: boolean;
  }) => Promise<boolean>;
  isDoNotContact?: boolean;
}

function splitLocalDateTime(value?: string): { date: string; time: string } {
  if (!value) return { date: "", time: "" };
  const [date = "", time = ""] = value.split("T");
  return { date, time };
}

export const ContactMeetingModal: React.FC<ContactMeetingModalProps> = ({ targetId, isOpen, onClose, onSave, isDoNotContact }) => (
  <MeetingActivityCreateModal
    targetId={targetId}
    recordingOnly
    guardChanges
    isOpen={isOpen}
    onClose={onClose}
    formId="contact-meeting-form"
    defaults={{ owner: getAuthSessionSnapshot()?.principal.memberId ?? "", reminder: false }}
    contactPolicy={{ restricted: isDoNotContact }}
    onSubmit={async () => {}}
    onSave={(draft: MeetingActivityDraft) => {
      const start = splitLocalDateTime(draft.startAt);
      const end = splitLocalDateTime(draft.endAt);
      return onSave({
        title: draft.title,
        startDate: start.date,
        startTime: start.time,
        endTime: end.time,
        channel: draft.channel,
        location: draft.location,
        attendees: draft.attendees,
        owner: draft.owner || "",
        agenda: draft.agenda,
        reminder: draft.reminder,
      });
    }}
  />
);
