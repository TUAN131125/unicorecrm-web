import React, { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  CalendarRange,
  CheckCircle2,
  CircleDollarSign,
  FileCheck2,
  FileDown,
  FileText,
  GitCompareArrows,
  HeartHandshake,
  Printer,
  RefreshCw,
  ShoppingBag,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toWorkspacePath } from "@/platform/navigation";
import { SafeResponsiveContainer } from "@/components/charts/SafeResponsiveContainer";
import { ModulePageShell } from "@/components/crm/ModulePageShell";
import { PageHeaderActions } from "@/components/crm/PageHeaderActions";
import { Input, PageHeader } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import { flattenOrders } from "@/modules/orders";
import { useEffectiveAccess } from "@/platform/access-control";
import { resolveWorkspaceMemberName } from "@/platform/member-directory";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import {
  calculateCustomerPopulation,
  calculateDealsByStage,
  calculateOrdersByStatus,
  calculateQuotesByStatus,
  calculateTopCustomers,
  type StatusDistribution,
} from "@/workspaces/crm/read-models/analytics/reportReadModel";
import { useReportsReadModel } from "@/workspaces/crm/read-models/analytics/useReportsReadModel";
import { useWorkspaceOperationalConfiguration } from "@/platform/workspace-config";
import { buildCohortFunnel, buildCrmMetric, CRM_METRIC_IDS, getCrmMetricDefinition, resolveMetricPeriod, resolvePreviousMetricPeriod, type CrmMetricId, type MetricPeriodKey, type MetricResult } from "@/workspaces/crm/metrics";
import { MetricDrilldownDrawer } from "@/workspaces/crm/metrics/presentation/MetricDrilldownDrawer";
import { AdvancedForecastPanel } from "@/workspaces/crm/forecast/AdvancedForecastPanel";
import { OrderToCashPanel } from "@/workspaces/crm/order-to-cash/OrderToCashPanel";
import { ReportAnalysisTable, type ReportAnalysisRow, type ReportGroupOption } from "@/workspaces/crm/presentation/reports/ReportAnalysisTable";

type ReportSection = "overview" | "sales" | "customers" | "operations";

type Tone = "violet" | "blue" | "emerald" | "amber";

const CHART_COLORS = ["#7c3aed", "#2563eb", "#0891b2", "#059669", "#d97706", "#e11d48", "#64748b"];

interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  hint: string;
  icon: React.ReactNode;
  tone: Tone;
  onClick?: () => void;
  guidanceId?: string;
}

const metricTone: Record<Tone, string> = {
  violet: "bg-violet-50 text-violet-700 border-violet-100",
  blue: "bg-sky-50 text-sky-700 border-sky-100",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
  amber: "bg-amber-50 text-amber-700 border-amber-100",
};

const MetricCard: React.FC<MetricCardProps> = ({ label, value, hint, icon, tone, onClick, guidanceId }) => {
  const content = <div className="flex min-w-0 items-start gap-3">
    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${metricTone[tone]}`}>{icon}</div>
    <div className="min-w-0 flex-1">
      <div className="crm-text-wrap text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-1 break-words text-2xl font-bold tracking-tight text-slate-950 [overflow-wrap:anywhere]">{value}</div>
      <div className="mt-1 crm-text-wrap text-xs font-medium text-slate-500" title={hint}>{hint}</div>
    </div>
  </div>;
  const className = "min-w-0 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30";
  return onClick
    ? <button type="button" onClick={onClick} data-guidance-id={guidanceId} className={className} aria-label={`${label}: ${hint}`}>{content}</button>
    : <section data-guidance-id={guidanceId} className={className}>{content}</section>;
};

const ReportCard: React.FC<{
  title: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, icon, actions, children, className = "" }) => (
  <section className={`min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
    <header className="flex min-w-0 flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div className="flex min-w-0 items-start gap-3">
        {icon && <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">{icon}</div>}
        <div className="min-w-0">
          <h2 className="break-words text-sm font-semibold text-slate-950 [overflow-wrap:anywhere]">{title}</h2>
        </div>
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </header>
    {children}
  </section>
);

const StatusDonut: React.FC<{
  items: StatusDistribution[];
  labelFor(status: string): string;
  formatMoney(value: number): string;
  emptyText: string;
}> = ({ items, labelFor, formatMoney, emptyText }) => {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  if (total === 0) return <div className="px-5 py-14 text-center text-xs font-semibold text-slate-400">{emptyText}</div>;

  return (
    <div className="grid min-w-0 grid-cols-1 gap-2 px-4 py-4 sm:grid-cols-[150px_minmax(0,1fr)] lg:grid-cols-1 xl:grid-cols-[145px_minmax(0,1fr)]">
      <div className="relative mx-auto h-[145px] w-[145px]">
        <SafeResponsiveContainer height={145}>
          <PieChart>
            <Pie data={items} dataKey="count" nameKey="status" innerRadius={43} outerRadius={66} paddingAngle={3} stroke="none">
              {items.map((item, index) => <Cell key={item.status} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(value, _name, entry) => [Number(value ?? 0), entry.payload ? labelFor((entry.payload as StatusDistribution).status) : ""]} />
          </PieChart>
        </SafeResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-slate-950">{total}</span>
          <span className="text-[10px] font-medium text-slate-500">{emptyText.includes("Chưa") ? "mục" : "items"}</span>
        </div>
      </div>
      <div className="min-w-0 divide-y divide-slate-100">
        {items.map((item, index) => (
          <div key={item.status} className="flex min-w-0 items-center gap-2 py-2.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <span className="crm-text-wrap text-[11px] font-extrabold text-slate-700">{labelFor(item.status)}</span>
                <span className="shrink-0 text-[11px] font-black text-slate-950">{item.count}</span>
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-2 text-[9px] font-semibold text-slate-400">
                <span>{item.percentage}%</span>
                <span className="crm-text-wrap">{formatMoney(item.totalValue)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

function toValidDate(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export const ReportsPage: React.FC = () => {
  const { leads, customers, contacts, deals, quotes, orders, cases } = useReportsReadModel();
  const { locale } = useI18n();
  const workspace = useWorkspaceContextSnapshot();
  const configuration = useWorkspaceOperationalConfiguration();
  const access = useEffectiveAccess();
  const [searchParams, setSearchParams] = useSearchParams();
  const isVi = locale === "vi";
  const [section, setSection] = useState<ReportSection>("overview");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [comparePrevious, setComparePrevious] = useState(true);
  const [groupBy, setGroupBy] = useState("month");
  const [analysisQuery, setAnalysisQuery] = useState("");
  const [analysisSort, setAnalysisSort] = useState<"count" | "value" | "label">("value");
  const allowedPeriods: MetricPeriodKey[] = ["current_month", "current_quarter", "current_year", "all_time", "custom"];
  const requestedPeriod = searchParams.get("period") as MetricPeriodKey | null;
  const periodKey: MetricPeriodKey = requestedPeriod && allowedPeriods.includes(requestedPeriod) ? requestedPeriod : "current_year";
  const timezone = configuration.localeRegion.timezone;
  const todayKey = new Date().toISOString().slice(0, 10);
  const defaultStartDate = `${new Date().getFullYear()}-01-01`;
  const customStartDate = searchParams.get("start") ?? defaultStartDate;
  const customEndDate = searchParams.get("end") ?? todayKey;
  const selectedStartDate = periodKey === "custom" ? customStartDate : undefined;
  const selectedEndDate = periodKey === "custom" ? customEndDate : undefined;
  const reportPeriod = resolveMetricPeriod(periodKey, new Date(), timezone, { startDate: selectedStartDate, endDate: selectedEndDate });
  const previousPeriod = resolvePreviousMetricPeriod(reportPeriod);
  const metricDataset = useMemo(() => ({ leads, deals, quotes, orders, customers, cases }), [leads, deals, quotes, orders, customers, cases]);
  const metricFor = (metricId: CrmMetricId) => buildCrmMetric({ ...metricDataset, metricId, periodKey, timezone, startDate: selectedStartDate, endDate: selectedEndDate });
  const previousMetricFor = (metricId: CrmMetricId) => previousPeriod
    ? buildCrmMetric({ ...metricDataset, metricId, periodKey: "custom", timezone, startDate: previousPeriod.startDate, endDate: previousPeriod.endDate })
    : undefined;

  const flatOrders = useMemo(() => flattenOrders(orders), [orders]);
  const cohortFunnel = useMemo(() => buildCohortFunnel({ ...metricDataset, periodKey, timezone, startDate: selectedStartDate, endDate: selectedEndDate }), [metricDataset, periodKey, timezone, selectedStartDate, selectedEndDate]);
  const dealStats = useMemo(() => calculateDealsByStage(deals), [deals]);
  const quoteStats = useMemo(() => calculateQuotesByStatus(quotes), [quotes]);
  const orderStats = useMemo(() => calculateOrdersByStatus(orders), [orders]);
  const topCustomers = useMemo(() => calculateTopCustomers(customers, orders), [customers, orders]);
  const customerPopulation = useMemo(() => calculateCustomerPopulation(customers, orders), [customers, orders]);
  const completedRevenueMetric = useMemo(() => metricFor(CRM_METRIC_IDS.MONTHLY_COMPLETED_REVENUE), [metricDataset, periodKey, timezone]);
  const openPipelineMetric = useMemo(() => metricFor(CRM_METRIC_IDS.OPEN_PIPELINE_VALUE), [metricDataset, periodKey, timezone]);
  const leadQualificationMetric = useMemo(() => metricFor(CRM_METRIC_IDS.LEAD_QUALIFICATION_RATE), [metricDataset, periodKey, timezone]);
  const quoteAcceptanceMetric = useMemo(() => metricFor(CRM_METRIC_IDS.QUOTE_ACCEPTANCE_RATE), [metricDataset, periodKey, timezone]);
  const completedOrdersMetric = useMemo(() => metricFor(CRM_METRIC_IDS.COMPLETED_ORDERS), [metricDataset, periodKey, timezone]);
  const previousCompletedRevenueMetric = useMemo(() => previousMetricFor(CRM_METRIC_IDS.MONTHLY_COMPLETED_REVENUE), [metricDataset, previousPeriod?.startDate, previousPeriod?.endDate, timezone]);
  const previousLeadQualificationMetric = useMemo(() => previousMetricFor(CRM_METRIC_IDS.LEAD_QUALIFICATION_RATE), [metricDataset, previousPeriod?.startDate, previousPeriod?.endDate, timezone]);
  const previousQuoteAcceptanceMetric = useMemo(() => previousMetricFor(CRM_METRIC_IDS.QUOTE_ACCEPTANCE_RATE), [metricDataset, previousPeriod?.startDate, previousPeriod?.endDate, timezone]);
  const requestedMetricId = searchParams.get("metric");
  const selectedMetric = useMemo(() => {
    const definition = getCrmMetricDefinition(requestedMetricId ?? "");
    if (!definition || !definition.requiredCapabilities.every((capability) => access.can(capability))) return undefined;
    return metricFor(requestedMetricId as CrmMetricId);
  }, [requestedMetricId, metricDataset, periodKey, timezone, access]);

  const completedRevenue = completedRevenueMetric.value;
  const openPipeline = openPipelineMetric.value;
  const leadConversion = leadQualificationMetric.value;
  const quoteAcceptance = quoteAcceptanceMetric.value;
  const completedOrders = completedOrdersMetric.value;
  const openDeals = openPipelineMetric.records.length;
  const openCases = cases.filter((item) => !["RESOLVED", "CLOSED", "CANCELLED"].includes(String(item.status).toUpperCase())).length;
  const urgentCases = cases.filter((item) => ["URGENT", "HIGH", "CRITICAL"].includes(String(item.priority).toUpperCase())).length;
  const activeCustomers = customerPopulation.active;
  const canExport = access.canPerform("reports", "export");

  const crmPath = (relativePath: string) => toWorkspacePath(workspace.workspaceKey, "crm", relativePath);
  const formatMoney = (amount: number) => new Intl.NumberFormat(isVi ? "vi-VN" : "en-US", {
    style: "currency",
    currency: configuration.localeRegion.currencies.baseCurrency,
    maximumFractionDigits: 0,
  }).format(amount);
  const formatCompactMoney = (amount: number) => new Intl.NumberFormat(isVi ? "vi-VN" : "en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
  const formatMetricValue = (metric: MetricResult) => metric.definition.valueKind === "currency"
    ? formatMoney(metric.value)
    : metric.definition.valueKind === "percentage" ? `${metric.value}%` : metric.value.toLocaleString(isVi ? "vi-VN" : "en-US");
  const openMetric = (metric: MetricResult) => {
    if (!metric.definition.requiredCapabilities.every((capability) => access.can(capability))) return;
    const next = new URLSearchParams(searchParams);
    next.set("metric", metric.definition.id);
    next.set("period", periodKey);
    setSearchParams(next, { replace: false });
  };
  const closeMetric = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("metric");
    setSearchParams(next, { replace: true });
  };
  const changePeriod = (nextPeriod: MetricPeriodKey) => {
    const next = new URLSearchParams(searchParams);
    next.set("period", nextPeriod);
    if (nextPeriod === "custom") {
      if (!next.get("start")) next.set("start", customStartDate);
      if (!next.get("end")) next.set("end", customEndDate);
    } else {
      next.delete("start");
      next.delete("end");
    }
    setSearchParams(next, { replace: true });
  };
  const changeCustomDate = (key: "start" | "end", value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("period", "custom");
    next.set(key, value);
    if (!next.get(key === "start" ? "end" : "start")) next.set(key === "start" ? "end" : "start", key === "start" ? customEndDate : customStartDate);
    setSearchParams(next, { replace: true });
  };
  const returnPath = searchParams.get("returnTo") === "dashboard" ? crmPath("dashboard") : undefined;
  const forecastPeriod = periodKey === "all_time" ? resolveMetricPeriod("current_year", new Date(), timezone) : reportPeriod;
  const forecastStart = `${forecastPeriod.startDate ?? new Date().getFullYear() + "-01-01"}T00:00:00`;
  const forecastEnd = `${forecastPeriod.endDate ?? new Date().getFullYear() + "-12-31"}T23:59:59`;

  const statusLabel = (status: string) => {
    const key = status.toUpperCase();
    const labels: Record<string, [string, string]> = {
      DRAFT: ["Bản nháp", "Draft"], REVIEW: ["Chờ duyệt", "Review"], SENT: ["Đã gửi", "Sent"],
      ACCEPTED: ["Đã chấp nhận", "Accepted"], REJECTED: ["Từ chối", "Rejected"], EXPIRED: ["Hết hiệu lực", "Expired"],
      DISCOVERY: ["Khám phá", "Discovery"], QUALIFIED: ["Đã xác nhận", "Qualified"], SOLUTION: ["Giải pháp", "Solution"],
      PROPOSAL: ["Đề xuất", "Proposal"], NEGOTIATION: ["Thương thảo", "Negotiation"], WON: ["Thành công", "Won"], LOST: ["Thất bại", "Lost"],
      CONFIRMED: ["Đã xác nhận", "Confirmed"], PROCESSING: ["Đang xử lý", "Processing"], COMPLETED: ["Hoàn thành", "Completed"], CANCELLED: ["Đã hủy", "Cancelled"],
    };
    return labels[key] ? (isVi ? labels[key][0] : labels[key][1]) : status;
  };

  const monthlyRevenue = useMemo(() => {
    const dated = flatOrders.map((order) => ({ order, date: toValidDate(order.completedAt ?? order.orderDate ?? order.createdAt) })).filter((entry): entry is { order: typeof flatOrders[number]; date: Date } => Boolean(entry.date));
    const latest = dated.reduce<Date | null>((current, entry) => !current || entry.date > current ? entry.date : current, null) ?? new Date();
    const monthKeys = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(latest.getFullYear(), latest.getMonth() - (5 - index), 1);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    });
    return monthKeys.map((key) => {
      const date = new Date(`${key}-01T00:00:00`);
      const monthOrders = dated.filter((entry) => `${entry.date.getFullYear()}-${String(entry.date.getMonth() + 1).padStart(2, "0")}` === key && String(entry.order.state).toUpperCase() === "COMPLETED");
      return {
        key,
        month: new Intl.DateTimeFormat(isVi ? "vi-VN" : "en-US", { month: "short", year: "2-digit" }).format(date),
        revenue: monthOrders.reduce((sum, entry) => sum + (entry.order.grandTotal ?? entry.order.totalAmount ?? 0), 0),
        orders: monthOrders.length,
      };
    });
  }, [flatOrders, isVi]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    window.setTimeout(() => {
      setRefreshKey((value) => value + 1);
      setIsRefreshing(false);
    }, 450);
  };

  const handleExport = () => {
    if (!canExport) return;
    const rows: Array<Array<string | number>> = [
      ["category", "metric", "value"], ["summary", "completed_revenue", completedRevenue], ["summary", "open_pipeline", openPipeline],
      ["summary", "lead_conversion_percent", leadConversion], ["summary", "quote_acceptance_percent", quoteAcceptance],
      ["summary", "customers", customerPopulation.total], ["summary", "contacts", contacts.length], ["summary", "open_cases", openCases],
      ...monthlyRevenue.map((item) => ["monthly_completed_revenue", item.key, item.revenue]),
      ...dealStats.map((item) => ["deal_stage", item.status, item.count]), ...quoteStats.map((item) => ["quote_status", item.status, item.count]),
      ...orderStats.map((item) => ["order_status", item.status, item.count]),
    ];
    const content = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `UnicoreCRM_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const handlePrint = () => window.print();

  const comparisonHint = (metric: MetricResult, previous: MetricResult | undefined, fallback: string) => {
    if (!comparePrevious || !previous || !previousPeriod) return fallback;
    const delta = metric.value - previous.value;
    const sign = delta > 0 ? "+" : "";
    if (metric.definition.valueKind === "currency") return `${sign}${formatMoney(delta)} ${isVi ? "so với kỳ trước" : "vs previous period"}`;
    if (metric.definition.valueKind === "percentage") return `${sign}${Math.round(delta * 10) / 10} ${isVi ? "điểm % so với kỳ trước" : "pp vs previous period"}`;
    return `${sign}${delta.toLocaleString(isVi ? "vi-VN" : "en-US")} ${isVi ? "so với kỳ trước" : "vs previous period"}`;
  };

  const sectionOptions: Array<{ id: ReportSection; label: string; icon: React.ReactNode }> = [
    { id: "overview", label: isVi ? "Tổng quan" : "Overview", icon: <BarChart3 size={14} /> },
    { id: "sales", label: isVi ? "Bán hàng" : "Sales", icon: <BriefcaseBusiness size={14} /> },
    { id: "customers", label: isVi ? "Khách hàng" : "Customers", icon: <Users size={14} /> },
    { id: "operations", label: isVi ? "Vận hành" : "Operations", icon: <HeartHandshake size={14} /> },
  ];

  const groupOptionsBySection: Record<ReportSection, ReportGroupOption[]> = {
    overview: [
      { id: "month", label: isVi ? "Tháng" : "Month" },
      { id: "stage", label: isVi ? "Giai đoạn cơ hội" : "Deal stage" },
      { id: "source", label: isVi ? "Nguồn khách hàng tiềm năng" : "Lead source" },
      { id: "order_status", label: isVi ? "Trạng thái đơn" : "Order status" },
    ],
    sales: [
      { id: "stage", label: isVi ? "Giai đoạn cơ hội" : "Deal stage" },
      { id: "owner", label: isVi ? "Người phụ trách" : "Owner" },
      { id: "source", label: isVi ? "Nguồn khách hàng tiềm năng" : "Lead source" },
      { id: "month", label: isVi ? "Tháng doanh thu" : "Revenue month" },
    ],
    customers: [
      { id: "customer_revenue", label: isVi ? "Doanh thu khách hàng" : "Customer revenue" },
      { id: "customer_status", label: isVi ? "Trạng thái khách hàng" : "Customer status" },
    ],
    operations: [
      { id: "order_status", label: isVi ? "Trạng thái đơn" : "Order status" },
      { id: "support_priority", label: isVi ? "Ưu tiên hỗ trợ" : "Support priority" },
    ],
  };
  const groupOptions = groupOptionsBySection[section];
  const effectiveGroupBy = groupOptions.some((option) => option.id === groupBy) ? groupBy : groupOptions[0].id;
  const analysisRows = useMemo<ReportAnalysisRow[]>(() => {
    if (effectiveGroupBy === "month") return monthlyRevenue.map((item) => ({ id: item.key, label: item.month, secondary: isVi ? `${item.orders} đơn hoàn tất` : `${item.orders} completed orders`, count: item.orders, value: item.revenue, route: crmPath("orders") }));
    if (effectiveGroupBy === "stage") return dealStats.map((item) => ({ id: item.status, label: statusLabel(item.status), count: item.count, value: item.totalValue, route: crmPath("deals") }));
    if (effectiveGroupBy === "order_status") return orderStats.map((item) => ({ id: item.status, label: statusLabel(item.status), count: item.count, value: item.totalValue, route: crmPath("orders") }));
    if (effectiveGroupBy === "customer_revenue") return topCustomers.map((item) => ({ id: item.customerId, label: item.customerName, secondary: isVi ? `${item.orderCount} đơn liên quan` : `${item.orderCount} related orders`, count: item.orderCount, value: item.totalSpent, route: crmPath(`customers/${item.customerId}`) }));
    if (effectiveGroupBy === "customer_status") {
      const grouped = new Map<string, number>();
      for (const customer of customers) grouped.set(String(customer.status), (grouped.get(String(customer.status)) ?? 0) + 1);
      return [...grouped.entries()].map(([status, count]) => ({ id: status, label: statusLabel(status), count, route: crmPath("customers") }));
    }
    if (effectiveGroupBy === "support_priority") {
      const grouped = new Map<string, number>();
      for (const item of cases) grouped.set(String(item.priority), (grouped.get(String(item.priority)) ?? 0) + 1);
      return [...grouped.entries()].map(([priority, count]) => ({ id: priority, label: priority, count, route: crmPath("support/cases") }));
    }
    if (effectiveGroupBy === "owner") {
      const grouped = new Map<string, { count: number; value: number }>();
      for (const deal of deals) {
        const current = grouped.get(deal.ownerId) ?? { count: 0, value: 0 };
        current.count += 1;
        current.value += deal.amount;
        grouped.set(deal.ownerId, current);
      }
      return [...grouped.entries()].map(([ownerId, aggregate]) => ({ id: ownerId, label: resolveWorkspaceMemberName(ownerId), count: aggregate.count, value: aggregate.value, route: crmPath("deals") }));
    }
    const grouped = new Map<string, { count: number; value: number }>();
    for (const lead of leads) {
      const source = lead.source || (isVi ? "Không xác định" : "Unknown");
      const current = grouped.get(source) ?? { count: 0, value: 0 };
      current.count += 1;
      current.value += lead.expectedValue ?? 0;
      grouped.set(source, current);
    }
    return [...grouped.entries()].map(([source, aggregate]) => ({ id: source, label: source, count: aggregate.count, value: aggregate.value, route: crmPath("leads") }));
  }, [effectiveGroupBy, monthlyRevenue, dealStats, orderStats, topCustomers, customers, cases, deals, leads, isVi, workspace.workspaceKey]);

  const insights = [
    leadConversion < 30 ? (isVi ? "Tỷ lệ khách hàng tiềm năng đủ điều kiện dưới 30%; nên rà soát nguồn và tiêu chí đánh giá." : "Qualified-lead rate is below 30%; review sources and qualification criteria.") : null,
    quoteAcceptance < 35 ? (isVi ? "Tỷ lệ báo giá được chấp nhận còn thấp; nên kiểm tra giá, chiết khấu và tốc độ phản hồi." : "Quote acceptance is low; review pricing, discounts and response time.") : null,
    urgentCases > 0 ? (isVi ? `${urgentCases} phiếu hỗ trợ ưu tiên cao cần được xử lý.` : `${urgentCases} high-priority support cases need attention.`) : null,
    openPipeline > completedRevenue * 2 && openPipeline > 0 ? (isVi ? "Cơ hội đang mở lớn hơn gấp đôi doanh thu hoàn tất; cần rà soát xác suất và ngày chốt." : "Open pipeline is more than twice completed revenue; review probability and close dates.") : null,
  ].filter(Boolean) as string[];

  return (
    <ModulePageShell key={refreshKey} id="reports-dashboard-container" className="min-w-0" data-report-design="v2">
      <PageHeader
        title={isVi ? "Báo cáo & phân tích" : "Reports & analytics"}
        icon={<BarChart3 size={18} />}
        actions={<PageHeaderActions actions={[
          { id: "reports-refresh", label: isVi ? "Làm mới" : "Refresh", icon: <RefreshCw size={13} className={isRefreshing ? "animate-spin" : ""} />, onClick: handleRefresh, disabled: isRefreshing, variant: "secondary" },
          { id: "reports-print", label: isVi ? "In / PDF" : "Print / PDF", icon: <Printer size={13} />, onClick: handlePrint, variant: "secondary" },
          { id: "reports-export", label: isVi ? "Xuất dữ liệu" : "Export data", icon: <FileDown size={13} />, onClick: handleExport, disabled: !canExport, tooltip: !canExport ? (isVi ? "Bạn không có quyền xuất báo cáo." : "You do not have report export permission.") : undefined, variant: "primary" },
        ]} />}
      />
      {returnPath ? <Link data-guidance-id="reports.return-dashboard" to={returnPath} className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"><ArrowRight size={13} className="rotate-180" />{isVi ? "Quay lại Dashboard" : "Back to Dashboard"}</Link> : null}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex min-w-0 gap-2 overflow-x-auto border-b border-slate-100 p-2" role="tablist" aria-label={isVi ? "Nhóm báo cáo" : "Report sections"}>
          {sectionOptions.map((option) => {
            const active = section === option.id;
            return <button key={option.id} type="button" role="tab" aria-selected={active} onClick={() => setSection(option.id)} className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 text-xs font-semibold transition-all ${active ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}>{option.icon}<span>{option.label}</span></button>;
          })}
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[210px_160px_160px]">
            <label className="min-w-0 space-y-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
              <span className="flex items-center gap-1.5"><CalendarRange size={12} />{isVi ? "Kỳ báo cáo" : "Report period"}</span>
              <select data-guidance-id="reports.period.selector" value={periodKey} onChange={(event) => changePeriod(event.target.value as MetricPeriodKey)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold normal-case tracking-normal text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100">
                <option value="current_month">{isVi ? "Tháng hiện tại" : "Current month"}</option>
                <option value="current_quarter">{isVi ? "Quý hiện tại" : "Current quarter"}</option>
                <option value="current_year">{isVi ? "Năm hiện tại" : "Current year"}</option>
                <option value="all_time">{isVi ? "Toàn bộ thời gian" : "All time"}</option>
                <option value="custom">{isVi ? "Khoảng tùy chọn" : "Custom range"}</option>
              </select>
            </label>
            {periodKey === "custom" ? <>
              <Input label={isVi ? "Từ ngày" : "From"} type="date" value={customStartDate} max={customEndDate} onChange={(event) => changeCustomDate("start", event.target.value)} className="h-10 bg-white text-xs font-bold" />
              <Input label={isVi ? "Đến ngày" : "To"} type="date" value={customEndDate} min={customStartDate} max={todayKey} onChange={(event) => changeCustomDate("end", event.target.value)} className="h-10 bg-white text-xs font-bold" />
            </> : null}
          </div>
          <button type="button" onClick={() => setComparePrevious((current) => !current)} disabled={!previousPeriod} className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3.5 text-xs font-bold transition ${comparePrevious && previousPeriod ? "border-violet-200 bg-violet-50 text-violet-800" : "border-slate-200 bg-white text-slate-600"} disabled:cursor-not-allowed disabled:opacity-45`}><GitCompareArrows size={14} />{isVi ? "So sánh kỳ trước" : "Compare previous"}</button>
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label={completedRevenueMetric.definition.title[locale]} value={formatMetricValue(completedRevenueMetric)} hint={comparisonHint(completedRevenueMetric, previousCompletedRevenueMetric, isVi ? `${completedOrders} đơn nguồn · Nhấn để kiểm tra` : `${completedOrders} source orders · Click to inspect`)} icon={<CircleDollarSign size={18} />} tone="emerald" onClick={() => openMetric(completedRevenueMetric)} guidanceId="reports.metric.completed-revenue" />
        <MetricCard label={openPipelineMetric.definition.title[locale]} value={formatMetricValue(openPipelineMetric)} hint={isVi ? `${openDeals} cơ hội đang mở · Ảnh chụp hiện tại` : `${openDeals} open deals · Current snapshot`} icon={<TrendingUp size={18} />} tone="violet" onClick={() => openMetric(openPipelineMetric)} guidanceId="reports.metric.open-pipeline" />
        <MetricCard label={leadQualificationMetric.definition.title[locale]} value={formatMetricValue(leadQualificationMetric)} hint={comparisonHint(leadQualificationMetric, previousLeadQualificationMetric, isVi ? `${leadQualificationMetric.numerator ?? 0}/${leadQualificationMetric.denominator ?? 0} khách hàng tiềm năng trong kỳ` : `${leadQualificationMetric.numerator ?? 0}/${leadQualificationMetric.denominator ?? 0} period leads`)} icon={<Target size={18} />} tone="blue" onClick={() => openMetric(leadQualificationMetric)} guidanceId="reports.metric.lead-qualification" />
        <MetricCard label={quoteAcceptanceMetric.definition.title[locale]} value={formatMetricValue(quoteAcceptanceMetric)} hint={comparisonHint(quoteAcceptanceMetric, previousQuoteAcceptanceMetric, isVi ? `${quoteAcceptanceMetric.numerator ?? 0}/${quoteAcceptanceMetric.denominator ?? 0} báo giá trong kỳ` : `${quoteAcceptanceMetric.numerator ?? 0}/${quoteAcceptanceMetric.denominator ?? 0} period quotes`)} icon={<FileCheck2 size={18} />} tone="amber" onClick={() => openMetric(quoteAcceptanceMetric)} guidanceId="reports.metric.quote-acceptance" />
      </div>

      <div className="flex flex-col gap-1 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs text-sky-900 sm:flex-row sm:items-center sm:justify-between">
        <span className="font-semibold">{isVi ? "Phạm vi dữ liệu" : "Data scope"}</span>
        <span>{completedRevenueMetric.period.label[locale]}{reportPeriod.startDate && reportPeriod.endDate ? ` · ${reportPeriod.startDate} → ${reportPeriod.endDate}` : ""} · {timezone} · {isVi ? "KPI snapshot được ghi nhãn riêng và không bị hiểu nhầm là dữ liệu theo kỳ." : "Snapshot KPIs are labeled separately and are not presented as period metrics."}</span>
      </div>

      <ReportAnalysisTable
        isVi={isVi}
        rows={analysisRows}
        groupBy={effectiveGroupBy}
        groupOptions={groupOptions}
        onGroupByChange={setGroupBy}
        query={analysisQuery}
        onQueryChange={setAnalysisQuery}
        sortBy={analysisSort}
        onSortByChange={setAnalysisSort}
        formatMoney={formatMoney}
      />

      {(section === "overview" || section === "sales") && (
        <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,.85fr)]">
          <ReportCard title={isVi ? "Xu hướng doanh thu hoàn tất" : "Completed revenue trend"} icon={<CircleDollarSign size={17} />}>
            <div className="h-[310px] min-w-0 px-2 pb-4 pt-5 sm:px-5">
              <SafeResponsiveContainer height={285}>
                <AreaChart data={monthlyRevenue} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                  <defs><linearGradient id="reportsRevenueArea" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#7c3aed" stopOpacity={0.28} /><stop offset="95%" stopColor="#7c3aed" stopOpacity={0.02} /></linearGradient></defs>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#64748b" }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#64748b" }} tickFormatter={formatCompactMoney} width={54} />
                  <Tooltip formatter={(value, name) => [name === "revenue" ? formatMoney(Number(value ?? 0)) : Number(value ?? 0), name === "revenue" ? (isVi ? "Doanh thu" : "Revenue") : (isVi ? "Đơn hoàn tất" : "Completed orders")]} />
                  <Area type="monotone" dataKey="revenue" stroke="#7c3aed" strokeWidth={3} fill="url(#reportsRevenueArea)" dot={{ r: 3, fill: "#7c3aed" }} activeDot={{ r: 5 }} />
                </AreaChart>
              </SafeResponsiveContainer>
            </div>
          </ReportCard>

          <ReportCard title={isVi ? "Điểm cần chú ý" : "Attention points"} icon={<AlertTriangle size={17} />}>
            <div className="space-y-3 px-5 py-5">
              {insights.length === 0 ? <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-xs font-semibold leading-relaxed text-emerald-800"><div className="flex items-center gap-2 font-extrabold"><CheckCircle2 size={15} />{isVi ? "Không có cảnh báo nổi bật" : "No major alerts"}</div><p className="mt-2">{isVi ? "Các chỉ số chính chưa vượt ngưỡng cảnh báo cơ bản." : "Headline metrics are within baseline alert thresholds."}</p></div> : insights.map((insight, index) => <div key={insight} className="flex min-w-0 gap-3 rounded-2xl border border-amber-100 bg-amber-50/70 p-4"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white text-[11px] font-black text-amber-600 shadow-sm">{index + 1}</span><p className="min-w-0 break-words text-xs font-semibold leading-relaxed text-amber-950 [overflow-wrap:anywhere]">{insight}</p></div>)}
            </div>
          </ReportCard>
        </div>
      )}

      {(section === "overview" || section === "sales") && (
        <ReportCard title={isVi ? "Funnel chuyển đổi theo cohort" : "Cohort conversion funnel"} icon={<TrendingUp size={17} />} actions={<span className="max-w-[360px] text-right text-[10px] font-medium leading-4 text-slate-500">{cohortFunnel.definition[locale]}</span>}>
          <div data-guidance-id="reports.cohort-funnel" className="h-[330px] min-w-0 px-2 pb-4 pt-5 sm:px-5">
            <SafeResponsiveContainer height={305}>
              <BarChart data={cohortFunnel.stages.map((item) => ({ name: item.label[locale], count: item.count, percent: item.percentageOfCohort }))} layout="vertical" margin={{ top: 4, right: 28, bottom: 4, left: 20 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#64748b" }} />
                <YAxis type="category" dataKey="name" width={150} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#334155", fontWeight: 600 }} />
                <Tooltip cursor={{ fill: "#f8fafc" }} formatter={(value, name) => [Number(value ?? 0), name === "count" ? (isVi ? "Số lượng" : "Count") : (isVi ? "% của cohort" : "% of cohort")]} />
                <Bar dataKey="count" fill="#7c3aed" radius={[0, 8, 8, 0]} barSize={20} />
              </BarChart>
            </SafeResponsiveContainer>
          </div>
        </ReportCard>
      )}

      {(section === "overview" || section === "sales") && (
        <AdvancedForecastPanel workspaceId={workspace.workspaceId} locale={locale} deals={deals} periodStart={forecastStart} periodEnd={forecastEnd} formatMoney={formatMoney} />
      )}

      {(section === "overview" || section === "sales") && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <strong className="text-slate-900">{isVi ? "Ảnh chụp độc lập:" : "Independent snapshots:"}</strong> {isVi ? "Các tập dữ liệu độc lập bên dưới là ảnh chụp hiện tại và không được dùng như một funnel chuyển đổi." : "The independent datasets below are current snapshots and must not be interpreted as a conversion funnel."}
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3">
          <ReportCard title={isVi ? "Cơ hội theo giai đoạn" : "Deals by stage"} icon={<BriefcaseBusiness size={16} />}><StatusDonut items={dealStats} labelFor={statusLabel} formatMoney={formatMoney} emptyText={isVi ? "Chưa có dữ liệu cơ hội." : "No deal data yet."} /></ReportCard>
          <ReportCard title={isVi ? "Báo giá theo trạng thái" : "Quotes by status"} icon={<FileText size={16} />}><StatusDonut items={quoteStats} labelFor={statusLabel} formatMoney={formatMoney} emptyText={isVi ? "Chưa có dữ liệu báo giá." : "No quote data yet."} /></ReportCard>
          <ReportCard title={isVi ? "Đơn hàng theo trạng thái" : "Orders by status"} icon={<ShoppingBag size={16} />}><StatusDonut items={orderStats} labelFor={statusLabel} formatMoney={formatMoney} emptyText={isVi ? "Chưa có dữ liệu đơn hàng." : "No order data yet."} /></ReportCard>
          </div>
        </div>
      )}

      {(section === "overview" || section === "customers") && (
        <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,.8fr)]">
          <ReportCard title={isVi ? "Khách hàng theo doanh thu hoàn tất" : "Customers by completed revenue"} icon={<Users size={17} />}>
            {topCustomers.length === 0 ? <div className="px-5 py-14 text-center text-xs font-semibold text-slate-400">{isVi ? "Chưa có dữ liệu doanh thu theo khách hàng." : "No customer revenue data yet."}</div> : <div className="overflow-x-auto"><table className="min-w-[680px] w-full text-left text-xs"><thead className="border-b border-slate-100 bg-slate-50 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400"><tr><th className="px-5 py-3">{isVi ? "Khách hàng" : "Customer"}</th><th className="px-5 py-3 text-center">{isVi ? "Đơn liên quan" : "Related orders"}</th><th className="px-5 py-3 text-right">{isVi ? "Doanh thu hoàn tất" : "Completed revenue"}</th><th className="px-5 py-3 text-right">{isVi ? "Hồ sơ" : "Profile"}</th></tr></thead><tbody className="divide-y divide-slate-100">{topCustomers.map((customer, index) => <tr key={customer.customerId} className="hover:bg-slate-50/70"><td className="px-5 py-3.5"><div className="flex min-w-0 items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-[11px] font-black text-violet-700">{index + 1}</span><div className="min-w-0"><div className="max-w-[360px] crm-text-wrap font-extrabold text-slate-900">{customer.customerName}</div><div className="mt-0.5 crm-text-wrap text-[10px] font-medium text-slate-500">{isVi ? `${customer.orderCount} đơn hàng liên quan` : `${customer.orderCount} related orders`}</div></div></div></td><td className="px-5 py-3.5 text-center font-bold text-slate-600">{customer.orderCount}</td><td className="px-5 py-3.5 text-right font-mono font-black text-slate-900">{formatMoney(customer.totalSpent)}</td><td className="px-5 py-3.5 text-right"><Link to={crmPath(`customers/${customer.customerId}`)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-extrabold text-violet-700 hover:bg-violet-50">{isVi ? "Mở" : "Open"}<ArrowRight size={11} /></Link></td></tr>)}</tbody></table></div>}
          </ReportCard>

          <ReportCard title={isVi ? "Quy mô dữ liệu quan hệ" : "Relationship data scale"} icon={<Users size={17} />}>
            <div className="grid grid-cols-2 gap-3 px-5 py-5">{[
              { label: isVi ? "Khách hàng" : "Customers", value: customerPopulation.total, accent: "text-violet-700 bg-violet-50" },
              { label: isVi ? "Đang hoạt động" : "Active", value: activeCustomers, accent: "text-emerald-700 bg-emerald-50" },
              { label: isVi ? "Có giao dịch" : "With transactions", value: customerPopulation.withTransactions, accent: "text-sky-700 bg-sky-50" },
              { label: isVi ? "Chưa có giao dịch" : "Without transactions", value: customerPopulation.withoutTransactions, accent: "text-slate-700 bg-slate-100" },
              { label: isVi ? "Tổ chức" : "Organizations", value: customerPopulation.b2b, accent: "text-indigo-700 bg-indigo-50" },
              { label: isVi ? "Cá nhân" : "Individuals", value: customerPopulation.b2c, accent: "text-fuchsia-700 bg-fuchsia-50" },
              { label: isVi ? "Liên hệ" : "Contacts", value: contacts.length, accent: "text-cyan-700 bg-cyan-50" },
              { label: isVi ? "Giá trị trung bình" : "Average value", value: topCustomers.length ? formatCompactMoney(topCustomers.reduce((sum, item) => sum + item.totalSpent, 0) / topCustomers.length) : "0", accent: "text-amber-700 bg-amber-50" },
            ].map((item) => <div key={item.label} className={`min-w-0 rounded-2xl p-4 ${item.accent}`}><div className="crm-text-wrap text-[10px] font-black uppercase tracking-wider opacity-70">{item.label}</div><div className="mt-2 break-words text-xl font-black [overflow-wrap:anywhere]">{item.value}</div></div>)}</div>
          </ReportCard>
        </div>
      )}

      {(section === "overview" || section === "operations") && (
        <OrderToCashPanel locale={locale} orders={flatOrders} refreshKey={refreshKey} />
      )}

      {(section === "overview" || section === "operations") && (
        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
          <ReportCard title={isVi ? "Chăm sóc khách hàng" : "Customer care"} icon={<HeartHandshake size={17} />} actions={<Link to={crmPath("support/cases")} className="inline-flex items-center gap-1 text-[11px] font-extrabold text-violet-700 hover:underline">{isVi ? "Mở danh sách" : "Open list"}<ArrowRight size={11} /></Link>}>
            <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:grid-cols-[minmax(0,1fr)_180px]"><div className="grid grid-cols-2 gap-3"><div className="rounded-2xl bg-slate-50 p-4"><div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{isVi ? "Tổng phiếu" : "Total cases"}</div><div className="mt-2 text-2xl font-black text-slate-950">{cases.length}</div></div><div className="rounded-2xl bg-amber-50 p-4"><div className="text-[10px] font-black uppercase tracking-wider text-amber-600">{isVi ? "Đang mở" : "Open"}</div><div className="mt-2 text-2xl font-black text-amber-800">{openCases}</div></div><div className="rounded-2xl bg-rose-50 p-4"><div className="text-[10px] font-black uppercase tracking-wider text-rose-600">{isVi ? "Ưu tiên cao" : "High priority"}</div><div className="mt-2 text-2xl font-black text-rose-800">{urgentCases}</div></div><div className="rounded-2xl bg-emerald-50 p-4"><div className="text-[10px] font-black uppercase tracking-wider text-emerald-600">{isVi ? "Đã đóng" : "Closed"}</div><div className="mt-2 text-2xl font-black text-emerald-800">{Math.max(cases.length - openCases, 0)}</div></div></div><div className="relative h-[180px] min-w-0"><SafeResponsiveContainer height={180}><PieChart><Pie data={[{ name: isVi ? "Đang mở" : "Open", value: openCases }, { name: isVi ? "Đã đóng" : "Closed", value: Math.max(cases.length - openCases, 0) }]} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={4} stroke="none"><Cell fill="#f59e0b" /><Cell fill="#10b981" /></Pie><Tooltip /></PieChart></SafeResponsiveContainer><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-2xl font-black text-slate-950">{cases.length}</span><span className="text-[10px] font-medium text-slate-500">{isVi ? "phiếu" : "tickets"}</span></div></div></div>
          </ReportCard>

          <ReportCard title={isVi ? "Vận hành đơn hàng" : "Order operations"} icon={<ShoppingBag size={17} />} actions={<Link to={crmPath("orders")} className="inline-flex items-center gap-1 text-[11px] font-extrabold text-violet-700 hover:underline">{isVi ? "Mở đơn hàng" : "Open orders"}<ArrowRight size={11} /></Link>}>
            <div className="h-[260px] min-w-0 px-2 pb-3 pt-4 sm:px-5">{orderStats.length === 0 ? <div className="flex h-full items-center justify-center text-xs font-semibold text-slate-400">{isVi ? "Chưa có dữ liệu đơn hàng." : "No order data yet."}</div> : <SafeResponsiveContainer height={240}><BarChart data={orderStats.map((item) => ({ name: statusLabel(item.status), count: item.count, value: item.totalValue }))} margin={{ top: 4, right: 8, bottom: 12, left: 0 }}><CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#64748b" }} interval={0} /><YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fontSize: 9, fill: "#64748b" }} /><Tooltip formatter={(value, name) => [name === "count" ? Number(value ?? 0) : formatMoney(Number(value ?? 0)), name === "count" ? (isVi ? "Số đơn" : "Orders") : (isVi ? "Giá trị" : "Value")]} /><Bar dataKey="count" fill="#2563eb" radius={[7, 7, 0, 0]} barSize={28} /></BarChart></SafeResponsiveContainer>}</div>
          </ReportCard>
        </div>
      )}

      <MetricDrilldownDrawer
        metric={selectedMetric}
        locale={locale}
        isOpen={Boolean(selectedMetric)}
        onClose={closeMetric}
        resolveRecordPath={crmPath}
        returnPath={returnPath}
        formatValue={formatMetricValue}
        formatAmount={formatMoney}
      />
    </ModulePageShell>
  );
};
