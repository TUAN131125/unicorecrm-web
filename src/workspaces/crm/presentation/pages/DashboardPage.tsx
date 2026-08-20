import React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Flame,
  LayoutDashboard,
  LifeBuoy,
  ListTodo,
  Radio,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { toWorkspacePath } from "@/platform/navigation";
import { ModulePageShell } from "@/components/crm/ModulePageShell";
import { PageHeader } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import { DealStage } from "@/modules/deals";
import { LeadWorkState } from "@/modules/leads";
import { flattenOrders } from "@/modules/orders";
import { getAuthSessionSnapshot } from "@/platform/identity-auth";
import { resolveWorkspaceMemberName } from "@/platform/member-directory";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { buildCrmMetric, CRM_METRIC_IDS } from "@/workspaces/crm/metrics";
import { useDashboardReadModel } from "@/workspaces/crm/read-models/dashboard/useDashboardReadModel";

type DashboardPeriod = "today" | "week" | "month";
type DashboardTone = "violet" | "sky" | "emerald" | "amber" | "rose";

const toneClasses: Record<DashboardTone, { icon: string; value: string; dot: string; hover: string }> = {
  violet: { icon: "bg-violet-50 text-violet-700 ring-violet-100", value: "text-violet-950", dot: "bg-violet-500", hover: "hover:bg-violet-50/45" },
  sky: { icon: "bg-sky-50 text-sky-700 ring-sky-100", value: "text-sky-950", dot: "bg-sky-500", hover: "hover:bg-sky-50/45" },
  emerald: { icon: "bg-emerald-50 text-emerald-700 ring-emerald-100", value: "text-emerald-950", dot: "bg-emerald-500", hover: "hover:bg-emerald-50/45" },
  amber: { icon: "bg-amber-50 text-amber-700 ring-amber-100", value: "text-amber-950", dot: "bg-amber-500", hover: "hover:bg-amber-50/45" },
  rose: { icon: "bg-rose-50 text-rose-700 ring-rose-100", value: "text-rose-950", dot: "bg-rose-500", hover: "hover:bg-rose-50/45" },
};

const DashboardMetricCell: React.FC<{
  label: string;
  value: React.ReactNode;
  hint: string;
  icon: React.ReactNode;
  tone: DashboardTone;
  onClick: () => void;
  guidanceId: string;
}> = ({ label, value, hint, icon, tone, onClick, guidanceId }) => {
  const style = toneClasses[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      data-guidance-id={guidanceId}
      className={`group min-w-0 bg-white p-4 text-left transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500/30 sm:p-5 ${style.hover}`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ${style.icon}`}>{icon}</span>
        <span className="crm-text-wrap min-w-0 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</span>
      </div>
      <div className={`mt-4 break-words text-[1.65rem] font-black leading-none tracking-tight [overflow-wrap:anywhere] ${style.value}`}>{value}</div>
      <div className="mt-3 flex min-w-0 items-start gap-2 text-[11px] font-semibold leading-4 text-slate-500">
        <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} />
        <span className="crm-text-wrap min-w-0 flex-1">{hint}</span>
        <ArrowRight size={12} className="mt-0.5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500" />
      </div>
    </button>
  );
};

const DashboardPanel: React.FC<{
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, icon, action, children, className = "" }) => (
  <section className={`min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
    <header className="flex min-w-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">{icon}</span>
        <h2 className="crm-text-wrap text-sm font-bold text-slate-950">{title}</h2>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
    {children}
  </section>
);

const PriorityLink: React.FC<{
  to: string;
  icon: React.ReactNode;
  label: string;
  value: number;
  detail: string;
  tone: "rose" | "amber" | "sky";
}> = ({ to, icon, label, value, detail, tone }) => {
  const styles = {
    rose: "bg-rose-50 text-rose-700 ring-rose-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    sky: "bg-sky-50 text-sky-700 ring-sky-100",
  }[tone];
  return (
    <Link to={to} className="group flex min-w-0 items-center gap-3 p-4 transition-colors hover:bg-slate-50 sm:p-5">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ${styles}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-baseline justify-between gap-3">
          <span className="crm-text-wrap min-w-0 text-xs font-bold text-slate-800">{label}</span>
          <span className="shrink-0 text-xl font-black text-slate-950">{value}</span>
        </span>
        <span className="crm-text-wrap mt-1 block text-[10px] font-semibold leading-4 text-slate-500">{detail}</span>
      </span>
      <ArrowRight size={14} className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500" />
    </Link>
  );
};

function periodStart(period: DashboardPeriod, now: Date): Date {
  if (period === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "week") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekday = start.getDay() || 7;
    start.setDate(start.getDate() - weekday + 1);
    return start;
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function validDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export const DashboardPage: React.FC = () => {
  const { leads, deals, cases, tasks, activities, quotes, orders, customers, timezone, baseCurrency } = useDashboardReadModel();
  const { locale } = useI18n();
  const navigate = useNavigate();
  const workspace = useWorkspaceContextSnapshot();
  const isVi = locale === "vi";
  const [period, setPeriod] = React.useState<DashboardPeriod>("today");
  const now = new Date();
  const start = periodStart(period, now);
  const end = now;
  const flatOrders = React.useMemo(() => flattenOrders(orders), [orders]);
  const currentMemberId = getAuthSessionSnapshot()?.principal.memberId;
  const crmPath = React.useCallback((path: string) => toWorkspacePath(workspace.workspaceKey, "crm", path), [workspace.workspaceKey]);
  const formatMoney = React.useCallback((value: number) => new Intl.NumberFormat(isVi ? "vi-VN" : "en-US", {
    style: "currency",
    currency: baseCurrency,
    maximumFractionDigits: 0,
  }).format(value), [baseCurrency, isVi]);
  const formatDateTime = React.useCallback((value?: string) => {
    const date = validDate(value);
    return date ? date.toLocaleString(isVi ? "vi-VN" : "en-US", { dateStyle: "short", timeStyle: "short" }) : (isVi ? "Chưa lên lịch" : "Not scheduled");
  }, [isVi]);
  const inSelectedPeriod = React.useCallback((value?: string) => {
    const date = validDate(value);
    return Boolean(date && date >= start && date <= end);
  }, [start.getTime(), end.getTime()]);

  const metricDataset = React.useMemo(() => ({ leads, deals, customers, cases, quotes, orders }), [leads, deals, customers, cases, quotes, orders]);
  const openPipelineMetric = React.useMemo(() => buildCrmMetric({ ...metricDataset, metricId: CRM_METRIC_IDS.OPEN_PIPELINE_VALUE, periodKey: "all_time", timezone }), [metricDataset, timezone]);
  const openSupportMetric = React.useMemo(() => buildCrmMetric({ ...metricDataset, metricId: CRM_METRIC_IDS.OPEN_SUPPORT_CASES, periodKey: "all_time", timezone }), [metricDataset, timezone]);

  const periodCompletedOrders = flatOrders.filter((order) => String(order.state).toUpperCase() === "COMPLETED" && inSelectedPeriod(order.completedAt ?? order.updatedAt ?? order.createdAt ?? order.orderDate));
  const periodRevenue = periodCompletedOrders.reduce((sum, order) => sum + (order.grandTotal ?? order.totalAmount ?? 0), 0);
  const periodLeads = leads.filter((lead) => inSelectedPeriod(lead.createdAt));
  const highScorePeriodLeads = periodLeads.filter((lead) => lead.score >= 80);
  const myOpenTasks = tasks
    .filter((task) => task.status === "OPEN" && (!currentMemberId || task.assigneeId === currentMemberId))
    .sort((left, right) => new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime());
  const overdueTasks = myOpenTasks.filter((task) => new Date(task.dueAt).getTime() < now.getTime());
  const dueTodayTasks = myOpenTasks.filter((task) => {
    const due = validDate(task.dueAt);
    return Boolean(due && due.toDateString() === now.toDateString());
  });
  const urgentCases = cases
    .filter((item) => !["resolved", "closed", "cancelled"].includes(String(item.status).toLowerCase()))
    .filter((item) => ["high", "critical"].includes(String(item.priority).toLowerCase()))
    .sort((left, right) => new Date(left.nextFollowUpAt ?? left.updatedAt ?? left.createdAt).getTime() - new Date(right.nextFollowUpAt ?? right.updatedAt ?? right.createdAt).getTime());
  const hotLeads = leads
    .filter((lead) => lead.leadWorkState !== LeadWorkState.CLOSED)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);
  const closingDeals = deals
    .filter((deal) => ![DealStage.WON, DealStage.LOST].includes(deal.stage as DealStage))
    .sort((left, right) => new Date(left.expectedCloseDate).getTime() - new Date(right.expectedCloseDate).getTime())
    .slice(0, 5);
  const recentActivities = [...activities]
    .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())
    .slice(0, 6);

  const periodLabel = period === "today"
    ? (isVi ? "Hôm nay" : "Today")
    : period === "week" ? (isVi ? "Tuần này" : "This week") : (isVi ? "Tháng này" : "This month");
  const openReports = (metric?: string) => {
    const dashboardReturnQuery = "returnTo=dashboard";
    const params = new URLSearchParams();
    params.set("period", "custom");
    params.set("start", start.toISOString().slice(0, 10));
    params.set("end", end.toISOString().slice(0, 10));
    params.set("returnTo", dashboardReturnQuery.split("=")[1]);
    if (metric) params.set("metric", metric);
    navigate(`${crmPath("reports")}?${params.toString()}`);
  };
  const activityRoute = (moduleKey?: string, recordId?: string) => {
    if (!moduleKey || !recordId) return undefined;
    if (moduleKey === "support") return crmPath(`support/cases/${recordId}`);
    return crmPath(`${moduleKey}/${recordId}`);
  };

  return (
    <ModulePageShell id="dashboard-page" className="min-w-0">
      <PageHeader
        title="Dashboard"
        icon={<LayoutDashboard size={18} />}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-9 items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 text-xs font-bold text-emerald-700">
              <Radio size={13} className="animate-pulse" />{isVi ? "Dữ liệu trực tiếp" : "Live data"}
            </span>
            <Link to={crmPath("reports")} className="inline-flex h-9 items-center gap-2 rounded-xl bg-violet-600 px-3.5 text-xs font-bold text-white shadow-sm transition hover:bg-violet-700">
              <BarChart3 size={14} />{isVi ? "Phân tích báo cáo" : "Open reports"}
            </Link>
          </div>
        )}
      />

      <section data-guidance-id="dashboard.overview.screen" data-dashboard-visual="operational-board" data-dashboard-kpi-layout="snapshot-ribbon" className="-mt-3 min-w-0 overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-br from-white via-violet-50/60 to-sky-50/60 shadow-sm">
        <div className="flex min-w-0 flex-col gap-4 border-b border-violet-100/80 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-violet-700 shadow-sm ring-1 ring-violet-100"><Sparkles size={19} /></span>
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-700">{isVi ? "Tổng quan vận hành" : "Operational overview"}</div>
              <p className="mt-1 max-w-3xl crm-text-wrap text-sm font-semibold leading-6 text-slate-700">
                {isVi ? "Theo dõi trạng thái hiện tại, việc cần xử lý và tín hiệu kinh doanh. Phân tích xu hướng chuyên sâu được giữ riêng tại Báo cáo." : "Review current status, work requiring attention and business signals. Deeper trend analysis remains in Reports."}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 rounded-xl border border-slate-200 bg-white p-1 shadow-sm" role="group" aria-label={isVi ? "Khoảng thời gian Dashboard" : "Dashboard period"}>
            {(["today", "week", "month"] as DashboardPeriod[]).map((item) => {
              const active = item === period;
              const label = item === "today" ? (isVi ? "Hôm nay" : "Today") : item === "week" ? (isVi ? "Tuần" : "Week") : (isVi ? "Tháng" : "Month");
              return <button key={item} type="button" onClick={() => setPeriod(item)} className={`h-8 rounded-lg px-3 text-xs font-bold transition ${active ? "bg-violet-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}>{label}</button>;
            })}
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-px bg-slate-100 sm:grid-cols-2 xl:grid-cols-5">
          <DashboardMetricCell label={isVi ? `Doanh thu ${periodLabel.toLowerCase()}` : `${periodLabel} revenue`} value={formatMoney(periodRevenue)} hint={isVi ? `${periodCompletedOrders.length} đơn hoàn tất trong kỳ` : `${periodCompletedOrders.length} completed orders`} icon={<CircleDollarSign size={17} />} tone="emerald" onClick={() => openReports(CRM_METRIC_IDS.MONTHLY_COMPLETED_REVENUE)} guidanceId="dashboard.metric.completed-revenue" />
          <DashboardMetricCell label={isVi ? `Lead mới ${periodLabel.toLowerCase()}` : `New leads ${periodLabel.toLowerCase()}`} value={periodLeads.length} hint={isVi ? `${highScorePeriodLeads.length} Lead có điểm từ 80` : `${highScorePeriodLeads.length} leads score 80+`} icon={<Users size={17} />} tone="sky" onClick={() => navigate(crmPath("leads"))} guidanceId="dashboard.metric.active-leads" />
          <DashboardMetricCell label={isVi ? "Pipeline đang mở" : "Open pipeline"} value={formatMoney(openPipelineMetric.value)} hint={isVi ? `${openPipelineMetric.records.length} cơ hội đang hoạt động` : `${openPipelineMetric.records.length} active deals`} icon={<TrendingUp size={17} />} tone="violet" onClick={() => openReports(CRM_METRIC_IDS.OPEN_PIPELINE_VALUE)} guidanceId="dashboard.metric.open-pipeline" />
          <DashboardMetricCell label={isVi ? "Công việc quá hạn" : "Overdue tasks"} value={overdueTasks.length} hint={isVi ? `${dueTodayTasks.length} công việc đến hạn hôm nay` : `${dueTodayTasks.length} tasks due today`} icon={<ListTodo size={17} />} tone={overdueTasks.length ? "rose" : "emerald"} onClick={() => navigate(`${crmPath("tasks")}?view=mine`)} guidanceId="dashboard.metric.overdue-tasks" />
          <DashboardMetricCell label={isVi ? "Phiếu hỗ trợ đang mở" : "Open support tickets"} value={openSupportMetric.value} hint={isVi ? `${urgentCases.length} phiếu ưu tiên cao cần chú ý` : `${urgentCases.length} high-priority tickets need attention`} icon={<LifeBuoy size={17} />} tone={urgentCases.length ? "amber" : "emerald"} onClick={() => navigate(crmPath("support/cases"))} guidanceId="dashboard.metric.open-support" />
        </div>
      </section>

      <DashboardPanel title={isVi ? "Ưu tiên cần xử lý" : "Action priorities"} icon={<AlertTriangle size={16} />} className="mt-5">
        {(overdueTasks.length > 0 || dueTodayTasks.length > 0 || urgentCases.length > 0) ? (
          <div className="grid min-w-0 grid-cols-1 divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <PriorityLink to={`${crmPath("tasks")}?view=mine`} icon={<AlertTriangle size={17} />} label={isVi ? "Công việc quá hạn" : "Overdue work"} value={overdueTasks.length} detail={isVi ? "Mở hàng đợi và xử lý theo hạn gần nhất" : "Open the queue and address nearest deadlines"} tone="rose" />
            <PriorityLink to={`${crmPath("tasks")}?view=mine`} icon={<Clock3 size={17} />} label={isVi ? "Đến hạn hôm nay" : "Due today"} value={dueTodayTasks.length} detail={isVi ? "Các việc cần hoàn tất trong ngày" : "Work expected to be completed today"} tone="sky" />
            <PriorityLink to={crmPath("support/cases")} icon={<LifeBuoy size={17} />} label={isVi ? "Hỗ trợ ưu tiên cao" : "High-priority support"} value={urgentCases.length} detail={isVi ? "Phiếu đang mở cần theo dõi sớm" : "Open tickets requiring early follow-up"} tone="amber" />
          </div>
        ) : (
          <div className="flex items-center gap-3 px-5 py-8 text-xs font-bold text-emerald-700"><CheckCircle2 size={18} />{isVi ? "Không có cảnh báo vận hành nổi bật ở thời điểm hiện tại." : "No major operational alerts right now."}</div>
        )}
      </DashboardPanel>

      <div className="mt-5 grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-3">
        <DashboardPanel title={isVi ? "Công việc của tôi" : "My work"} icon={<ListTodo size={16} />} action={<Link to={`${crmPath("tasks")}?view=mine`} className="text-[11px] font-black text-violet-700 hover:underline">{isVi ? "Mở danh sách" : "Open list"}</Link>}>
          <div className="divide-y divide-slate-100">
            {myOpenTasks.length === 0 ? <div className="px-5 py-12 text-center text-xs font-semibold text-slate-400">{isVi ? "Không có công việc đang mở." : "No open tasks."}</div> : myOpenTasks.slice(0, 5).map((task) => {
              const overdue = new Date(task.dueAt).getTime() < now.getTime();
              return <Link key={task.id} to={crmPath(`tasks/${task.id}`)} className="flex min-w-0 items-start gap-3 px-5 py-3.5 hover:bg-slate-50"><span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${overdue ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"}`}>{overdue ? <AlertTriangle size={13} /> : <Clock3 size={13} />}</span><span className="min-w-0 flex-1"><span className="crm-text-wrap block text-xs font-bold text-slate-900">{task.title}</span><span className={`mt-1 block text-[10px] font-semibold ${overdue ? "text-rose-600" : "text-slate-500"}`}>{formatDateTime(task.dueAt)}</span></span></Link>;
            })}
          </div>
        </DashboardPanel>

        <DashboardPanel title={isVi ? "Lead cần ưu tiên" : "Priority leads"} icon={<Flame size={16} />} action={<Link to={crmPath("leads")} className="text-[11px] font-black text-violet-700 hover:underline">{isVi ? "Xem tất cả" : "View all"}</Link>}>
          <div className="divide-y divide-slate-100">
            {hotLeads.length === 0 ? <div className="px-5 py-12 text-center text-xs font-semibold text-slate-400">{isVi ? "Chưa có Lead đang hoạt động." : "No active leads."}</div> : hotLeads.map((lead) => (
              <Link key={lead.id} to={crmPath(`leads/${lead.id}`)} className="flex min-w-0 items-center gap-3 px-5 py-3.5 hover:bg-slate-50">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black ${lead.score >= 80 ? "bg-rose-50 text-rose-700" : "bg-sky-50 text-sky-700"}`}>{lead.score}</span>
                <span className="min-w-0 flex-1"><span className="crm-text-wrap block text-xs font-bold text-slate-900">{lead.name}</span><span className="crm-text-wrap mt-0.5 block text-[10px] font-medium text-slate-500">{lead.companyName} · {lead.source}</span></span>
                <ArrowRight size={13} className="shrink-0 text-slate-300" />
              </Link>
            ))}
          </div>
        </DashboardPanel>

        <DashboardPanel title={isVi ? "Cơ hội sắp đóng" : "Deals closing soon"} icon={<CalendarDays size={16} />} action={<Link to={crmPath("deals")} className="text-[11px] font-black text-violet-700 hover:underline">{isVi ? "Xem pipeline" : "View pipeline"}</Link>}>
          <div className="divide-y divide-slate-100">
            {closingDeals.length === 0 ? <div className="px-5 py-12 text-center text-xs font-semibold text-slate-400">{isVi ? "Chưa có cơ hội đang mở." : "No open deals."}</div> : closingDeals.map((deal) => (
              <Link key={deal.id} to={crmPath(`deals/${deal.id}`)} className="block px-5 py-3.5 hover:bg-slate-50">
                <div className="flex min-w-0 items-start justify-between gap-3"><span className="crm-text-wrap min-w-0 text-xs font-bold text-slate-900">{deal.name}</span><span className="shrink-0 text-xs font-black text-slate-950">{formatMoney(deal.amount)}</span></div>
                <div className="mt-1.5 flex min-w-0 items-center justify-between gap-3 text-[10px] font-medium text-slate-500"><span className="crm-text-wrap">{deal.customerName ?? deal.organizationAccountName ?? deal.contactName}</span><span className="shrink-0 text-amber-700">{new Date(deal.expectedCloseDate).toLocaleDateString(isVi ? "vi-VN" : "en-US")}</span></div>
              </Link>
            ))}
          </div>
        </DashboardPanel>
      </div>

      <div className="mt-5 grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,.9fr)]">
        <DashboardPanel title={isVi ? "Hoạt động gần nhất" : "Recent activity"} icon={<Activity size={16} />}>
          <div className="divide-y divide-slate-100">
            {recentActivities.length === 0 ? <div className="px-5 py-12 text-center text-xs font-semibold text-slate-400">{isVi ? "Chưa có hoạt động gần đây." : "No recent activity."}</div> : recentActivities.map((item) => {
              const route = activityRoute(item.recordRef?.moduleKey, item.recordRef?.recordId);
              const row = <div className="flex min-w-0 items-start gap-3 px-5 py-3.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><Activity size={13} /></span><span className="min-w-0 flex-1"><span className="crm-text-wrap block text-xs font-bold text-slate-900">{item.subject}</span><span className="crm-text-wrap mt-0.5 block text-[10px] font-medium text-slate-500">{item.recordRef?.label ?? item.body ?? resolveWorkspaceMemberName(item.actorId)}</span><span className="mt-1 block text-[10px] font-semibold text-slate-400">{formatDateTime(item.occurredAt)}</span></span>{route ? <ArrowRight size={13} className="mt-2 shrink-0 text-slate-300" /> : null}</div>;
              return route ? <Link key={item.id} to={route} className="block hover:bg-slate-50">{row}</Link> : <div key={item.id}>{row}</div>;
            })}
          </div>
        </DashboardPanel>

        <DashboardPanel title={isVi ? "Phiếu hỗ trợ cần chú ý" : "Support attention queue"} icon={<LifeBuoy size={16} />} action={<Link to={crmPath("support/cases")} className="text-[11px] font-black text-violet-700 hover:underline">{isVi ? "Mở tất cả" : "Open all"}</Link>}>
          <div className="divide-y divide-slate-100">
            {urgentCases.length === 0 ? <div className="flex items-center gap-3 px-5 py-10 text-xs font-bold text-emerald-700"><CheckCircle2 size={17} />{isVi ? "Không có phiếu ưu tiên cao đang mở." : "No high-priority open tickets."}</div> : urgentCases.slice(0, 6).map((item) => (
              <Link key={item.id} to={crmPath(`support/cases/${item.id}`)} className="flex min-w-0 items-start gap-3 px-5 py-3.5 hover:bg-slate-50"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><AlertTriangle size={14} /></span><span className="min-w-0 flex-1"><span className="crm-text-wrap block text-xs font-bold text-slate-900">{item.title}</span><span className="crm-text-wrap mt-0.5 block text-[10px] font-medium text-slate-500">{item.caseNumber} · {item.customerName}</span><span className="mt-1 block text-[10px] font-semibold text-amber-700">{item.nextFollowUpAt ? formatDateTime(item.nextFollowUpAt) : (isVi ? "Chưa có lịch theo dõi" : "No follow-up scheduled")}</span></span></Link>
            ))}
          </div>
        </DashboardPanel>
      </div>
    </ModulePageShell>
  );
};
