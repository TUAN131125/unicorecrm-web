import React from "react";
import { MeetingActivityCreateModal, type MeetingActivityDraft } from "@/modules/tasks";

interface ContactMeetingModalProps {
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
  }) => void;
  isDoNotContact?: boolean;
}

function splitLocalDateTime(value?: string): { date: string; time: string } {
  if (!value) return { date: "", time: "" };
  const [date = "", time = ""] = value.split("T");
  return { date, time };
}

export const ContactMeetingModal: React.FC<ContactMeetingModalProps> = ({ isOpen, onClose, onSave, isDoNotContact }) => (
  <MeetingActivityCreateModal
    isOpen={isOpen}
    onClose={onClose}
    formId="contact-meeting-form"
    defaults={{ owner: "Sales Representative" }}
    contactPolicy={{ restricted: isDoNotContact }}
    onSubmit={(draft: MeetingActivityDraft) => {
      const start = splitLocalDateTime(draft.startAt);
      const end = splitLocalDateTime(draft.endAt);
      onSave({
        title: draft.title,
        startDate: start.date,
        startTime: start.time,
        endTime: end.time,
        channel: draft.channel,
        location: draft.location,
        attendees: draft.attendees,
        owner: draft.owner || "Sales Representative",
        agenda: draft.agenda,
        reminder: draft.reminder,
      });
    }}
  />
);
