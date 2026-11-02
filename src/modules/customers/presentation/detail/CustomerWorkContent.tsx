import { useNavigate } from "react-router-dom";
import { useI18n } from "@/i18n";
import { MeetingActivityCreateModal, TaskCreateModal } from "@/modules/tasks";
import { resolveWorkspaceMemberLabel } from "@/platform/member-directory";
import { toWorkspacePath } from "@/platform/navigation";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { useWorkspaceRuntimeSettings } from "@/platform/workspace-config";
import { Button, Modal } from "@/shared/components/ui";
import { formatDateTime } from "@/shared/lib/format/date";
import { WorkSection, WorkTaskItem } from "@/components/crm/relationship-panel/RelationshipWorkPresentation";
import type { CustomerWorkController } from "../hooks/useCustomerWorkController";

export function CustomerWorkContent({ controller, history = false }: { controller: CustomerWorkController; history?: boolean }) {
  const { locale } = useI18n();
  const vi = locale === "vi", text = (a: string, b: string) => vi ? a : b;
  const workspace = useWorkspaceContextSnapshot();
  const { timeZone } = useWorkspaceRuntimeSettings();
  const navigate = useNavigate();
  const { data } = controller;
  const query = history ? data.history : data.tasks;
  const supported = history ? data.historySupported : data.tasksEnabled;
  const message = !data.readable ? text("Bạn không có quyền đọc công việc và hoạt động.", "You cannot read tasks and activities.")
    : !supported ? history ? text("Chưa thể mở lịch sử này.", "This history cannot be opened.") : text("Chưa thể mở công việc này.", "These tasks cannot be opened.")
      : query.loading ? text("Đang tải…", "Loading…") : query.error ? text("Không thể tải dữ liệu. Vui lòng thử lại.", "Data could not be loaded. Please retry.") : "";
  const date = (value: string) => formatDateTime(value, locale, { timeZone }) || text("Thời điểm chưa khả dụng", "Time unavailable");
  const entry = history ? data.historyEntry : data.taskEntry;
  const items = history ? data.historyItems : data.taskItems;
  const status = { OPEN: text("Đang mở", "Open"), COMPLETED: text("Hoàn thành", "Completed"), CANCELLED: text("Đã hủy", "Cancelled") };
  const priority = { LOW: text("Thấp", "Low"), NORMAL: text("Bình thường", "Normal"), HIGH: text("Cao", "High"), URGENT: text("Khẩn cấp", "Urgent") };
  return <section aria-label={history ? text("Hoạt động khách hàng", "Customer activities") : text("Công việc khách hàng", "Customer work")} className="space-y-3">
    {message && <p role={query.error ? "alert" : "status"}>{message}</p>}
    {query.error && supported && data.readable && <Button onClick={() => void entry.refresh()}>{text("Thử lại", "Retry")}</Button>}
    {!message && !items.length && <p role="status">{history ? text("Không có hoạt động để hiển thị.", "No activities to display.") : text("Không có công việc để hiển thị.", "No tasks to display.")}</p>}
    {history ? <ol className="space-y-2">{data.historyItems.map(item => <li key={item.id} data-customer-history-id={item.id}><button type="button" aria-haspopup="dialog" onClick={() => controller.selectActivity(item.id)} className="w-full space-y-1 rounded-lg border border-slate-200 p-3 text-left text-xs focus-visible:outline focus-visible:outline-indigo-600 [overflow-wrap:anywhere]">
      <span className="block text-indigo-600">{item.type}</span><span className="block font-semibold">{item.subject}</span><time dateTime={item.occurredAt}>{date(item.occurredAt)}</time>
    </button></li>)}</ol> : <WorkSection first title={text("Công việc liên quan trực tiếp", "Directly linked work")}><ul className="space-y-2">{data.taskItems.map(task => <li key={task.id} data-customer-task-id={task.id}><WorkTaskItem title={task.title} onOpen={() => navigate(toWorkspacePath(workspace.workspaceKey, "crm", `tasks/${encodeURIComponent(task.id)}`))} metadata={<>{status[task.status]} · {priority[task.priority]} · <time dateTime={task.dueAt}>{date(task.dueAt)}</time> · {resolveWorkspaceMemberLabel(task.assigneeId, vi ? "vi" : "en")}</>}/></li>)}</ul></WorkSection>}
    {!message && query.data?.pageInfo.hasNextPage && <Button disabled={items.length >= 500} onClick={() => void entry.more()}>{history ? text("Tải thêm hoạt động", "Load more activities") : text("Tải thêm công việc", "Load more tasks")}</Button>}
    {items.length >= 500 && <p role="status">{history ? text("Đã tải tối đa 500 hoạt động.", "500-activity display limit reached.") : text("Đã tải tối đa 500 công việc.", "500-task display limit reached.")}</p>}
    <Button size="sm" variant="secondary" disabled={!data.readable || !supported || query.loading} onClick={() => void entry.refresh()}>{text("Làm mới", "Refresh")}</Button>
    {history && <p className="text-[10px] text-slate-500">{text("Chỉ gồm hoạt động gắn trực tiếp Customer; không suy diễn từ Task, Contact hoặc Organization. Ghi nhận Email/SMS không xác nhận gửi.", "Direct Customer activities only; no inferred Task, Contact or Organization history. Email/SMS logs do not confirm delivery.")}</p>}
  </section>;
}

export function CustomerWorkActions({ controller }: { controller: CustomerWorkController }) {
  const { locale } = useI18n();
  const vi = locale === "vi";
  return <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
    <Button size="sm" variant="secondary" data-guidance-id="customers.detail.create-task" disabled={!controller.canCreateTask} onClick={controller.openTask}>{vi ? "Tạo công việc" : "Create task"}</Button>
    <Button size="sm" variant="secondary" data-guidance-id="customers.detail.meeting" disabled={!controller.meeting.canCreate} onClick={controller.meeting.open}>{vi ? "Tạo cuộc hẹn" : "Create meeting"}</Button>
    {controller.taskCreated && <p role="status">{vi ? "Đã tạo công việc." : "Task created."}</p>}
  </div>;
}

/** Render once per Customer even when both work surfaces are visible. */
export function CustomerWorkDialogs({ customerId, customerLabel, controller }: { customerId: string; customerLabel: string; controller: CustomerWorkController }) {
  const { locale } = useI18n();
  const vi = locale === "vi";
  const { timeZone } = useWorkspaceRuntimeSettings();
  const { selected, meeting } = controller;
  return <><TaskCreateModal key={customerId} targetId={customerId} formId="customer-task-create-form" isOpen={controller.taskOpen && controller.canCreateTask} onClose={controller.closeTask}
    context={{ recordRef: { moduleKey: "customers", recordId: customerId }, sourceRef: { type: "CUSTOMER_360", id: customerId }, label: customerLabel }} onCreated={controller.onTaskCreated}/>
    <MeetingActivityCreateModal targetId={customerId} recordingOnly guardChanges isOpen={meeting.isOpen} onClose={meeting.close} formId="customer-meeting-form" defaults={{ reminder: false }} onSubmit={async () => {}} onSave={meeting.save}/>
    <Modal isOpen={Boolean(selected)} onClose={() => controller.selectActivity(undefined)} title={vi ? "Chi tiết hoạt động" : "Activity detail"} size="sm">{selected && <article className="space-y-3 text-sm [overflow-wrap:anywhere]"><h3>{selected.subject}</h3><time dateTime={selected.occurredAt}>{formatDateTime(selected.occurredAt, locale, { timeZone }) || "—"}</time><p>{resolveWorkspaceMemberLabel(selected.actorId, vi ? "vi" : "en")}</p><p className="whitespace-pre-wrap">{selected.body}</p></article>}</Modal>
  </>;
}
