import React from "react";
import { useNavigate } from "react-router-dom";
import { toWorkspacePath } from "@/platform/navigation/canonicalRoutes";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { Button } from "@/shared/components/ui";
import { TaskCreateModal, type Task } from "@/modules/tasks";
import type { Deal } from "../../domain/model/deal.types";
import { useDealFollowUpTasks } from "../hooks/useDealFollowUpTasks";
import { formatDateTime } from "@/shared/lib/format/date";
import { resolveWorkspaceMemberLabel } from "@/platform/member-directory";
import { useWorkspaceRuntimeSettings } from "@/platform/workspace-config";

export function DealFollowUpTasks({ deal, locale, compact = false }: { deal: Deal; locale: "vi" | "en"; compact?: boolean }) {
  const query = useDealFollowUpTasks(deal.id, locale);
  return <DealFollowUpSession key={JSON.stringify([query.authority, deal.id])} deal={deal} locale={locale} query={query} compact={compact} />;
}
function DealFollowUpSession({ deal, locale, query, compact }: { deal: Deal; locale: "vi" | "en"; query: ReturnType<typeof useDealFollowUpTasks>; compact: boolean }) {
  const vi = locale === "vi"; const navigate = useNavigate();
  const workspace = useWorkspaceContextSnapshot();
  const { timeZone } = useWorkspaceRuntimeSettings();
  const [open, setOpen] = React.useState(false);
  const [created, setCreated] = React.useState<Task>();
  const priorityLabel: Record<Task["priority"], string> = { LOW: vi ? "Thấp" : "Low", NORMAL: vi ? "Bình thường" : "Normal", HIGH: vi ? "Cao" : "High", URGENT: vi ? "Khẩn cấp" : "Urgent" };
  const openTask = (id: string) => navigate(toWorkspacePath(workspace.workspaceKey, "crm", `tasks/${encodeURIComponent(id)}`));
  return <section className={compact ? "space-y-3 border-t border-slate-100 pt-3" : "space-y-3"} data-guidance="deals.detail.follow-up" data-deal-follow-up={deal.id}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      {!compact && <h3 className="text-base font-semibold text-slate-900">{vi ? "Công việc theo dõi" : "Follow-up tasks"}</h3>}
      {query.canCreate && !deal.archivedAt && <Button type="button" size="sm" onClick={() => setOpen(true)}>{vi ? "Tạo công việc theo dõi" : "Create follow-up task"}</Button>}
    </div>
    {created && <div role="status" className="rounded-lg bg-emerald-50 p-3">
      <p>{vi ? "Công việc đã được lưu." : "Task was saved."}</p>
      <button type="button" onClick={() => openTask(created.id)} className="max-w-full break-words text-left font-semibold underline">{vi ? "Mở công việc" : "Open task"}: {created.title}</button>
    </div>}
    {!query.enabled ? <p>{vi ? "Bạn không có quyền xem công việc liên quan." : "You cannot read related tasks."}</p>
      : query.loading ? <p role="status">{vi ? "Đang tải công việc…" : "Loading tasks…"}</p>
      : query.error ? <div role="alert"><p>{query.error}</p><Button type="button" size="sm" onClick={query.reload}>{vi ? "Thử tải lại" : "Retry loading"}</Button></div>
      : query.tasks.length === 0 ? <p>{vi ? "Chưa có công việc liên quan." : "No related tasks."}</p>
      : <ul className="divide-y divide-slate-100">{(compact ? query.tasks.slice(0, 1) : query.tasks).map(task => <li key={task.id} className="py-2" data-related-task-id={task.id}>
        <button type="button" onClick={() => openTask(task.id)} className="max-w-full break-words text-left font-semibold text-indigo-700">{task.title}</button>
        <p className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-slate-500"><span>{task.status === "COMPLETED" ? (vi ? "Hoàn thành" : "Done") : task.status === "CANCELLED" ? (vi ? "Đã hủy" : "Canceled") : (vi ? "Chưa hoàn thành" : "Open")}</span><span data-task-priority={task.priority}>{vi ? "Ưu tiên" : "Priority"}: {priorityLabel[task.priority]}</span><time dateTime={task.dueAt}>{formatDateTime(task.dueAt, locale, { timeZone }) || (vi ? "Thời hạn chưa khả dụng" : "Due time unavailable")}</time><span>{resolveWorkspaceMemberLabel(task.assigneeId, locale)}</span></p>
      </li>)}</ul>}
    {query.enabled && !query.loading && <div className="flex gap-2">
      <Button type="button" size="sm" variant="secondary" onClick={query.reload}>{vi ? "Làm mới" : "Refresh"}</Button>
      {!compact && query.next && <Button type="button" size="sm" onClick={query.nextPage}>{vi ? "Trang tiếp" : "Next page"}</Button>}
    </div>}
    <TaskCreateModal isOpen={open && query.canCreate} onClose={() => setOpen(false)} targetId={deal.id}
      formId="deal-follow-up-task-form" title={vi ? "Tạo công việc theo dõi" : "Create follow-up task"}
      context={{ recordRef: { moduleKey: "deals", recordId: deal.id }, label: query.deal?.name ?? deal.id }}
      defaults={{ assigneeId: query.deal?.ownerId ?? "" }} onCreated={task => { setCreated(task); query.reload(); }} />
  </section>;
}
