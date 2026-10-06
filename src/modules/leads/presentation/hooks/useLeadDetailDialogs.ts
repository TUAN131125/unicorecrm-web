import { useCallback, useEffect, useRef, useState } from "react";
import { registerUnsavedWork } from "@/platform/unsaved-work";
import type { Lead } from "../../domain/model/lead.types";
import { useWorkspaceOperationalConfiguration } from "@/platform/workspace-config";
import { toDateKeyInTimeZone } from "@/shared/lib/datetime/workspaceDateTime";

export function useLeadDetailDialogs(lead: Lead | undefined, routeLeadId: string) {
  const configuration = useWorkspaceOperationalConfiguration();
  const today = toDateKeyInTimeZone(new Date(), configuration.localeRegion.timezone);
  const [interactionPending, setInteractionPending] = useState(false);

  type FormKind = "edit" | "handover" | "call" | "task" | "meeting" | "email" | "sms" | "disqualify" | "archive" | "tags" | "verification";
  const latestLead = useRef(lead);
  latestLead.current = lead;
  const [formIntent, setFormIntent] = useState<{
    kind: FormKind; lead: Lead; cycle: number;
    disqualifyCategory: string; disqualifyReasonText: string;
  } | null>(null);
  const nextCycle = useRef(0);
  const currentIntent = useRef(formIntent);
  currentIntent.current = formIntent;
  const pendingCycle = useRef<number | null>(null);
  const [editDirty, setEditDirty] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const activeForm = formIntent?.kind ?? null;
  const disqualifyCategory = formIntent?.disqualifyCategory ?? "Không có nhu cầu";
  const disqualifyReasonText = formIntent?.disqualifyReasonText ?? "";
  const disqualifyDirty = activeForm === "disqualify"
    && (disqualifyCategory !== "Không có nhu cầu" || disqualifyReasonText !== "");
  const boundLead = formIntent?.lead;
  const submitting = useRef(false);
  submitting.current = editSubmitting;
  const callbackTargetId = boundLead?.id ?? routeLeadId;
  const callbackCycle = formIntent?.cycle;
  const setForm = useCallback((kind: FormKind, open: boolean) => {
    setFormIntent((current) => {
      if (!open) return current?.kind === kind && current.lead.id === callbackTargetId
        && current.cycle === callbackCycle && pendingCycle.current !== current.cycle ? null : current;
      if (current || !latestLead.current) return current;
      return { kind, lead: structuredClone(latestLead.current), cycle: ++nextCycle.current,
        disqualifyCategory: "Không có nhu cầu", disqualifyReasonText: "" };
    });
  }, [callbackCycle, callbackTargetId]);
  const setDisqualifyCategory = useCallback((category: string) => {
    setFormIntent(current => current?.kind === "disqualify" && current.cycle === callbackCycle
      && pendingCycle.current !== current.cycle ? { ...current, disqualifyCategory: category } : current);
  }, [callbackCycle]);
  const setDisqualifyReasonText = useCallback((reason: string) => {
    setFormIntent(current => current?.kind === "disqualify" && current.cycle === callbackCycle
      && pendingCycle.current !== current.cycle ? { ...current, disqualifyReasonText: reason } : current);
  }, [callbackCycle]);
  const setActiveInteractionPending = useCallback((pending: boolean) => {
    if (callbackCycle === undefined || currentIntent.current?.cycle !== callbackCycle) return false;
    if (pending && pendingCycle.current === callbackCycle) return false;
    pendingCycle.current = pending ? callbackCycle ?? null : null;
    setInteractionPending(pending);
    return true;
  }, [callbackCycle]);
  const isCurrentInteraction = useCallback(() => callbackCycle !== undefined
    && currentIntent.current?.cycle === callbackCycle, [callbackCycle]);
  const resolveInteraction = useCallback((kind: FormKind) => {
    setFormIntent(current => current?.kind === kind && current.cycle === callbackCycle ? null : current);
  }, [callbackCycle]);
  const discardActiveForm = useCallback(() => {
    // An in-flight operation keeps its opening target until its own completion.
    if (currentIntent.current?.cycle === callbackCycle && !submitting.current && pendingCycle.current === null) {
      setFormIntent(current => current?.cycle === callbackCycle ? null : current);
    }
  }, [callbackCycle]);
  useEffect(() => {
    if (!formIntent) return;
    return registerUnsavedWork({
      id: `lead-form:${formIntent.lead.id}`, title: formIntent.lead.name,
      // Sibling forms own their local drafts. Require explicit resolution while
      // one is open; never assume their draft is clean from screen state alone.
      isDirty: (formIntent.kind === "edit" ? editDirty || editSubmitting
        : formIntent.kind === "disqualify" ? disqualifyDirty : true) || interactionPending,
      save: async () => false,
      canDiscard: () => currentIntent.current?.cycle === callbackCycle && !submitting.current && pendingCycle.current === null,
      discard: discardActiveForm,
    });
  }, [discardActiveForm, disqualifyDirty, editDirty, editSubmitting, formIntent, interactionPending]);
  useEffect(() => {
    if (formIntent?.kind === "edit" && formIntent.lead.id !== routeLeadId && !editDirty && !editSubmitting) setFormIntent(null);
    if (formIntent?.kind === "disqualify" && formIntent.lead.id !== routeLeadId && !disqualifyDirty && !interactionPending) setFormIntent(null);
  }, [disqualifyDirty, editDirty, editSubmitting, formIntent, interactionPending, routeLeadId]);
  useEffect(() => {
    if (!formIntent) {
      setEditDirty(false); setEditSubmitting(false);
      pendingCycle.current = null; setInteractionPending(false);
    }
  }, [formIntent]);
  const showDisqualifyModal = activeForm === "disqualify";
  const setShowDisqualifyModal = useCallback((open: boolean) => setForm("disqualify", open), [setForm]);
  const showEditModal = activeForm === "edit";
  const setShowEditModal = useCallback((open: boolean) => setForm("edit", open), [setForm]);
  const showArchiveConfirm = activeForm === "archive";
  const setShowArchiveConfirm = useCallback((open: boolean) => setForm("archive", open), [setForm]);
  const showHandoverModal = activeForm === "handover";
  const setShowHandoverModal = useCallback((open: boolean) => setForm("handover", open), [setForm]);
  const showTagsModal = activeForm === "tags";
  const setShowTagsModal = useCallback((open: boolean) => setForm("tags", open), [setForm]);
  const showVerificationReadiness = activeForm === "verification";
  const setShowVerificationReadiness = useCallback((open: boolean) => setForm("verification", open), [setForm]);
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
    setActiveInteractionPending, resolveInteraction, isCurrentInteraction,
    showVerificationReadiness, setShowVerificationReadiness,
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
