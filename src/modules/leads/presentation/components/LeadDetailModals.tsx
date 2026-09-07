import React from "react";
import type { NavigateFunction } from "react-router-dom";
import { Button, ConfirmDialog, Input, Modal, Select, Textarea } from "@/shared/components/ui";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { formatApplicationError } from "@/shared/operations";
import { normalizeApplicationError } from "@/shared/domain";
import type { useI18n } from "@/i18n";
import type { Lead, LeadCampaign, LeadSource } from "../../domain/model/lead.types";
import type { Product } from "@/modules/products";
import {
  CallActivityCreateModal,
  EmailActivityCreateModal,
  MeetingActivityCreateModal,
  SmsActivityCreateModal,
  TaskCreateModal,
  type CallActivityDraft,
  type EmailActivityDraft,
  type MeetingActivityDraft,
  type SmsActivityDraft,
} from "@/modules/tasks";
import type { LeadDetailDialogs } from "../hooks/useLeadDetailDialogs";
import type { useLeadActions } from "../hooks/useLeadActions";
import { getLeadDetailResource } from "../../application/vertical-slice/leadAuthoritativeQueries";
import { LeadArchiveConfirmationModal } from "./LeadArchiveConfirmationModal";

const LeadForm = React.lazy(() => import("@/components/LeadForm").then((module) => ({ default: module.LeadForm })));

type Translate = ReturnType<typeof useI18n>["t"];
type LeadActions = ReturnType<typeof useLeadActions>;

export interface LeadDetailModalScreen {
  dialogs: LeadDetailDialogs;
  lead: Lead;
  locale: string;
  t: Translate;
  sources: LeadSource[];
  campaigns: LeadCampaign[];
  products: Product[];
  showToast: (message: string) => void;
  navigate: NavigateFunction;
  leadActions: LeadActions;
  handleConfirmDisqualify: () => void;
  handleConfirmHandover: (ownerId: string, reason: string) => void;
  handleSaveEditFromForm: (formData: Partial<Lead>) => void;
  handleSavePhoneCall: (draft: CallActivityDraft) => void;
  handleSaveMeeting: (draft: MeetingActivityDraft) => void;
  handleSendEmailFromComposer: (draft: EmailActivityDraft) => void;
  handleSendSMSFromComposer: (draft: SmsActivityDraft) => void;
  members: Array<{ memberId: string; displayName: string }>;
  archiveListPath: string;
}

interface LeadDetailModalsProps {
  screen: LeadDetailModalScreen;
}

export function LeadDetailModals({ screen }: LeadDetailModalsProps) {
  const {
    dialogs, lead, locale, t, sources, campaigns, products, showToast, navigate, leadActions,
    handleConfirmDisqualify, handleConfirmHandover, handleSaveEditFromForm,
    handleSavePhoneCall, handleSaveMeeting,
    handleSendEmailFromComposer, handleSendSMSFromComposer, members, archiveListPath,
  } = screen;

  const {
    showDisqualifyModal, setShowDisqualifyModal, disqualifyCategory, setDisqualifyCategory,
    disqualifyReasonText, setDisqualifyReasonText, showEditModal, setShowEditModal,
    showArchiveConfirm, setShowArchiveConfirm, showHandoverModal, setShowHandoverModal,
    showTagsModal, setShowTagsModal,
    handoverOwnerId, setHandoverOwnerId, handoverReason, setHandoverReason, showCallModal, setShowCallModal,
    showTaskModal, setShowTaskModal, showMeetingModal, setShowMeetingModal,
    showEmailModal, setShowEmailModal, showSmsModal, setShowSmsModal,
    callForm, setCallForm, meetingForm, setMeetingForm,
    emailForm, setEmailForm, smsForm, setSmsForm,
  } = dialogs;

  const closeEditModal = React.useCallback(() => setShowEditModal(false), [setShowEditModal]);
  const editUnsavedChanges = useUnsavedChangesGuard(closeEditModal);
  const [tagDraft, setTagDraft] = React.useState("");
  const [archivePending, setArchivePending] = React.useState(false);
  React.useEffect(() => {
    if (!showEditModal) {
      editUnsavedChanges.setIsDirty(false);
      editUnsavedChanges.setIsConfirmOpen(false);
    }
  }, [editUnsavedChanges.setIsConfirmOpen, editUnsavedChanges.setIsDirty, showEditModal]);

  return (
    <>
      {/* CONFIRM MODAL: DISQUALIFICATION REASON */}
      <Modal
        variant="form"
        isOpen={showDisqualifyModal}
        onClose={() => { setShowDisqualifyModal(false); setDisqualifyReasonText(""); }}
        title={locale === "vi" ? "Xác nhận không đạt" : "Confirm disqualification"}
        size="sm"
        footer={(
          <>
            <Button onClick={() => { setShowDisqualifyModal(false); setDisqualifyReasonText(""); }} variant="secondary" size="sm">
              {locale === "vi" ? "Bỏ qua" : "Cancel"}
            </Button>
            <Button onClick={handleConfirmDisqualify} variant="danger" size="sm">
              {locale === "vi" ? "Xác nhận không đạt" : "Confirm disqualification"}
            </Button>
          </>
        )}
      >
        <div className="space-y-4 text-left text-xs font-sans">
          <p className="font-medium leading-5 text-slate-500">
            {locale === "vi"
              ? "Chỉ dùng khi Lead thực sự không phù hợp. Cuộc gọi nhỡ hoặc khách đang bận nên được đặt lịch chăm sóc lại."
              : "Use this only when the Lead is genuinely unsuitable. Missed calls or busy contacts should be scheduled for follow-up."}
          </p>
          <Select
            label={locale === "vi" ? "Danh mục nguyên nhân *" : "Reason category *"}
            value={disqualifyCategory}
            onChange={(event) => setDisqualifyCategory(event.target.value)}
          >
            <option value="Không có nhu cầu">Không có nhu cầu</option>
            <option value="Không có ngân sách">Không có ngân sách</option>
            <option value="Không đúng người quyết định">Không đúng người quyết định</option>
            <option value="Không liên hệ được">Không liên hệ được</option>
            <option value="Thông tin sai">Thông tin sai</option>
            <option value="Không phù hợp sản phẩm">Không phù hợp sản phẩm</option>
            <option value="Đã chọn đối thủ">Đã chọn đối thủ</option>
            <option value="Khác">Khác/Chờ xử lý</option>
          </Select>
          <Textarea
            label={locale === "vi" ? "Ghi chú cụ thể lý do *" : "Reason details *"}
            value={disqualifyReasonText}
            onChange={(event) => setDisqualifyReasonText(event.target.value)}
            placeholder={locale === "vi" ? "Cung cấp chi tiết ngắn để phục vụ báo cáo phễu..." : "Add a short explanation for funnel reporting..."}
          />
        </div>
      </Modal>

      {/* CONFIRM MODAL: ARCHIVE CONFIRMATION */}
      <LeadArchiveConfirmationModal
        isOpen={showArchiveConfirm}
        bulk={false}
        selectedCount={1}
        pending={archivePending}
        onClose={() => {
          if (!archivePending) setShowArchiveConfirm(false);
        }}
        onConfirm={() => {
          if (archivePending) return;
          setArchivePending(true);
          void leadActions.archive(lead.id).then(() => {
            setShowArchiveConfirm(false);
            showToast(locale === "vi" ? `Đã lưu trữ tiềm năng ${lead.name}.` : `Archived lead ${lead.name}.`);
            navigate(archiveListPath);
          }).catch(async (error: unknown) => {
            const applicationError = normalizeApplicationError(error);
            if (applicationError.code === "VERSION_CONFLICT") {
              await getLeadDetailResource(lead.id).refresh();
            }
            showToast(formatApplicationError(applicationError, { locale }));
          }).finally(() => setArchivePending(false));
        }}
      />

      {/* HANDOVER ASSIGNMENT MODAL */}
      <Modal
        variant="form"
        isOpen={showHandoverModal}
        onClose={() => setShowHandoverModal(false)}
        title={locale === "vi" ? "Bàn giao Lead & công việc" : "Handover Lead & tasks"}
        description={locale === "vi" ? "Đổi chủ sở hữu Lead, chuyển các công việc đang mở và tạo công việc tiếp nhận cho người mới." : "Change Lead ownership, reassign open tasks, and create a handover task for the new owner."}
        size="sm"
        footer={(
          <>
            <Button onClick={() => setShowHandoverModal(false)} variant="secondary" size="sm">{t("common.cancel")}</Button>
            <Button
              onClick={() => {
                if (!handoverOwnerId || !handoverReason.trim()) {
                  showToast(locale === "vi" ? "Hãy chọn người nhận và nhập lý do bàn giao." : "Select the new owner and enter a handover reason.");
                  return;
                }
                handleConfirmHandover(handoverOwnerId, handoverReason.trim());
              }}
              variant="primary"
              size="sm"
            >
              {locale === "vi" ? "Bàn giao" : "Handover"}
            </Button>
          </>
        )}
      >
        <div className="space-y-4 text-left text-xs font-sans">
          <Select
            label={locale === "vi" ? "Người chịu trách nhiệm mới *" : "New owner *"}
            value={handoverOwnerId}
            onChange={(event) => setHandoverOwnerId(event.target.value)}
          >
            {members.map((member) => (
              <option key={member.memberId} value={member.memberId}>{member.displayName}</option>
            ))}
          </Select>
          <Textarea
            label={locale === "vi" ? "Lý do bàn giao *" : "Handover reason *"}
            value={handoverReason}
            onChange={(event) => setHandoverReason(event.target.value)}
            placeholder={locale === "vi" ? "Ví dụ: chuyển theo khu vực hoặc chuyên môn phụ trách" : "For example: territory or expertise reassignment"}
          />
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 px-3 py-2.5 text-[11px] font-medium leading-5 text-indigo-800">
            {locale === "vi"
              ? "Các công việc đang mở liên kết với Lead sẽ được chuyển cho người mới. Hệ thống đồng thời tạo một công việc tiếp nhận trong module Công việc."
              : "Open tasks linked to this Lead will be reassigned. A handover task will also be created in the Tasks module."}
          </div>
        </div>
      </Modal>

      {/* MANAGE TAGS MODAL */}
      <Modal
        variant="form"
        isOpen={showTagsModal}
        onClose={() => { setShowTagsModal(false); setTagDraft(""); }}
        title={locale === "vi" ? "Quản lý nhãn Lead" : "Manage Lead Tags"}
        size="sm"
        footer={(
          <Button type="button" onClick={() => { setShowTagsModal(false); setTagDraft(""); }} variant="primary" size="sm">
            {locale === "vi" ? "Đóng" : "Done"}
          </Button>
        )}
      >
        <div className="space-y-4 text-left text-xs font-sans">
          <p className="text-slate-500">
            {locale === "vi" ? "Các thay đổi được lưu trực tiếp vào hồ sơ Lead." : "Changes are saved directly to the Lead record."}
          </p>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
            <Input
              label={locale === "vi" ? "Nhãn mới" : "New tag"}
              placeholder={locale === "vi" ? "Ví dụ: Khách hàng ưu tiên" : "For example: Priority account"}
              value={tagDraft}
              onChange={(event) => setTagDraft(event.target.value)}
            />
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="h-11 min-w-20"
              disabled={!tagDraft.trim()}
              onClick={() => {
                const tag = tagDraft.trim();
                if (!tag) return;
                leadActions.update(lead.id, (currentLead) => ({
                  ...currentLead,
                  tags: [...new Set([...(currentLead.tags || []), tag])],
                  updatedAt: new Date().toISOString(),
                }));
                setTagDraft("");
                showToast(locale === "vi" ? `Đã gắn nhãn “${tag}”.` : `Applied tag “${tag}”.`);
              }}
            >
              {locale === "vi" ? "Thêm" : "Add"}
            </Button>
          </div>
          <div className="space-y-1">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {locale === "vi" ? "Nhãn đang gắn" : "Attached tags"}
            </span>
            <div className="flex min-h-[45px] flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-2.5">
              {(lead.tags || []).length === 0 ? (
                <span className="text-[10px] text-slate-400">{locale === "vi" ? "Chưa có nhãn" : "No tags"}</span>
              ) : (lead.tags || []).map((tag) => (
                <span key={tag} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[10px] font-extrabold text-indigo-700">
                  <span>{tag}</span>
                  <button
                    type="button"
                    aria-label={locale === "vi" ? `Gỡ nhãn ${tag}` : `Remove tag ${tag}`}
                    onClick={() => {
                      leadActions.update(lead.id, (currentLead) => ({
                        ...currentLead,
                        tags: (currentLead.tags || []).filter((item) => item !== tag),
                        updatedAt: new Date().toISOString(),
                      }));
                      showToast(locale === "vi" ? `Đã gỡ nhãn “${tag}”.` : `Removed tag “${tag}”.`);
                    }}
                    className="ml-1 font-bold text-indigo-400 hover:text-indigo-700"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* MODAL: INTEGRATED EDIT FORM */}
      <Modal variant="form"
        isOpen={showEditModal}
        onClose={editUnsavedChanges.requestClose}
        title={locale === "vi" ? "Chỉnh sửa Chi tiết Khách hàng tiềm năng" : "Edit Lead Details"}
        size="lg"
        scrollBody={false}
        bodyClassName="p-0"
        footer={<div id="lead-edit-modal-footer" className="contents" />}
      >
        <React.Suspense fallback={<div className="p-6 text-sm text-slate-500">{locale === "vi" ? "Đang tải biểu mẫu…" : "Loading form…"}</div>}>
        <LeadForm
          initialLead={lead}
          ownerOptions={members}
          sources={sources}
          campaigns={campaigns}
          products={products}
          defaultOwnerId={lead.ownerId}
          canAssignOwner={false} 
          onSubmit={handleSaveEditFromForm} 
          onCancel={editUnsavedChanges.requestClose}
          onDirtyChange={editUnsavedChanges.setIsDirty}
          isEdit={true}
          footerPortalId="lead-edit-modal-footer"
        />
        </React.Suspense>
      </Modal>

      <ConfirmDialog
        isOpen={editUnsavedChanges.isConfirmOpen}
        onClose={() => editUnsavedChanges.setIsConfirmOpen(false)}
        onConfirm={editUnsavedChanges.confirmDiscard}
        title={locale === "vi" ? "Bỏ thay đổi chưa lưu?" : "Discard unsaved changes?"}
        message={locale === "vi"
          ? "Các thay đổi trên Lead này chưa được lưu. Bạn có chắc chắn muốn đóng biểu mẫu?"
          : "Your changes to this Lead have not been saved. Are you sure you want to close the form?"}
        confirmText={locale === "vi" ? "Bỏ thay đổi" : "Discard changes"}
        cancelText={locale === "vi" ? "Tiếp tục chỉnh sửa" : "Keep editing"}
        type="warning"
      />

      {/* CUỘC GỌI MODAL */}
      <CallActivityCreateModal
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
        onSubmit={handleSavePhoneCall}
      />

      {/* NHIỆM VỤ MODAL */}
      <TaskCreateModal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        context={{
          relationshipRef: lead.relationshipRef,
          recordRef: { moduleKey: "leads", recordId: lead.id, label: lead.name },
          sourceRef: { type: "LEAD_DETAIL_TASK", id: lead.id },
          label: lead.name,
        }}
        defaults={{
          assigneeId: lead.ownerId,
          dueAt: lead.nextFollowUpAt,
          priority: lead.priority === "high" ? "HIGH" : lead.priority === "low" ? "LOW" : "NORMAL",
        }}
        onCreated={() => showToast(locale === "vi" ? "Đã thêm công việc." : "Task added.")}
        onError={() => showToast(locale === "vi" ? "Chưa thể tạo công việc." : "Task could not be created.")}
      />

      {/* LỊCH HẸN MODAL */}
      <MeetingActivityCreateModal
        isOpen={showMeetingModal}
        onClose={() => setShowMeetingModal(false)}
        formId="lead-quick-meeting-form"
        defaults={{
          title: meetingForm.title,
          startAt: `${meetingForm.startDate}T${meetingForm.startTime}`,
          endAt: `${meetingForm.endDate}T${meetingForm.endTime}`,
          channel: meetingForm.location.toLowerCase().includes("meet") || meetingForm.location.toLowerCase().includes("zoom") ? "online" : "in_person",
          location: meetingForm.location,
          owner: meetingForm.performer,
          agenda: meetingForm.desc,
        }}
        onSubmit={handleSaveMeeting}
      />

      {/* EMAIL MODAL */}
      <EmailActivityCreateModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        formId="lead-quick-email-form"
        defaults={{ to: emailForm.to || lead.email || "", subject: emailForm.subject, body: emailForm.content }}
        onSubmit={handleSendEmailFromComposer}
      />

      {/* SMS MODAL */}
      <SmsActivityCreateModal
        isOpen={showSmsModal}
        onClose={() => setShowSmsModal(false)}
        formId="lead-quick-sms-form"
        defaults={{ phone: smsForm.to || lead.phone || "", body: smsForm.content }}
        onSubmit={handleSendSMSFromComposer}
      />
    </>
  );
}
