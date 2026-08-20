import React, { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, ListTodo, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/shared/components/ui";
import { ModulePageShell } from "@/components/crm/ModulePageShell";
import { toWorkspacePath } from "@/platform/navigation";
import { useI18n } from "@/i18n";
import { getTaskActivitySnapshot, subscribeToTaskActivity, useTasksAuthoritative, type Task } from "@/modules/tasks";
import { useSubscribableSnapshot } from "@/platform/react";
import { getAuthSessionSnapshot } from "@/platform/identity-auth";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function dateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthGrid(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(first.getFullYear(), first.getMonth(), first.getDate() - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => new Date(gridStart.getTime() + index * DAY_MS));
}

const priorityTone: Record<Task["priority"], string> = {
  LOW: "border-slate-200 bg-slate-50 text-slate-600",
  NORMAL: "border-indigo-200 bg-indigo-50 text-indigo-700",
  HIGH: "border-amber-200 bg-amber-50 text-amber-700",
  URGENT: "border-rose-200 bg-rose-50 text-rose-700",
};

export const WorkCalendarPage: React.FC = () => {
  const navigate = useNavigate();
  const { locale } = useI18n();
  const vi = locale === "vi";
  const workspace = useWorkspaceContextSnapshot();
  useTasksAuthoritative();
  const snapshot = useSubscribableSnapshot(getTaskActivitySnapshot, subscribeToTaskActivity);
  const currentMemberId = getAuthSessionSnapshot()?.principal.memberId;
  const assignedTasks = useMemo(() => currentMemberId ? snapshot.tasks.filter((task) => task.assigneeId === currentMemberId) : snapshot.tasks, [currentMemberId, snapshot.tasks]);
  const today = useMemo(() => startOfDay(new Date()), []);
  const [monthAnchor, setMonthAnchor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(today);

  const days = useMemo(() => monthGrid(monthAnchor), [monthAnchor]);
  const tasksByDate = useMemo(() => {
    const grouped = new Map<string, Task[]>();
    for (const task of assignedTasks) {
      const key = dateKey(new Date(task.dueAt));
      grouped.set(key, [...(grouped.get(key) ?? []), task]);
    }
    for (const tasks of grouped.values()) tasks.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    return grouped;
  }, [assignedTasks]);

  const selectedTasks = tasksByDate.get(dateKey(selectedDate)) ?? [];
  const openCount = assignedTasks.filter((task) => task.status === "OPEN").length;
  const overdueCount = assignedTasks.filter((task) => task.status === "OPEN" && new Date(task.dueAt) < new Date()).length;
  const currentMonthCount = assignedTasks.filter((task) => {
    const due = new Date(task.dueAt);
    return due.getFullYear() === monthAnchor.getFullYear() && due.getMonth() === monthAnchor.getMonth();
  }).length;

  const monthTitle = monthAnchor.toLocaleDateString(vi ? "vi-VN" : "en-US", { month: "long", year: "numeric" });
  const weekdayLabels = vi ? ["T2", "T3", "T4", "T5", "T6", "T7", "CN"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const goToTask = (task: Task) => {
    navigate(toWorkspacePath(workspace.workspaceKey, "crm", `tasks/${task.id}`));
  };

  const moveMonth = (offset: number) => {
    setMonthAnchor((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  const resetToday = () => {
    setMonthAnchor(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today);
  };

  return (
    <ModulePageShell id="work-calendar-page">
      <PageHeader
        title={vi ? "Lịch làm việc" : "Work Calendar"}
        icon={<CalendarDays size={18} />}
        actions={(
          <button type="button" onClick={resetToday} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">
            <RotateCcw size={14} /> {vi ? "Hôm nay" : "Today"}
          </button>
        )}
      />

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <span className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">{vi ? "Đang mở" : "Open"} <strong className="ml-1 text-slate-950">{openCount}</strong></span>
        <span className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{vi ? "Quá hạn" : "Overdue"} <strong className="ml-1">{overdueCount}</strong></span>
        <span className="rounded-xl bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700">{vi ? "Trong tháng" : "This month"} <strong className="ml-1">{currentMonthCount}</strong></span>
        <button type="button" onClick={() => navigate(toWorkspacePath(workspace.workspaceKey, "crm", "tasks?view=mine"))} className="ml-auto rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">{vi ? "Mở chế độ Của tôi" : "Open Mine view"}</button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <button type="button" onClick={() => moveMonth(-1)} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" aria-label={vi ? "Tháng trước" : "Previous month"}><ChevronLeft size={16} /></button>
            <h2 className="text-sm font-black capitalize text-slate-900">{monthTitle}</h2>
            <button type="button" onClick={() => moveMonth(1)} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" aria-label={vi ? "Tháng sau" : "Next month"}><ChevronRight size={16} /></button>
          </div>

          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
            {weekdayLabels.map((day) => <div key={day} className="px-2 py-2 text-center text-[10px] font-black uppercase tracking-wider text-slate-400">{day}</div>)}
          </div>

          <div className="grid grid-cols-7">
            {days.map((day) => {
              const key = dateKey(day);
              const tasks = tasksByDate.get(key) ?? [];
              const isCurrentMonth = day.getMonth() === monthAnchor.getMonth();
              const isToday = key === dateKey(today);
              const isSelected = key === dateKey(selectedDate);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDate(day)}
                  className={`min-h-24 border-b border-r border-slate-100 p-2 text-left transition-colors hover:bg-indigo-50/40 ${!isCurrentMonth ? "bg-slate-50/50 text-slate-300" : "text-slate-700"} ${isSelected ? "bg-indigo-50 ring-1 ring-inset ring-indigo-300" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[11px] font-black ${isToday ? "bg-indigo-600 text-white" : ""}`}>{day.getDate()}</span>
                    {tasks.length > 0 && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">{tasks.length}</span>}
                  </div>
                  <div className="mt-2 space-y-1">
                    {tasks.slice(0, 2).map((task) => (
                      <div key={task.id} className={`crm-text-wrap rounded border px-1.5 py-1 text-[9px] font-bold ${priorityTone[task.priority]}`}>{task.title}</div>
                    ))}
                    {tasks.length > 2 && <div className="text-[9px] font-bold text-slate-400">+{tasks.length - 2} {vi ? "công việc" : "more"}</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-4">
            <div className="text-[10px] font-black uppercase tracking-wider text-indigo-600">{vi ? "LỊCH TRONG NGÀY" : "DAY AGENDA"}</div>
            <h2 className="mt-1 text-sm font-black text-slate-900">{selectedDate.toLocaleDateString(vi ? "vi-VN" : "en-US", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}</h2>
          </div>
          <div className="p-3">
            {selectedTasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                <CalendarDays size={24} className="mx-auto text-slate-300" />
                <p className="mt-2 text-xs font-bold text-slate-600">{vi ? "Không có công việc đến hạn" : "No work due"}</p>
                <p className="mt-1 text-[10px] text-slate-400">{vi ? "Chọn ngày khác hoặc tạo công việc mới trong mục Công việc." : "Choose another date or create a task from Tasks."}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedTasks.map((task) => (
                  <button key={task.id} type="button" onClick={() => goToTask(task)} className="w-full rounded-xl border border-slate-200 p-3 text-left hover:border-indigo-200 hover:bg-indigo-50/40">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="crm-text-wrap text-xs font-black text-slate-900">{task.title}</div>
                        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-500"><Clock3 size={11} />{new Date(task.dueAt).toLocaleTimeString(vi ? "vi-VN" : "en-US", { hour: "2-digit", minute: "2-digit" })}</div>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-black ${priorityTone[task.priority]}`}>{task.priority}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-slate-500"><ListTodo size={11} />{task.status === "OPEN" ? (vi ? "Đang mở" : "Open") : task.status === "COMPLETED" ? (vi ? "Đã hoàn thành" : "Completed") : (vi ? "Đã hủy" : "Cancelled")}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </ModulePageShell>
  );
};
