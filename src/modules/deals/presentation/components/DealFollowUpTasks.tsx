import React from "react";
import { useNavigate } from "react-router-dom";
import { toWorkspacePath } from "@/platform/navigation/canonicalRoutes";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { Button } from "@/shared/components/ui";
import { TaskCreateModal, type Task } from "@/modules/tasks";
import type { Deal } from "../../domain/model/deal.types";
import { useDealFollowUpTasks } from "../hooks/useDealFollowUpTasks";

export function DealFollowUpTasks({ deal, locale }: { deal: Deal; locale: "vi" | "en" }) {
  const query = useDealFollowUpTasks(deal.id, locale);
  return <DealFollowUpSession key={JSON.stringify([query.authority, deal.id])} deal={deal} locale={locale} query={query} />;
}
function DealFollowUpSession({ deal, locale, query }: { deal: Deal; locale: "vi" | "en"; query: ReturnType<typeof useDealFollowUpTasks> }) {
  const vi = locale === "vi"; const navigate = useNavigate();
  const workspace = useWorkspaceContextSnapshot();
  const [open, setOpen] = React.useState(false);
  const [created, setCreated] = React.useState<Task>();
  const openTask = (id: string) => navigate(toWorkspacePath(workspace.workspaceKey, "crm", `tasks/${encodeURIComponent(id)}`));
  return <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3" data-guidance="deals.detail.follow-up" data-deal-follow-up={deal.id}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-semibold">{vi ? "Công việc theo dõi" : "Follow-up tasks"}</h3>
      {query.canCreate && !deal.archivedAt && <Button type="button" size="sm" onClick={() => setOpen(true)}>{vi ? "Tạo công việc theo dõi" : "Create follow-up task"}</Button>}
    </div>
    {created && <div role="status" className="rounded-lg bg-emerald-50 p-3">
      <p>{vi ? "Công việc đã được lưu." : "Task was saved."}</p>
      <button type="button" onClick={() => openTask(created.id)} className="font-semibold underline">{vi ? "Mở công việc" : "Open task"}: {created.title}</button>
    </div>}
    {!query.enabled ? <p>{vi ? "Bạn không có quyền xem công việc liên quan." : "You cannot read related tasks."}</p>
      : query.loading ? <p role="status">{vi ? "Đang tải công việc…" : "Loading tasks…"}</p>
      : query.error ? <div role="alert"><p>{query.error}</p><Button type="button" size="sm" onClick={query.reload}>{vi ? "Thử tải lại" : "Retry loading"}</Button></div>
      : query.tasks.length === 0 ? <p>{vi ? "Chưa có công việc liên quan." : "No related tasks."}</p>
      : <ul className="divide-y divide-slate-100">{query.tasks.map(task => <li key={task.id} className="py-2" data-related-task-id={task.id}>
        <button type="button" onClick={() => openTask(task.id)} className="font-semibold text-indigo-700">{task.title}</button>
        <p className="text-xs text-slate-500">{task.status} · {task.dueAt} · {task.assigneeId}</p>
      </li>)}</ul>}
    {query.enabled && !query.loading && <div className="flex gap-2">
      <Button type="button" size="sm" variant="secondary" onClick={query.reload}>{vi ? "Làm mới" : "Refresh"}</Button>
      {query.next && <Button type="button" size="sm" onClick={query.nextPage}>{vi ? "Trang tiếp" : "Next page"}</Button>}
    </div>}
    <TaskCreateModal isOpen={open && query.canCreate} onClose={() => setOpen(false)} targetId={deal.id}
      formId="deal-follow-up-task-form" title={vi ? "Tạo công việc theo dõi" : "Create follow-up task"}
      context={{ recordRef: { moduleKey: "deals", recordId: deal.id }, label: query.deal?.name ?? deal.id }}
      defaults={{ assigneeId: query.deal?.ownerId ?? "" }} onCreated={task => { setCreated(task); query.reload(); }} />
  </section>;
}
