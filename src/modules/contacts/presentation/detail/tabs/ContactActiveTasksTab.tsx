import React, { useState } from "react";
import { CheckSquare, Calendar, User, CheckCircle2, Clock, Plus } from "lucide-react";
import { useI18n } from "@/i18n";
import { Modal, Button, Input, DetailTabActionButton } from "@/shared/components/ui";
import { RelationshipModuleActions, RelationshipWorkspaceHeader } from "@/components/crm/relationship-detail";

interface TaskMocks {
  id: string;
  title: string;
  dueDate?: string;
  dueTime?: string;
  completedDate?: string;
  status: "pending" | "in_progress" | "completed";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  assignee: string;
  description?: string;
}

interface ContactActiveTasksTabProps {
  tasks: TaskMocks[];
  onCreateTask: () => void;
  onScheduleMeeting: () => void;
  onOpenModule: () => void;
  onCompleteTask: (id: string) => void;
  onRescheduleTask?: (id: string, newDate: string) => void;
  isArchived?: boolean;
  onModalStateChange?: (open: boolean) => void;
}

export const ContactActiveTasksTab: React.FC<ContactActiveTasksTabProps> = ({
  tasks = [],
  onCreateTask,
  onScheduleMeeting,
  onOpenModule,
  onCompleteTask,
  onRescheduleTask,
  isArchived = false,
  onModalStateChange
}) => {
  const { tx } = useI18n();
  const [rescheduleTask, setRescheduleTask] = useState<{ id: string; date: string } | null>(null);

  React.useEffect(() => {
    onModalStateChange?.(rescheduleTask !== null);
    return () => {
      if (rescheduleTask !== null) onModalStateChange?.(false);
    };
  }, [rescheduleTask, onModalStateChange]);

  const activeTasks = tasks.filter(t => t.status !== "completed");

  const getPriorityColor = (p: string) => {
    switch (p.toUpperCase()) {
      case "URGENT": return "text-rose-700 bg-rose-50 border-rose-100";
      case "HIGH": return "text-amber-700 bg-amber-50 border-amber-100";
      case "MEDIUM": return "text-indigo-700 bg-indigo-50 border-indigo-100";
      default: return "text-slate-600 bg-slate-50 border-slate-100";
    }
  };

  const handleReschedule = (tkId: string, currentDueDate?: string) => {
    if (isArchived) return;
    if (!onRescheduleTask) return;
    setRescheduleTask({
      id: tkId,
      date: currentDueDate || new Date().toISOString().split("T")[0]
    });
  };

  return (
    <div id="contact-active-tasks-tab" className="space-y-6 animate-fade-in text-[11px] text-slate-700 text-left">
      
      <RelationshipWorkspaceHeader
        title={`${tx("contactDetail.tabs.activeTasks", "Công việc đang thực hiện")} (${activeTasks.length})`}
        actions={<RelationshipModuleActions secondaryLabel={tx("contactDetail.tasks.openModule", "Mở Công việc")} primaryLabel={!isArchived ? tx("contactDetail.tasks.actions.create", "Tạo công việc") : undefined} onSecondary={onOpenModule} onPrimary={!isArchived ? onCreateTask : undefined} />}
      />

      {activeTasks.length === 0 ? (
        <div className="flex min-h-[160px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-xs text-slate-400">
          <CheckSquare size={24} className="mb-2 text-slate-300" />
          <span className="font-semibold">{tx("contactDetail.empty.noActiveTasks", "Không có công việc nào đang thực hiện.")}</span>
          <p className="text-[10px] text-slate-400 mt-1 font-sans">{tx("contactDetail.empty.activeTasksHint", "Các công việc được giao mới sẽ xuất hiện ở đây.")}</p>
          {!isArchived && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <DetailTabActionButton actionIntent="create" onClick={onCreateTask} icon={<Plus size={14} />}>
                {tx("contactDetail.tasks.actions.create", "Tạo công việc")}
              </DetailTabActionButton>
              <DetailTabActionButton actionIntent="create" onClick={onScheduleMeeting} icon={<Calendar size={14} />}>
                {tx("contactDetail.tasks.actions.scheduleMeeting", "Lên lịch hẹn")}
              </DetailTabActionButton>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-sans">
          {activeTasks.map(tk => (
            <div key={tk.id} className="bg-white border border-slate-200 hover:border-indigo-200 rounded-xl p-4 shadow-sm flex flex-col justify-between transition">
              <div className="space-y-2 text-left">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-slate-800 text-[11px] leading-relaxed">{tk.title}</p>
                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-semibold border uppercase shrink-0 ${getPriorityColor(tk.priority)}`}>
                    {tk.priority}
                  </span>
                </div>
                {tk.description && (
                  <p className="text-[10px] text-slate-500 crm-text-wrap leading-relaxed">{tk.description}</p>
                )}
                <p className="text-[10px] text-slate-400 font-semibold font-mono">
                  {tx("contactDetail.table.dueDate", "Hạn chót")}: {tk.dueDate || tx("common.none", "Không có")} {tk.dueTime && `@ ${tk.dueTime}`} • {tx("common.owner", "Người nhận")}: {tk.assignee}
                </p>
              </div>
              
              <div className="flex justify-end items-center gap-2 mt-4 pt-2.5 border-t border-slate-100 flex-wrap">
                {onRescheduleTask && !isArchived && (
                  <button
                    type="button"
                    onClick={() => handleReschedule(tk.id, tk.dueDate)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 rounded-lg text-[9px] font-semibold transition cursor-pointer select-none"
                  >
                    <Calendar size={10} />
                    <span>{tx("contactDetail.tasks.actions.reschedule", "Đổi lịch")}</span>
                  </button>
                )}

                {!isArchived && (
                  <button
                    type="button"
                    onClick={() => onCompleteTask(tk.id)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-[9px] font-semibold transition cursor-pointer select-none border border-emerald-200"
                  >
                    <Clock size={10} />
                    <span>{tx("contactDetail.actions.complete", "Hoàn thành")}</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {rescheduleTask && (
        <Modal variant="form"
          isOpen={true}
          onClose={() => setRescheduleTask(null)}
          title={tx("contactDetail.actions.rescheduleTitle", "Điều chỉnh hạn xử lý")}
          size="sm"
        >
          <div className="space-y-4 text-left">
            <div>
              <label className="block text-[9px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                {tx("contactDetail.actions.dueDateLabel", "Hạn xử lý mới")}
              </label>
              <Input
                type="date"
                value={rescheduleTask.date}
                onChange={(e) => setRescheduleTask({ ...rescheduleTask, date: e.target.value })}
                className="text-[11px] font-mono"
              />
            </div>
            
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="ghost"
                onClick={() => setRescheduleTask(null)}
              >
                {tx("common.cancel", "Hủy bỏ")}
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  if (onRescheduleTask && rescheduleTask.date.trim()) {
                    onRescheduleTask(rescheduleTask.id, rescheduleTask.date.trim());
                  }
                  setRescheduleTask(null);
                }}
              >
                {tx("common.save", "Cập nhật")}
              </Button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
};
