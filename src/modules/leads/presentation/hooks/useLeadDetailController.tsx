import { useLeadHandover } from "./useLeadHandover";
import type { LeadHandoverOpenTaskPolicy } from "../../application/ports/LeadApiRuntime";
import { describePartialCommit, executeSequentialCommits, formatApplicationError } from "@/shared/operations";
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft, Phone, Mail, FileText, CheckSquare, Calendar, Edit3, MessageCircle, AlertCircle,
  Clock, User, Check, ArrowRightLeft, Building2, Layers, ShoppingBag,
  Paperclip, Plus, Download, Search, Filter, HelpCircle, CheckCircle2,
  ChevronDown, Unlock, UserPlus, Tag, Printer, X, MoreHorizontal, Copy, Sparkles
} from "lucide-react";
import { RecordAttachmentsTab, RecordDetailFrame } from "@/components/crm/detail-archetype";
import { normalizeApplicationError, type CRMActivity } from "@/shared/domain";
import type { Lead, LeadSource, LeadCampaign, LeadInterestedProduct } from "../../domain/model/lead.types";
import { LeadWorkState, QualificationOutcome } from "../../domain/model/leadLifecycle.canonical";
import type { CrmWorkspaceConfig } from "@/platform/workspace-config";

import { DEFAULT_CRM_WORKSPACE_CONFIG } from "@/platform/workspace-config/workspaceConfigDefaults";
import { useI18n } from "@/i18n";
import { Button, Badge, Modal, Input, Textarea, EmptyState, IconButton, Select, Tabs, ResponsiveTabs, FilterChip, RecordTabTransition } from "@/shared/components/ui";
import { DetailPanelToggle } from "@/components/detail/DetailPanelToggle";
import { formatPhone } from "@/shared/lib/format/phone";
import { LeadForm } from "@/components/LeadForm";
import type { SelectedPickerItem } from "@/modules/products";
import { useLeads } from "../hooks/useLeads";
import { useLeadActions } from "../hooks/useLeadActions";
import { useLeadDetailDialogs } from "../hooks/useLeadDetailDialogs";
import type { LeadQuickAction } from "../components/LeadWorkPanel";
import { LeadCompletedWorkTab, LeadOpenWorkTab } from "../components/LeadWorkActivityTabs";
import { LeadDetailMoreMenu } from "../components/LeadDetailMoreMenu";
import {
  LeadTransitionRequirementsModal,
  type LeadTransitionProfileInput,
} from "../components/lead-transition/LeadTransitionRequirementsModal";
import { buildLeadDetailFields, getLeadDetailSections } from "../detail/buildLeadDetailFields";
import { useLeadDetailViewState } from "../hooks/useLeadDetailViewState";
import { getLeadBadgeVariant, getLeadLifecycleLabel } from "../leadLifecyclePresentation";
import { isPositiveQualificationOutcome } from "../../domain/model/leadLifecycle.canonical";
import { getConfiguredLeadProfileBlockers } from "../../application/policies/leadProgressiveProfilePolicyRuntime";
import { evaluateLeadContactPolicy, getLeadContactPolicyMessage, LeadContactChannel } from "../../domain/rules/leadContactPolicy";
import {
  completeTaskCommand,
  createTaskCommand,
  type CallActivityDraft,
  type EmailActivityDraft,
  type MeetingActivityDraft,
  type NoteActivityDraft,
  type SmsActivityDraft,
} from "@/modules/tasks";
import { getSupportCasesSnapshot, subscribeToSupportCases } from "@/modules/support";
import { relationshipRefKey } from "@/platform/identity";
import { getAuthSessionSnapshot } from "@/platform/identity-auth";
import { resolveWorkspaceMemberName } from "@/platform/member-directory";
import { CAPABILITIES, useEffectiveAccess, useEffectiveRecordAccess } from "@/platform/access-control";
import { useRecordOwnershipContext } from "@/platform/record-ownership";
import { useSubscribableSnapshot } from "@/platform/react";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { useConfigurationRuntime } from "@/platform/configuration-runtime";
import { toWorkspacePath } from "@/platform/navigation";
import { useLeadReferenceData } from "../hooks/useLeadReferenceData";
import { isLeadOperationAvailable, LEAD_OPERATION } from "../../application/leadOperationAvailability";
import { useLeadDetailWorkResources } from "./useLeadDetailWorkResources";



const ProductPickerModal = React.lazy(() => import("@/modules/products").then((module) => ({ default: module.ProductPickerModal })));
const LeadDetailModals = React.lazy(() => import("../components/LeadDetailModals").then((module) => ({ default: module.LeadDetailModals })));

export interface LeadDetailPageProps {
  sources?: LeadSource[];
  campaigns?: LeadCampaign[];
  crmConfig?: CrmWorkspaceConfig;
  authoritativeLead?: Lead;
}
export function useLeadDetailController(props: LeadDetailPageProps) {
  const {
  sources = [],
  campaigns = [],
  crmConfig = DEFAULT_CRM_WORKSPACE_CONFIG,
  authoritativeLead,
} = props;
  const { leadId } = useParams();
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const { leads } = useLeads({ loadAuthoritative: false });
  const leadActions = useLeadActions();
  const referenceData = useLeadReferenceData(sources, campaigns);
  const workResources = useLeadDetailWorkResources(leadId ?? "");
  const careCases = useSubscribableSnapshot(getSupportCasesSnapshot, subscribeToSupportCases);
  const ownership = useRecordOwnershipContext("leads", CAPABILITIES.LEADS_ASSIGN);
  const access = useEffectiveAccess();
  const canUpdatePermission = access.can(CAPABILITIES.LEADS_UPDATE);
  const canQualifyPermission = access.can(CAPABILITIES.LEADS_QUALIFY);
  const members = ownership?.assignableOwners || [];
  const workspace = useWorkspaceContextSnapshot();
  const configurationRuntime = useConfigurationRuntime();
  const lt = (viText: string, enText: string) => (locale === "vi" ? viText : enText);
  const lead = authoritativeLead?.id === leadId
    ? authoritativeLead
    : leads.find(l => l.id === leadId);
  const canEdit = canUpdatePermission && !lead?.archivedAt;
  const canRecordConsent = canEdit && isLeadOperationAvailable(LEAD_OPERATION.RECORD_CONSENT);
  const canQualify = canQualifyPermission && !lead?.archivedAt;
  const canArchive = isLeadOperationAvailable(LEAD_OPERATION.ARCHIVE)
    && access.can(CAPABILITIES.LEADS_DELETE)
    && !lead?.archivedAt;
  const handoverOwnership = useRecordOwnershipContext("leads", CAPABILITIES.LEADS_HANDOVER);
  const handover = useLeadHandover(lead);
  const handoverAccess = useEffectiveRecordAccess({ resourceKey: "leads", recordId: lead?.id, record: lead,
    requestedCommands: ["lead.handover"], requestedFields: ["ownerId"], enabled: Boolean(lead?.ownerId) });
  const canMoveHandoverTasks = access.can(CAPABILITIES.TASKS_ASSIGN);
  const canHandover = (Boolean(lead?.ownerId) || handover.ambiguous) && access.can(CAPABILITIES.LEADS_HANDOVER)
    && access.can(CAPABILITIES.TASKS_CREATE)
    && Boolean(handoverAccess.data?.canRead && handoverAccess.data.allowedCommands.includes("lead.handover"))
    && (handover.ambiguous || handoverAccess.data?.fieldAccess.ownerId === "READ_WRITE")
    && isLeadOperationAvailable(LEAD_OPERATION.HANDOVER_WITH_TASKS)
    && (!lead?.archivedAt || handover.ambiguous);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showVerificationReadiness, setShowVerificationReadiness] = useState(false);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const viewState = useLeadDetailViewState();
  const {
    activeTab, setActiveTab,
    isProductPickerOpen, setIsProductPickerOpen,
    fieldSearch, setFieldSearch,
    showEmptyFields, setShowEmptyFields,
    isRightPanelVisible, toggleRightPanel,
    showNoteForm, setShowNoteForm,
    showProductForm, setShowProductForm,
    showCampaignForm, setShowCampaignForm,
    showMoreMenu, setShowMoreMenu,
  } = viewState;

  const dialogs = useLeadDetailDialogs(lead);
  const {
    showDisqualifyModal, setShowDisqualifyModal,
    disqualifyCategory, setDisqualifyCategory,
    disqualifyReasonText, setDisqualifyReasonText,
    showEditModal, setShowEditModal,
    showArchiveConfirm, setShowArchiveConfirm,
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
  } = dialogs;
  if (!lead) return null;


  const ownerName = !lead.ownerId ? (locale === "vi" ? "Chưa phân công" : "Unassigned") : ownership?.visibleOwners.find((owner) => owner.memberId === lead.ownerId)?.displayName
    || resolveWorkspaceMemberName(lead.ownerId);
  const activeCampaign = referenceData.campaigns.find((campaign) => campaign.id === lead.campaignId);
  const campaignName = activeCampaign ? activeCampaign.name : "Không thuộc chiến dịch";

  // Timeline Activity logger
  const addTimelineActivity = async (type: string, title: string, description: string) => {
    const newAct: CRMActivity = {
      id: `act_${Date.now()}`,
      title,
      description,
      createdAt: "Vừa xong",
      author: "Bạn (Sales Rep)",
      type
    };

    await leadActions.appendActivity(lead.id, newAct);
  };

  // Canonical work-state update. Qualification outcome is committed separately.
  const updateWorkStateDirectly = async (nextWorkState: "CONTACTING" | "VERIFYING", title: string, details: string) => {
    const newAct: CRMActivity = {
      id: `act_work_state_${Date.now()}`,
      title,
      description: details,
      createdAt: "Vừa xong",
      author: "Hệ thống",
      type: "system",
    };
    await leadActions.changeWorkState(lead.id, nextWorkState, newAct);
  };

  const commitStartVerification = async (input?: LeadTransitionProfileInput) => {
    const activity: CRMActivity = {
      id: `act_work_state_${Date.now()}`,
      title: locale === "vi" ? "Lead đạt chất lượng sơ bộ" : "Lead is ready for verification",
      description: locale === "vi" ? "Lead được chuyển sang bước Đang xác minh." : "Lead moved to Verifying.",
      createdAt: new Date().toISOString(),
      author: ownership?.displayName || t("common.system"),
      type: "system",
    };
    try {
      await leadActions.startVerification(lead.id, { ...input, activity });
      setShowVerificationReadiness(false);
      showToast(locale === "vi" ? "Đã chuyển Lead sang Đang xác minh." : "Lead moved to Verifying.");
    } catch (error) {
      showToast(formatApplicationError(error, { locale }));
    }
  };

  const requestStartVerification = () => {
    const blockers = getConfiguredLeadProfileBlockers(lead, LeadWorkState.VERIFYING);
    if (blockers.length > 0) {
      setShowVerificationReadiness(true);
      return;
    }
    void commitStartVerification();
  };

  // Qualification-resolution readiness rules
  const getQualificationResolutionBlockers = (currentLead: Lead) => {
    const blockers: string[] = [];
    if (!currentLead.name || !currentLead.name.trim()) {
      blockers.push(
        locale === "vi"
          ? "Hồ sơ Lead bị thiếu Họ và tên bắt buộc."
          : "Lead profile is missing required Full Name."
      );
    }
    const hasPhone = currentLead.phone && currentLead.phone.trim();
    const hasEmail = currentLead.email && currentLead.email.trim();
    const hasZalo = currentLead.zaloId && currentLead.zaloId.trim();
    if (!hasPhone && !hasEmail && !hasZalo) {
      blockers.push(
        locale === "vi"
          ? "Hồ sơ phải có ít nhất một kênh liên lạc chính thức: Số điện thoại, Email, hoặc Zalo."
          : "Profile must have at least one communication channel: Phone, Email, or Zalo."
      );
    }
    return blockers;
  };

  const qualificationBlockers = getQualificationResolutionBlockers(lead);
  const isQualificationBlocked = qualificationBlockers.length > 0;

  const customSectionLabel = locale === "vi" ? "Trường tùy chỉnh" : "Custom fields";
  const customDetailFields = (configurationRuntime.objectSchemas.find((schema) => schema.objectType === "lead")?.fields ?? [])
    .filter((field) => field.origin === "CUSTOM" && field.status === "ACTIVE")
    .map((field) => {
      const value = lead.customFields?.[field.key];
      const displayValue = Array.isArray(value) ? value.join(", ") : typeof value === "boolean" ? (value ? (locale === "vi" ? "Có" : "Yes") : (locale === "vi" ? "Không" : "No")) : value ?? "";
      return { section: customSectionLabel, id: `custom-${field.key}`, label: field.labels[locale], value: String(displayValue), isEmpty: value === undefined || value === "" || (Array.isArray(value) && value.length === 0) };
    });
  const allDetailFields = [
    ...buildLeadDetailFields({ lead, locale, ownerName, campaignName }),
    ...customDetailFields,
  ];
  const detailSections = [...getLeadDetailSections(locale), ...(customDetailFields.length > 0 ? [customSectionLabel] : [])];

  const handleSaveEditFromForm = async (formData: Partial<Lead>) => {
    try {
      const { ownerId: _ownerId, ...editableData } = formData;
      const saved = await leadActions.replaceProfileFromForm(lead.id, {
        ...lead,
        ...editableData,
        ownerId: lead.ownerId,
        resourceVersion: lead.resourceVersion,
      });
      if (saved.activitiesAuthority === "LOCAL_COMPLETE") {
        addTimelineActivity(
          "system",
          locale === "vi" ? "Lead đã được cập nhật" : "Lead was updated",
          locale === "vi" ? "Thông tin chi tiết của tiềm năng vừa được cập nhật bởi nhân viên." : "Detail profile of the lead was updated by staff.",
        );
      }
      setShowEditModal(false);
      showToast(locale === "vi" ? "Lưu bản sửa đổi thành công!" : "Lead updated successfully");
    } catch (error: unknown) {
      // LeadForm owns recovery and dirty state. Do not refresh away the editing version.
      throw normalizeApplicationError(error);
    }
  };

  // Disqualification handler
  const handleConfirmDisqualify = async () => {
    if (!disqualifyReasonText.trim()) {
      showToast("Vui lòng nhập lý do cụ thể!");
      return;
    }
    const fullDesc = `Danh mục: ${disqualifyCategory} | Chi tiết: ${disqualifyReasonText.trim()}`;
    const activity: CRMActivity = {
      id: `act_outcome_${Date.now()}`,
      title: locale === "vi" ? "Lead đã đóng: Không đủ điều kiện" : "Lead closed: Disqualified",
      description: fullDesc,
      createdAt: "Vừa xong",
      author: "Hệ thống",
      type: "system",
    };
    await leadActions.disqualify(lead.id, {
      reason: disqualifyReasonText.trim(),
      evidence: fullDesc,
      actorId: lead.ownerId,
      activity,
    });
    setShowDisqualifyModal(false);
    setDisqualifyReasonText("");
    showToast(locale === "vi" ? "Đã lưu trạng thái Không đủ điều kiện." : "Disqualified status saved.");
  };

  // Reopen disqualified Lead
  const handleReopenLead = async () => {
    await leadActions.reopen(lead.id, {
      id: `act_reopen_${Date.now()}_${lead.id}`,
      icon: "unlock",
      title: locale === "vi" ? "Mở lại Lead" : "Lead reopened",
      description: locale === "vi"
        ? "Lead được đưa về bước Đang liên hệ để bắt đầu chu kỳ xác minh mới."
        : "The Lead returned to Contacting for a new verification cycle.",
      createdAt: new Date().toISOString(),
      author: t("common.system"),
      type: "system",
    });
    showToast(locale === "vi" ? "Đã mở lại Lead." : "Lead reopened.");
  };

  const ensureContactAllowed = (channel: typeof LeadContactChannel[keyof typeof LeadContactChannel]) => {
    const decision = evaluateLeadContactPolicy(lead, channel);
    if (decision.allowed) return true;
    showToast(getLeadContactPolicyMessage(decision.reason, locale));
    return false;
  };

  // Handlers for right workspace forms submisson
  const handleSavePhoneCall = async (draft: CallActivityDraft) => {
    if (!ensureContactAllowed(LeadContactChannel.CALL)) return;
    const resultLabels: Record<CallActivityDraft["result"], string> = {
      connected: locale === "vi" ? "Đã kết nối" : "Connected",
      no_answer: locale === "vi" ? "Không trả lời" : "No answer",
      busy: locale === "vi" ? "Máy bận" : "Busy",
      voicemail: "Voicemail",
      callback: locale === "vi" ? "Hẹn gọi lại" : "Callback requested",
    };
    const fullDesc = [
      `${locale === "vi" ? "Chiều" : "Direction"}: ${draft.direction === "outbound" ? "Outbound" : "Inbound"}`,
      `${locale === "vi" ? "Kết quả" : "Result"}: ${resultLabels[draft.result]}`,
      draft.recipient ? `${locale === "vi" ? "SĐT" : "Phone"}: ${draft.recipient}` : "",
      `${locale === "vi" ? "Thời lượng" : "Duration"}: ${draft.durationMinutes} ${locale === "vi" ? "phút" : "minutes"}`,
      draft.body,
    ].filter(Boolean).join(" | ");
    // The activity and the follow-up Task are two authoritative commands and no backend
    // operation commits them together. The activity can commit and the Task still fail, so
    // the outcome is reported instead of the whole action appearing to do nothing. The
    // committed activity is never reversed from here.
    const followUpOwnerId = lead.ownerId;
    if (draft.createFollowUpTask && !followUpOwnerId) {
      showToast(locale === "vi" ? "Lead chưa có người phụ trách để giao công việc." : "The Lead needs an owner before assigning a follow-up task.");
      return;
    }
    const followUpDueAt = draft.createFollowUpTask && draft.nextFollowUpAt
      ? new Date(draft.nextFollowUpAt).toISOString()
      : undefined;
    const callReport = await executeSequentialCommits([
      {
        step: "activity",
        run: () => addTimelineActivity("call", `${locale === "vi" ? "Cuộc gọi" : "Call"}: ${draft.subject}`, fullDesc),
      },
      ...(followUpDueAt && followUpOwnerId ? [{
        step: "followUpTask",
        run: () => createTaskCommand({
        id: `task_lead_call_${lead.id}_${Date.now()}`,
        title: `${locale === "vi" ? "Theo dõi cuộc gọi" : "Follow up call"}: ${draft.subject}`,
        description: draft.body || undefined,
        priority: "NORMAL",
        assigneeId: followUpOwnerId,
        dueAt: followUpDueAt,
        relationshipRef: lead.relationshipRef,
        recordRef: { moduleKey: "leads", recordId: lead.id, label: lead.name },
        sourceRef: { type: "LEAD_CALL_FOLLOW_UP", id: lead.id },
          actorId: followUpOwnerId,
          actorName: resolveWorkspaceMemberName(lead.ownerId),
        }),
      }] : []),
    ]);

    if (callReport.status !== "FULL_SUCCESS") {
      const failure = formatApplicationError(callReport.error, { locale });
      showToast(callReport.status === "PARTIAL_SUCCESS"
        ? `${describePartialCommit(callReport, {
            committed: locale === "vi" ? "Cuộc gọi" : "The call log",
            failed: locale === "vi" ? "Công việc theo dõi" : "the follow-up task",
          }, locale)} ${failure}`
        : failure);
      throw normalizeApplicationError(callReport.error);
    }
    setShowCallModal(false);
    setCallForm((current) => ({ ...current, title: "", desc: "" }));
    showToast(locale === "vi" ? "Đã ghi nhận cuộc gọi." : "Call logged.");
  };

  const handleSaveMeeting = async (draft: MeetingActivityDraft) => {
    const fullDesc = [
      `${locale === "vi" ? "Hình thức" : "Channel"}: ${draft.channel}`,
      `${locale === "vi" ? "Thời gian" : "Time"}: ${draft.startAt}${draft.endAt ? ` - ${draft.endAt}` : ""}`,
      draft.location ? `${locale === "vi" ? "Địa điểm" : "Location"}: ${draft.location}` : "",
      draft.attendees ? `${locale === "vi" ? "Tham dự" : "Attendees"}: ${draft.attendees}` : "",
      draft.agenda,
    ].filter(Boolean).join(" | ");
    await addTimelineActivity("meeting", `${locale === "vi" ? "Lịch hẹn" : "Meeting"}: ${draft.title}`, fullDesc);
    setShowMeetingModal(false);
    setMeetingForm((current) => ({ ...current, title: "", desc: "" }));
    showToast(locale === "vi" ? "Đã lưu lịch hẹn." : "Meeting saved.");
  };

  const handleLogExternalEmail = async (draft: EmailActivityDraft) => {
    if (!ensureContactAllowed(LeadContactChannel.EMAIL)) return;
    await addTimelineActivity(
      "email",
      locale === "vi" ? `Email đã ghi nhận: ${draft.subject}` : `Email logged: ${draft.subject}`,
      `${locale === "vi" ? "Tới" : "To"}: ${draft.to} | ${locale === "vi" ? "Nội dung" : "Content"}: ${draft.body}${draft.attachProposal ? ` | ${locale === "vi" ? "Có tài liệu đính kèm" : "Attachment included"}` : ""}`,
    );
    setShowEmailModal(false);
    setEmailForm((current) => ({ ...current, subject: "", content: "" }));
    showToast(locale === "vi" ? "Đã ghi nhận hoạt động Email." : "Email activity logged.");
  };

  const handleLogExternalSms = async (draft: SmsActivityDraft) => {
    if (!ensureContactAllowed(LeadContactChannel.SMS)) return;
    await addTimelineActivity("sms", locale === "vi" ? "SMS đã ghi nhận" : "SMS logged", `${locale === "vi" ? "Tới số" : "To"}: ${draft.phone} | ${locale === "vi" ? "Nội dung" : "Content"}: ${draft.body}`);
    setShowSmsModal(false);
    setSmsForm((current) => ({ ...current, content: "" }));
    showToast(locale === "vi" ? "Đã ghi nhận hoạt động SMS." : "SMS activity logged.");
  };

  const handleAddNoteFromComposer = async (draft: NoteActivityDraft) => {
    await addTimelineActivity("note", draft.title, `[${draft.category}] ${draft.body}`);
    setShowNoteForm(false);
    showToast(locale === "vi" ? "Ghi chú đã được lưu." : "Note saved.");
  };

  // Link addition handler


  const { tasks: leadTasks, openTasks: openLeadTasks, completedTasks: completedLeadTasks } = workResources;
  const leadActivities: CRMActivity[] = workResources.activities.map((activity) => ({
    id: activity.id,
    title: activity.subject,
    description: activity.body,
    createdAt: activity.occurredAt,
    author: resolveWorkspaceMemberName(activity.actorId),
    type: activity.type.toLowerCase(),
  }));
  const leadNotes = workResources.activities.filter((activity) => activity.type === "NOTE");
  const leadCareCases = lead.relationshipRef
    ? careCases.filter((item) => item.relationshipRef && relationshipRefKey(item.relationshipRef) === relationshipRefKey(lead.relationshipRef!))
    : [];

  const handleConfirmHandover = async (newOwnerId: string, reason: string, openTaskPolicy: LeadHandoverOpenTaskPolicy) => {
    if (!canHandover || (newOwnerId === lead.ownerId && !handover.isAmbiguousRetry({ newOwnerId, reason, openTaskPolicy })) || (openTaskPolicy === "MOVE_LEAD_OPEN_TASKS_TO_NEW_OWNER" && !canMoveHandoverTasks)) return;
    const result = await handover.submit({ newOwnerId, reason, openTaskPolicy });
    if (!result) return;
    setShowHandoverModal(false);
    setHandoverReason("");
    showToast(locale === "vi"
      ? `Đã bàn giao, chuyển ${result.reassignedTaskIds.length} công việc. Hạn tiếp nhận: ${result.handoverTaskDueAt}.`
      : `Handover complete; moved ${result.reassignedTaskIds.length} tasks. Acceptance due: ${result.handoverTaskDueAt}.`);
  };

  const handleActivityQuickAction = (action: LeadQuickAction) => {
    if ((Boolean(lead.qualificationOutcome) && lead.qualificationOutcome !== QualificationOutcome.DISQUALIFIED)) {
      showToast(lt(
        "Lead đã đóng với outcome tích cực. Hoạt động tiếp theo thuộc relationship hoặc transaction record tương ứng.",
        "The Lead is closed with a positive outcome. Continue work on the resulting relationship or transaction record.",
      ));
      return;
    }

    switch (action) {
      case "call":
        if (!ensureContactAllowed(LeadContactChannel.CALL)) return;
        setCallForm((current) => ({ ...current, phone: lead.phone || "", potential: lead.name }));
        setShowCallModal(true);
        break;
      case "task":
        setShowTaskModal(true);
        break;
      case "meeting":
        setShowMeetingModal(true);
        break;
      case "email":
        if (!ensureContactAllowed(LeadContactChannel.EMAIL)) return;
        setEmailForm((current) => ({ ...current, to: lead.email || "" }));
        setShowEmailModal(true);
        break;
      case "sms":
        if (!ensureContactAllowed(LeadContactChannel.SMS)) return;
        setSmsForm((current) => ({ ...current, to: lead.phone || "" }));
        setShowSmsModal(true);
        break;
      case "note":
        setActiveTab("notes");
        setShowNoteForm(true);
        showToast(lt("Đã điều hướng bạn tới tab Ghi chú trung tâm.", "Navigated view frame to central Notes tab."));
        break;
    }
  };
  return {
    sources,
    campaigns,
    crmConfig,
    leadId,
    navigate,
    t,
    locale,
    leads,
    leadActions,
    referenceData,
    workResources,
    leadActivities,
    leadNotes,
    careCases,
    ownership,
    access,
    canEdit,
    canRecordConsent,
    canQualify,
    canArchive,
    canHandover,
    canMoveHandoverTasks,
    handover,
    handoverMembers: handoverOwnership?.assignableOwners ?? [],
    members,
    workspace,
    configurationRuntime,
    lt,
    lead,
    toastMessage,
    setToastMessage,
    showVerificationReadiness,
    setShowVerificationReadiness,
    showToast,
    viewState,
    activeTab,
    setActiveTab,
    isProductPickerOpen,
    setIsProductPickerOpen,
    fieldSearch,
    setFieldSearch,
    showEmptyFields,
    setShowEmptyFields,
    isRightPanelVisible,
    toggleRightPanel,
    showNoteForm,
    setShowNoteForm,
    showProductForm,
    setShowProductForm,
    showCampaignForm,
    setShowCampaignForm,
    showMoreMenu,
    setShowMoreMenu,
    dialogs,
    showDisqualifyModal,
    setShowDisqualifyModal,
    disqualifyCategory,
    setDisqualifyCategory,
    disqualifyReasonText,
    setDisqualifyReasonText,
    showEditModal,
    setShowEditModal,
    showArchiveConfirm,
    setShowArchiveConfirm,
    showHandoverModal,
    setShowHandoverModal,
    showTagsModal,
    setShowTagsModal,
    handoverOwnerId,
    setHandoverOwnerId,
    handoverReason,
    setHandoverReason,
    showCallModal,
    setShowCallModal,
    showTaskModal,
    setShowTaskModal,
    showMeetingModal,
    setShowMeetingModal,
    showEmailModal,
    setShowEmailModal,
    showSmsModal,
    setShowSmsModal,
    callForm,
    setCallForm,
    meetingForm,
    setMeetingForm,
    emailForm,
    setEmailForm,
    smsForm,
    setSmsForm,
    ownerName,
    activeCampaign,
    campaignName,
    addTimelineActivity,
    updateWorkStateDirectly,
    commitStartVerification,
    requestStartVerification,
    getQualificationResolutionBlockers,
    qualificationBlockers,
    isQualificationBlocked,
    customSectionLabel,
    customDetailFields,
    allDetailFields,
    detailSections,
    handleSaveEditFromForm,
    handleConfirmDisqualify,
    handleReopenLead,
    ensureContactAllowed,
    handleSavePhoneCall,
    handleSaveMeeting,
    handleLogExternalEmail,
    handleLogExternalSms,
    handleAddNoteFromComposer,
    leadTasks,
    openLeadTasks,
    completedLeadTasks,
    leadCareCases,
    handleConfirmHandover,
    handleActivityQuickAction,
  };
}
