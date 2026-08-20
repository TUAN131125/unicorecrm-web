import React, { useMemo, useState } from "react";
import { AuthoritativeQueryNotice } from "@/shared/operations";
import { useTasksAuthoritative } from "../hooks/useTasksAuthoritative";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarDays, CheckCircle2, Clock3, ListTodo, Plus, Archive, UserRound, XCircle } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useI18n } from "@/i18n";
import { getContactsSnapshot, subscribeToContacts } from "@/modules/contacts";
import { getOrganizationAccountsSnapshot, subscribeToOrganizationAccounts } from "@/modules/organizations";
import { ListPageFrame, ListPageHeader, ListPaginationBar, ListStatePanel, ListToolbar, useListPagination } from "@/components/crm/list-archetype";
import { Button, ConfirmDialog, IconButton, SearchableSelect } from "@/shared/components/ui";
import { OperationFilterPopover, OperationSavedViews } from "@/components/crm/operations";
import { useEffectiveAccess } from "@/platform/access-control";
import { useSubscribableSnapshot } from "@/platform/react";
import { getAuthSessionSnapshot } from "@/platform/identity-auth";
import { resolveWorkspaceMemberName } from "@/platform/member-directory";
import { TaskCreateModal } from "../components/TaskCreateModal";
import { resolveTaskContextLabel } from "../model/taskContextPresentation";
import { archiveTaskCommand, cancelTaskCommand, completeTaskCommand, getTaskActivitySnapshot, queryTaskSnapshot, subscribeToTaskActivity, type Task, type TaskPriority, type TaskStatus } from "../../public/api";

type TaskSavedView = "all" | "my_open" | "today" | "overdue" | "high" | "unassigned" | "completed";
type DisplayMode = "table" | "cards";

const badgeClass: Record<string, string> = {
  OPEN: "bg-blue-50 text-blue-700 border-blue-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-slate-100 text-slate-600 border-slate-200",
  LOW: "bg-slate-100 text-slate-600 border-slate-200",
  NORMAL: "bg-indigo-50 text-indigo-700 border-indigo-200",
  HIGH: "bg-amber-50 text-amber-700 border-amber-200",
  URGENT: "bg-rose-50 text-rose-700 border-rose-200",
};

const statusLabel = (status: TaskStatus, vi: boolean) => status === "OPEN" ? (vi ? "Đang mở" : "Open") : status === "COMPLETED" ? (vi ? "Đã hoàn thành" : "Completed") : (vi ? "Đã hủy" : "Cancelled");
const priorityLabel = (priority: TaskPriority, vi: boolean) => priority === "LOW" ? (vi ? "Thấp" : "Low") : priority === "NORMAL" ? (vi ? "Bình thường" : "Normal") : priority === "HIGH" ? (vi ? "Cao" : "High") : (vi ? "Khẩn cấp" : "Urgent");

function isToday(value: string) {
  return new Date(value).toDateString() === new Date().toDateString();
}
function isOverdue(task: Task) {
  return task.status === "OPEN" && new Date(task.dueAt).getTime() < Date.now() && !isToday(task.dueAt);
}

export const TaskListPage: React.FC = () => {
  const taskQuery = useTasksAuthoritative();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { locale } = useI18n();
  const vi = locale === "vi";
  const reduceMotion = useReducedMotion();
  const access = useEffectiveAccess();
  const snapshot = useSubscribableSnapshot(getTaskActivitySnapshot, subscribeToTaskActivity);
  const contacts = useSubscribableSnapshot(getContactsSnapshot, subscribeToContacts);
  const organizations = useSubscribableSnapshot(getOrganizationAccountsSnapshot, subscribeToOrganizationAccounts);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<TaskSavedView>(() => searchParams.get("view") === "mine" ? "my_open" : "all");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("table");
  const [filterOpen, setFilterOpen] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "ALL">("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState("ALL");
  const [showCreate, setShowCreate] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

  const currentMemberId = getAuthSessionSnapshot()?.principal.memberId || access.memberId || access.accountId || "current-user";
  const allTasks = useMemo(() => queryTaskSnapshot({ search }), [snapshot, search]);
  const owners = useMemo(() => Array.from(new Set(snapshot.tasks.map((task) => task.assigneeId).filter(Boolean))).sort(), [snapshot.tasks]);
  const filteredTasks = useMemo(() => allTasks
    .filter((task) => priorityFilter === "ALL" || task.priority === priorityFilter)
    .filter((task) => assigneeFilter === "ALL" || task.assigneeId === assigneeFilter)
    .filter((task) => {
      if (view === "all") return true;
      if (view === "my_open") return task.status === "OPEN" && task.assigneeId === currentMemberId;
      if (view === "today") return task.status === "OPEN" && isToday(task.dueAt);
      if (view === "overdue") return isOverdue(task);
      if (view === "high") return task.status === "OPEN" && ["HIGH", "URGENT"].includes(task.priority);
      if (view === "unassigned") return task.status === "OPEN" && (!task.assigneeId || task.assigneeId === "unassigned");
      if (view === "completed") return task.status === "COMPLETED";
      return true;
    }), [allTasks, priorityFilter, assigneeFilter, view, currentMemberId]);

  const pagination = useListPagination(filteredTasks, 25);

  const canCreate = access.canPerform("tasks", "create");
  const canComplete = access.canPerform("tasks", "complete");
  const canUpdate = access.canPerform("tasks", "update");
  const actorId = currentMemberId;

  const savedViews = useMemo(() => {
    const open = snapshot.tasks.filter((task) => task.status === "OPEN");
    return [
      { key: "all", label: vi ? "Tất cả" : "All", count: snapshot.tasks.length, tone: "slate" as const },
      { key: "my_open", label: vi ? "Của tôi" : "Mine", count: open.filter((task) => task.assigneeId === currentMemberId).length, tone: "sky" as const },
      { key: "today", label: vi ? "Hôm nay" : "Today", count: open.filter((task) => isToday(task.dueAt)).length, tone: "emerald" as const },
      { key: "overdue", label: vi ? "Quá hạn" : "Overdue", count: open.filter(isOverdue).length, tone: "rose" as const },
      { key: "high", label: vi ? "Ưu tiên cao" : "High priority", count: open.filter((task) => ["HIGH", "URGENT"].includes(task.priority)).length, tone: "amber" as const },
      { key: "unassigned", label: vi ? "Chưa giao" : "Unassigned", count: open.filter((task) => !task.assigneeId || task.assigneeId === "unassigned").length, tone: "slate" as const },
      { key: "completed", label: vi ? "Đã hoàn thành" : "Completed", count: snapshot.tasks.filter((task) => task.status === "COMPLETED").length, tone: "emerald" as const },
    ];
  }, [snapshot.tasks, currentMemberId, vi]);

  const changeView = (nextView: TaskSavedView) => {
    setView(nextView);
    const next = new URLSearchParams(searchParams);
    if (nextView === "my_open") next.set("view", "mine");
    else next.delete("view");
    setSearchParams(next, { replace: true });
  };

  const complete = async (task: Task) => {
    try {
      await completeTaskCommand(task.id, { actorId, actorName: getAuthSessionSnapshot()?.principal.displayName || actorId, outcome: vi ? "Hoàn thành từ danh sách Công việc" : "Completed from Task workspace" });
      setMessageTone("success");
      setMessage(vi ? "Đã hoàn thành công việc." : "Task completed.");
    } catch (error) {
      setMessageTone("error");
      setMessage(vi ? "Chưa thể hoàn thành thao tác. Dữ liệu hiện tại vẫn được giữ. Hãy thử lại." : "The action could not be completed. Your current data is unchanged. Please try again.");
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await archiveTaskCommand(deleteTarget.id, { actorId, actorName: getAuthSessionSnapshot()?.principal.displayName || actorId, reason: vi ? "Lưu trữ từ danh sách Công việc." : "Archived from Task workspace." });
      setMessageTone("success");
      setMessage(vi ? "Đã lưu trữ công việc; lịch sử vẫn được giữ lại." : "Task archived; history was retained.");
      setDeleteTarget(null);
    } catch (error) {
      setMessageTone("error");
      setMessage(vi ? "Chưa thể hoàn thành thao tác. Dữ liệu hiện tại vẫn được giữ. Hãy thử lại." : "The action could not be completed. Your current data is unchanged. Please try again.");
    }
  };

  const cancel = async (task: Task) => {
    try {
      await cancelTaskCommand(task.id, { actorId, actorName: getAuthSessionSnapshot()?.principal.displayName || actorId, reason: vi ? "Đã hủy từ danh sách Công việc" : "Cancelled from Task workspace" });
      setMessageTone("success");
      setMessage(vi ? "Đã hủy công việc." : "Task cancelled.");
    } catch (error) {
      setMessageTone("error");
      setMessage(vi ? "Chưa thể hoàn thành thao tác. Dữ liệu hiện tại vẫn được giữ. Hãy thử lại." : "The action could not be completed. Your current data is unchanged. Please try again.");
    }
  };

  const renderCard = (task: Task) => {
    const overdue = isOverdue(task);
    const context = resolveTaskContextLabel(task, contacts, organizations) || (vi ? "Không gắn bản ghi" : "No related record");
    return (
      <motion.article
        key={task.id}
        layout
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
        className="group min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <button type="button" onClick={() => navigate(task.id)} className="block max-w-full break-words text-left text-sm font-semibold leading-5 text-slate-950 hover:text-indigo-700 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [overflow-wrap:anywhere]">{task.title}</button>
            <div className="mt-1 crm-text-wrap break-words text-[11px] font-semibold text-slate-500 [overflow-wrap:anywhere]">{context}</div>
          </div>
          <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${badgeClass[task.priority]}`}>{priorityLabel(task.priority, vi)}</span>
        </div>
        {task.description && <p className="mt-3 crm-text-wrap break-words text-xs text-slate-500 [overflow-wrap:anywhere]">{task.description}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-3">
          <div className={`inline-flex items-center gap-1.5 text-xs font-medium ${overdue ? "text-rose-600" : "text-slate-600"}`}><Clock3 size={13} /><span>{new Date(task.dueAt).toLocaleString(vi ? "vi-VN" : "en-US")}</span></div>
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600"><UserRound size={13} /><span className="crm-text-wrap">{resolveWorkspaceMemberName(task.assigneeId)}</span></div>
          <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${badgeClass[task.status]}`}>{statusLabel(task.status, vi)}</span>
        </div>
        {<div className="mt-4 flex flex-wrap justify-end gap-2">{task.status === "OPEN" && canComplete && <Button type="button" actionIntent="complete" size="sm" icon={<CheckCircle2 size={14} />} className="text-white [&_svg]:stroke-white" onClick={() => void complete(task)}>{vi ? "Hoàn thành" : "Complete"}</Button>}{task.status === "OPEN" && canUpdate && <Button type="button" actionIntent="destructive" size="sm" icon={<XCircle size={14} />} className="text-white [&_svg]:stroke-white" onClick={() => void cancel(task)}>{vi ? "Hủy" : "Cancel"}</Button>}{canUpdate && <Button type="button" actionIntent="destructive" size="sm" icon={<Archive size={14} />} className="text-white [&_svg]:stroke-white" onClick={() => setDeleteTarget(task)}>{vi ? "Lưu trữ" : "Archive"}</Button>}</div>}
      </motion.article>
    );
  };

  return (
    <><AuthoritativeQueryNotice connected={taskQuery.connected} loading={taskQuery.loading} refreshing={taskQuery.refreshing} stale={taskQuery.stale} loadedAt={taskQuery.loadedAt} error={taskQuery.error} onRefresh={() => void taskQuery.refresh()} compact /><ListPageFrame id="task-list-page">
      <ListPageHeader
        title={vi ? "Công việc" : "Tasks"}
        count={filteredTasks.length}
        context={vi ? "Theo dõi công việc, thời hạn và người phụ trách tại một nơi." : "Track work, due dates, and owners in one place."}
        icon={<ListTodo size={20} />}
        actions={<div className="flex flex-wrap gap-2"><Button type="button" actionIntent="navigate" size="sm" icon={<CalendarDays size={15} />} className="h-9 rounded-xl" onClick={() => navigate("../calendar")}>{vi ? "Xem lịch" : "Calendar"}</Button>{canCreate && <Button type="button" actionIntent="create" size="sm" icon={<Plus size={15} />} className="h-9 rounded-xl" onClick={() => setShowCreate(true)}>{vi ? "Tạo công việc" : "Create Task"}</Button>}</div>}
      />

      {message && <div className={`rounded-xl border px-4 py-3 text-xs font-semibold ${messageTone === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{message}</div>}
      <OperationSavedViews items={savedViews} activeKey={view} onChange={(key) => changeView(key as TaskSavedView)} title={vi ? "Hàng đợi" : "Views"} />

      <ListToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={vi ? "Tìm theo tên công việc, khách hàng hoặc người phụ trách..." : "Search by task, customer, or assignee..."}
        viewMode={displayMode === "cards" ? "card" : "table"}
        onViewModeChange={(mode) => setDisplayMode(mode === "card" ? "cards" : "table")}
        viewOptions={[
          { value: "table", label: vi ? "Dạng bảng" : "Table view" },
          { value: "card", label: vi ? "Dạng thẻ" : "Card view" },
        ]}
        showFilters
        onOpenFilters={() => setFilterOpen((open) => !open)}
        onCloseFilters={() => setFilterOpen(false)}
        filtersOpen={filterOpen}
        activeFilterCount={(priorityFilter !== "ALL" ? 1 : 0) + (assigneeFilter !== "ALL" ? 1 : 0)}
        hasActiveFilters={priorityFilter !== "ALL" || assigneeFilter !== "ALL"}
        filtersLabel={vi ? "Bộ lọc" : "Filters"}
        filtersPanel={(
          <OperationFilterPopover
            isOpen={filterOpen}
            onClose={() => setFilterOpen(false)}
            onReset={() => { setPriorityFilter("ALL"); setAssigneeFilter("ALL"); }}
            title={vi ? "Bộ lọc Công việc" : "Task filters"}
            resetLabel={vi ? "Đặt lại" : "Reset"}
            doneLabel={vi ? "Hoàn tất" : "Done"}
          >
            <label className="block">
              <span className="text-[10px] font-semibold uppercase text-slate-400">{vi ? "Ưu tiên" : "Priority"}</span>
              <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as TaskPriority | "ALL")} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <option value="ALL">{vi ? "Tất cả" : "All"}</option>
                <option value="LOW">{vi ? "Thấp" : "Low"}</option>
                <option value="NORMAL">{vi ? "Bình thường" : "Normal"}</option>
                <option value="HIGH">{vi ? "Cao" : "High"}</option>
                <option value="URGENT">{vi ? "Khẩn cấp" : "Urgent"}</option>
              </select>
            </label>
            <SearchableSelect label={vi ? "Người phụ trách" : "Assignee"} value={assigneeFilter} onChange={setAssigneeFilter} clearable={false} placeholder={vi ? "Tất cả" : "All"} searchPlaceholder={vi ? "Tìm nhân viên..." : "Search members..."} options={[{ value: "ALL", label: vi ? "Tất cả" : "All" }, ...owners.map((owner) => ({ value: owner, label: resolveWorkspaceMemberName(owner) || owner }))]} />
          </OperationFilterPopover>
        )}
      />

      {filteredTasks.length === 0 ? <ListStatePanel kind="empty" title={vi ? "Không có công việc phù hợp" : "No tasks match this view"} /> : displayMode === "cards" ? (
        <div className="grid gap-3 lg:grid-cols-2"><AnimatePresence>{pagination.pageItems.map(renderCard)}</AnimatePresence></div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">{vi ? "Công việc" : "Task"}</th><th className="px-4 py-3">{vi ? "Hạn" : "Due"}</th><th className="px-4 py-3">{vi ? "Phụ trách" : "Assignee"}</th><th className="px-4 py-3">{vi ? "Ưu tiên" : "Priority"}</th><th className="px-4 py-3">{vi ? "Trạng thái" : "Status"}</th><th className="px-4 py-3 text-right">{vi ? "Thao tác" : "Actions"}</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{pagination.pageItems.map((task) => <tr key={task.id} className="hover:bg-slate-50/70"><td className="px-4 py-3"><button type="button" onClick={() => navigate(task.id)} className="block max-w-[360px] break-words text-left font-medium text-slate-900 hover:text-indigo-700 [overflow-wrap:anywhere]">{task.title}</button><div className="mt-1 max-w-[360px] break-words text-[11px] text-slate-500 [overflow-wrap:anywhere]">{resolveTaskContextLabel(task, contacts, organizations) || (vi ? "Không gắn bản ghi" : "No related record")}</div></td><td className={`px-4 py-3 font-semibold ${isOverdue(task) ? "text-rose-600" : "text-slate-600"}`}>{new Date(task.dueAt).toLocaleString(vi ? "vi-VN" : "en-US")}</td><td className="px-4 py-3 text-slate-600">{resolveWorkspaceMemberName(task.assigneeId)}</td><td className="px-4 py-3"><span className={`rounded-full border px-2 py-1 font-medium ${badgeClass[task.priority]}`}>{priorityLabel(task.priority, vi)}</span></td><td className="px-4 py-3"><span className={`rounded-full border px-2 py-1 font-medium ${badgeClass[task.status]}`}>{statusLabel(task.status, vi)}</span></td><td className="px-4 py-3"><div className="flex justify-end gap-2">{task.status === "OPEN" && <>{canComplete && <IconButton type="button" variant="success" size="xs" className="text-white [&_svg]:stroke-white" onClick={() => void complete(task)} title={vi ? "Hoàn thành" : "Complete"}><CheckCircle2 size={15} /></IconButton>}{canUpdate && <IconButton type="button" variant="danger" size="xs" className="text-white [&_svg]:stroke-white" onClick={() => void cancel(task)} title={vi ? "Hủy" : "Cancel"}><XCircle size={15} /></IconButton>}</>}{canUpdate && <IconButton type="button" variant="danger" size="xs" className="text-white [&_svg]:stroke-white" onClick={() => setDeleteTarget(task)} title={vi ? "Lưu trữ công việc" : "Archive task"}><Archive size={15} /></IconButton>}</div></td></tr>)}</tbody>
            </table>
          </div>
        </div>
      )}
      {filteredTasks.length > 0 ? <ListPaginationBar {...pagination} itemLabelVi="công việc" itemLabelEn="tasks" /> : null}


      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        title={vi ? "Lưu trữ công việc" : "Archive task"}
        message={deleteTarget ? (vi ? `Lưu trữ “${deleteTarget.title}”? Hồ sơ và lịch sử vẫn được giữ lại.` : `Archive “${deleteTarget.title}”? The record and history will be retained.`) : undefined}
        confirmText={vi ? "Lưu trữ công việc" : "Archive task"}
        cancelText={vi ? "Quay lại" : "Go back"}
        variant="danger"
      />

      <TaskCreateModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        defaults={{ assigneeId: actorId }}
        onCreated={(task) => {
          changeView(task.assigneeId === currentMemberId ? "my_open" : "all");
          setMessageTone("success");
          setMessage(vi ? "Đã tạo công việc. Công việc được giao cho bạn sẽ xuất hiện trong Của tôi và Lịch làm việc." : "Task created. Tasks assigned to you will appear in My tasks and Work calendar.");
        }}
        onError={() => setMessageTone("error")}
      />
    </ListPageFrame>
  </>);
};
