import { useCallback, useState } from "react";
import type { Lead } from "../../domain/model/lead.types";
import { useWorkspaceOperationalConfiguration } from "@/platform/workspace-config";
import { toDateKeyInTimeZone } from "@/shared/lib/datetime/workspaceDateTime";

export function useLeadDetailDialogs(lead?: Lead) {
  const configuration = useWorkspaceOperationalConfiguration();
  const today = toDateKeyInTimeZone(new Date(), configuration.localeRegion.timezone);
  const [showDisqualifyModal, setShowDisqualifyModal] = useState(false);
  const [disqualifyCategory, setDisqualifyCategory] = useState("Không có nhu cầu");
  const [disqualifyReasonText, setDisqualifyReasonText] = useState("");

  type FormKind = "edit" | "handover" | "call" | "task" | "meeting" | "email" | "sms";
  const [activeForm, setActiveForm] = useState<FormKind | null>(null);
  // Background triggers cannot replace a live draft; close the current surface first.
  const setForm = useCallback((kind: FormKind, open: boolean) => {
    setActiveForm((current) => open ? current ?? kind : current === kind ? null : current);
  }, []);
  const showEditModal = activeForm === "edit";
  const setShowEditModal = useCallback((open: boolean) => setForm("edit", open), [setForm]);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const showHandoverModal = activeForm === "handover";
  const setShowHandoverModal = useCallback((open: boolean) => setForm("handover", open), [setForm]);
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [tagsAnchor, setTagsAnchor] = useState<HTMLElement | null>(null);
  const [handoverOwnerId, setHandoverOwnerId] = useState("");
  const [handoverReason, setHandoverReason] = useState("");

  const showCallModal = activeForm === "call";
  const setShowCallModal = useCallback((open: boolean) => setForm("call", open), [setForm]);
  const showTaskModal = activeForm === "task";
  const setShowTaskModal = useCallback((open: boolean) => setForm("task", open), [setForm]);
  const showMeetingModal = activeForm === "meeting";
  const setShowMeetingModal = useCallback((open: boolean) => setForm("meeting", open), [setForm]);
  const showEmailModal = activeForm === "email";
  const setShowEmailModal = useCallback((open: boolean) => setForm("email", open), [setForm]);
  const showSmsModal = activeForm === "sms";
  const setShowSmsModal = useCallback((open: boolean) => setForm("sms", open), [setForm]);

  const [callForm, setCallForm] = useState({
    title: "",
    desc: "",
    phone: lead?.phone || "",
    potential: lead?.name || "",
    campaignId: lead?.campaignId || "",
    ownerId: lead?.ownerId || "",
    relatedContact: "",
    startDate: today,
    startTime: "09:00",
    duration: "10",
    endDate: today,
    endTime: "09:10",
    callType: "Outbound",
    status: "Hoàn thành",
    callResult: "Đã liên hệ, khách phản hồi tích cực",
  });

  const [meetingForm, setMeetingForm] = useState({
    title: "",
    desc: "",
    startDate: today,
    startTime: "10:00",
    endDate: today,
    endTime: "11:00",
    performer: lead?.ownerId || "",
    location: "Google Meet",
    status: "Chưa hoàn thành",
  });

  const [emailForm, setEmailForm] = useState({
    subject: "",
    content: "",
    to: lead?.email || "",
  });

  const [smsForm, setSmsForm] = useState({
    content: "",
    to: lead?.phone || "",
  });

  return {
    showDisqualifyModal, setShowDisqualifyModal,
    disqualifyCategory, setDisqualifyCategory,
    disqualifyReasonText, setDisqualifyReasonText,
    showEditModal, setShowEditModal,
    showArchiveConfirm, setShowArchiveConfirm,
    showHandoverModal, setShowHandoverModal,
    showTagsModal, setShowTagsModal, tagsAnchor, setTagsAnchor,
    handoverOwnerId, setHandoverOwnerId,
    handoverReason, setHandoverReason,
    showCallModal, setShowCallModal,
    showTaskModal, setShowTaskModal,
    showMeetingModal, setShowMeetingModal,
    showEmailModal, setShowEmailModal,
    showSmsModal, setShowSmsModal,
    callForm, setCallForm,
    meetingForm, setMeetingForm,
    emailForm, setEmailForm,
    smsForm, setSmsForm,
  };
}

export type LeadDetailDialogs = ReturnType<typeof useLeadDetailDialogs>;
