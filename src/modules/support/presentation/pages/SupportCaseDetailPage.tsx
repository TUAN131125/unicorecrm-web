import { formatApplicationError } from "@/shared/operations";
import React, { useMemo, useState } from "react";
import { ArrowLeft, CalendarClock, CheckCircle2, FileClock, Link2, ListTodo, MessageSquare, Plus, StickyNote, UserRound } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toWorkspacePath } from "@/platform/navigation";
import { RecordDetailFrame } from "@/components/crm/detail-archetype";
import { OperationDetailTabs, OperationLifecycleRail } from "@/components/crm/operations";
import { Button, RecordTabTransition, SearchableSelect, Textarea } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import { businessStatusLabel } from "@/i18n/productGlossary";
import { TaskCreateModal, getTaskActivitySnapshot, subscribeToTaskActivity } from "@/modules/tasks";
import { getAuthSessionSnapshot } from "@/platform/identity-auth";
import { CAPABILITIES, useEffectiveAccess, useEffectiveRecordAccessDecision } from "@/platform/access-control";
import { listWorkspaceMemberDirectory, resolveWorkspaceMemberName } from "@/platform/member-directory";
import { useSubscribableSnapshot } from "@/platform/react";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { getCustomerCareCategoryLabel, getCustomerCarePolicy, useWorkspaceConfigSnapshot } from "@/platform/workspace-config";
import { getAllowedSupportCaseTransitions } from "../../domain/rules/supportCaseLifecycle";
import { SUPPORT_CASE_CATEGORY_CONFIG, SUPPORT_CASE_PRIORITY_CONFIG, SUPPORT_CASE_STATUS_CONFIG } from "../../domain/rules/supportCase.config";
import type { SupportCase, SupportCasePriority, SupportCaseStatus } from "../../domain/model/supportCase.types";
import { addSupportCaseInternalNoteCommand, addSupportCaseReplyCommand, reassignSupportCaseCommand, transitionSupportCaseCommand } from "../../public/cases";
import { useSupportCases } from "../hooks/useSupportCases";
import { resolveSupportCustomerName } from "../model/supportCustomerPresentation";

type DetailTab = "overview" | "conversation" | "notes" | "tasks" | "activity";

interface SupportCaseDetailPageProps {
  customers?: any[];
  contacts?: any[];
  products?: any[];
  orders?: any[];
}

const statusLabel = (status: SupportCaseStatus, vi: boolean) => {
  const config = SUPPORT_CASE_STATUS_CONFIG[status];
  return config ? (vi ? config.labelVi : config.labelEn) : status.replaceAll("_", " ");
};
const priorityLabel = (priority: SupportCasePriority, vi: boolean) => {
  const config = SUPPORT_CASE_PRIORITY_CONFIG[priority];
  return config ? (vi ? config.labelVi : config.labelEn) : priority;
};

export const SupportCaseDetailPage: React.FC<SupportCaseDetailPageProps> = ({ customers = [], contacts = [], products = [], orders = [] }) => {
  const { caseId = "" } = useParams();
  const navigate = useNavigate();
  const workspace = useWorkspaceContextSnapshot();
  const { locale } = useI18n();
  const vi = locale === "vi";
  const workspaceConfig = useWorkspaceConfigSnapshot();
  const carePolicy = useMemo(() => getCustomerCarePolicy(workspaceConfig), [workspaceConfig]);
  const session = getAuthSessionSnapshot();
  const access = useEffectiveAccess();
  const recordAccess = useEffectiveRecordAccessDecision();
  const { cases } = useSupportCases();
  const taskSnapshot = useSubscribableSnapshot(getTaskActivitySnapshot, subscribeToTaskActivity);
  const supportCase = cases.find((item) => item.id === caseId);
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [replyText, setReplyText] = useState("");
  const [noteText, setNoteText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);

  if (!supportCase) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600">{vi ? "Không tìm thấy phiếu hỗ trợ." : "Support ticket not found."}</div>;

  const actorId = session?.principal.memberId || "current-user";
  const actorName = session?.principal.displayName || actorId;
  const members = listWorkspaceMemberDirectory();
  const relatedTasks = taskSnapshot.tasks.filter((task) => task.recordRef?.moduleKey === "support" && task.recordRef?.recordId === supportCase.id);
  const linkedCustomer = customers.find((item) => item.id === supportCase.customerId);
  const linkedContact = contacts.find((item) => item.id === supportCase.contactId);
  const linkedOrder = orders.find((item) => item.id === supportCase.relatedOrderId);
  const linkedProduct = products.find((item) => item.id === supportCase.relatedProductId);
  const categoryConfig = SUPPORT_CASE_CATEGORY_CONFIG[supportCase.category];
  const categoryDisplayLabel = getCustomerCareCategoryLabel(carePolicy, supportCase.category, locale) || (vi ? categoryConfig.labelVi : categoryConfig.labelEn);
  const commandForStatus = (status: SupportCaseStatus) => status === "resolved"
    ? "support.resolve"
    : status === "closed"
      ? "support.close"
      : status === "reopened"
        ? "support.reopen"
        : status === "cancelled"
          ? "support.cancel"
          : "support.update";
  const allowedTransitions = getAllowedSupportCaseTransitions(supportCase.status)
    .filter((status) => recordAccess?.allowedCommands.includes(commandForStatus(status)));
  const canUpdate = Boolean(recordAccess?.allowedCommands.includes("support.update") && access.can(CAPABILITIES.SUPPORT_UPDATE));
  const canAssign = Boolean(recordAccess?.allowedCommands.includes("support.assign") && access.can(CAPABILITIES.SUPPORT_ASSIGN));
  const customerComments = (supportCase.comments ?? []).filter((comment) => !comment.isInternal);
  const internalNotes = (supportCase.comments ?? []).filter((comment) => comment.isInternal);
  const nextDue = supportCase.nextFollowUpAt ? new Date(supportCase.nextFollowUpAt) : undefined;
  const followUpOverdue = Boolean(nextDue && nextDue.getTime() < Date.now() && !["resolved", "closed", "cancelled"].includes(supportCase.status));

  const runCommand = async (key: string, success: string, command: () => Promise<unknown>, after?: () => void) => {
    if (busyAction) return;
    setBusyAction(key);
    setMessage(null);
    try {
      await command();
      setMessage(success);
      after?.();
    } catch (error) {
      setMessage(formatApplicationError(error, { locale }));
    } finally {
      setBusyAction(null);
    }
  };

  const changeStatus = (status: SupportCaseStatus) => runCommand(
    `status:${status}`,
    vi ? "Đã cập nhật trạng thái phiếu." : "Support ticket status updated.",
    () => transitionSupportCaseCommand(supportCase.id, status, {
      actorId,
      actorName,
      locale,
      resolutionSummary: status === "resolved" ? (vi ? "Đã hoàn tất xử lý yêu cầu chăm sóc." : "Care request completed.") : undefined,
    }),
  );

  const submitReply = () => {
    if (!replyText.trim()) return;
    void runCommand("reply", vi ? "Đã thêm phản hồi." : "Reply added.", () => addSupportCaseReplyCommand(
      supportCase.id,
      replyText.trim(),
      { actorId, actorName, locale },
    ), () => setReplyText(""));
  };

  const submitNote = () => {
    if (!noteText.trim()) return;
    void runCommand("note", vi ? "Đã thêm ghi chú nội bộ." : "Internal note added.", () => addSupportCaseInternalNoteCommand(
      supportCase.id,
      noteText.trim(),
      { actorId, actorName, locale },
    ), () => setNoteText(""));
  };

  const assignOwner = (ownerId: string) => {
    const owner = members.find((item) => item.memberId === ownerId);
    if (!owner) return;
    void runCommand("assign", vi ? "Đã chuyển người phụ trách." : "Owner updated.", () => reassignSupportCaseCommand(
      supportCase.id,
      { id: owner.memberId, name: owner.displayName },
      { actorId, actorName, locale },
    ));
  };

  const openTaskModal = () => setShowTaskModal(true);

  const tabs = [
    { key: "overview", label: vi ? "Tổng quan" : "Overview", icon: <UserRound size={14} /> },
    { key: "conversation", label: vi ? "Trao đổi" : "Conversation", icon: <MessageSquare size={14} />, count: customerComments.length },
    { key: "notes", label: vi ? "Ghi chú nội bộ" : "Internal notes", icon: <StickyNote size={14} />, count: internalNotes.length },
    { key: "tasks", label: vi ? "Công việc" : "Tasks", icon: <ListTodo size={14} />, count: relatedTasks.length },
    { key: "activity", label: vi ? "Hoạt động" : "Activity", icon: <FileClock size={14} />, count: (supportCase.activities ?? []).length },
  ];

  const lifecycleItems = [
    { key: "created", label: vi ? "Đã tạo" : "Created", state: "done" as const, description: new Date(supportCase.createdAt).toLocaleString(vi ? "vi-VN" : "en-US") },
    { key: "active", label: vi ? "Đang chăm sóc" : "In care", state: activeStatuses.has(supportCase.status) ? "current" as const : "done" as const, description: statusLabel(supportCase.status, vi) },
    { key: "resolved", label: vi ? "Đã giải quyết" : "Resolved", state: ["resolved", "closed"].includes(supportCase.status) ? "done" as const : "next" as const, description: supportCase.resolvedAt ? new Date(supportCase.resolvedAt).toLocaleString(vi ? "vi-VN" : "en-US") : undefined },
    { key: "closed", label: vi ? "Đã đóng" : "Closed", state: supportCase.status === "closed" ? "done" as const : "next" as const, description: supportCase.closedAt ? new Date(supportCase.closedAt).toLocaleString(vi ? "vi-VN" : "en-US") : undefined },
  ];

  return (
    <RecordDetailFrame id="support-case-detail-page">
      <button type="button" onClick={() => navigate("..")} className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-indigo-700"><ArrowLeft size={14} /> {vi ? "Quay lại Phiếu hỗ trợ" : "Back to Support Tickets"}</button>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <main className="space-y-5">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-indigo-500">{vi ? "Phiếu hỗ trợ" : "Support ticket"} · {supportCase.caseNumber}</div>
                <h1 className="mt-2 max-w-full break-words text-2xl font-semibold text-slate-950 [overflow-wrap:anywhere]">{supportCase.title}</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{supportCase.description || (vi ? "Chưa có mô tả." : "No description.")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700">{statusLabel(supportCase.status, vi)}</span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">{priorityLabel(supportCase.priority, vi)}</span>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Info label={vi ? "Khách hàng" : "Customer"} value={resolveSupportCustomerName(supportCase)} />
              <Info label={vi ? "Loại chăm sóc" : "Care type"} value={categoryDisplayLabel} />
              <Info label={vi ? "Người phụ trách" : "Owner"} value={resolveWorkspaceMemberName(supportCase.ownerId)} />
            </div>
            {message && <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs font-medium text-indigo-800">{message}</div>}
          </section>

          <OperationDetailTabs items={tabs} activeKey={activeTab} onChange={(key) => setActiveTab(key as DetailTab)} />

          <RecordTabTransition transitionKey={activeTab} axis="x" minHeightClassName="min-h-[360px]" className="space-y-5">
          {activeTab === "overview" && (
            <Panel title={vi ? "Thông tin chăm sóc" : "Care information"}>
              <div className="grid gap-3 md:grid-cols-2">
                <Info label={vi ? "Khách hàng" : "Customer"} value={linkedCustomer?.displayName || linkedCustomer?.companyName || supportCase.customerName || "—"} />
                <Info label={vi ? "Người liên hệ" : "Contact"} value={linkedContact?.fullName || linkedContact?.name || supportCase.contactName || "—"} />
                <Info label={vi ? "Kênh" : "Channel"} value={supportCase.channel || supportCase.source} />
                <Info label={vi ? "Hẹn xử lý tiếp theo" : "Next follow-up"} value={supportCase.nextFollowUpAt ? new Date(supportCase.nextFollowUpAt).toLocaleString(vi ? "vi-VN" : "en-US") : "—"} />
                <Info label={vi ? "Đơn hàng liên quan" : "Related order"} value={linkedOrder?.orderNumber || supportCase.relatedOrderNumber || "—"} />
                <Info label={vi ? "Sản phẩm liên quan" : "Related product"} value={linkedProduct?.name || supportCase.relatedProductName || "—"} />
                {supportCase.resolutionSummary && <Info label={vi ? "Kết quả xử lý" : "Resolution"} value={supportCase.resolutionSummary} wide />}
              </div>
            </Panel>
          )}

          {activeTab === "conversation" && (
            <Panel title={vi ? "Trao đổi với khách hàng" : "Customer conversation"}>
              <div className="space-y-3">
                {customerComments.length === 0 ? <Empty text={vi ? "Chưa có trao đổi." : "No conversation yet."} /> : customerComments.map((comment) => <Comment key={comment.id} name={comment.authorName} body={comment.body} time={comment.createdAt} locale={locale} />)}
              </div>
              {canUpdate && <div className="mt-4 space-y-2"><Textarea disabled={Boolean(busyAction)} rows={4} value={replyText} onChange={(event) => setReplyText(event.target.value)} placeholder={vi ? "Nhập nội dung phản hồi..." : "Write a reply..."} /><div className="flex justify-end"><Button type="button" actionIntent="create" size="sm" loading={busyAction === "reply"} disabled={Boolean(busyAction) || !replyText.trim()} onClick={submitReply}>{vi ? "Gửi phản hồi" : "Send reply"}</Button></div></div>}
            </Panel>
          )}

          {activeTab === "notes" && (
            <Panel title={vi ? "Ghi chú nội bộ" : "Internal notes"}>
              <div className="space-y-3">{internalNotes.length === 0 ? <Empty text={vi ? "Chưa có ghi chú nội bộ." : "No internal notes."} /> : internalNotes.map((comment) => <Comment key={comment.id} name={comment.authorName} body={comment.body} time={comment.createdAt} locale={locale} />)}</div>
              {canUpdate && <div className="mt-4 space-y-2"><Textarea disabled={Boolean(busyAction)} rows={4} value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder={vi ? "Thêm ghi chú chỉ nhân viên nội bộ nhìn thấy..." : "Add an internal note..."} /><div className="flex justify-end"><Button type="button" actionIntent="save" size="sm" loading={busyAction === "note"} disabled={Boolean(busyAction) || !noteText.trim()} onClick={submitNote}>{vi ? "Lưu ghi chú" : "Save note"}</Button></div></div>}
            </Panel>
          )}

          {activeTab === "tasks" && (
            <Panel title={vi ? "Công việc liên quan" : "Related tasks"} action={<Button type="button" actionIntent="create" size="sm" icon={<Plus size={14} />} onClick={openTaskModal}>{vi ? "Tạo công việc" : "Create task"}</Button>}>
              <div className="space-y-3">
                {relatedTasks.length === 0 ? <Empty text={vi ? "Chưa có công việc. Chỉ tạo khi có hành động cụ thể cần giao." : "No tasks yet. Create one only for a concrete assigned action."} /> : relatedTasks.map((task) => (
                  <button key={task.id} type="button" onClick={() => navigate(toWorkspacePath(workspace.workspaceKey, "crm", `tasks/${task.id}`))} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-left hover:border-indigo-200 hover:bg-indigo-50/30">
                    <div className="flex items-start justify-between gap-3"><div><div className="text-xs font-medium text-slate-900">{task.title}</div><div className="mt-1 text-[10px] text-slate-500">{resolveWorkspaceMemberName(task.assigneeId)} · {new Date(task.dueAt).toLocaleString(vi ? "vi-VN" : "en-US")}</div></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-medium text-slate-600">{businessStatusLabel(task.status, locale)}</span></div>
                  </button>
                ))}
              </div>
            </Panel>
          )}

          {activeTab === "activity" && (
            <Panel title={vi ? "Dòng hoạt động" : "Activity timeline"}>
              <div className="space-y-3">{(supportCase.activities ?? []).length === 0 ? <Empty text={vi ? "Chưa có hoạt động." : "No activity yet."} /> : (supportCase.activities ?? []).map((activity) => <div key={activity.id} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"><div className="text-xs font-medium text-slate-900">{activity.title}</div><p className="mt-1 text-xs leading-5 text-slate-500">{activity.description}</p><div className="mt-2 text-[10px] text-slate-400">{activity.actorName} · {new Date(activity.createdAt).toLocaleString(vi ? "vi-VN" : "en-US")}</div></div>)}</div>
            </Panel>
          )}
          </RecordTabTransition>
        </main>

        <aside className="self-start xl:sticky xl:top-4">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-indigo-500">{vi ? "XỬ LÝ PHIẾU" : "CASE ACTIONS"}</div>
              <h2 className="mt-1 text-sm font-semibold text-slate-950">{statusLabel(supportCase.status, vi)}</h2>
            </div>

            <div className="space-y-3 p-4">
              <Row label={vi ? "Người phụ trách" : "Owner"} value={resolveWorkspaceMemberName(supportCase.ownerId)} />
              <Row label={vi ? "Hẹn tiếp theo" : "Next follow-up"} value={supportCase.nextFollowUpAt ? new Date(supportCase.nextFollowUpAt).toLocaleString(vi ? "vi-VN" : "en-US") : "—"} />
              {(supportCase.resolutionDueAt ?? supportCase.firstResponseDueAt) && <Row label={vi ? "Hạn cam kết" : "Commitment due"} value={new Date(supportCase.resolutionDueAt ?? supportCase.firstResponseDueAt ?? "").toLocaleString(vi ? "vi-VN" : "en-US")} />}
              {followUpOverdue && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">{vi ? "Đã đến hạn theo dõi tiếp theo." : "Follow-up is due."}</div>}

              {canAssign && <SearchableSelect disabled={Boolean(busyAction)} label={vi ? "Chuyển người phụ trách" : "Reassign"} value={supportCase.ownerId || ""} onChange={assignOwner} placeholder={vi ? "Chưa phân công" : "Unassigned"} searchPlaceholder={vi ? "Tìm tên hoặc email..." : "Search name or email..."} options={members.map((member) => ({ value: member.memberId, label: member.displayName, description: member.email, keywords: member.email }))} />}

              {allowedTransitions.length > 0 && <label className="block"><span className="text-[10px] font-medium uppercase text-slate-400">{vi ? "Chuyển trạng thái" : "Change status"}</span><select disabled={Boolean(busyAction)} value="" onChange={(event) => event.target.value && void changeStatus(event.target.value as SupportCaseStatus)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium"><option value="">{vi ? "Chọn trạng thái..." : "Choose status..."}</option>{allowedTransitions.map((status) => <option key={status} value={status}>{statusLabel(status, vi)}</option>)}</select></label>}

              <Button type="button" actionIntent="create" size="sm" icon={<ListTodo size={15} />} className="w-full" onClick={openTaskModal}>{vi ? "Tạo công việc cụ thể" : "Create concrete task"}</Button>
            </div>

            <div className="border-t border-slate-100 p-4">
              <div className="mb-3 text-[10px] font-medium uppercase tracking-wider text-slate-400">{vi ? "Vòng đời" : "Lifecycle"}</div>
              <OperationLifecycleRail steps={lifecycleItems} />
            </div>
          </div>
        </aside>
      </div>

      <TaskCreateModal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        title={vi ? "Tạo công việc từ Phiếu hỗ trợ" : "Create task from Support Ticket"}
        context={{
          customerId: supportCase.customerId,
          relationshipRef: supportCase.relationshipRef,
          recordRef: { moduleKey: "support", recordId: supportCase.id, label: `${supportCase.caseNumber} · ${supportCase.title}` },
          sourceRef: { type: "CARE_CASE_ACTION", id: supportCase.id },
          label: `${supportCase.caseNumber} · ${supportCase.title}`,
        }}
        defaults={{
          title: vi ? `Xử lý: ${supportCase.title}` : `Handle: ${supportCase.title}`,
          assigneeId: supportCase.ownerId || actorId,
          dueAt: supportCase.nextFollowUpAt,
        }}
        actorId={actorId}
        actorName={actorName}
        onCreated={() => {
          setActiveTab("tasks");
          setMessage(vi ? "Đã tạo công việc liên quan." : "Related task created.");
        }}
        onError={(error) => setMessage(formatApplicationError(error, { locale }))}
      />
    </RecordDetailFrame>
  );
};

const activeStatuses = new Set<SupportCaseStatus>(["new", "in_progress", "waiting_customer", "waiting_internal", "reopened"]);
const Panel: React.FC<{ title: string; children: React.ReactNode; action?: React.ReactNode }> = ({ title, children, action }) => <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold text-slate-900">{title}</h2>{action}</div><div className="mt-4">{children}</div></section>;
const Info: React.FC<{ label: string; value: string; wide?: boolean }> = ({ label, value, wide }) => <div className={`rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 ${wide ? "md:col-span-2" : ""}`}><div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{label}</div><div className="mt-1.5 text-sm font-medium text-slate-900">{value}</div></div>;
const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => <div className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5"><span className="text-xs text-slate-500">{label}</span><span className="text-right text-xs font-medium text-slate-800">{value}</span></div>;
const Empty: React.FC<{ text: string }> = ({ text }) => <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-xs text-slate-400">{text}</div>;
const Comment: React.FC<{ name: string; body: string; time: string; locale: "vi" | "en" }> = ({ name, body, time, locale }) => <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"><div className="text-xs font-medium text-slate-900">{name}</div><p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-600">{body}</p><div className="mt-2 text-[10px] text-slate-400">{new Date(time).toLocaleString(locale === "vi" ? "vi-VN" : "en-US")}</div></div>;
