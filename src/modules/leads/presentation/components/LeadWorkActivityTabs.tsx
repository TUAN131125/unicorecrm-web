import React from "react";
import { Plus } from "lucide-react";
import { Button, EmptyState } from "@/shared/components/ui";
import type { Task } from "@/modules/tasks";
import type { CRMActivity } from "@/shared/domain";

import { resolveWorkspaceMemberName } from "@/platform/member-directory";

interface LeadOpenWorkTabProps {
  locale: string;
  tasks: Task[];
  activities: CRMActivity[];
  onCreateTask(): void;
  onCreateMeeting(): void;
  onOpenTask(task: Task): void;
  onCompleteTask(task: Task): void;
  onCompleteActivity(activity: CRMActivity): void;
}

export const LeadOpenWorkTab: React.FC<LeadOpenWorkTabProps> = ({
  locale,
  tasks,
  activities,
  onCreateTask,
  onCreateMeeting,
  onOpenTask,
  onCompleteTask,
  onCompleteActivity,
}) => {
  const isVi = locale === "vi";

  return (
    <div className="space-y-4">
      <div className="mb-2 flex justify-end gap-2">
        <Button onClick={onCreateTask} actionIntent="create" size="sm" className="min-w-[132px]" icon={<Plus size={14} />}>
          {isVi ? "Thêm công việc" : "Add Task"}
        </Button>
        <Button onClick={onCreateMeeting} actionIntent="create" size="sm" className="min-w-[132px]" icon={<Plus size={14} />}>
          {isVi ? "Thêm lịch hẹn" : "Add Meeting"}
        </Button>
      </div>

      {tasks.length > 0 && (
        <div className="space-y-3 text-left">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-start justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50/30 p-3">
              <button type="button" onClick={() => onOpenTask(task)} className="min-w-0 flex-1 text-left">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded bg-indigo-100 px-2 py-0.5 text-[10px] font-black uppercase text-indigo-700">{isVi ? "Công việc" : "Task"}</span>
                  <span className="text-[10px] font-bold uppercase text-amber-600">{isVi ? "Đang mở" : "Open"}</span>
                </div>
                <p className="mt-1 text-xs font-bold text-slate-800">{task.title}</p>
                {task.description && <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-500">{task.description}</p>}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-semibold text-slate-500">
                  <span>{isVi ? "Phụ trách" : "Assignee"}: {resolveWorkspaceMemberName(task.assigneeId)}</span>
                  <span>{isVi ? "Hạn" : "Due"}: {new Date(task.dueAt).toLocaleString(isVi ? "vi-VN" : "en-US")}</span>
                </div>
              </button>
              <Button onClick={() => onCompleteTask(task)} actionIntent="complete" size="sm" className="min-w-[112px] whitespace-nowrap">
                {isVi ? "Hoàn thành" : "Complete"}
              </Button>
            </div>
          ))}
        </div>
      )}

      {activities.length > 0 && (
        <div className="space-y-3 text-left">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
              <div>
                <span className="mr-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase text-slate-700">
                  {activity.type === "call" ? (isVi ? "Cuộc gọi" : "Call") : (isVi ? "Lịch hẹn" : "Meeting")}
                </span>
                <span className="text-[10px] font-bold uppercase text-amber-600">({isVi ? "Đang thực hiện" : "In Progress"})</span>
                <p className="mt-1 text-xs font-bold text-slate-800">{activity.title}</p>
                <p className="text-[11px] font-medium leading-relaxed text-slate-500">{activity.description}</p>
              </div>
              <Button onClick={() => onCompleteActivity(activity)} actionIntent="complete" size="sm" className="min-w-[112px] whitespace-nowrap">
                {isVi ? "Hoàn thành" : "Complete"}
              </Button>
            </div>
          ))}
        </div>
      )}

      {tasks.length === 0 && activities.length === 0 && (
        <EmptyState
          title={isVi ? "Không có công việc đang mở" : "No open work"}
        />
      )}
    </div>
  );
};

interface LeadCompletedWorkTabProps {
  locale: string;
  tasks: Task[];
  activities: CRMActivity[];
  onOpenTask(task: Task): void;
}

export const LeadCompletedWorkTab: React.FC<LeadCompletedWorkTabProps> = ({
  locale,
  tasks,
  activities,
  onOpenTask,
}) => {
  const isVi = locale === "vi";
  const lt = (viText: string, enText: string) => (isVi ? viText : enText);

  return (
    <div className="space-y-4">
      {tasks.length > 0 && (
        <div className="space-y-3 text-left">
          {tasks.map((task) => (
            <button
              type="button"
              key={task.id}
              onClick={() => onOpenTask(task)}
              className="w-full rounded-xl border border-emerald-100 bg-emerald-50/30 p-3 text-left transition hover:border-emerald-200"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-800">{isVi ? "Công việc" : "Task"}</span>
                <span className="text-[10px] font-bold uppercase text-emerald-600">{task.status === "COMPLETED" ? lt("Đã hoàn thành", "Completed") : lt("Đã hủy", "Cancelled")}</span>
              </div>
              <p className="mt-1 text-xs font-bold text-slate-800">{task.title}</p>
              <div className="mt-2 text-[10px] font-semibold text-slate-500">{resolveWorkspaceMemberName(task.assigneeId)} · {new Date(task.updatedAt).toLocaleString(isVi ? "vi-VN" : "en-US")}</div>
            </button>
          ))}
        </div>
      )}

      {activities.length > 0 && (
        <div className="space-y-3 text-left">
          {activities.map((activity) => (
            <div key={activity.id} className="space-y-1 rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-800">
                  {activity.type === "call" ? lt("Cuộc gọi", "Call") : lt("Lịch hẹn", "Meeting")}
                </span>
                <span className="text-[10px] font-bold uppercase text-emerald-600">({lt("Đã hoàn thành", "Completed")})</span>
                <span className="shrink-0 text-[9px] font-bold text-slate-400">{activity.createdAt}</span>
              </div>
              <p className="mt-1 text-xs font-bold text-slate-800">{activity.title}</p>
              <p className="text-[11px] font-medium text-slate-600">{activity.description}</p>
            </div>
          ))}
        </div>
      )}

      {tasks.length === 0 && activities.length === 0 && (
        <EmptyState
          title={lt("Chưa có công việc đã hoàn thành", "No completed work")}
        />
      )}
    </div>
  );
};
