import React from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { toWorkspacePath } from "@/platform/navigation";
import { ModulePageShell } from "@/components/crm/ModulePageShell";
import { Button } from "@/shared/components/ui";
import { toDateKeyInTimeZone } from "@/shared/lib/datetime/workspaceDateTime";
import { classifyTaskDate } from "@/modules/tasks";
import type { useConnectedDashboardReadModel } from "../../read-models/dashboard/useConnectedDashboardReadModel";
import { DashboardEmpty, DashboardMetric, DashboardPanel, DashboardReadState, dashboardFocus } from "./DashboardPrimitives";
import { dashboardDate, dashboardMoney, type DashboardLocale } from "./dashboardPresentation";

type Model = ReturnType<typeof useConnectedDashboardReadModel>;
const row = `group block min-w-0 px-5 py-3.5 hover:bg-slate-50 ${dashboardFocus}`;
const activityLabels = { CALL: ["Cuộc gọi", "Call"], EMAIL: ["Email", "Email"], MEETING: ["Cuộc họp", "Meeting"], NOTE: ["Ghi chú", "Note"], MESSAGE: ["Tin nhắn", "Message"], SYSTEM: ["Hệ thống", "System"] } as const;
const supportLabels = { new: ["Mới", "New"], in_progress: ["Đang xử lý", "In progress"], waiting_customer: ["Chờ khách hàng", "Waiting for customer"], waiting_internal: ["Chờ nội bộ", "Waiting internally"], reopened: ["Mở lại", "Reopened"], resolved: ["Đã giải quyết", "Resolved"], closed: ["Đã đóng", "Closed"], cancelled: ["Đã hủy", "Cancelled"] } as const;

export function ConnectedDashboardView({ model, locale }: { model: Model; locale: DashboardLocale }) {
  const vi = locale === "vi";
  const text = (vn: string, en: string) => vi ? vn : en;
  const path = (value: string) => toWorkspacePath(model.workspaceKey, "crm", value);
  // Preserve hydration guard: no retired scope data during refresh or workspace changes.
  const data = model.enabled && !model.loading ? model.data : undefined;
  const { pipeline, tasks, support, closing, activities } = data ?? {};
  const taskData = tasks?.state === "READY" ? tasks.data : undefined;
  const supportData = support?.state === "READY" ? support.data : undefined;
  const buckets = pipeline?.state === "READY" ? pipeline.data.buckets : undefined;
  const count = buckets?.reduce((sum, bucket) => sum + bucket.openDealCount, 0);
  const retry = () => { void model.refresh(); };
  const date = (value: string) => dashboardDate(value, locale, model.timeZone);
  const today = data ? toDateKeyInTimeZone(data.asOf, model.timeZone) : undefined;
  const money = (amount: string, currency: string) => {
    const formatted = dashboardMoney({ amount, currency }, locale);
    return <span title={formatted.full} data-dashboard-money-full={formatted.full}><span aria-hidden="true">{formatted.compact}</span><span className="sr-only">{formatted.full}</span></span>;
  };
  return <ModulePageShell id="connected-dashboard" className="space-y-5 pb-28">
    <header className="flex flex-wrap items-center justify-between gap-4" data-guidance-id="dashboard.overview.screen">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{text("Tổng quan", "Overview")}</h1>
        <p className="mt-1 text-[13px] leading-5 text-slate-500">{text("Theo dõi kinh doanh và công việc trong workspace", "Business and work across your workspace")}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs text-slate-500" role="status">{model.loading ? text("Đang tải số liệu…", "Loading metrics…") : data ? <><span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />{text("Cập nhật", "Updated")} <time dateTime={data.asOf} title={`${data.asOf} · ${model.timeZone}`}>{date(data.asOf)}</time></> : text("Chưa có dữ liệu mới", "No current data")}</p>
        <Button variant="secondary" size="sm" className="text-[13px]" disabled={!model.enabled || model.loading} onClick={retry} icon={<RefreshCw size={15} aria-hidden="true" />}>{text("Làm mới số liệu", "Refresh metrics")}</Button>
      </div>
    </header>
    {model.error && <DashboardReadState read={{ state: "ERROR", error: model.error }} locale={locale} retry={retry} />}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={text("Số liệu hiện tại", "Current metrics")} aria-busy={model.loading}>
      <DashboardMetric id="pipeline" label={text("Pipeline đang mở", "Open pipeline")} read={pipeline} count={count} href={path("deals")} locale={locale} retry={retry} guidance="dashboard.metric.open-pipeline"
        value={buckets?.length ? buckets.map(bucket => <div key={bucket.currency}>{money(bucket.openAmount.amount, bucket.currency)}</div>) : money("0", model.baseCurrency)} context={text(`${count ?? ""} cơ hội đang mở`, `${count ?? ""} open deals`)} />
      <DashboardMetric id="overdue" label={text("Công việc quá hạn", "Overdue tasks")} read={tasks} numeric={taskData?.overdue} attention={Boolean(taskData?.overdue)} href={path("tasks?view=overdue&assignee=mine")} locale={locale} retry={retry} guidance="dashboard.metric.overdue-tasks"
        value={taskData?.overdue} context={taskData?.overdue ? text("Cần ưu tiên xử lý", "Needs your attention") : text("Không có việc quá hạn", "No overdue work")} />
      <DashboardMetric id="due-today" label={text("Đến hạn hôm nay", "Due today")} read={tasks} numeric={taskData?.dueToday} href={path("tasks?view=today&assignee=mine")} locale={locale} retry={retry} guidance="dashboard.metric.due-today"
        value={taskData?.dueToday} context={text("Công việc đang mở của bạn", "Your open tasks")} />
      <DashboardMetric id="support" label={text("Phiếu hỗ trợ đang mở", "Open support cases")} read={support} numeric={supportData?.total} href={path("support/cases")} locale={locale} retry={retry} guidance="dashboard.metric.open-support"
        value={supportData?.total} context={text(`${supportData?.urgent ?? ""} phiếu ưu tiên cao`, `${supportData?.urgent ?? ""} high-priority cases`)} />
    </div>
    <nav aria-label={text("Cần chú ý", "Needs attention")} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-slate-100/70 px-4 py-1 text-[13px] text-slate-600" data-dashboard-priorities>
      <span className="py-2 font-medium text-slate-800">{text("Cần chú ý", "Needs attention")}</span>
      {taskData && <><Link to={path("tasks?view=overdue&assignee=mine")} className={`rounded-md py-2 hover:text-violet-700 ${dashboardFocus}`}><span className={taskData.overdue ? "font-semibold text-rose-700" : "font-semibold"}>{taskData.overdue}</span> {text("việc quá hạn", "overdue tasks")}</Link><Link to={path("tasks?view=today&assignee=mine")} className={`rounded-md py-2 hover:text-violet-700 ${dashboardFocus}`}><strong className="font-semibold">{taskData.dueToday}</strong> {text("đến hạn hôm nay", "due today")}</Link></>}
      {supportData && <Link to={path("support/cases")} className={`rounded-md py-2 hover:text-violet-700 ${dashboardFocus}`}><strong className={supportData.urgent ? "font-semibold text-amber-800" : "font-semibold"}>{supportData.urgent}</strong> {text("phiếu ưu tiên cao", "high-priority cases")}</Link>}
      {!taskData && !supportData && <span className="py-2 text-slate-500">{model.loading ? text("Đang tải…", "Loading…") : text("Chưa có số liệu khả dụng", "Metrics unavailable")}</span>}
    </nav>
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <DashboardPanel id="work" title={text("Công việc cần xử lý", "Work to address")} subtitle={taskData ? text(`${taskData.items.length} / ${taskData.total} việc đang mở · Hạn gần nhất trước`, `${taskData.items.length} / ${taskData.total} open tasks · Earliest due first`) : text("Công việc được giao cho bạn", "Tasks assigned to you")} href={path("tasks?view=mine")} locale={locale}>
        {taskData ? taskData.items.length ? <ul className="divide-y divide-slate-100">{taskData.items.map(task => {
          const { overdue, dueToday, validDate } = classifyTaskDate(task, data?.asOf ?? "", model.timeZone);
          return <li key={task.id}><Link to={path(`tasks/${task.id}`)} className={row} title={task.title}>
            <p className="break-words whitespace-normal text-sm font-medium text-slate-800 group-hover:text-violet-700">{task.title}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
              <time dateTime={task.dueAt}>{date(task.dueAt)}</time>
              <span className={overdue ? "text-rose-700" : dueToday ? "text-amber-800" : "text-slate-500"}>{!validDate ? text("Thời hạn chưa khả dụng", "Due time unavailable") : overdue ? text("Quá hạn", "Overdue") : dueToday ? text("Hôm nay", "Today") : text("Sắp đến hạn", "Upcoming")}</span>
              {task.recordRef?.label && <span className="max-w-full break-words whitespace-normal">{task.recordRef.label}</span>}
            </div>
          </Link></li>;
        })}</ul> : <DashboardEmpty>{text("Bạn không có công việc đang mở.", "You have no open tasks.")}</DashboardEmpty> : <DashboardReadState read={tasks} locale={locale} retry={retry} />}
      </DashboardPanel>
      <DashboardPanel id="closing" title={text("Cơ hội sắp đóng", "Deals closing soon")} subtitle={text("Theo ngày dự kiến · Gồm cơ hội quá hạn", "By expected date · Includes overdue deals")} href={path("deals")} locale={locale}>
        {closing?.state === "READY" ? closing.data.length ? <ul className="divide-y divide-slate-100">{closing.data.map(deal => <li key={deal.id}><Link className={row} to={path(`deals/${deal.id}`)} title={deal.name}>
          <p className="break-words text-[13px] font-medium leading-5 text-slate-800 group-hover:text-violet-700">{deal.name}</p>
          {(deal.organizationAccountName || deal.contactName) && <p className="mt-1 break-words whitespace-normal text-xs text-slate-500">{deal.organizationAccountName || deal.contactName}</p>}
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
            <span className="font-medium text-slate-700">{deal.currency && deal.amountDecimal ? money(deal.amountDecimal, deal.currency) : text("Chưa có giá trị", "Amount unavailable")}</span>
            <time dateTime={deal.expectedCloseDate} className={today && deal.expectedCloseDate < today ? "text-amber-800" : "text-slate-500"}>{dashboardDate(deal.expectedCloseDate, locale, model.timeZone, true)}{today && deal.expectedCloseDate < today ? ` · ${text("Quá hạn", "Overdue")}` : ""}</time>
          </div>
        </Link></li>)}</ul> : <DashboardEmpty>{text("Chưa có cơ hội đang mở.", "No open deals.")}</DashboardEmpty> : <DashboardReadState read={closing} locale={locale} retry={retry} />}
      </DashboardPanel>
    </div>
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <DashboardPanel id="activities" title={text("Hoạt động gần nhất", "Recent activity")} subtitle={text("Tương tác gần đây", "Recent interactions")} locale={locale}>
        {activities?.state === "READY" ? activities.data.length ? <ul className="divide-y divide-slate-100">{activities.data.map(activity => <li key={activity.id} className="px-5 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-slate-500"><span>{activityLabels[activity.type][vi ? 0 : 1]}</span><time dateTime={activity.occurredAt}>{date(activity.occurredAt)}</time></div>
          <p className="mt-1 break-words text-[13px] leading-5 text-slate-700" title={activity.subject}>{activity.subject}</p>
          {activity.recordRef?.label && <p className="mt-1 break-words whitespace-normal text-xs text-slate-500">{activity.recordRef.label}</p>}
        </li>)}</ul> : <DashboardEmpty>{text("Chưa có hoạt động để hiển thị.", "No activity to display.")}</DashboardEmpty> : <DashboardReadState read={activities} locale={locale} retry={retry} />}
      </DashboardPanel>
      <DashboardPanel id="support" title={text("Hỗ trợ cần chú ý", "Support needing attention")} subtitle={supportData ? text(`Một số phiếu trong ${supportData.urgent} phiếu ưu tiên cao`, `A sample of ${supportData.urgent} high-priority cases`) : text("Phiếu ưu tiên cao và khẩn cấp", "High and critical priority cases")} href={path("support/cases")} locale={locale}>
        {supportData ? supportData.items.length ? <ul className="divide-y divide-slate-100">{supportData.items.map(item => <li key={item.id}><Link to={path(`support/cases/${item.id}`)} className={row} title={item.title}>
          <p className="break-words text-[13px] font-medium leading-5 text-slate-800 group-hover:text-violet-700">{item.title}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500"><span>{supportLabels[item.status][vi ? 0 : 1]}</span><span className={item.priority === "critical" ? "text-rose-700" : "text-amber-800"}>{item.priority === "critical" ? text("Khẩn cấp", "Critical") : text("Ưu tiên cao", "High priority")}</span>{item.nextFollowUpAt && <span>{text("Theo dõi", "Follow up")}: {date(item.nextFollowUpAt)}</span>}</div>
        </Link></li>)}</ul> : <DashboardEmpty>{text("Không có phiếu ưu tiên cao cần chú ý.", "No high-priority cases need attention.")}</DashboardEmpty> : <DashboardReadState read={support} locale={locale} retry={retry} />}
      </DashboardPanel>
    </div>
    <aside aria-label={text("Khả dụng của số liệu", "Metric availability")} className="border-t border-slate-200 pt-4 text-xs leading-6 text-slate-500" data-dashboard-unsupported>
      <span className="mr-1 font-medium text-slate-600">{text("Chưa khả dụng:", "Not yet available:")}</span>
      <span data-dashboard-metric="revenue" data-state="BLOCKED_CONTRACT" data-guidance-id="dashboard.metric.completed-revenue">{text("doanh thu theo kỳ", "period revenue")}</span>{" · "}
      <span data-dashboard-metric="leads" data-state="BLOCKED_CONTRACT" data-guidance-id="dashboard.metric.active-leads">{text("Lead mới theo kỳ", "period new leads")}</span>{" · "}
      <span data-state="BLOCKED_CONTRACT">{text("xếp hạng Lead", "Lead ranking")}</span>.
      <p>{text("Một số báo cáo theo kỳ chưa khả dụng. Các số liệu ở trên thể hiện tình hình hiện tại.", "Some period reports are not available yet. The figures above reflect the current situation.")}</p>
    </aside>
  </ModulePageShell>;
}
