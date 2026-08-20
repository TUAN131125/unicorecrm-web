import React from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Badge, Button } from "@/shared/components/ui";
import { RelationshipModuleActions, RelationshipWorkspaceHeader } from "@/components/crm/relationship-detail";
import { resolveWorkspaceMemberName } from "@/platform/member-directory";
import type { Task } from "@/modules/tasks";
import type { Customer360ReadModel } from "../model/customer360ReadModel";

export const SectionHeader = RelationshipWorkspaceHeader;

export const RecordListSection: React.FC<{
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, action, children }) => (
  <section className="space-y-3">
    <SectionHeader title={title} actions={action} />
    <div className="space-y-2">{children}</div>
  </section>
);

export const CompactRecordGroup: React.FC<{
  title: string;
  empty: string;
  children: React.ReactNode;
}> = ({ title, empty, children }) => {
  const childCount = React.Children.count(children);
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
        {title}
      </h4>
      <div className="space-y-2">
        {childCount > 0 ? children : <EmptyInline text={empty} />}
      </div>
    </section>
  );
};

export const ActionPair = RelationshipModuleActions;

export const RecordRow: React.FC<{
  title: string;
  meta?: string;
  value?: string;
  onClick(): void;
}> = ({ title, meta, value, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition-all hover:border-indigo-300 hover:shadow-sm"
  >
    <div className="min-w-0">
      <div className="crm-text-wrap font-semibold text-slate-800">{title}</div>
      {meta && (
        <div className="mt-1 crm-text-wrap text-xs font-medium text-slate-500">
          {meta}
        </div>
      )}
    </div>
    <div className="flex shrink-0 items-center gap-2">
      {value && (
        <div className="text-[11px] font-semibold text-slate-700">{value}</div>
      )}
      <ArrowRight size={12} className="text-slate-300" />
    </div>
  </button>
);

export const TaskRow: React.FC<{
  task: Task;
  isVi: boolean;
  onOpen(): void;
  onComplete?(): void;
}> = ({ task, isVi, onOpen, onComplete }) => (
  <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
    <button type="button" onClick={onOpen} className="min-w-0 text-left">
      <div className="crm-text-wrap font-semibold text-slate-800">{task.title}</div>
      <div className="mt-1 text-xs text-slate-500">
        {formatDateTime(task.dueAt, isVi)} ·{" "}
        {resolveWorkspaceMemberName(task.assigneeId)}{" "}
        · {task.priority}
      </div>
    </button>
    <div className="flex shrink-0 items-center gap-2">
      {onComplete ? (
        <Button
          size="xs"
          variant="secondary"
          icon={<CheckCircle2 size={11} />}
          onClick={onComplete}
        >
          {isVi ? "Hoàn thành" : "Complete"}
        </Button>
      ) : (
        <Badge variant={task.status === "COMPLETED" ? "success" : "neutral"}>
          {task.status}
        </Badge>
      )}
      <Button size="xs" variant="ghost" onClick={onOpen}>
        {isVi ? "Mở" : "Open"}
      </Button>
    </div>
  </div>
);

export const DetailSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, icon, action, children }) => (
  <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
      <div className="flex items-center gap-2 text-indigo-600">
        <span>{icon}</span>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-700">
          {title}
        </h3>
      </div>
      {action}
    </div>
    <div className="space-y-2.5">{children}</div>
  </section>
);

export const InfoRow: React.FC<{ label: string; value?: React.ReactNode }> = ({
  label,
  value,
}) => (
  <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 text-[11px]">
    <span className="font-medium text-slate-500">{label}</span>
    <span className="min-w-0 break-words font-medium text-slate-700">
      {value || "—"}
    </span>
  </div>
);

export const EmptyState: React.FC<{
  icon: React.ReactNode;
  text: string;
  action?: React.ReactNode;
}> = ({ icon, text, action }) => (
  <div className="flex min-h-[150px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-8 text-center text-slate-400">
    <span className="mb-2 text-slate-300">{icon}</span>
    <p className="text-[11px] font-medium">{text}</p>
    {action && <div className="mt-3">{action}</div>}
  </div>
);

export const EmptyInline: React.FC<{ text: string }> = ({ text }) => (
  <p className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-5 text-center text-xs font-medium text-slate-400">
    {text}
  </p>
);

export function returnStatusLabel(
  status: Customer360ReadModel["returns"][number]["status"],
  isVi: boolean,
): string {
  const vi: Record<Customer360ReadModel["returns"][number]["status"], string> =
    {
      REQUESTED: "Chờ quyết định",
      APPROVED: "Đã duyệt",
      AWAITING_ITEM: "Chờ hàng trả về",
      RECEIVED: "Đã nhận hàng",
      RESOLVED: "Đã xử lý",
      CLOSED: "Đã đóng",
      REJECTED: "Từ chối",
    };
  const en: Record<Customer360ReadModel["returns"][number]["status"], string> =
    {
      REQUESTED: "Awaiting decision",
      APPROVED: "Approved",
      AWAITING_ITEM: "Awaiting item",
      RECEIVED: "Received",
      RESOLVED: "Resolved",
      CLOSED: "Closed",
      REJECTED: "Rejected",
    };
  return (isVi ? vi : en)[status];
}

export function returnReasonLabel(
  reason: Customer360ReadModel["returns"][number]["reason"],
  isVi: boolean,
): string {
  const vi: Record<Customer360ReadModel["returns"][number]["reason"], string> =
    {
      DEFECTIVE: "Lỗi sản phẩm",
      WRONG_ITEM: "Sai sản phẩm",
      DAMAGED: "Hư hỏng",
      NOT_AS_DESCRIBED: "Không đúng mô tả",
      CUSTOMER_CHANGED_MIND: "Khách đổi ý",
      OTHER: "Khác",
    };
  const en: Record<Customer360ReadModel["returns"][number]["reason"], string> =
    {
      DEFECTIVE: "Defective",
      WRONG_ITEM: "Wrong item",
      DAMAGED: "Damaged",
      NOT_AS_DESCRIBED: "Not as described",
      CUSTOMER_CHANGED_MIND: "Customer changed mind",
      OTHER: "Other",
    };
  return (isVi ? vi : en)[reason];
}

export function formatCurrency(value: number, isVi: boolean): string {
  return `${value.toLocaleString(isVi ? "vi-VN" : "en-US")} ₫`;
}

export function formatDateTime(value: string | undefined, isVi: boolean): string {
  return value ? new Date(value).toLocaleString(isVi ? "vi-VN" : "en-US") : "—";
}
