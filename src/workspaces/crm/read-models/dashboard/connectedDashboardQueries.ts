import { readDealForecastSummary, type Deal, type DealForecastSummary } from "@/modules/deals";
import { getTaskApiRuntime, taskDayBounds, type Task, type Activity } from "@/modules/tasks";
import { getSupportApiRuntime, type SupportCase } from "@/modules/support";
import { getModuleDataAuthority, type AuthoritativePage } from "@/shared/application";
import { ApplicationError, normalizeApplicationError } from "@/shared/domain";

export type DashboardRead<T> = { state: "READY"; data: T } | { state: "FORBIDDEN" } | { state: "ERROR"; error: ApplicationError };
export interface DashboardTasks { items: Task[]; total: number; overdue: number; dueToday: number }
export interface DashboardSupport { items: SupportCase[]; total: number; urgent: number }
export interface ConnectedDashboardData {
  pipeline: DashboardRead<DealForecastSummary>;
  tasks: DashboardRead<DashboardTasks>;
  support: DashboardRead<DashboardSupport>;
  closing: DashboardRead<Deal[]>;
  activities: DashboardRead<Activity[]>;
  asOf: string;
}
export interface DashboardReadOptions {
  memberId: string;
  timeZone: string;
  canReadDeals: boolean;
  canReadTasks: boolean;
  canReadSupport: boolean;
  asOf: string;
}

export function dashboardTotal(page: AuthoritativePage<unknown>): number {
  const value = page.pageInfo.totalCount;
  if (page.authority !== "backend" || value === undefined || !Number.isSafeInteger(value) || value < 0) {
    throw new ApplicationError({ code: "DASHBOARD_TOTAL_UNAVAILABLE", message: "An authoritative server count is required.", category: "INFRASTRUCTURE" });
  }
  return value;
}

async function readSection<T>(allowed: boolean, read: () => Promise<T>): Promise<DashboardRead<T>> {
  if (!allowed) return { state: "FORBIDDEN" };
  try { return { state: "READY", data: await read() }; }
  catch (error: unknown) {
    const normalized = normalizeApplicationError(error);
    if (normalized.category === "AUTHORIZATION" || normalized.category === "AUTHENTICATION") return { state: "FORBIDDEN" };
    return { state: "ERROR", error: normalized };
  }
}

export function dashboardDayBounds(asOf: string, timeZone: string) {
  return taskDayBounds(asOf, timeZone);
}

async function readTasks(options: DashboardReadOptions, signal: AbortSignal): Promise<DashboardTasks> {
  const queries = getTaskApiRuntime().queries;
  const filters = { status: "OPEN" as const, assigneeId: options.memberId };
  const day = dashboardDayBounds(options.asOf, options.timeZone);
  const [window, overdue, beforeToday, beforeTomorrow] = await Promise.all([
    queries.list({ limit: 5, sortBy: "dueAt", sortDirection: "asc", filters }, signal),
    queries.list({ limit: 1, filters: { ...filters, overdueAt: options.asOf } }, signal),
    queries.list({ limit: 1, filters: { ...filters, overdueAt: day.start } }, signal),
    queries.list({ limit: 1, filters: { ...filters, overdueAt: day.end } }, signal),
  ]);
  const dueToday = dashboardTotal(beforeTomorrow) - dashboardTotal(beforeToday);
  if (dueToday < 0) throw new ApplicationError({ code: "DASHBOARD_READ_CHANGED", message: "Task counts changed during the read.", category: "CONFLICT" });
  return { items: window.items, total: dashboardTotal(window), overdue: dashboardTotal(overdue), dueToday };
}

async function readSupport(signal: AbortSignal): Promise<DashboardSupport> {
  const queries = getSupportApiRuntime().queries;
  const statuses = ["new", "in_progress", "waiting_customer", "waiting_internal", "reopened"] as const;
  const pages = await Promise.all(statuses.map(async status => {
    const [all, high, critical] = await Promise.all([
      queries.list({ limit: 1, filters: { status } }, signal),
      queries.list({ limit: 1, filters: { status, priority: "high" } }, signal),
      queries.list({ limit: 1, filters: { status, priority: "critical" } }, signal),
    ]);
    return { total: dashboardTotal(all), urgent: dashboardTotal(high) + dashboardTotal(critical), items: [...high.items, ...critical.items] };
  }));
  return { total: pages.reduce((sum, page) => sum + page.total, 0), urgent: pages.reduce((sum, page) => sum + page.urgent, 0), items: pages.flatMap(page => page.items).slice(0, 6) };
}

export async function readConnectedDashboard(options: DashboardReadOptions, signal: AbortSignal): Promise<ConnectedDashboardData> {
  const [pipeline, tasks, support, closing, activities] = await Promise.all([
    readSection(options.canReadDeals, () => readDealForecastSummary(signal)),
    readSection(options.canReadTasks, () => readTasks(options, signal)),
    readSection(options.canReadSupport, () => readSupport(signal)),
    readSection(options.canReadDeals, async () => {
      const page = await getModuleDataAuthority("deals").queries.list<Deal>({ limit: 5, sortBy: "expectedCloseDate", sortDirection: "asc", filters: { stageCategory: "OPEN" } }, signal);
      if (page.authority !== "backend") throw new ApplicationError({ code: "DASHBOARD_BACKEND_REQUIRED", message: "Backend authority required.", category: "INFRASTRUCTURE" });
      return page.items;
    }),
    readSection(options.canReadTasks, async () => (await getTaskApiRuntime().queries.listActivities({ limit: 6, sortDirection: "desc" }, signal)).items),
  ]);
  signal.throwIfAborted();
  return { pipeline, tasks, support, closing, activities, asOf: options.asOf };
}
