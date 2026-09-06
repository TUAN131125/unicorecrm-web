import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft, Phone, Mail, FileText, CheckSquare, Calendar, Edit3, MessageCircle, AlertCircle,
  Clock, User, Check, Trash2, ArrowRightLeft, Building2, Layers, ShoppingBag,
  Paperclip, Plus, Download, Search, Filter, HelpCircle, CheckCircle2,
  ChevronDown, Unlock, UserPlus, Tag, Printer, X, MoreHorizontal, Copy, Sparkles
} from "lucide-react";
import { RecordAttachmentsTab, RecordDetailFrame } from "@/components/crm/detail-archetype";
import type { CRMActivity } from "@/shared/domain";
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
import { LeadDetailActivityPanel, type LeadQuickAction } from "../components/LeadDetailActivityPanel";
import { LeadCompletedWorkTab, LeadOpenWorkTab } from "../components/LeadWorkActivityTabs";
import { LeadDetailMoreMenu } from "../components/LeadDetailMoreMenu";
import { LeadConsentPanel } from "../components/LeadConsentPanel";
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
  getTaskActivitySnapshot,
  NoteActivityCreateModal,
  subscribeToTaskActivity,
} from "@/modules/tasks";
import { getSupportCasesSnapshot, subscribeToSupportCases } from "@/modules/support";
import { relationshipRefKey } from "@/platform/identity";
import { getAuthSessionSnapshot } from "@/platform/identity-auth";
import { resolveWorkspaceMemberName } from "@/platform/member-directory";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";
import { useRecordOwnershipContext } from "@/platform/record-ownership";
import { useSubscribableSnapshot } from "@/platform/react";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { useConfigurationRuntime } from "@/platform/configuration-runtime";
import { toWorkspacePath } from "@/platform/navigation";
import { useLeadReferenceData } from "../hooks/useLeadReferenceData";



const ProductPickerModal = React.lazy(() => import("@/modules/products").then((module) => ({ default: module.ProductPickerModal })));
const LeadDetailModals = React.lazy(() => import("../components/LeadDetailModals").then((module) => ({ default: module.LeadDetailModals })));

interface LeadDetailPageProps {
  sources?: LeadSource[];
  campaigns?: LeadCampaign[];
  crmConfig?: CrmWorkspaceConfig;
}
import type { useLeadDetailController } from "../hooks/useLeadDetailController";

type Controller = NonNullable<ReturnType<typeof useLeadDetailController>>;

export function LeadDetailView({ controller }: { controller: Controller }) {
  const moreActionsAnchorRef = useRef<HTMLDivElement>(null);
  const {
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
    taskActivity,
    careCases,
    ownership,
    access,
    canEdit,
    canQualify,
    canArchive,
    canHandover,
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
    selectedActivity,
    setSelectedActivity,
    isFilterExpanded,
    setIsFilterExpanded,
    timelineFilter,
    setTimelineFilter,
    attachments,
    setAttachments,
    dialogs,
    showDisqualifyModal,
    setShowDisqualifyModal,
    disqualifyCategory,
    setDisqualifyCategory,
    disqualifyReasonText,
    setDisqualifyReasonText,
    showEditModal,
    setShowEditModal,
    showDeleteConfirm,
    setShowDeleteConfirm,
    setArchiveReason,
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
    handleSendEmailFromComposer,
    handleSendSMSFromComposer,
    handleAddNoteFromComposer,
    getActivitiesByStatus,
    openActivities,
    completedActivities,
    leadTasks,
    openLeadTasks,
    completedLeadTasks,
    leadCareCases,
    handleConfirmHandover,
    handleActivityQuickAction,
  } = controller;
  return (
    <RecordDetailFrame className="animate-fade-in space-y-6">
      {/* Toast message indicator */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-xl z-50 flex items-center gap-2"
          >
            <Check size={14} className="text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* RECORD HEADER AREA */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <IconButton
              id="back-to-leads-btn"
              type="button"
              onClick={() => navigate("/leads")}
              variant="secondary"
              size="sm"
              title={t("leadDetail.backToList")}
            >
              <ArrowLeft size={14} />
            </IconButton>

            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200 text-indigo-700 font-extrabold text-base flex items-center justify-center shrink-0 uppercase shadow-inner">
              {lead.name ? lead.name.split(" ").pop()?.substring(0, 2) : "LD"}
            </div>
            <div className="space-y-1 text-left">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="max-w-full break-words text-lg font-black text-slate-800 tracking-tight [overflow-wrap:anywhere]">{lead.name}</h2>
                <Badge variant={getLeadBadgeVariant(lead)} className="uppercase text-[9px] font-extrabold py-0.5 tracking-wider px-2">
                  {getLeadLifecycleLabel(lead, locale)}
                </Badge>
                {lead.archivedAt && (
                  <Badge variant="secondary" className="uppercase text-[9px] font-extrabold py-0.5 tracking-wider px-2">
                    {locale === "vi" ? "Đã lưu trữ" : "Archived"}
                  </Badge>
                )}
                {lead.priority && (
                  <Badge variant={lead.priority === "high" ? "danger" : lead.priority === "medium" ? "warning" : "secondary"} className="text-[9px] py-0.5 font-bold uppercase">
                    {lead.priority === "high" ? (locale === "vi" ? "Ưu tiên cao" : "High Priority") : lead.priority === "medium" ? (locale === "vi" ? "Trung bình" : "Medium Priority") : (locale === "vi" ? "Thấp" : "Low Priority")}
                  </Badge>
                )}
                {canEdit && ownership?.memberId && (
                  <LeadConsentPanel
                    lead={lead}
                    actorId={ownership.memberId}
                    actorName={ownership.displayName}
                    onRecord={(input) => leadActions.recordConsent(lead.id, input)}
                  />
                )}
                {lead.tags && lead.tags.map(tag => (
                  <span key={tag} className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full border border-slate-200">
                    #{tag}
                  </span>
                ))}
              </div>
              <div className="text-xs text-slate-500 font-medium flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-bold text-slate-700">{lead.title || (locale === "vi" ? "Người liên lạc đại diện" : "Representative Contact")}</span>
                <span className="text-slate-300">•</span>
                <span className="text-slate-600 font-semibold">{lead.companyName || "—"}</span>
                {lead.phone && (
                  <>
                    <span className="text-slate-300">•</span>
                    <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1 text-slate-500 hover:text-indigo-600 font-bold">
                      <Phone size={11} /> {formatPhone(lead.phone)}
                    </a>
                  </>
                )}
                {lead.email && (
                  <>
                    <span className="text-slate-300">•</span>
                    <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1 text-slate-500 hover:text-indigo-600 font-bold">
                      <Mail size={11} /> {lead.email}
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {canEdit && (
              <IconButton
                id="edit-direct-btn"
                disabled={(Boolean(lead.qualificationOutcome) && lead.qualificationOutcome !== QualificationOutcome.DISQUALIFIED)}
                onClick={() => {
                  if ((Boolean(lead.qualificationOutcome) && lead.qualificationOutcome !== QualificationOutcome.DISQUALIFIED)) {
                    showToast(locale === "vi" ? "Lead đã chốt kết quả nên không thể sửa trực tiếp." : "This Lead has a final outcome and cannot be edited directly.");
                    return;
                  }
                  setShowEditModal(true);
                }}
                variant="secondary"
                size="sm"
                title={t("leadDetail.edit.title")}
              >
                <Edit3 size={14} />
              </IconButton>
            )}

            {/* Contextual lifecycle CTA: one clear next step for the current Lead state. */}
            {lead.leadWorkState !== LeadWorkState.CLOSED
              && (lead.leadWorkState === LeadWorkState.VERIFYING ? canQualify : canEdit) && (
              <Button
                id="lead-primary-lifecycle-action"
                onClick={() => {
                  if (lead.leadWorkState === LeadWorkState.NEW) {
                    updateWorkStateDirectly(
                      LeadWorkState.CONTACTING,
                      locale === "vi" ? "Bắt đầu liên hệ Lead" : "Lead contact started",
                      locale === "vi" ? "Lead được chuyển sang bước Đang liên hệ." : "Lead moved to Contacting.",
                    );
                    showToast(locale === "vi" ? "Đã chuyển Lead sang Đang liên hệ." : "Lead moved to Contacting.");
                    return;
                  }
                  if (lead.leadWorkState === LeadWorkState.CONTACTING) {
                    requestStartVerification();
                    return;
                  }
                  if (isQualificationBlocked) {
                    showToast(locale === "vi" ? "Không đủ điều kiện: Vui lòng bổ sung Họ tên và kênh liên hệ trước." : "Not ready: add a name and contact channel first.");
                    return;
                  }
                  navigate(`/leads/${lead.id}/qualify`);
                }}
                variant="primary"
                size="sm"
                icon={lead.leadWorkState === LeadWorkState.NEW ? <Phone size={12} /> : lead.leadWorkState === LeadWorkState.CONTACTING ? <CheckCircle2 size={12} /> : <ArrowRightLeft size={12} />}
              >
                {lead.leadWorkState === LeadWorkState.NEW
                  ? (locale === "vi" ? "Đã liên hệ" : "Mark contacted")
                  : lead.leadWorkState === LeadWorkState.CONTACTING
                    ? (locale === "vi" ? "Đạt chất lượng" : "Qualify")
                    : (locale === "vi" ? "Chốt kết quả" : "Resolve outcome")}
              </Button>
            )}

            {isPositiveQualificationOutcome(lead.qualificationOutcome) && (
              <span className="bg-emerald-50 text-emerald-800 text-[10px] font-extrabold px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 size={12} className="text-emerald-600" /> {locale === "vi" ? "Đã chốt outcome" : "Outcome committed"}
              </span>
            )}

            {lead.relationshipRef?.type === "CONTACT" && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate(toWorkspacePath(workspace.workspaceKey, "crm", `contacts/${lead.relationshipRef?.id}`))}
              >
                {locale === "vi" ? "Mở Contact" : "Open Contact"}
              </Button>
            )}

            {lead.dealRef && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate(toWorkspacePath(workspace.workspaceKey, "crm", `deals/${lead.dealRef}`))}
              >
                {locale === "vi" ? "Mở cơ hội" : "Open Deal"}
              </Button>
            )}

            {/* Dropdown for Status Management actions */}
            <div ref={moreActionsAnchorRef} className="relative">
              <IconButton
                id="header-more-actions-btn"
                onClick={() => setShowMoreMenu(prev => !prev)}
                variant="secondary"
                size="sm"
                title={locale === "vi" ? "Thao tác khác" : "More Actions"}
                className="border border-slate-200 h-9 w-9 flex items-center justify-center p-0 rounded-xl"
              >
                <MoreHorizontal size={14} />
              </IconButton>
              <LeadDetailMoreMenu
                lead={lead}
                isOpen={showMoreMenu}
                anchorEl={moreActionsAnchorRef.current}
                canAssign={canHandover}
                canUpdate={canEdit}
                canQualify={canQualify}
                canManageTags={canEdit}
                onClose={() => setShowMoreMenu(false)}
                onMarkContacted={() => {
                  updateWorkStateDirectly(
                    LeadWorkState.CONTACTING,
                    locale === "vi" ? "Bắt đầu liên hệ Lead" : "Lead contact started",
                    locale === "vi" ? "Lead được chuyển sang bước Đang liên hệ." : "Lead moved to Contacting.",
                  );
                  setShowMoreMenu(false);
                  showToast(locale === "vi" ? "Đã chuyển Lead sang Đang liên hệ." : "Lead moved to Contacting.");
                }}
                onStartVerifying={() => {
                  setShowMoreMenu(false);
                  requestStartVerification();
                }}
                onDisqualify={() => { setShowDisqualifyModal(true); setShowMoreMenu(false); }}
                onReopen={() => { handleReopenLead(); setShowMoreMenu(false); }}
                onHandover={() => { setShowMoreMenu(false); setHandoverOwnerId(lead.ownerId); setShowHandoverModal(true); }}
                onManageTags={() => { setShowMoreMenu(false); setShowTagsModal(true); }}
                onPrint={() => { setShowMoreMenu(false); window.print(); }}
                onDelete={canArchive ? () => { setShowMoreMenu(false); setArchiveReason(""); setShowDeleteConfirm(true); } : undefined}
              />
            </div>
          </div>
        </div>
      </div>

      {/* CORE WORKSPACE WITH THREE MAIN AREAS: LEFT CONTENT AREA / RIGHT PANEL */}
      <div className="relative min-w-0 lg:min-h-[calc(100vh-170px)]">
        <div className="flex min-w-0 flex-col gap-3 lg:min-h-[calc(100vh-170px)] lg:flex-row lg:items-start">
        {/* MAIN / LEFT CONTAINER AREA */}
        <main className="w-full min-w-0 lg:flex-1">
          
          {/* MAIN TABS SELECTOR SYSTEM */}
          <div className="relative z-10 min-h-[580px] overflow-visible rounded-xl border border-slate-200 bg-white lg:min-h-[calc(100vh-170px)]">
            <div className="flex min-w-0 items-center gap-2 border-b border-slate-100 bg-slate-50/50 pr-2">
              <div className="min-w-0 flex-1">
                <ResponsiveTabs
                  activeId={activeTab}
                  onChange={(id) => setActiveTab(id as any)}
                  className="border-b-0 bg-transparent"
                  overflowMode="dropdown"
                  motionId="lead-primary-tabs"
                  reflowKey={isRightPanelVisible}
                  items={[
                { id: "details", label: locale === "vi" ? "Thông tin chi tiết" : "Detailed Information", icon: <User size={12} /> },
                { id: "notes", label: locale === "vi" ? "Ghi chú" : "Notes", icon: <FileText size={12} /> },
                { id: "attachments", label: locale === "vi" ? "Tài liệu đính kèm" : "Attachments", icon: <Paperclip size={12} /> },
                { id: "products", label: locale === "vi" ? "Hàng hóa quan tâm" : "Interested Products", icon: <ShoppingBag size={12} /> },
                { id: "campaigns", label: locale === "vi" ? "Chiến dịch" : "Campaigns", icon: <Layers size={12} /> },
                { id: "email", label: "Email", icon: <Mail size={12} /> },
                { id: "sms", label: "SMS", icon: <MessageCircle size={12} /> },
                { id: "care_cases", label: locale === "vi" ? "Phiếu hỗ trợ" : "Support Tickets", icon: <HelpCircle size={12} />, badge: leadCareCases.length || "" },
                { id: "open_activities", label: locale === "vi" ? "Công việc đang thực hiện" : "Open Activities", icon: <CheckSquare size={12} />, badge: openActivities.length + openLeadTasks.length || "" },
                { id: "completed_activities", label: locale === "vi" ? "Công việc đã hoàn thành" : "Completed Activities", icon: <Clock size={12} />, badge: completedActivities.length + completedLeadTasks.length || "" },
                { id: "others", label: locale === "vi" ? "Khác" : "Others", icon: <HelpCircle size={12} /> }
                  ]}
                />
              </div>
              <DetailPanelToggle
                isPanelVisible={isRightPanelVisible}
                onToggle={toggleRightPanel}
                visibleLabel={t("leads.hideWorkPanel")}
                hiddenLabel={t("leads.showWorkPanel")}
              />
            </div>

            {/* TAB CONTENTS RENDERING */}
            <div className="p-5 text-slate-800">
              <RecordTabTransition transitionKey={activeTab} axis="y" minHeightClassName="min-h-[460px]">
              {/* TAB 1: DETAILS */}
              {activeTab === "details" && (
                <div className="space-y-4">
                  
                  {/* AI Lead Scoring Widget */}
                  <div className="p-4 rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/20 via-white to-violet-50/10 shadow-sm text-xs text-left">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
                        <Sparkles className="w-4 h-4 text-violet-500" />
                        <span>{locale === "vi" ? "AI Chấm Điểm & Khai Thác" : "AI Lead Scoring"}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-black uppercase ${
                        lead.score >= 80 ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                        lead.score >= 50 ? "bg-amber-50 text-amber-700 border border-amber-100" :
                        "bg-slate-100 text-slate-600 border border-slate-200"
                      }`}>
                        {lead.score >= 80 ? lt("Mức Cao: ", "High: ") : lead.score >= 50 ? lt("Trung bình: ", "Medium: ") : lt("Mức Thấp: ", "Low: ")} {lead.score}/100
                      </span>
                    </div>

                    <p className="text-slate-600 mb-3.5 leading-relaxed">
                      {lead.score >= 80 
                        ? lt("Khách hàng có tính tương tác cực kỳ cao, website và thông tin đại diện rõ ràng. Hãy khẩn trương gửi đề xuất dịch vụ.", "Client exhibits strong engagement patterns. Website and contact representation details are highly valid. Expedite quote issuance.")
                        : lead.score >= 50
                        ? lt("Mức độ thiện chí trung bình. Cần rà soát khai thác thêm vấn nạn tồn đọng (painpoints) của phòng ban vận hành.", "Average interest level. Continued exploration is recommended to uncover deep organizational painpoints.")
                        : lt("Mức độ khớp sản phẩm thấp. Thiếu nhiều trường thông tin quan trọng để đưa vào phễu chào thầu.", "Low profile alignment. Many critical context fields are missing or unvalidated.")
                      }
                    </p>

                    <div className="flex flex-wrap gap-2 pt-2.5 border-t border-slate-100/80">
                      <Button
                        type="button"
                        actionIntent="create"
                        size="sm"
                        className="min-w-[168px]"
                        onClick={() => {
                          const name = lead.representativeName || lead.name || "Anh/Chị";
                          const draft = `Chào ${name},\n\nTôi là đại diện từ UnicoreCRM. Tôi viết email này để theo dõi tiến độ thảo luận liên quan đến giải pháp quản trị của chúng tôi.\n\nNếu anh/chị có bất kỳ câu hỏi nào về tính năng sản phẩm hoặc báo giá đề xuất, xin vui lòng phản hồi email này để đặt lịch hẹn thảo luận sâu hơn.\n\nTrân trọng,\nĐội ngũ kinh doanh UnicoreCRM`;
                          navigator.clipboard.writeText(draft);
                          showToast(locale === "vi" ? "Đã sao chép thư soạn nháp email vào bộ nhớ tạm!" : "Copied draft email template to clipboard!");
                        }}
                        icon={<Copy size={14} />}
                      >
                        {lt("Soạn thư nhắc nhở", "Draft follow-up email")}
                      </Button>
                    </div>
                  </div>

                  {/* Search and empty filter row */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                    <div className="relative w-full sm:w-64">
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                      <Input
                        type="text"
                        value={fieldSearch}
                        onChange={e => setFieldSearch(e.target.value)}
                        placeholder={locale === "vi" ? "Tìm kiếm danh mục trường..." : "Search fields..."}
                        className="pl-8"
                      />
                    </div>
                    <label className="flex items-center gap-2 select-none cursor-pointer font-bold text-slate-600">
                      <input
                        type="checkbox"
                        checked={showEmptyFields}
                        onChange={e => setShowEmptyFields(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 border-slate-300"
                      />
                      <span>{locale === "vi" ? "Hiển thị dữ liệu trống" : "Show empty fields"}</span>
                    </label>
                  </div>

                  {/* Fields lists arranged by Group Section */}
                  <div className="space-y-6">
                    {detailSections.map(secTitle => {
                      const secFields = allDetailFields.filter(f => {
                        if (f.section !== secTitle) return false;
                        if (!showEmptyFields && f.isEmpty) return false;
                        if (fieldSearch) {
                          return String(f.label).toLowerCase().includes(fieldSearch.toLowerCase()) || 
                                 f.id.toLowerCase().includes(fieldSearch.toLowerCase());
                        }
                        return true;
                      });

                      if (secFields.length === 0) return null;

                      return (
                        <div key={secTitle} className="space-y-2 animate-fade-in text-left">
                          <h4 className="text-xs font-black text-slate-400 block uppercase tracking-widest border-b border-indigo-50 pb-1">
                            {secTitle}
                          </h4>
                          <div className="divide-y divide-slate-100 text-xs">
                            {secFields.map(f => (
                              <div key={f.id} className="grid grid-cols-1 sm:grid-cols-3 py-2.5 gap-2 items-center">
                                <span className="font-bold text-slate-500 font-sans">{f.label}</span>
                                <div className="sm:col-span-2 font-semibold text-slate-800">
                                  {f.value || <span className="text-slate-400 italic font-medium">{locale === "vi" ? "Chưa cung cấp" : "Not provided"}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    {detailSections.every(sec => allDetailFields.filter(f => {
                      if (f.section !== sec) return false;
                      if (!showEmptyFields && f.isEmpty) return false;
                      if (fieldSearch) return String(f.label).toLowerCase().includes(fieldSearch.toLowerCase());
                      return true;
                    }).length === 0) && (
                      <div className="p-6 text-center text-slate-400 font-medium">
                        {locale === "vi" ? "Không có trường thông tin nào khớp lựa chọn tìm kiếm của bạn." : "No fields matched your search selection."}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: NOTES */}
              {activeTab === "notes" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">{locale === "vi" ? "Ghi chú" : "Notes"}</span>
                    <Button onClick={() => setShowNoteForm(prev => !prev)} variant={showNoteForm ? "secondary" : undefined} actionIntent={showNoteForm ? "neutral" : "create"} size="sm" className="min-w-[132px]" icon={showNoteForm ? undefined : <Plus size={14} />}>
                      {showNoteForm ? (locale === "vi" ? "Huỷ bỏ" : "Cancel") : (locale === "vi" ? "Viết ghi chú" : "Write note")}
                    </Button>
                  </div>


                  <div className="pt-2 border-t border-slate-100 space-y-3">
                    {lead.activities.filter(a => a.type === "note").length > 0 ? (
                      lead.activities.filter(a => a.type === "note").map(item => (
                        <div key={item.id} className="p-3 bg-white border border-slate-200/60 rounded-xl space-y-1 text-left">
                          <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
                            <span>{item.author}</span>
                            <span>{item.createdAt}</span>
                          </div>
                          <p className="text-xs text-slate-700 font-medium whitespace-pre-line">{item.description}</p>
                        </div>
                      ))
                    ) : (
                      <EmptyState title={locale === "vi" ? "Ghi chú trống" : "Empty Notes"} />
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: ATTACHMENTS */}
              {activeTab === "attachments" && (
                <RecordAttachmentsTab
                  idPrefix="lead"
                  attachments={attachments.map((attachment) => ({
                    id: attachment.id,
                    name: attachment.name,
                    size: attachment.size,
                    date: attachment.createdAt,
                    category: attachment.category ?? attachment.type?.toLowerCase(),
                    description: attachment.description,
                    file: attachment.file,
                  }))}
                  onUploadAttachment={(data) => {
                    const createdAt = new Date().toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US");
                    setAttachments((current) => [
                      {
                        id: `lead_attachment_${Date.now()}`,
                        name: data.name,
                        type: data.category,
                        size: data.size || "—",
                        createdAt,
                        category: data.category,
                        description: data.description,
                        file: data.file,
                      },
                      ...current,
                    ]);
                    addTimelineActivity(
                      "system",
                      locale === "vi" ? "Đã thêm tài liệu đính kèm" : "Attachment added",
                      data.name,
                    );
                    showToast(locale === "vi" ? "Tài liệu đã được tải lên." : "Attachment uploaded.");
                  }}
                  onDeleteAttachment={(id) => {
                    const attachment = attachments.find((item) => item.id === id);
                    setAttachments((current) => current.filter((item) => item.id !== id));
                    if (attachment) {
                      addTimelineActivity(
                        "system",
                        locale === "vi" ? "Đã xóa tài liệu đính kèm" : "Attachment removed",
                        attachment.name,
                      );
                    }
                    showToast(locale === "vi" ? "Tài liệu đã được xóa." : "Attachment removed.");
                  }}
                  onDownloadAttachment={(id) => {
                    const attachment = attachments.find((item) => item.id === id);
                    if (!attachment?.file) {
                      showToast(locale === "vi" ? "Tệp này chưa có dữ liệu tải xuống trên thiết bị hiện tại." : "This file is not available on the current device.");
                      return;
                    }
                    const url = URL.createObjectURL(attachment.file);
                    const anchor = document.createElement("a");
                    anchor.href = url;
                    anchor.download = attachment.name;
                    document.body.appendChild(anchor);
                    anchor.click();
                    anchor.remove();
                    window.setTimeout(() => URL.revokeObjectURL(url), 0);
                  }}
                />
              )}

              {/* TAB 4: PRODUCTS */}
              {activeTab === "products" && (() => {
                const normalInterestedProducts = (lead.interestedProducts || []).map((item: any, index) => {
                  if (typeof item === "string") {
                    const prod = referenceData.products.find(p => p.id === item);
                    return {
                      id: `lip_fallback_${index}_${Date.now()}`,
                      productId: item,
                      productNameSnapshot: prod?.name || item,
                      skuSnapshot: prod?.sku,
                      productTypeSnapshot: prod?.type,
                      interestLevel: "medium" as const,
                      estimatedQuantity: 1,
                      expectedBudget: prod?.listPrice || 0,
                      createdAt: new Date().toISOString()
                    };
                  }
                  return item;
                });

                return (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">{locale === "vi" ? "Hàng hóa quan tâm" : "Interested Products"}</span>
                      <Button onClick={() => setIsProductPickerOpen(true)} actionIntent="create" size="sm" className="min-w-[132px]" icon={<Plus size={14} />}>
                        {locale === "vi" ? "Chọn hàng hóa" : "Select product"}
                      </Button>
                    </div>

                    {normalInterestedProducts && normalInterestedProducts.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                        {normalInterestedProducts.map((item: LeadInterestedProduct) => {
                          const prod = referenceData.products.find(x => x.id === item.productId);
                          return (
                            <div key={item.id} className="border border-slate-200/60 rounded-xl p-3 bg-white flex flex-col justify-between hover:border-slate-300 transition-colors shadow-sm">
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0 pr-2">
                                  <p className="font-bold text-slate-800 text-xs crm-text-wrap" title={item.productNameSnapshot}>{item.productNameSnapshot}</p>
                                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                    SKU: {item.skuSnapshot || "N/A"} | {locale === "vi" ? "Loại" : "Type"}: {item.productTypeSnapshot || "N/A"}
                                  </p>
                                </div>
                                <IconButton
                                  onClick={() => {
                                    leadActions.update(lead.id, (currentLead) => ({
                                      ...currentLead,
                                      interestedProducts: normalInterestedProducts.filter((product) => product.id !== item.id),
                                    }));
                                    addTimelineActivity("system", locale === "vi" ? "Gỡ tháo nguồn sắm sản phẩm" : "Removed interested product", `Hủy bỏ sản phẩm: ${item.productNameSnapshot}`);
                                    showToast(locale === "vi" ? "Đã gỡ sản phẩm." : "Product removed.");
                                  }}
                                  variant="danger"
                                  size="xs"
                                  title={locale === "vi" ? "Loại bỏ khỏi phễu" : "Remove from funnel"}
                                >
                                  <Trash2 size={11} />
                                </IconButton>
                              </div>

                              {/* Interactive Customization Inputs per Product */}
                              <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-slate-100 text-[11px]">
                                <div>
                                  <label className="text-slate-400 font-medium block mb-1">{locale === "vi" ? "Mức quan tâm" : "Interest"}</label>
                                  <select
                                    value={item.interestLevel}
                                    onChange={(e) => {
                                      const val = e.target.value as "low" | "medium" | "high";
                                      leadActions.update(lead.id, (currentLead) => ({
                                        ...currentLead,
                                        interestedProducts: normalInterestedProducts.map((product) => product.id === item.id ? { ...product, interestLevel: val } : product),
                                      }));
                                    }}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-md py-1 px-1.5 font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  >
                                    <option value="low">{locale === "vi" ? "Thấp" : "Low"}</option>
                                    <option value="medium">{locale === "vi" ? "Trung bình" : "Medium"}</option>
                                    <option value="high">{locale === "vi" ? "Cao" : "High"}</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="text-slate-400 font-medium block mb-1">{locale === "vi" ? "Số lượng" : "Qty"}</label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={item.estimatedQuantity || 1}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value) || 1;
                                      leadActions.update(lead.id, (currentLead) => ({
                                        ...currentLead,
                                        interestedProducts: normalInterestedProducts.map((product) => product.id === item.id ? { ...product, estimatedQuantity: val } : product),
                                      }));
                                    }}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-md py-1 px-1.5 text-center font-bold font-mono text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  />
                                </div>
                                <div className="col-span-2">
                                  <label className="text-slate-400 font-medium block mb-1">{locale === "vi" ? "Báo giá ước tính" : "Expected Budget"}</label>
                                  <input
                                    type="number"
                                    value={item.expectedBudget || 0}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      leadActions.update(lead.id, (currentLead) => ({
                                        ...currentLead,
                                        interestedProducts: normalInterestedProducts.map((product) => product.id === item.id ? { ...product, expectedBudget: val } : product),
                                      }));
                                    }}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-md py-1 px-1.5 font-semibold font-mono text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  />
                                </div>
                                <div className="col-span-2">
                                  <label className="text-slate-400 font-medium block mb-1">{locale === "vi" ? "Ghi chú đặc thù" : "Note"}</label>
                                  <input
                                    type="text"
                                    value={item.note || ""}
                                    placeholder={locale === "vi" ? "Yêu cầu tích hợp, thời gian..." : "Custom specifications..."}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      leadActions.update(lead.id, (currentLead) => ({
                                        ...currentLead,
                                        interestedProducts: normalInterestedProducts.map((product) => product.id === item.id ? { ...product, note: val } : product),
                                      }));
                                    }}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-md py-1 px-2 text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <EmptyState title={locale === "vi" ? "Sản phẩm quan tâm trống" : "Interested Products Empty"} />
                    )}

      <React.Suspense fallback={null}>
                    <ProductPickerModal
                      id={`lead_picker_${lead.id}`}
                      isOpen={isProductPickerOpen}
                      onClose={() => setIsProductPickerOpen(false)}
                      products={referenceData.products}
                      context="lead_interest"
                      initialSelected={normalInterestedProducts.map(p => {
                        const originalProd = referenceData.products.find(x => x.id === p.productId);
                        return {
                          product: originalProd || { id: p.productId, name: p.productNameSnapshot, sku: p.skuSnapshot || "", type: p.productTypeSnapshot || "license", status: "active", category: "", unit: "", listPrice: p.expectedBudget || 0, currency: "VND", taxRate: 0, taxMode: "none", billingCycle: "one_time", isSubscription: false, isRenewable: false, tags: [], createdAt: "", updatedAt: "" },
                          quantity: p.estimatedQuantity || 1
                        };
                      })}
                      onApply={(selected) => {
                        const nextProducts: LeadInterestedProduct[] = selected.map(s => {
                          // Check if it already exists to preserve custom settings
                          const existing = normalInterestedProducts.find(x => x.productId === s.product.id);
                          if (existing) {
                            return {
                              ...existing,
                              estimatedQuantity: s.quantity
                            };
                          }
                          return {
                            id: `lip_${s.product.id}_${Date.now()}`,
                            productId: s.product.id,
                            skuSnapshot: s.product.sku,
                            productNameSnapshot: s.product.name,
                            productTypeSnapshot: s.product.type,
                            interestLevel: "medium" as const,
                            estimatedQuantity: s.quantity,
                            expectedBudget: s.product.listPrice * s.quantity,
                            createdAt: new Date().toISOString()
                          };
                        });

                        leadActions.update(lead.id, (currentLead) => ({
                          ...currentLead,
                          interestedProducts: nextProducts,
                        }));

                        showToast(locale === "vi" ? "Cập nhập hàng hóa quan tâm thành công!" : "Successfully updated interested products!");
                        setIsProductPickerOpen(false);
                      }}
                    />
                    </React.Suspense>
                  </div>
                );
              })()}

              {/* TAB 5: CAMPAIGNS */}
              {activeTab === "campaigns" && (
                <div className="space-y-4 text-left">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">{locale === "vi" ? "Chiến dịch tiếp thị" : "Marketing Campaigns"}</span>
                    <Button onClick={() => setShowCampaignForm(prev => !prev)} variant={showCampaignForm ? "secondary" : undefined} actionIntent={showCampaignForm ? "neutral" : "create"} size="sm" className="min-w-[132px]" icon={showCampaignForm ? undefined : <Plus size={14} />}>
                      {showCampaignForm ? (locale === "vi" ? "Huỷ bỏ" : "Cancel") : (locale === "vi" ? "Gắn chiến dịch" : "Associate Campaign")}
                    </Button>
                  </div>

                  {showCampaignForm && (
                    <div className="p-3 bg-slate-50/50 border border-slate-200/60 rounded-xl flex items-center justify-between text-xs font-sans gap-2 flex-wrap animate-fade-in">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">{locale === "vi" ? "Chọn chiến dịch gán liên kết" : "Choose campaign to associate"}</span>
                      <Select
                        value={lead.campaignId || ""}
                        onChange={e => {
                          const val = e.target.value;
                          leadActions.update(lead.id, (currentLead) => ({ ...currentLead, campaignId: val || undefined }));
                          const campObj = campaigns.find(x => x.id === val);
                          addTimelineActivity("system", locale === "vi" ? "Thay đổi chiến dịch marketing" : "Changed marketing campaign", `Liên kết mục tiêu mới: ${campObj ? campObj.name : (locale === "vi" ? "Huỷ liên kết chiến dịch" : "De-associate campaign")}`);
                          showToast(locale === "vi" ? "Đã gán cập nhật chiến dịch." : "Campaign assigned.");
                          setShowCampaignForm(false);
                        }}
                        className="w-auto font-semibold text-slate-700"
                      >
                        <option value="">{locale === "vi" ? "-- Huỷ hoặc Chọn chiến dịch --" : "-- Cancel or Select Campaign --"}</option>
                        {campaigns.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </Select>
                    </div>
                  )}

                  {activeCampaign ? (
                    <div className="border border-slate-200 rounded-xl p-4 space-y-2 bg-gradient-to-br from-indigo-50/5 to-transparent">
                      <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Layers size={13} className="text-indigo-600" /> {locale === "vi" ? "Track ghi nhận Chiến dịch" : "Tracked Campaign"}: {activeCampaign.name}
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs font-medium text-slate-600">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold uppercase">{locale === "vi" ? "Trạng thái" : "Status"}</span>
                          <span className="font-bold text-indigo-600 uppercase text-[11px]">{activeCampaign.status}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold uppercase">{locale === "vi" ? "Ngày khởi tạo" : "Start Date"}</span>
                          <span>{activeCampaign.startDate || (locale === "vi" ? "Chưa thiết lập" : "Not configured")}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold uppercase">{locale === "vi" ? "Hạn kết thúc" : "End Date"}</span>
                          <span>{activeCampaign.endDate || (locale === "vi" ? "vô hạn" : "No end date")}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <EmptyState title={locale === "vi" ? "Chưa liên kết chiến dịch" : "No Associated Campaign"} />
                  )}
                </div>
              )}

              {/* TAB 6: EMAIL */}
              {activeTab === "email" && (
                <div className="space-y-4 text-left">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">{locale === "vi" ? "Lịch sử tương tác Email" : "Email History"}</span>
                    <Button onClick={() => { if (ensureContactAllowed(LeadContactChannel.EMAIL)) setShowEmailModal(true); }} disabled={!evaluateLeadContactPolicy(lead, LeadContactChannel.EMAIL).allowed} title={evaluateLeadContactPolicy(lead, LeadContactChannel.EMAIL).allowed ? undefined : getLeadContactPolicyMessage(evaluateLeadContactPolicy(lead, LeadContactChannel.EMAIL).reason, locale)} actionIntent="create" size="sm" className="min-w-[132px]" icon={<Plus size={14} />}>
                      {locale === "vi" ? "Soạn & Gửi Email" : "Compose & Send Email"}
                    </Button>
                  </div>

                  <div className="border-t border-slate-100 pt-2 space-y-3">
                    {lead.activities.filter(a => a.type === "email").length > 0 ? (
                      lead.activities.filter(a => a.type === "email").map(item => (
                        <div key={item.id} className="p-3 bg-white border border-slate-200 rounded-xl text-xs space-y-1">
                          <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
                            <span>{locale === "vi" ? "Sự kiện chăm sóc email" : "Email interaction"}</span>
                            <span>{item.createdAt}</span>
                          </div>
                          <p className="font-bold text-slate-800 text-xs">{item.title}</p>
                          <p className="text-slate-600 font-medium whitespace-pre-line text-[11px]">{item.description}</p>
                        </div>
                      ))
                    ) : (
                      <EmptyState title={locale === "vi" ? "Thư mục Email rỗng" : "Email History Empty"} />
                    )}
                  </div>
                </div>
              )}

              {/* TAB 7: SMS */}
              {activeTab === "sms" && (
                <div className="space-y-4 text-left">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">{locale === "vi" ? "Lịch sử tương tác SMS" : "SMS History"}</span>
                    <Button onClick={() => { if (ensureContactAllowed(LeadContactChannel.SMS)) setShowSmsModal(true); }} disabled={!evaluateLeadContactPolicy(lead, LeadContactChannel.SMS).allowed} title={evaluateLeadContactPolicy(lead, LeadContactChannel.SMS).allowed ? undefined : getLeadContactPolicyMessage(evaluateLeadContactPolicy(lead, LeadContactChannel.SMS).reason, locale)} actionIntent="create" size="sm" className="min-w-[132px]" icon={<Plus size={14} />}>
                      {locale === "vi" ? "Gửi tin nhắn SMS" : "Send SMS"}
                    </Button>
                  </div>

                  <div className="border-t border-slate-100 pt-2 space-y-3">
                    {lead.activities.filter(a => a.type === "sms").length > 0 ? (
                      lead.activities.filter(a => a.type === "sms").map(item => (
                        <div key={item.id} className="p-3 bg-white border border-slate-200 rounded-xl text-xs space-y-1">
                          <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
                            <span>{locale === "vi" ? "Chiến dịch tương tác SMS" : "SMS Campaign"}</span>
                            <span>{item.createdAt}</span>
                          </div>
                          <p className="font-bold text-slate-800 text-xs">{item.title}</p>
                          <p className="text-slate-600 font-medium text-[11px]">{item.description}</p>
                        </div>
                      ))
                    ) : (
                      <EmptyState title={locale === "vi" ? "Lịch sử SMS trống" : "SMS History Empty"} />
                    )}
                  </div>
                </div>
              )}

              {activeTab === "care_cases" && (
                <div className="space-y-4 text-left">
                  <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-4">
                    <div className="text-xs font-black text-slate-900">{locale === "vi" ? "Phiếu hỗ trợ liên quan" : "Related Support Tickets"}</div>
                    <p className="mt-1 text-[11px] leading-5 text-slate-500">
                      {locale === "vi"
                        ? "Dữ liệu được đọc trực tiếp từ module Phiếu hỗ trợ theo quan hệ đã liên kết với Lead. Lead chưa có quan hệ Customer/Contact sẽ không tự sinh phiếu giả."
                        : "Data is read directly from Support Tickets through the Lead's linked relationship. An unlinked Lead does not generate fake cases."}
                    </p>
                  </div>
                  {leadCareCases.length > 0 ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {leadCareCases.map((item) => (
                        <button type="button" key={item.id} onClick={() => navigate(toWorkspacePath(workspace.workspaceKey, "crm", `support/cases/${item.id}`))} className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-violet-200 hover:shadow-md">
                          <div className="text-[10px] font-black uppercase tracking-wider text-violet-600">{item.caseNumber}</div>
                          <div className="mt-1 text-xs font-black text-slate-900">{item.title}</div>
                          <div className="mt-3 flex flex-wrap gap-1.5 text-[9px] font-bold">
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">{item.status}</span>
                            <span className="rounded-full bg-violet-50 px-2 py-1 text-violet-700">{item.category}</span>
                            <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">{item.priority}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title={locale === "vi" ? "Chưa có phiếu hỗ trợ liên quan" : "No related support tickets"}
                    />
                  )}
                </div>
              )}

              {/* TAB 8: OPEN ACTIVITIES */}
              {activeTab === "open_activities" && (
                <LeadOpenWorkTab
                  locale={locale}
                  tasks={openLeadTasks}
                  activities={openActivities}
                  onCreateTask={() => setShowTaskModal(true)}
                  onCreateMeeting={() => setShowMeetingModal(true)}
                  onOpenTask={(task) => navigate(toWorkspacePath(workspace.workspaceKey, "crm", `tasks/${task.id}`))}
                  onCompleteTask={async (task) => {
                    await completeTaskCommand(task.id, {
                      actorId: getAuthSessionSnapshot()?.principal.memberId || task.assigneeId,
                      actorName: getAuthSessionSnapshot()?.principal.displayName || resolveWorkspaceMemberName(task.assigneeId),
                      outcome: locale === "vi" ? "Hoàn thành từ Lead chi tiết" : "Completed from Lead detail",
                    });
                    showToast(locale === "vi" ? "Đã hoàn thành công việc." : "Task completed.");
                  }}
                  onCompleteActivity={async (activity) => {
                    await leadActions.appendActivity(lead.id, {
                      id: `act_complete_${activity.id}_${Date.now()}`,
                      title: locale === "vi" ? "Hoàn thành hoạt động" : "Activity completed",
                      description: `${activity.title}: ${activity.description ?? ""}`,
                      createdAt: new Date().toISOString(),
                      author: getAuthSessionSnapshot()?.principal.displayName,
                      type: "system",
                    });
                    showToast(locale === "vi" ? "Đã ghi nhận hoàn thành hoạt động." : "Activity completion recorded.");
                  }}
                />
              )}

              {/* TAB 9: COMPLETED ACTIVITIES */}
              {activeTab === "completed_activities" && (
                <LeadCompletedWorkTab
                  locale={locale}
                  tasks={completedLeadTasks}
                  activities={completedActivities}
                  onOpenTask={(task) => navigate(toWorkspacePath(workspace.workspaceKey, "crm", `tasks/${task.id}`))}
                />
              )}

              {/* TAB 10: OTHERS */}
              {activeTab === "others" && (
                <div className="space-y-4 text-left text-xs font-medium text-slate-600 font-sans">
                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl space-y-2">
                    <p className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2">{lt("Metadata Thông tin hệ thống", "System Metadata Information")}</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">{lt("Bản ghi ID", "Record ID")}</span>
                        <span className="font-mono text-slate-700 bg-slate-200/50 px-1.5 py-0.5 rounded text-[10px]">{lead.id}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">{lt("Kênh tiếp thị chính", "Primary Lead Channel")}</span>
                        <span>{lead.channel || lt("Tự liên hệ / Chat web", "Self Inquiry / Web Chat")}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">UTM Source</span>
                        <span>{lead.utmSource || lt("Không xác lập (Direct)", "Direct / Organic")}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">{lt("Referrer trang giới thiệu", "Referrer Origin")}</span>
                        <span className="crm-text-wrap block max-w-[200px]">{lead.referrer || lt("Tuyển dụng / Tìm kiếm tự nhiên", "Organic Search")}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              </RecordTabTransition>
            </div>
          </div>
        </main>

        <LeadDetailActivityPanel
          lead={lead}
          locale={locale}
          t={t}
          lt={lt}
          isVisible={isRightPanelVisible}
          isFilterExpanded={isFilterExpanded}
          setIsFilterExpanded={setIsFilterExpanded}
          timelineFilter={timelineFilter}
          setTimelineFilter={setTimelineFilter}
          selectedActivity={selectedActivity}
          setSelectedActivity={setSelectedActivity}
          onQuickAction={handleActivityQuickAction}
          showToast={showToast}
        />
        </div>
      </div>

      <NoteActivityCreateModal
        isOpen={showNoteForm}
        onClose={() => setShowNoteForm(false)}
        formId="lead-quick-note-form"
        defaults={{ title: locale === "vi" ? `Ghi chú Lead ${lead.name}` : `Lead note: ${lead.name}` }}
        onSubmit={handleAddNoteFromComposer}
      />

      <React.Suspense fallback={null}>
      <LeadTransitionRequirementsModal
        isOpen={showVerificationReadiness}
        lead={lead}
        requiredFields={getConfiguredLeadProfileBlockers(lead, LeadWorkState.VERIFYING)}
        onClose={() => setShowVerificationReadiness(false)}
        onConfirm={commitStartVerification}
      />
      <LeadDetailModals
        screen={{
          dialogs,
          lead,
          locale,
          t,
          sources: referenceData.sources,
          campaigns: referenceData.campaigns,
          products: referenceData.products,
          showToast,
          navigate,
          leadActions,
          handleConfirmHandover,
          handleConfirmDisqualify,
          handleSaveEditFromForm,
          handleSavePhoneCall,
                handleSaveMeeting,
          handleSendEmailFromComposer,
          handleSendSMSFromComposer,
          members,
          archiveListPath: toWorkspacePath(workspace.workspaceKey, "crm", "leads"),
        }}
      />
      </React.Suspense>
    </RecordDetailFrame>
  );
}
