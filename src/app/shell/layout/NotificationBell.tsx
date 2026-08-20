import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Bell, CheckCheck } from "lucide-react";
import { toWorkspacePath } from "@/platform/navigation";
import { useNotificationsReadModel } from "@/workspaces/crm/read-models/notifications/useNotificationsReadModel";

interface NotificationBellProps {
  t: (key: string, options?: any) => string;
  activeWorkspaceKey: string;
  locale: "vi" | "en";
}

const tone: Record<string, string> = {
  urgent: "bg-rose-500",
  high: "bg-amber-500",
  medium: "bg-indigo-500",
  low: "bg-slate-400",
};

export const NotificationBell: React.FC<NotificationBellProps> = ({ t, activeWorkspaceKey, locale }) => {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const { notifications, markRead, markAllRead } = useNotificationsReadModel();
  const unread = notifications.filter((item) => !item.readAt);
  const latest = notifications.slice(0, 5);
  const notificationsPath = toWorkspacePath(activeWorkspaceKey, "crm", "notifications");
  const sourcePath = (route?: string) => route
    ? toWorkspacePath(activeWorkspaceKey, "crm", route.replace(/^\//, ""))
    : notificationsPath;

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer, true);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer, true);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  useEffect(() => setIsOpen(false), [location.pathname, location.search]);

  return (
    <div ref={rootRef} className="relative">
      <button
        id="topbar-notifications-btn"
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="relative rounded-full p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
        aria-label={t("navbar.notifications", "Thông báo")}
        title={t("navbar.notifications", "Thông báo")}
        aria-expanded={isOpen}
        aria-controls="topbar-notification-popover"
      >
        <Bell size={18} />
        {unread.length > 0 && <span className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-rose-500 px-1 text-center text-[9px] font-semibold leading-4 text-white">{unread.length > 9 ? "9+" : unread.length}</span>}
      </button>

      <AnimatePresence>
        {isOpen && (
            <motion.div
              id="topbar-notification-popover"
              role="dialog"
              aria-label={t("notifications.title", "Thông báo")}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute right-0 z-50 mt-2 w-[22rem] overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
                <div>
                  <div className="text-xs font-semibold text-slate-900">{t("notifications.title", "Thông báo")}</div>
                  <div className="mt-0.5 text-[10px] font-medium text-slate-400">{unread.length} {t("notifications.unreadCountSuffix", "chưa đọc")}</div>
                </div>
                {unread.length > 0 && (
                  <button type="button" onClick={markAllRead} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-50">
                    <CheckCheck size={13} /> {t("notifications.markAllRead", "Đọc tất cả")}
                  </button>
                )}
              </div>

              <div className="crm-scroll-y max-h-80 overflow-y-auto overscroll-contain [mask-image:linear-gradient(to_bottom,transparent,black_8%,black_92%,transparent)]">
                {latest.length === 0 ? (
                  <div className="px-5 py-10 text-center">
                    <Bell size={22} className="mx-auto text-slate-300" />
                    <p className="mt-2 text-xs font-medium text-slate-600">{t("notifications.empty", "Chưa có thông báo")}</p>
                    <p className="mt-1 text-[10px] leading-4 text-slate-400">{t("notifications.emptyHint", "Thông báo sẽ xuất hiện khi có công việc hoặc phiếu hỗ trợ được giao cho bạn.")}</p>
                  </div>
                ) : latest.map((item) => (
                  <Link
                    key={item.id}
                    to={sourcePath(item.route)}
                    onClick={() => { markRead(item.id); setIsOpen(false); }}
                    className={`relative flex gap-3 border-b border-slate-100 px-4 py-3 transition-colors hover:bg-slate-50 ${item.readAt ? "bg-white" : "bg-violet-50/45"}`}
                  >
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${tone[item.priority] ?? tone.medium}`} />
                    <div className="min-w-0 flex-1">
                      <div className={`crm-text-wrap text-[11px] ${item.readAt ? "font-normal text-slate-600" : "font-medium text-slate-950"}`}>{item.title}</div>
                      <p className="mt-1 crm-text-wrap text-[10px] leading-4 text-slate-500">{item.message}</p>
                      <span className="mt-1.5 block text-[9px] font-medium text-slate-400">{new Date(item.createdAt).toLocaleString(locale === "vi" ? "vi-VN" : "en-US")}</span>
                    </div>
                  </Link>
                ))}
              </div>

              <Link
                to={notificationsPath}
                onClick={() => setIsOpen(false)}
                className="block border-t border-slate-100 bg-slate-50/70 py-3 text-center text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50"
              >
                {t("notifications.viewAll", "Xem tất cả thông báo")}
              </Link>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
