import React from "react";
import {
  ArrowRight,
  CheckSquare,
  ExternalLink,
  History,
  Activity,
  LifeBuoy,
  ListTodo,
  RotateCcw,
  Truck,
} from "lucide-react";
import { Badge, Button } from "@/shared/components/ui";
import { businessStatusLabel } from "@/i18n/productGlossary";
import { resolveWorkspaceMemberName } from "@/platform/member-directory";
import type { Task } from "@/modules/tasks";
import type { Customer360ReadModel } from "../model/customer360ReadModel";
import { presentCustomerTimelineItem } from "../model/customerTimelinePresentation";
import {
  ActionPair,
  EmptyInline,
  EmptyState,
  formatDateTime,
  RecordListSection,
  RecordRow,
  returnReasonLabel,
  returnStatusLabel,
  SectionHeader,
  TaskRow,
} from "./CustomerDetailSectionPrimitives";

export const ReturnsTab: React.FC<{
  model: Customer360ReadModel;
  isVi: boolean;
  onOpen(id: string): void;
  onOpenModule(): void;
}> = ({ model, isVi, onOpen, onOpenModule }) => {
  const activeReturns = model.returns.filter(
    (request) => !["CLOSED", "REJECTED"].includes(request.status),
  );
  const completedReturns = model.returns.filter((request) =>
    ["CLOSED", "REJECTED"].includes(request.status),
  );
  return (
    <div className="space-y-5">
      <SectionHeader
        title={isVi ? "Đổi / Trả hàng" : "Returns"}
        actions={
          <Button
            size="sm"
            variant="secondary"
            icon={<ExternalLink size={12} />}
            onClick={onOpenModule}
          >
            {isVi ? "Mở module Đổi / Trả" : "Open Returns"}
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <ReturnMetric
          label={isVi ? "Đang hoạt động" : "Active"}
          value={model.metrics.activeReturnCount ?? 0}
        />
        <ReturnMetric
          label={isVi ? "Cần chú ý" : "Needs attention"}
          value={model.metrics.returnAttentionCount ?? 0}
        />
        <ReturnMetric
          label={isVi ? "Tác vụ xử lý lỗi" : "Failed resolution actions"}
          value={
            model.returnIntents.filter((intent) => intent.status === "FAILED")
              .length
          }
        />
      </div>
      <RecordListSection title={isVi ? "Đang xử lý" : "In progress"}>
        {activeReturns.length > 0 ? (
          activeReturns.map((request) => (
            <ReturnRow
              key={request.id}
              request={request}
              isVi={isVi}
              onOpen={() => onOpen(request.id)}
            />
          ))
        ) : (
          <EmptyState
            icon={<RotateCcw size={20} />}
            text={
              isVi
                ? "Không có yêu cầu đổi/trả đang hoạt động."
                : "No active return requests."
            }
          />
        )}
      </RecordListSection>
      <RecordListSection title={isVi ? "Lịch sử" : "History"}>
        {completedReturns.length > 0 ? (
          completedReturns.map((request) => (
            <ReturnRow
              key={request.id}
              request={request}
              isVi={isVi}
              onOpen={() => onOpen(request.id)}
            />
          ))
        ) : (
          <EmptyInline
            text={
              isVi
                ? "Chưa có yêu cầu đã đóng hoặc bị từ chối."
                : "No closed or rejected return requests."
            }
          />
        )}
      </RecordListSection>
    </div>
  );
};

const ReturnMetric: React.FC<{ label: string; value: number }> = ({
  label,
  value,
}) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
      {label}
    </div>
    <div className="mt-2 text-xl font-semibold text-slate-900">{value}</div>
  </div>
);

const ReturnRow: React.FC<{
  request: Customer360ReadModel["returns"][number];
  isVi: boolean;
  onOpen(): void;
}> = ({ request, isVi, onOpen }) => (
  <button
    type="button"
    onClick={onOpen}
    className="flex w-full min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-violet-300 hover:shadow-sm"
  >
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
      <RotateCcw size={15} />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block crm-text-wrap text-[11px] font-semibold text-slate-800">
        {request.code}
      </span>
      <span className="mt-1 block crm-text-wrap text-[9px] font-medium text-slate-500">
        {returnStatusLabel(request.status, isVi)} ·{" "}
        {returnReasonLabel(request.reason, isVi)} ·{" "}
        {request.items.reduce((sum, item) => sum + item.requestedQuantity, 0)}{" "}
        {isVi ? "sản phẩm" : "item(s)"}
      </span>
    </span>
    <span className="shrink-0 text-right">
      <span className="block text-xs font-semibold text-slate-700">
        {request.requestedResolution}
      </span>
      <span className="mt-1 block text-[9px] text-slate-400">
        {formatDateTime(request.updatedAt, isVi)}
      </span>
    </span>
    <ArrowRight size={12} className="shrink-0 text-slate-300" />
  </button>
);

export const SupportTab: React.FC<{
  model: Customer360ReadModel;
  isVi: boolean;
  onOpen(id: string): void;
  onCreate(): void;
  onOpenModule(): void;
}> = ({ model, isVi, onOpen, onCreate, onOpenModule }) => (
  <RecordListSection
    title={isVi ? "Chăm sóc" : "Care"}
    action={
      <ActionPair
        secondaryLabel={isVi ? "Mở chăm sóc" : "Open care"}
        primaryLabel={isVi ? "Tạo phiếu hỗ trợ" : "Create support ticket"}
        onSecondary={onOpenModule}
        onPrimary={onCreate}
      />
    }
  >
    {model.supportCases.length > 0 ? (
      model.supportCases.map((item) => (
        <RecordRow
          key={item.id}
          title={`${item.caseNumber} · ${item.title}`}
          meta={`${businessStatusLabel(item.status, isVi ? "vi" : "en")} · ${businessStatusLabel(item.category, isVi ? "vi" : "en")} · ${item.ownerId ? resolveWorkspaceMemberName(item.ownerId) : item.ownerName || "—"}`}
          value={String(item.priority)}
          onClick={() => onOpen(item.id)}
        />
      ))
    ) : (
      <EmptyState
        icon={<LifeBuoy size={20} />}
        text={isVi ? "Chưa có phiếu hỗ trợ nào." : "No support tickets yet."}
        action={
          <Button size="sm" variant="primary" onClick={onCreate}>
            {isVi ? "Tạo phiếu hỗ trợ đầu tiên" : "Create first support ticket"}
          </Button>
        }
      />
    )}
  </RecordListSection>
);

export const TasksTab: React.FC<{
  model: Customer360ReadModel;
  isVi: boolean;
  onCreateTask(): void;
  onCompleteTask(task: Task): void;
  onOpenTask(id: string): void;
  onOpenModule(): void;
}> = ({
  model,
  isVi,
  onCreateTask,
  onCompleteTask,
  onOpenTask,
  onOpenModule,
}) => {
  const openTasks = model.tasks.filter((task) => task.status === "OPEN");
  const completedTasks = model.tasks.filter((task) => task.status !== "OPEN");
  return (
    <div className="space-y-5">
      <SectionHeader
        title={isVi ? "Công việc liên quan Customer" : "Customer-related tasks"}
        actions={
          <ActionPair
            secondaryLabel={isVi ? "Mở module Công việc" : "Open Tasks"}
            primaryLabel={isVi ? "Tạo công việc" : "Create task"}
            onSecondary={onOpenModule}
            onPrimary={onCreateTask}
          />
        }
      />
      <RecordListSection
        title={isVi ? "Công việc đang hoạt động" : "Active tasks"}
      >
        {openTasks.length > 0 ? (
          openTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              isVi={isVi}
              onOpen={() => onOpenTask(task.id)}
              onComplete={() => onCompleteTask(task)}
            />
          ))
        ) : (
          <EmptyState
            icon={<CheckSquare size={20} />}
            text={isVi ? "Không có công việc đang mở." : "No open tasks."}
            action={
              <Button size="sm" variant="primary" onClick={onCreateTask}>
                {isVi ? "Tạo công việc" : "Create task"}
              </Button>
            }
          />
        )}
      </RecordListSection>
      <RecordListSection title={isVi ? "Lịch sử công việc" : "Task history"}>
        {completedTasks.length > 0 ? (
          completedTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              isVi={isVi}
              onOpen={() => onOpenTask(task.id)}
            />
          ))
        ) : (
          <EmptyState
            icon={<ListTodo size={20} />}
            text={
              isVi
                ? "Chưa có công việc hoàn thành hoặc đã hủy."
                : "No completed or cancelled tasks."
            }
          />
        )}
      </RecordListSection>
    </div>
  );
};


export const CustomerActivitiesTab: React.FC<{
  model: Customer360ReadModel;
  isVi: boolean;
  onOpenRecord(moduleKey: string, id: string): void;
}> = ({ model, isVi, onOpenRecord }) => (
  <RecordListSection title={isVi ? "Hoạt động quan hệ" : "Relationship activities"}>
    {model.timeline.length > 0 ? (
      model.timeline.slice(0, 40).map((item) => {
        const display = presentCustomerTimelineItem(item, isVi);
        return (
          <button
            key={item.id}
            type="button"
            disabled={!item.recordRef}
            onClick={() => item.recordRef && onOpenRecord(item.recordRef.moduleKey, item.recordRef.recordId)}
            className="flex w-full min-w-0 items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition enabled:hover:border-violet-200 enabled:hover:bg-violet-50/30 disabled:cursor-default"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><Activity size={14} /></span>
            <span className="min-w-0 flex-1">
              <span className="block crm-text-wrap text-xs font-medium text-slate-900">{display.title}</span>
              <span className="mt-1 block crm-text-wrap text-[10px] leading-5 text-slate-500">{display.detail || formatDateTime(item.occurredAt, isVi)}</span>
            </span>
            <span className="shrink-0 text-[9px] text-slate-400">{formatDateTime(item.occurredAt, isVi)}</span>
          </button>
        );
      })
    ) : (
      <EmptyState icon={<History size={20} />} text={isVi ? "Chưa có hoạt động quan hệ nào." : "No relationship activities yet."} />
    )}
  </RecordListSection>
);

export const ShippingTab: React.FC<{
  model: Customer360ReadModel;
  isVi: boolean;
  onOpenShipping(): void;
}> = ({ model, isVi, onOpenShipping }) => (
  <div className="space-y-5">
    <SectionHeader
      title={isVi ? "Vận đơn" : "Shipping"}
      actions={
        <Button
          size="sm"
          variant="primary"
          icon={<ExternalLink size={12} />}
          onClick={onOpenShipping}
        >
          {isVi ? "Mở module Vận đơn" : "Open Shipping"}
        </Button>
      }
    />
    {model.shippingBookings.length > 0 ? (
      <div className="grid gap-3 md:grid-cols-2">
        {model.shippingBookings.map((booking) => (
          <div
            key={booking.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-indigo-200 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <Truck size={15} />
                </span>
                <div className="min-w-0">
                  <div className="crm-text-wrap font-semibold text-slate-800">{booking.code}</div>
                  <div className="mt-1 text-xs font-semibold text-slate-500">
                    {booking.externalStatus} · {booking.trackingCode || "—"}
                  </div>
                </div>
              </div>
              <Badge variant="info">{booking.bookingStatus}</Badge>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <EmptyState
        icon={<Truck size={20} />}
        text={isVi ? "Chưa có vận đơn." : "No shipping bookings."}
        action={
          <Button size="sm" variant="secondary" onClick={onOpenShipping}>
            {isVi ? "Mở Vận đơn" : "Open Shipping"}
          </Button>
        }
      />
    )}
  </div>
);
