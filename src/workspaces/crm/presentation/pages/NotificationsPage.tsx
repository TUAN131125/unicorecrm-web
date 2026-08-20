import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bell, CheckCheck, Eye, EyeOff, ListTodo, Search, Sparkles, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toWorkspacePath } from "@/platform/navigation";
import { ModulePageShell } from "@/components/crm/ModulePageShell";
import { PageHeader } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { useNotificationsReadModel } from "@/workspaces/crm/read-models/notifications/useNotificationsReadModel";
import type { NotificationCategory, NotificationPriority } from "@/platform/notifications";

type NotificationView = "all" | "unread" | NotificationCategory;

const categoryIcon: Record<NotificationCategory, React.ReactNode> = {
  work: <ListTodo size={14} className="text-indigo-600" />,
  care: <UserRound size={14} className="text-emerald-600" />,
  system: <Sparkles size={14} className="text-slate-500" />,
};

const priorityClass: Record<NotificationPriority, string> = {
  low: "border-slate-200 bg-slate-50 text-slate-600",
  medium: "border-indigo-200 bg-indigo-50 text-indigo-700",
  high: "border-amber-200 bg-amber-50 text-amber-700",
  urgent: "border-rose-200 bg-rose-50 text-rose-700",
};

const priorityLabel = (priority: NotificationPriority, vi: boolean): string => ({
  low: vi ? "Thấp" : "Low",
  medium: vi ? "Trung bình" : "Medium",
  high: vi ? "Cao" : "High",
  urgent: vi ? "Khẩn cấp" : "Urgent",
})[priority];

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { locale } = useI18n();
  const vi = locale === "vi";
  const workspace = useWorkspaceContextSnapshot();
  const { notifications, markRead, markUnread, markAllRead } = useNotificationsReadModel();
  const [view, setView] = useState<NotificationView>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return notifications.filter((item) => {
      if (view === "unread" && item.readAt) return false;
      if (view !== "all" && view !== "unread" && item.category !== view) return false;
      if (!keyword) return true;
      return `${item.title} ${item.message}`.toLowerCase().includes(keyword);
    });
  }, [notifications, search, view]);

  const counts = useMemo(() => ({
    all: notifications.length,
    unread: notifications.filter((item) => !item.readAt).length,
    work: notifications.filter((item) => item.category === "work").length,
    care: notifications.filter((item) => item.category === "care").length,
    system: notifications.filter((item) => item.category === "system").length,
  }), [notifications]);

  const sourcePath = (route?: string) => route
    ? toWorkspacePath(workspace.workspaceKey, "crm", route.replace(/^\//, ""))
    : undefined;

  const views: Array<{ key: NotificationView; label: string; count: number }> = [
    { key: "all", label: vi ? "Tất cả" : "All", count: counts.all },
    { key: "unread", label: vi ? "Chưa đọc" : "Unread", count: counts.unread },
    { key: "work", label: vi ? "Công việc" : "Work", count: counts.work },
    { key: "care", label: vi ? "Chăm sóc" : "Care", count: counts.care },
    { key: "system", label: vi ? "Hệ thống" : "System", count: counts.system },
  ];

  return (
    <ModulePageShell id="notifications-view">
      <PageHeader
        title={vi ? "Thông báo" : "Notifications"}
        icon={<Bell size={18} />}
        actions={counts.unread > 0 ? (
          <button type="button" onClick={markAllRead} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            <CheckCheck size={14} /> {vi ? "Đánh dấu tất cả đã đọc" : "Mark all read"}
          </button>
        ) : undefined}
      />

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap gap-2">
          {views.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setView(item.key)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${view === item.key ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              <span>{item.label}</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${view === item.key ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"}`}>{item.count}</span>
            </button>
          ))}
        </div>
        <label className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 lg:w-80">
          <Search size={15} className="text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={vi ? "Tìm thông báo..." : "Search notifications..."} className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none" />
        </label>
      </div>

      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
              <Bell size={28} className="mx-auto text-slate-300" />
              <h3 className="mt-3 text-sm font-semibold text-slate-800">{vi ? "Không có thông báo" : "No notifications"}</h3>
                </motion.div>
          ) : filtered.map((item) => (
            <motion.article key={item.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className={`relative overflow-hidden rounded-2xl border p-4 shadow-sm transition-colors ${item.readAt ? "border-slate-200 bg-white" : "border-violet-200 bg-violet-50/35 ring-1 ring-violet-100"}`}>
              <div className="flex items-start gap-3">
                {!item.readAt && <span aria-hidden="true" className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-violet-500" />}
                <button type="button" onClick={() => item.readAt ? markUnread(item.id) : markRead(item.id)} className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-indigo-700" title={item.readAt ? (vi ? "Đánh dấu chưa đọc" : "Mark unread") : (vi ? "Đánh dấu đã đọc" : "Mark read")}>
                  {item.readAt ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white">{categoryIcon[item.category]}</span>
                    <h3 className={`break-words text-sm [overflow-wrap:anywhere] ${item.readAt ? "font-normal text-slate-600" : "font-medium text-slate-950"}`}>{item.title}</h3>
                    <span className={`rounded-full border px-2 py-1 text-[9px] font-semibold ${priorityClass[item.priority]}`}>{priorityLabel(item.priority, vi)}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{item.message}</p>
                  <div className="mt-2 text-[10px] font-medium text-slate-400">{new Date(item.createdAt).toLocaleString(vi ? "vi-VN" : "en-US")}</div>
                </div>
                {item.route && (
                  <button type="button" onClick={() => { markRead(item.id); const target = sourcePath(item.route); if (target) navigate(target); }} className="shrink-0 rounded-xl bg-indigo-600 px-3 py-2 text-[10px] font-semibold text-white hover:bg-indigo-700">
                    {vi ? "Mở" : "Open"}
                  </button>
                )}
              </div>
            </motion.article>
          ))}
        </AnimatePresence>
      </div>
    </ModulePageShell>
  );
};
