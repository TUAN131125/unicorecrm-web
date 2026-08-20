import React, { useMemo, useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  ContactRound,
  LifeBuoy,
  Sparkles,
  UserRoundCheck,
} from "lucide-react";
import { Button } from "@/shared/components/ui";
import {
  buildCustomerRelationshipAssessment,
  type CustomerAssessmentSignal,
  type CustomerRecommendedAction,
} from "../model/customerOverviewAssessment";
import type { Customer360ReadModel } from "../model/customer360ReadModel";
import type { CustomerDetailTab } from "./CustomerDetailTabs";
import { localizeBusinessDescriptor } from "@/shared/lib/i18n/businessDescriptorLabels";

interface CustomerOverviewTabProps {
  model: Customer360ReadModel;
  ownerName: string;
  isVi: boolean;
  onSelectTab(tab: CustomerDetailTab, subTab?: string): void;
  onCreateOpportunity(): void;
  onCreateTask(): void;
  onCreateCare(): void;
  onOpenSource(): void;
  onOpenContact(id: string): void;
  onOpenRecord(moduleKey: string, id: string): void;
}

export const CustomerOverviewTab: React.FC<CustomerOverviewTabProps> = ({
  model,
  ownerName,
  isVi,
  onSelectTab,
  onCreateOpportunity,
  onCreateTask,
  onCreateCare,
  onOpenSource,
  onOpenContact,
  onOpenRecord,
}) => {
  const assessment = useMemo(
    () => buildCustomerRelationshipAssessment(model),
    [model],
  );
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const openDeals = model.deals.filter(
    (deal) => !["WON", "LOST"].includes(String(deal.stage).toUpperCase()),
  );
  const pipelineValue = openDeals.reduce(
    (sum, deal) => sum + (deal.amount || 0),
    0,
  );
  const primaryContact = model.identity.primaryContact;
  const latestActivity = model.timeline[0];
  const attentionSignals = assessment.signals.filter(
    (signal) => signal.kind !== "POSITIVE",
  );
  const visibleSignals = (
    attentionSignals.length > 0 ? attentionSignals : assessment.signals
  ).slice(0, 2);
  const primarySignal = visibleSignals[0];
  const operationalAttentionCount =
    model.metrics.supportRiskCount + model.metrics.returnAttentionCount;

  const runAction = (action: CustomerRecommendedAction | undefined) => {
    if (!action) return;
    if (action.actionType === "CREATE_TASK") return onCreateTask();
    if (action.actionType === "CREATE_CARE") return onCreateCare();
    if (action.actionType === "CREATE_OPPORTUNITY") {
      return onCreateOpportunity();
    }
    if (action.actionType === "OPEN_CUSTOMER_TAB" && action.customerTab) {
      const target = resolveCustomerWorkspaceTarget(action.customerTab);
      return onSelectTab(target.tab, target.subTab);
    }
    if (
      action.actionType === "OPEN_RECORD" &&
      action.targetModule &&
      action.targetRecordId
    ) {
      return onOpenRecord(action.targetModule, action.targetRecordId);
    }
  };

  return (
    <div
      data-customer-overview="ai-first"
      className="min-w-0 space-y-4 animate-fade-in"
    >
      <section
        data-customer-ai-brief="canonical"
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="p-4 sm:p-5">
          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] xl:items-start">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                  <Sparkles size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-medium text-violet-700">
                    {isVi ? "AI tổng quan khách hàng" : "AI customer overview"}
                  </div>
                  <h2 className="mt-0.5 crm-text-wrap text-base font-semibold leading-6 text-slate-950 sm:text-lg">
                    {isVi
                      ? "Sức khỏe quan hệ và điều cần ưu tiên"
                      : "Relationship health and current priority"}
                  </h2>
                </div>
                <AssessmentBadge
                  label={assessmentLabel(assessment.level, isVi)}
                  level={assessment.level}
                />
              </div>

              <p className="mt-3 max-w-3xl crm-text-wrap text-sm font-normal leading-6 text-slate-600">
                {isVi ? assessment.summaryVi : assessment.summaryEn}
              </p>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <AiMetric
                  label={isVi ? "Điểm sức khỏe" : "Health score"}
                  value={`${assessment.score}/100`}
                />
                <AiMetric
                  label={isVi ? "Xu hướng" : "Trend"}
                  value={trendLabel(assessment.trend, isVi)}
                />
                <AiMetric
                  label={isVi ? "Độ tin cậy" : "Confidence"}
                  value={`${assessment.confidence}%`}
                  help={
                    isVi
                      ? `${attentionSignals.length} tín hiệu cần theo dõi`
                      : `${attentionSignals.length} signal(s) to monitor`
                  }
                />
              </div>
            </div>

            <aside className="min-w-0 rounded-2xl border border-violet-200 bg-violet-50/70 p-4">
              <div className="flex items-center gap-2 text-[11px] font-medium text-violet-700">
                <Sparkles size={14} />
                <span>
                  {isVi ? "Đề xuất hoạt động tiếp theo" : "Recommended next activity"}
                </span>
              </div>
              <p className="mt-2 crm-text-wrap text-sm font-medium leading-6 text-slate-900">
                {isVi ? assessment.nextActionVi : assessment.nextActionEn}
              </p>
              {assessment.primaryAction ? (
                <Button
                  size="sm"
                  variant="primary"
                  className="mt-4 w-full justify-center sm:w-auto xl:w-full"
                  onClick={() => runAction(assessment.primaryAction)}
                >
                  {isVi
                    ? assessment.primaryAction.labelVi
                    : assessment.primaryAction.labelEn}
                </Button>
              ) : null}
            </aside>
          </div>

          <div className="mt-5 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  {isVi ? "Nhận xét chính từ AI" : "Key AI observations"}
                </h3>
                <p className="mt-0.5 text-xs font-normal leading-5 text-slate-500">
                  {isVi
                    ? "Chỉ hiển thị các tín hiệu có ảnh hưởng trực tiếp đến việc chăm sóc khách hàng."
                    : "Only signals that directly affect customer care are shown."}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-600">
                {attentionSignals.length} {isVi ? "cần theo dõi" : "to monitor"}
              </span>
            </div>

            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              {visibleSignals.map((signal) => (
                <AiSignalCard key={signal.id} signal={signal} isVi={isVi} />
              ))}
              {visibleSignals.length === 0 ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-sm font-normal leading-5 text-emerald-800 lg:col-span-2">
                  {isVi
                    ? "Chưa phát hiện ngoại lệ cần xử lý. Tiếp tục duy trì nhịp chăm sóc hiện tại."
                    : "No exception requires action. Continue the current customer-care cadence."}
                </div>
              ) : null}
            </div>

            {primarySignal?.evidence.length ? (
              <div className="mt-3">
                <button
                  type="button"
                  aria-expanded={evidenceOpen}
                  onClick={() => setEvidenceOpen((current) => !current)}
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-1 text-[11px] font-medium text-violet-700 transition hover:text-violet-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
                >
                  {evidenceOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {evidenceOpen
                    ? isVi
                      ? "Ẩn bằng chứng"
                      : "Hide evidence"
                    : isVi
                      ? "Xem bằng chứng AI sử dụng"
                      : "View evidence used by AI"}
                </button>
                {evidenceOpen ? (
                  <div className="mt-2 grid gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-2">
                    {primarySignal.evidence.slice(0, 4).map((evidence) => (
                      <div
                        key={`${primarySignal.id}-${evidence.sourceType}-${evidence.recordId}`}
                        className="min-w-0 rounded-lg bg-white px-3 py-2.5"
                      >
                        <div className="crm-text-wrap text-xs font-medium leading-5 text-slate-800">
                          {isVi ? evidence.factVi : evidence.factEn}
                        </div>
                        <div className="mt-1 crm-text-wrap text-[10px] font-normal leading-4 text-slate-500">
                          {evidence.sourceType} ·{" "}
                          {evidence.occurredAt
                            ? formatDateTime(evidence.occurredAt, isVi)
                            : evidence.recordId}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section
        aria-label={isVi ? "Chỉ số khách hàng" : "Customer metrics"}
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <OverviewKpi
          icon={<CircleDollarSign size={16} />}
          label={isVi ? "Doanh thu ghi nhận" : "Recognized revenue"}
          value={formatCurrency(model.metrics.revenue, isVi)}
          meta={`${model.metrics.purchaseCount} ${isVi ? "bằng chứng mua" : "purchase evidence"}`}
          onClick={() => onSelectTab("transactions", "history")}
        />
        <OverviewKpi
          icon={<BriefcaseBusiness size={16} />}
          label={isVi ? "Cơ hội đang mở" : "Open pipeline"}
          value={formatCurrency(pipelineValue, isVi)}
          meta={`${model.metrics.openDealCount} ${isVi ? "cơ hội" : "opportunities"}`}
          onClick={() => onSelectTab("sales", "opportunities")}
        />
        <OverviewKpi
          icon={<CheckSquare size={16} />}
          label={isVi ? "Công việc cần xử lý" : "Work needing attention"}
          value={String(model.metrics.overdueTaskCount)}
          meta={`${model.metrics.openTaskCount} ${isVi ? "việc đang mở" : "open tasks"}`}
          onClick={() => onSelectTab("work")}
        />
        <OverviewKpi
          icon={<LifeBuoy size={16} />}
          label={isVi ? "Rủi ro vận hành" : "Operational attention"}
          value={String(operationalAttentionCount)}
          meta={
            isVi
              ? `${model.metrics.supportRiskCount} hỗ trợ · ${model.metrics.returnAttentionCount} đổi/trả`
              : `${model.metrics.supportRiskCount} support · ${model.metrics.returnAttentionCount} returns`
          }
          onClick={() =>
            model.metrics.supportRiskCount > 0
              ? onSelectTab("service", "support")
              : onSelectTab("transactions", "returns")
          }
        />
      </section>

      <section className="min-w-0">
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                <UserRoundCheck size={15} />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-900">
                  {isVi ? "Thông tin khách hàng" : "Customer snapshot"}
                </h3>
                <p className="mt-0.5 text-xs font-normal text-slate-500">
                  {isVi
                    ? "Các dữ liệu cần biết trước khi liên hệ hoặc ra quyết định."
                    : "Key information before contacting or making a decision."}
                </p>
              </div>
            </div>
            <Button size="sm" variant="secondary" onClick={onOpenSource}>
              {isVi ? "Mở hồ sơ nguồn" : "Open source record"}
            </Button>
          </div>

          <dl className="mt-4 grid min-w-0 gap-x-5 gap-y-4 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-3">
            <SnapshotField
              label={isVi ? "Loại khách hàng" : "Customer type"}
              value={model.customer.type}
            />
            <SnapshotField
              label={isVi ? "Phân khúc" : "Segment"}
              value={
                localizeBusinessDescriptor(model.customer.segment, isVi ? "vi" : "en") ||
                (isVi ? "Chưa phân khúc" : "Not segmented")
              }
            />
            <SnapshotField
              label={isVi ? "Người phụ trách" : "Owner"}
              value={ownerName}
            />
            <SnapshotField
              label={isVi ? "Liên hệ chính" : "Primary contact"}
              value={
                primaryContact
                  ? primaryContact.fullName || primaryContact.name
                  : isVi
                    ? "Chưa xác định"
                    : "Not identified"
              }
              action={
                primaryContact
                  ? {
                      label: isVi ? "Mở liên hệ" : "Open contact",
                      onClick: () => onOpenContact(primaryContact.id),
                    }
                  : undefined
              }
            />
            <SnapshotField
              label={isVi ? "Tương tác gần nhất" : "Latest interaction"}
              value={
                latestActivity
                  ? formatDateTime(latestActivity.occurredAt, isVi)
                  : isVi
                    ? "Chưa có dữ liệu"
                    : "No data"
              }
            />
            <SnapshotField
              label={isVi ? "Mốc chăm sóc tiếp theo" : "Next care checkpoint"}
              value={
                model.customer.nextCareAt
                  ? formatDateTime(model.customer.nextCareAt, isVi)
                  : isVi
                    ? "Chưa lên lịch"
                    : "Not scheduled"
              }
            />
          </dl>
        </div>

      </section>
    </div>
  );
};

const AiMetric: React.FC<{
  label: string;
  value: string;
  help?: string;
}> = ({ label, value, help }) => (
  <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
    <div className="text-[10px] font-normal leading-4 text-slate-500">{label}</div>
    <div className="mt-0.5 crm-text-wrap text-base font-semibold leading-6 text-slate-900">
      {value}
    </div>
    {help ? (
      <div className="mt-0.5 crm-text-wrap text-[10px] font-normal leading-4 text-slate-500">
        {help}
      </div>
    ) : null}
  </div>
);

const AssessmentBadge: React.FC<{
  label: string;
  level: string;
}> = ({ label, level }) => (
  <span
    className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${assessmentBadgeClass(level)}`}
  >
    {label}
  </span>
);

const AiSignalCard: React.FC<{
  signal: CustomerAssessmentSignal;
  isVi: boolean;
}> = ({ signal, isVi }) => (
  <div className="flex min-w-0 gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
    <span
      className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${signalDotClass(signal.kind)}`}
    />
    <div className="min-w-0">
      <div className="crm-text-wrap text-sm font-medium leading-5 text-slate-900">
        {isVi ? signal.labelVi : signal.labelEn}
      </div>
      <p className="mt-1 crm-text-wrap text-xs font-normal leading-5 text-slate-500">
        {isVi ? signal.detailVi : signal.detailEn}
      </p>
    </div>
  </div>
);

const OverviewKpi: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  meta: string;
  onClick(): void;
}> = ({ icon, label, value, meta, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex min-h-[116px] min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-violet-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
  >
    <div className="flex min-w-0 items-center justify-between gap-3">
      <span className="crm-text-wrap text-xs font-medium leading-5 text-slate-600">
        {label}
      </span>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
        {icon}
      </span>
    </div>
    <div className="mt-2 crm-text-wrap text-lg font-semibold leading-7 text-slate-950">
      {value}
    </div>
    <div className="mt-auto flex min-w-0 items-end justify-between gap-2 pt-2 text-[10px] font-normal leading-4 text-slate-500">
      <span className="min-w-0 crm-text-wrap">{meta}</span>
      <ArrowRight
        size={13}
        className="shrink-0 transition group-hover:translate-x-0.5 group-hover:text-violet-600"
      />
    </div>
  </button>
);

const SnapshotField: React.FC<{
  label: string;
  value: string;
  action?: { label: string; onClick(): void };
}> = ({ label, value, action }) => (
  <div className="min-w-0">
    <dt className="text-[10px] font-normal leading-4 text-slate-500">{label}</dt>
    <dd className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <span className="min-w-0 crm-text-wrap text-sm font-medium leading-5 text-slate-800">
        {value || "—"}
      </span>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="inline-flex min-h-7 shrink-0 items-center gap-1 rounded-lg text-[10px] font-medium text-violet-700 transition hover:text-violet-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
        >
          <ContactRound size={12} />
          {action.label}
          <ArrowRight size={11} />
        </button>
      ) : null}
    </dd>
  </div>
);

function resolveCustomerWorkspaceTarget(customerTab: string): {
  tab: CustomerDetailTab;
  subTab?: string;
} {
  const targets: Record<string, { tab: CustomerDetailTab; subTab?: string }> = {
    overview: { tab: "overview" },
    detailInfo: { tab: "relationship", subTab: "profile" },
    contacts: { tab: "relationship", subTab: "people" },
    notes: { tab: "relationship", subTab: "notes" },
    sales: { tab: "sales", subTab: "opportunities" },
    opportunities: { tab: "sales", subTab: "opportunities" },
    quotations: { tab: "sales", subTab: "quotations" },
    purchaseHistory: { tab: "transactions", subTab: "history" },
    purchasedProducts: { tab: "transactions", subTab: "products" },
    orders: { tab: "transactions", subTab: "orders" },
    invoices: { tab: "transactions", subTab: "invoices" },
    shipping: { tab: "transactions", subTab: "shipping" },
    payments: { tab: "transactions", subTab: "payments" },
    returns: { tab: "transactions", subTab: "returns" },
    more: { tab: "transactions", subTab: "shipping" },
    care: { tab: "service", subTab: "support" },
    support: { tab: "service", subTab: "support" },
    activeTasks: { tab: "work", subTab: "tasks" },
  };
  return targets[customerTab] ?? { tab: "overview" };
}

function assessmentLabel(level: string, isVi: boolean): string {
  return level === "HEALTHY"
    ? isVi
      ? "Khỏe mạnh"
      : "Healthy"
    : level === "WATCH"
      ? isVi
        ? "Cần theo dõi"
        : "Watch"
      : level === "RISK"
        ? isVi
          ? "Có rủi ro"
          : "At risk"
        : isVi
          ? "Cảnh báo cao"
          : "Critical";
}

function assessmentBadgeClass(level: string): string {
  if (level === "HEALTHY") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (level === "WATCH") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function signalDotClass(kind: CustomerAssessmentSignal["kind"]): string {
  if (kind === "POSITIVE") return "bg-emerald-500";
  if (kind === "RISK") return "bg-rose-500";
  return "bg-amber-400";
}

function trendLabel(value: string, isVi: boolean): string {
  if (value === "IMPROVING") return isVi ? "Đang cải thiện" : "Improving";
  if (value === "DECLINING") return isVi ? "Đang giảm" : "Declining";
  return isVi ? "Ổn định" : "Stable";
}

function formatCurrency(value: number, isVi: boolean): string {
  return new Intl.NumberFormat(isVi ? "vi-VN" : "en-US", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDateTime(value: string, isVi: boolean): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(isVi ? "vi-VN" : "en-US", {
    dateStyle: "short",
    timeStyle: "short",
  });
}
