import React, { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Calendar, CheckSquare, Clock, FileText, Filter, Mail, MessageCircle, Phone } from "lucide-react";
import { FilterChip, IconButton } from "@/shared/components/ui";
import { RelationshipPanelActionBar, type RelationshipPanelAction } from "@/components/crm/relationship-panel/RelationshipPanelActionBar";
import { useI18n } from "@/i18n";
import type { Activity, Task } from "@/modules/tasks";
import type { OrganizationQuickAction } from "./OrganizationQuickActivityModal";

interface OrganizationInsightPanelProps {
  activities: Activity[];
  tasks: Task[];
  canCommunicate: boolean;
  hasEmail: boolean;
  hasPhone: boolean;
  onQuickAction(action: OrganizationQuickAction): void;
  onCreateTask(): void;
}

type TimelineFilter = "all" | "call" | "email" | "sms" | "meeting" | "note" | "task";

export const OrganizationInsightPanel: React.FC<OrganizationInsightPanelProps> = ({
  activities,
  tasks,
  canCommunicate,
  hasEmail,
  hasPhone,
  onQuickAction,
  onCreateTask,
}) => {
  const { locale } = useI18n();
  const isVi = locale === "vi";
  const text = (vi: string, en: string) => isVi ? vi : en;
  const reduceMotion = useReducedMotion();
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const [showFilters, setShowFilters] = useState(false);

  const timeline = useMemo(() => {
    const activityItems = activities.map((item) => ({
      id: item.id,
      type: activityFilter(item.type),
      title: item.subject,
      meta: `${activityLabel(item.type, isVi)} · ${formatDateTime(item.occurredAt, locale)}`,
      sortAt: item.occurredAt,
    }));
    const taskItems = tasks.map((item) => ({
      id: item.id,
      type: "task" as const,
      title: item.title,
      meta: `${taskStatusLabel(item.status, isVi)} · ${formatDateTime(item.dueAt, locale)}`,
      sortAt: item.updatedAt,
    }));
    return [...activityItems, ...taskItems]
      .sort((a, b) => b.sortAt.localeCompare(a.sortAt))
      .filter((item) => filter === "all" || item.type === filter);
  }, [activities, filter, isVi, locale, tasks]);

  const actions = [
    { id: "call", label: text("Ghi cuộc gọi", "Log call"), icon: <Phone size={12} className="text-emerald-600" />, disabled: !canCommunicate || !hasPhone, disabledReason: text("Tổ chức chưa có số điện thoại hoặc đang hạn chế liên hệ.", "The organization has no phone number or restricts outreach.") },
    { id: "task", label: text("Thêm việc", "Add task"), icon: <CheckSquare size={12} className="text-amber-600" /> },
    { id: "meeting", label: text("Thêm lịch hẹn", "Add meeting"), icon: <Calendar size={12} className="text-rose-600" /> },
    { id: "email", label: text("Ghi nhận Email", "Log email"), icon: <Mail size={12} className="text-indigo-600" />, disabled: !canCommunicate || !hasEmail, disabledReason: text("Tổ chức chưa có email hoặc đang hạn chế liên hệ.", "The organization has no email or restricts outreach.") },
    { id: "sms", label: text("Ghi nhận SMS", "Log SMS"), icon: <MessageCircle size={12} className="text-sky-600" />, disabled: !canCommunicate || !hasPhone, disabledReason: text("Tổ chức chưa có số điện thoại hoặc đang hạn chế liên hệ.", "The organization has no phone number or restricts outreach.") },
    { id: "note", label: text("Ghi chú nhanh", "Quick note"), icon: <FileText size={12} className="text-slate-600" /> },
  ] satisfies readonly RelationshipPanelAction<OrganizationQuickAction | "task">[];

  return (
    <div id="organization-right-work-panel" className="relative flex h-full min-h-[560px] w-full shrink-0 select-none flex-col space-y-4 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-[0_14px_38px_rgba(15,23,42,0.08)] xl:h-full xl:min-h-0 xl:w-[350px]">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Clock size={13} className="text-slate-400" />
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700">{text("Tương tác tổ chức", "Organization activity")}</h4>
            <p className="mt-0.5 text-[9px] font-semibold text-slate-400">{timeline.length} {text("sự kiện đang hiển thị", "visible events")}</p>
          </div>
        </div>
        <IconButton variant={showFilters ? "primary" : "secondary"} size="sm" onClick={() => setShowFilters((current) => !current)} title={text("Bộ lọc hoạt động", "Activity filters")} aria-label={text("Bộ lọc hoạt động", "Activity filters")}>
          <Filter size={12} />
        </IconButton>
      </div>

      <AnimatePresence initial={false}>
        {showFilters ? (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, height: 0, y: -6 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, y: -4 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50/60 p-2">
              {([
                ["all", text("Tất cả", "All")],
                ["call", text("Gọi", "Calls")],
                ["email", "Email"],
                ["sms", "SMS"],
                ["meeting", text("Hẹn", "Meetings")],
                ["note", text("Ghi chú", "Notes")],
                ["task", text("Công việc", "Tasks")],
              ] as Array<[TimelineFilter, string]>).map(([id, label]) => (
                <FilterChip key={id} label={label} active={filter === id} onClick={() => setFilter(id)} />
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <RelationshipPanelActionBar
        label={text("Tác vụ nhanh", "Quick actions")}
        actions={actions}
        onAction={(actionId) => actionId === "task" ? onCreateTask() : onQuickAction(actionId)}
      />

      <div className="crm-scroll-y min-h-[300px] flex-1 space-y-2 overflow-y-auto pr-1">
        <AnimatePresence mode="popLayout" initial={false}>
          {timeline.length > 0 ? timeline.map((item) => (
            <motion.div
              layout
              key={`${item.type}-${item.id}`}
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 8 }}
              className="rounded-xl border border-slate-200/70 bg-white p-3"
            >
              <div className="text-[9px] font-semibold uppercase tracking-wide text-violet-600">{timelineTypeLabel(item.type, isVi)}</div>
              <div className="mt-1 text-[11px] font-bold leading-4 text-slate-800">{item.title}</div>
              <div className="mt-1 text-[9px] font-semibold text-slate-400">{item.meta}</div>
            </motion.div>
          )) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-[10px] text-slate-400">
              {text("Chưa có hoạt động ở cấp quan hệ tổ chức.", "No organization-level activity yet.")}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

function activityFilter(type: Activity["type"]): Exclude<TimelineFilter, "all" | "task"> {
  switch (type) {
    case "CALL": return "call";
    case "EMAIL": return "email";
    case "MEETING": return "meeting";
    case "MESSAGE": return "sms";
    default: return "note";
  }
}

function activityLabel(type: Activity["type"], isVi: boolean): string {
  const labels = {
    CALL: isVi ? "Cuộc gọi" : "Call",
    EMAIL: "Email",
    MEETING: isVi ? "Cuộc họp" : "Meeting",
    NOTE: isVi ? "Ghi chú" : "Note",
    MESSAGE: isVi ? "Tin nhắn" : "Message",
    SYSTEM: isVi ? "Hệ thống" : "System",
  };
  return labels[type];
}

function timelineTypeLabel(type: TimelineFilter, isVi: boolean): string {
  if (type === "task") return isVi ? "Công việc" : "Task";
  if (type === "call") return isVi ? "Cuộc gọi" : "Call";
  if (type === "meeting") return isVi ? "Cuộc họp" : "Meeting";
  if (type === "note") return isVi ? "Ghi chú" : "Note";
  if (type === "sms") return "SMS";
  return "Email";
}

function taskStatusLabel(status: Task["status"], isVi: boolean): string {
  if (status === "COMPLETED") return isVi ? "Hoàn thành" : "Completed";
  if (status === "CANCELLED") return isVi ? "Đã hủy" : "Cancelled";
  return isVi ? "Đang mở" : "Open";
}

function formatDateTime(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
