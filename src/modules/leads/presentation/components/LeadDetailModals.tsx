import { LeadEmailActivityModal } from "./LeadEmailActivityModal";
import { LeadCallActivityModal } from "./LeadCallActivityModal";
import type { useLeadHandover } from "../hooks/useLeadHandover";
import React from "react";
import { RelationshipQuickActionModal } from "@/components/crm/relationship-panel/RelationshipQuickActionModal";
import type { NavigateFunction } from "react-router-dom";
import { Button, ConfirmDialog, Drawer, Input, Modal, RowActionPortal, Select, Textarea } from "@/shared/components/ui";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { formatApplicationError } from "@/shared/operations";
import { normalizeApplicationError } from "@/shared/domain";
import type { useI18n } from "@/i18n";
import type { Lead, LeadCampaign, LeadSource } from "../../domain/model/lead.types";
import type { Product } from "@/modules/products";
import {
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
  handleConfirmDisqualify: (deferClose?: boolean) => void | boolean | Promise<void | boolean>;
  handleSaveEditFromForm: (formData: Partial<Lead>, deferClose?: boolean) => void | boolean | Promise<void | boolean>;
  handleSavePhoneCall: (draft: CallActivityDraft, deferClose?: boolean) => void | boolean | Promise<void | boolean>;
  handleSaveMeeting: (draft: MeetingActivityDraft, deferClose?: boolean) => void | boolean | Promise<void | boolean>;
  handleLogExternalEmail: (draft: EmailActivityDraft, deferClose?: boolean) => void | boolean | Promise<void | boolean>;
  handleLogExternalSms: (draft: SmsActivityDraft, deferClose?: boolean) => void | boolean | Promise<void | boolean>;
  members: Array<{ memberId: string; displayName: string }>;
  archiveListPath: string;
  handleConfirmHandover: (ownerId: string, reason: string, deferClose?: boolean) => void | boolean | Promise<void | boolean>;
  handover: ReturnType<typeof useLeadHandover>;
  canHandover: boolean;
  handoverMembers: Array<{ memberId: string; displayName: string }>;
}

interface LeadDetailModalsProps {
  screen: LeadDetailModalScreen;
}

export function LeadDetailModals({ screen }: LeadDetailModalsProps) {
  const {
    dialogs, lead, locale, t, sources, campaigns, products, showToast, navigate, leadActions,
    handleConfirmDisqualify, handleConfirmHandover, handleSaveEditFromForm,
    handover, canHandover, handoverMembers,
    handleSavePhoneCall, handleSaveMeeting,
    handleLogExternalEmail, handleLogExternalSms, members, archiveListPath,
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

  const [disqualifySubmitting, setDisqualifySubmitting] = React.useState(false);
  const [disqualifyError, setDisqualifyError] = React.useState("");
  const disqualifyPending = React.useRef(false);
  const disqualifyWasOpen = React.useRef(false);
  const disqualifyOpening = React.useRef({ category: disqualifyCategory, reason: disqualifyReasonText });
  const closeDisqualify = React.useCallback(() => {
    setShowDisqualifyModal(false);
  }, [setShowDisqualifyModal]);
  const disqualifyGuard = useUnsavedChangesGuard(closeDisqualify);
  React.useEffect(() => {
    if (showDisqualifyModal && !disqualifyWasOpen.current) {
      disqualifyOpening.current = { category: disqualifyCategory, reason: disqualifyReasonText };
      setDisqualifyError("");
    }
    disqualifyWasOpen.current = showDisqualifyModal;
    disqualifyGuard.setIsDirty(showDisqualifyModal && (
      disqualifyCategory !== disqualifyOpening.current.category
      || disqualifyReasonText !== disqualifyOpening.current.reason
    ));
    if (!showDisqualifyModal) {
      disqualifyGuard.setIsConfirmOpen(false);
      setDisqualifyError("");
    }
  }, [showDisqualifyModal, disqualifyCategory, disqualifyReasonText, disqualifyGuard.setIsDirty, disqualifyGuard.setIsConfirmOpen]);
  const requestDisqualifyClose = () => {
    if (!disqualifyPending.current) disqualifyGuard.requestClose();
  };
  React.useEffect(() => {
    if (dialogs.targetChangeRequested && showDisqualifyModal && !disqualifyPending.current) disqualifyGuard.requestClose();
  }, [dialogs.targetChangeRequested, showDisqualifyModal]);
  const submitDisqualify = async () => {
    if (disqualifyPending.current) return;
    disqualifyPending.current = true;
    setDisqualifySubmitting(true);
    setDisqualifyError("");
    try {
      await dialogs.saveActiveForm();
    } catch (failure) {
      if (dialogs.isCurrentInteraction()) setDisqualifyError(formatApplicationError(normalizeApplicationError(failure), { locale }));
    } finally {
      disqualifyPending.current = false;
      setDisqualifySubmitting(false);
    }
  };

  const closeEditModal = React.useCallback(() => setShowEditModal(false), [setShowEditModal]);
  const editUnsavedChanges = useUnsavedChangesGuard(closeEditModal);
  const editPending = React.useRef(false);
  const requestEditClose = () => { if (!editPending.current) editUnsavedChanges.requestClose(); };
  React.useEffect(() => {
    if (dialogs.targetChangeRequested && showEditModal && !editPending.current) editUnsavedChanges.requestClose();
  }, [dialogs.targetChangeRequested, showEditModal]);
  const reportEditDirty = React.useCallback((dirty: boolean) => {
    editUnsavedChanges.setIsDirty(dirty);
    dialogs.setEditDirty(dirty);
  }, [editUnsavedChanges.setIsDirty, dialogs.setEditDirty]);
  const [tagDraft, setTagDraft] = React.useState("");
  const [archivePending, setArchivePending] = React.useState(false);
  React.useEffect(() => { if (!showTagsModal) setTagDraft(""); }, [showTagsModal]);
  React.useEffect(() => {
    if (!showEditModal) {
      editUnsavedChanges.setIsDirty(false);
      editUnsavedChanges.setIsConfirmOpen(false);
    }
  }, [editUnsavedChanges.setIsConfirmOpen, editUnsavedChanges.setIsDirty, showEditModal]);

  const saveTags = async (): Promise<boolean> => {
    const tag = tagDraft.trim();
    if (!tag || !dialogs.isCurrentInteraction()) return false;
    const saved = await leadActions.update(lead.id, currentLead => ({ ...currentLead,
      tags: [...new Set([...(currentLead.tags || []), tag])] }));
    return saved.id === lead.id && Boolean(saved.tags?.includes(tag));
  };
  if (dialogs.activeForm === "disqualify") dialogs.bindSave(async () => (await handleConfirmDisqualify(true)) === true);
  if (dialogs.activeForm === "handover") dialogs.bindSave(async () => (await handleConfirmHandover(handoverOwnerId, handoverReason.trim(), true)) === true);
  if (dialogs.activeForm === "tags") dialogs.bindSave(saveTags);
  if (dialogs.activeForm === "archive") dialogs.bindSave(async () => {
    const saved = await leadActions.archive(lead.id);
    return saved.id === lead.id && Boolean(saved.archivedAt);
  });

  return (
    <>
      {/* CONFIRM MODAL: DISQUALIFICATION REASON */}
      <Modal
        variant="form"
        isOpen={showDisqualifyModal}
        onClose={requestDisqualifyClose}
        title={locale === "vi" ? "Xác nhận không đạt" : "Confirm disqualification"}
        size="sm"
        footer={(
          <>
            <Button onClick={requestDisqualifyClose} disabled={disqualifySubmitting} variant="secondary" size="sm">
              {locale === "vi" ? "Bỏ qua" : "Cancel"}
            </Button>
            <Button onClick={submitDisqualify} disabled={disqualifySubmitting || dialogs.interactionPending} loading={disqualifySubmitting || dialogs.interactionPending} variant="danger" size="sm">
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
            disabled={disqualifySubmitting}
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
            disabled={disqualifySubmitting}
            value={disqualifyReasonText}
            onChange={(event) => setDisqualifyReasonText(event.target.value)}
            placeholder={locale === "vi" ? "Cung cấp chi tiết ngắn để phục vụ báo cáo phễu..." : "Add a short explanation for funnel reporting..."}
          />
          {(disqualifyError || dialogs.saveError) && <p role="alert" className="text-xs text-rose-600">{disqualifyError || dialogs.saveError}</p>}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={disqualifyGuard.isConfirmOpen}
        onClose={() => disqualifyGuard.setIsConfirmOpen(false)}
        onConfirm={() => { if (!disqualifyPending.current) disqualifyGuard.confirmDiscard(); }}
        title={locale === "vi" ? "Bỏ thay đổi chưa lưu?" : "Discard unsaved changes?"}
        message={locale === "vi" ? "Các thay đổi chưa được lưu. Bạn có muốn đóng biểu mẫu?" : "Your changes have not been saved. Close the form?"}
        confirmText={locale === "vi" ? "Bỏ thay đổi" : "Discard changes"}
        cancelText={locale === "vi" ? "Tiếp tục chỉnh sửa" : "Keep editing"}
        type="warning"
      />

      {/* CONFIRM MODAL: ARCHIVE CONFIRMATION */}
      <LeadArchiveConfirmationModal
        isOpen={showArchiveConfirm}
        bulk={false}
        selectedCount={1}
        pending={archivePending}
        onClose={() => {
          if (!archivePending) setShowArchiveConfirm(false);
        }}
        onConfirm={(isCurrent) => {
          if (archivePending || !dialogs.setActiveInteractionPending(true)) return;
          setArchivePending(true);
          return leadActions.archive(lead.id).then(() => {
            if (!isCurrent() || !dialogs.isCurrentInteraction()) return;
            dialogs.resolveInteraction("archive");
            showToast(locale === "vi" ? `Đã lưu trữ tiềm năng ${lead.name}.` : `Archived lead ${lead.name}.`);
            navigate(archiveListPath);
          }).catch(async (error: unknown) => {
            const applicationError = normalizeApplicationError(error);
            if (applicationError.code === "VERSION_CONFLICT") {
              await getLeadDetailResource(lead.id).refresh();
            }
            showToast(formatApplicationError(applicationError, { locale }));
          }).finally(() => { setArchivePending(false); dialogs.setActiveInteractionPending(false); });
        }}
      />

      <RelationshipQuickActionModal
        size="sm"
        guardChanges
        isOpen={showHandoverModal}
        onClose={() => setShowHandoverModal(false)}
        dirty={Boolean(handoverReason || handoverOwnerId)}
        title={locale === "vi" ? "Bàn giao Lead & công việc" : "Handover Lead & tasks"}
        formId="lead-handover-form"
        cancelLabel={t("common.cancel")}
        submitLabel={handover.ambiguous ? (locale === "vi" ? "Thử lại bàn giao" : "Retry handover") : (locale === "vi" ? "Bàn giao" : "Handover")}
        submitDisabled={!canHandover || handover.pending || handover.blocked || !handoverOwnerId || (handoverOwnerId === lead.ownerId && !handover.isAmbiguousRetry({ nextOwnerId: handoverOwnerId, reason: handoverReason })) || !handoverReason.trim() || handoverReason.trim().length > 1000}
        onSubmit={async (event) => {
          event.preventDefault();
          if (!handoverOwnerId || !handoverReason.trim() || handoverReason.trim().length > 1000) {
            showToast(locale === "vi" ? "Hãy chọn người nhận và nhập lý do bàn giao." : "Select the new owner and enter a handover reason.");
            return;
          }
          await dialogs.saveActiveForm();
        }}
      >
        <p className="mb-4 text-xs text-slate-500">{locale === "vi" ? "Máy chủ chuyển công việc Lead đang mở đủ điều kiện, tạo công việc tiếp nhận và xác định hạn tiếp nhận." : "The server transfers eligible open Lead tasks, creates an acceptance task, and determines the acceptance deadline."}</p>
        <div className="space-y-4 text-left text-xs font-sans">
          <Select
            label={locale === "vi" ? "Người chịu trách nhiệm mới *" : "New owner *"}
            disabled={handover.pending || handover.ambiguous}
            value={handoverOwnerId}
            onChange={(event) => setHandoverOwnerId(event.target.value)}
          >
            <option value="">{locale === "vi" ? "Chọn người nhận" : "Select new owner"}</option>
            {handoverMembers.filter((member) => member.memberId !== lead.ownerId || (handover.ambiguous && member.memberId === handoverOwnerId)).map((member) => (
              <option key={member.memberId} value={member.memberId}>{member.displayName}</option>
            ))}
          </Select>
          <Textarea
            label={locale === "vi" ? "Lý do bàn giao *" : "Handover reason *"}
            maxLength={1000}
            disabled={handover.pending || handover.ambiguous}
            value={handoverReason}
            onChange={(event) => setHandoverReason(event.target.value)}
            placeholder={locale === "vi" ? "Ví dụ: chuyển theo khu vực hoặc chuyên môn phụ trách" : "For example: territory or expertise reassignment"}
          />
          {handover.resolutionAccessDenied && <p role="alert" className="text-sm text-amber-700">{locale === "vi"
            ? "Chưa thể xác minh kết quả bàn giao vì quyền truy cập của bạn đã thay đổi. Yêu cầu gốc được giữ lại và có thể thử lại mà không tạo lần bàn giao mới."
            : "The Handover outcome cannot currently be verified because your access has changed. The original request is retained and can be retried without creating a new Handover."}</p>}
          {handover.blocked && <Button type="button" variant="secondary" onClick={() => { void handover.recover().catch((failure: unknown) => showToast(formatApplicationError(failure, { locale }))); }}>{locale === "vi" ? "Tải lại Lead để đối chiếu" : "Refresh Lead to reconcile"}</Button>}
          {dialogs.saveError && <p role="alert" className="text-xs text-rose-600">{dialogs.saveError}</p>}

        </div>
      </RelationshipQuickActionModal>

      <RowActionPortal
        open={showTagsModal && Boolean(dialogs.tagsAnchor?.isConnected)}
        anchorEl={dialogs.tagsAnchor}
        onClose={() => { setShowTagsModal(false); setTagDraft(""); }}
        width={340}
        align="end"
        role="dialog"
        ariaLabel={locale === "vi" ? "Quản lý nhãn Lead" : "Manage Lead Tags"}
        className="p-4"
      >
        <div className="space-y-4 text-left text-xs font-sans">
          <p className="text-slate-500">
            {locale === "vi" ? "Các thay đổi được lưu trực tiếp vào hồ sơ Lead." : "Changes are saved directly to the Lead record."}
          </p>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
            <Input
              autoFocus
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
              disabled={!tagDraft.trim() || dialogs.interactionPending}
              onClick={() => { void dialogs.saveActiveForm(); }}
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
      </RowActionPortal>

      {/* MODAL: INTEGRATED EDIT FORM */}
      <Drawer
        containPopovers
        isOpen={showEditModal}
        onClose={requestEditClose}
        title={locale === "vi" ? "Chỉnh sửa Chi tiết Khách hàng tiềm năng" : "Edit Lead Details"}
        size="wide"
        scrollBody={false}
        bodyClassName="p-0"
        footer={<div id="lead-edit-modal-footer" className="contents" />}
      >
        <React.Suspense fallback={<div className="p-6 text-sm text-slate-500">{locale === "vi" ? "Đang tải biểu mẫu…" : "Loading form…"}</div>}>
        <LeadForm
          key={lead.id}
          initialLead={lead}
          ownerOptions={members}
          sources={sources}
          campaigns={campaigns}
          products={products}
          defaultOwnerId={lead.ownerId}
          canAssignOwner={false}
          onSubmit={async (draft) => {
            editPending.current = true;
            dialogs.setEditSubmitting(true);
            try { await handleSaveEditFromForm(draft); }
            finally { editPending.current = false; dialogs.setEditSubmitting(false); }
          }}
          onSave={async (draft) => (await handleSaveEditFromForm(draft, true)) === true}
          onBindSave={showEditModal ? dialogs.bindSave : undefined}
          onSubmittingChange={dialogs.setEditSubmitting}
          onCancel={requestEditClose}
          onDirtyChange={reportEditDirty}
          isEdit={true}
          footerPortalId="lead-edit-modal-footer"
        />
        </React.Suspense>
      </Drawer>

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
      <LeadCallActivityModal dialogs={dialogs} lead={lead} handleSavePhoneCall={handleSavePhoneCall} />

      {/* NHIỆM VỤ MODAL */}
      <TaskCreateModal
        guardChanges
        isOpen={showTaskModal}
        targetId={lead.id}
        onBindSave={showTaskModal ? dialogs.bindSave : undefined}
        onPendingChange={showTaskModal ? dialogs.setActiveInteractionPending : undefined}
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
        titleOverride={locale === "vi" ? "Ghi nhận lịch hẹn" : "Log meeting"}
        guardChanges
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
        targetId={lead.id}
        recordingOnly
        onSave={async (draft) => (await handleSaveMeeting(draft, true)) === true}
        onBindSave={showMeetingModal ? dialogs.bindSave : undefined}
        onPendingChange={showMeetingModal ? dialogs.setActiveInteractionPending : undefined}
        onSubmit={async (draft) => { await handleSaveMeeting(draft); }}
      />

      {/* EMAIL MODAL */}
      <LeadEmailActivityModal dialogs={dialogs} lead={lead} locale={locale} handleLogExternalEmail={handleLogExternalEmail} />

      {/* SMS MODAL */}
      <SmsActivityCreateModal
        guardChanges
        titleOverride={locale === "vi" ? "Ghi nhận SMS ngoài CRM" : "Log external SMS"}
        submitLabelOverride={locale === "vi" ? "Lưu hoạt động" : "Save activity"}
        helperTextOverride={locale === "vi" ? "Chỉ dùng khi SMS đã được gửi hoặc nhận ngoài UniCoreCRM." : "Use only for SMS already sent or received outside UniCoreCRM."}
        isOpen={showSmsModal}
        onClose={() => setShowSmsModal(false)}
        formId="lead-quick-sms-form"
        defaults={{ phone: smsForm.to || lead.phone || "", body: smsForm.content }}
        targetId={lead.id}
        recordingOnly
        onSave={async (draft) => (await handleLogExternalSms(draft, true)) === true}
        onBindSave={showSmsModal ? dialogs.bindSave : undefined}
        onPendingChange={showSmsModal ? dialogs.setActiveInteractionPending : undefined}
        onSubmit={async (draft) => { await handleLogExternalSms(draft); }}
      />
    </>
  );
}
