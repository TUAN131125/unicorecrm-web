import React from "react";
import { CalendarClock, Mail, MessageSquare, NotebookPen, Phone, UsersRound } from "lucide-react";
import {
  RelationshipModuleActions,
  RelationshipWorkspaceHeader,
} from "@/components/crm/relationship-detail";
import { useI18n } from "@/i18n";
import { formatDate } from "@/shared/lib/format/date";

export interface ContactRelationshipActivity {
  id: string;
  title: string;
  description?: string;
  date: string;
  type: string;
  recordRef?: { moduleKey: string; recordId: string };
}

interface ContactActivitiesTabProps {
  activities: ContactRelationshipActivity[];
  onLogActivity(): void;
  onOpenTasks(): void;
  onOpenRecord(moduleKey: string, recordId: string): void;
}

const activityIcon = (type: string) => {
  const normalized = type.toUpperCase();
  if (normalized === "CALL") return <Phone size={14} />;
  if (normalized === "EMAIL") return <Mail size={14} />;
  if (normalized === "MEETING") return <UsersRound size={14} />;
  if (["MESSAGE", "SMS"].includes(normalized)) return <MessageSquare size={14} />;
  return <NotebookPen size={14} />;
};

const activityLabel = (type: string, isVi: boolean): string => {
  const normalized = type.toUpperCase();
  const labels: Record<string, { vi: string; en: string }> = {
    CALL: { vi: "Cuộc gọi", en: "Call" },
    EMAIL: { vi: "Email", en: "Email" },
    MEETING: { vi: "Cuộc hẹn", en: "Meeting" },
    NOTE: { vi: "Ghi chú", en: "Note" },
    MESSAGE: { vi: "Tin nhắn", en: "Message" },
    SMS: { vi: "Tin nhắn", en: "Message" },
    SYSTEM: { vi: "Hệ thống", en: "System" },
    TASK: { vi: "Công việc", en: "Task" },
  };
  return labels[normalized]?.[isVi ? "vi" : "en"] ?? (isVi ? "Hoạt động" : "Activity");
};

export const ContactActivitiesTab: React.FC<ContactActivitiesTabProps> = ({
  activities,
  onLogActivity,
  onOpenTasks,
  onOpenRecord,
}) => {
  const { locale } = useI18n();
  const isVi = locale === "vi";
  const text = (vi: string, en: string) => (isVi ? vi : en);
  const ordered = [...activities].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-4">
      <RelationshipWorkspaceHeader
        title={text("Hoạt động quan hệ", "Relationship activity")}
        actions={
          <RelationshipModuleActions
            secondaryLabel={text("Mở Công việc", "Open Tasks")}
            primaryLabel={text("Ghi hoạt động", "Log activity")}
            onSecondary={onOpenTasks}
            onPrimary={onLogActivity}
          />
        }
      />

      {ordered.length > 0 ? (
        <div className="space-y-2">
          {ordered.map((activity) => {
            const content = (
              <>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                  {activityIcon(activity.type)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block crm-text-wrap text-xs font-medium text-slate-900">{activity.title}</span>
                  {activity.description ? <span className="mt-1 block crm-text-wrap text-[10px] leading-4 text-slate-500">{activity.description}</span> : null}
                  <span className="mt-1.5 block text-[10px] text-slate-400">{activityLabel(activity.type, isVi)} · {formatDate(activity.date, locale)}</span>
                </span>
              </>
            );
            return activity.recordRef ? (
              <button
                key={activity.id}
                type="button"
                onClick={() => onOpenRecord(activity.recordRef!.moduleKey, activity.recordRef!.recordId)}
                className="flex w-full min-w-0 items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-violet-200"
              >
                {content}
              </button>
            ) : (
              <div key={activity.id} className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
                {content}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-8 text-center">
          <CalendarClock size={22} className="text-slate-300" />
          <p className="mt-3 text-xs font-medium text-slate-600">{text("Chưa có hoạt động quan hệ được ghi nhận.", "No relationship activity has been recorded.")}</p>
        </div>
      )}
    </div>
  );
};
