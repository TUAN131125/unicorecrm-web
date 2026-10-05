import { useCallback, useEffect, useRef, useState } from "react";
import { registerUnsavedWork } from "@/platform/unsaved-work";
import type { Lead } from "../../domain/model/lead.types";
import { useWorkspaceOperationalConfiguration } from "@/platform/workspace-config";
import { toDateKeyInTimeZone } from "@/shared/lib/datetime/workspaceDateTime";

export function useLeadDetailDialogs(lead: Lead | undefined, routeLeadId: string) {
  const configuration = useWorkspaceOperationalConfiguration();
  const today = toDateKeyInTimeZone(new Date(), configuration.localeRegion.timezone);
  const [showDisqualifyModal, setShowDisqualifyModal] = useState(false);
  const [disqualifyCategory, setDisqualifyCategory] = useState("Không có nhu cầu");
  const [disqualifyReasonText, setDisqualifyReasonText] = useState("");

  type FormKind = "edit" | "handover" | "call" | "task" | "meeting" | "email" | "sms";
  const latestLead = useRef(lead);
  latestLead.current = lead;
  const [formIntent, setFormIntent] = useState<{ kind: FormKind; lead: Lead } | null>(null);
  const [editDirty, setEditDirty] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const activeForm = formIntent?.kind ?? null;
  const boundLead = formIntent?.lead;
  const submitting = useRef(false);
  submitting.current = editSubmitting;
  const callbackTargetId = boundLead?.id ?? routeLeadId;
  const setForm = useCallback((kind: FormKind, open: boolean) => {
    setFormIntent((current) => {
      if (!open) return current?.kind === kind && current.lead.id === callbackTargetId ? null : current;
      if (current || !latestLead.current) return current;
      return { kind, lead: structuredClone(latestLead.current) };
    });
  }, [callbackTargetId]);
  const discardActiveForm = useCallback(() => {
    // An in-flight operation keeps its opening target until its own completion.
    if (!submitting.current) setFormIntent(null);
  }, []);
  useEffect(() => {
    if (!formIntent) return;
    return registerUnsavedWork({
      id: `lead-form:${formIntent.lead.id}`, title: formIntent.lead.name,
      // Sibling forms own their local drafts. Require explicit resolution while
      // one is open; never assume their draft is clean from screen state alone.
      isDirty: formIntent.kind !== "edit" || editDirty || editSubmitting,
      save: async () => false, discard: discardActiveForm,
    });
  }, [discardActiveForm, editDirty, editSubmitting, formIntent]);
  useEffect(() => {
    if (formIntent?.kind === "edit" && formIntent.lead.id !== routeLeadId && !editDirty && !editSubmitting) setFormIntent(null);
  }, [editDirty, editSubmitting, formIntent, routeLeadId]);
  useEffect(() => {
    if (!formIntent) { setEditDirty(false); setEditSubmitting(false); }
  }, [formIntent]);
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

  const defaults = useRef({ callForm, meetingForm, emailForm, smsForm });
  const draftTarget = useRef(lead?.id);
  useEffect(() => {
    // Reset only after the previous opening intent has been resolved. A refresh
    // of the same record must never replace an active draft.
    if (formIntent || !lead || draftTarget.current === lead.id) return;
    draftTarget.current = lead.id;
    setCallForm({ ...defaults.current.callForm, phone: lead.phone || "", potential: lead.name,
      campaignId: lead.campaignId || "", ownerId: lead.ownerId || "" });
    setMeetingForm({ ...defaults.current.meetingForm, performer: lead.ownerId || "" });
    setEmailForm({ ...defaults.current.emailForm, to: lead.email || "" });
    setSmsForm({ ...defaults.current.smsForm, to: lead.phone || "" });
    setHandoverOwnerId("");
    setHandoverReason("");
  }, [formIntent, lead]);

  return {
    boundLead, activeForm, setEditDirty, setEditSubmitting, discardActiveForm,
    targetChangeRequested: Boolean(boundLead && boundLead.id !== routeLeadId),
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
