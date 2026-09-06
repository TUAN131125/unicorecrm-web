import { useState } from "react";
import type { Lead } from "../../domain/model/lead.types";
import { useWorkspaceOperationalConfiguration } from "@/platform/workspace-config";
import { toDateKeyInTimeZone } from "@/shared/lib/datetime/workspaceDateTime";

export function useLeadDetailDialogs(lead?: Lead) {
  const configuration = useWorkspaceOperationalConfiguration();
  const today = toDateKeyInTimeZone(new Date(), configuration.localeRegion.timezone);
  const [showDisqualifyModal, setShowDisqualifyModal] = useState(false);
  const [disqualifyCategory, setDisqualifyCategory] = useState("Không có nhu cầu");
  const [disqualifyReasonText, setDisqualifyReasonText] = useState("");

  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [handoverOwnerId, setHandoverOwnerId] = useState("");
  const [handoverReason, setHandoverReason] = useState("");

  const [showCallModal, setShowCallModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showSmsModal, setShowSmsModal] = useState(false);

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
    showDeleteConfirm, setShowDeleteConfirm,
    archiveReason, setArchiveReason,
    showHandoverModal, setShowHandoverModal,
    showTagsModal, setShowTagsModal,
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
