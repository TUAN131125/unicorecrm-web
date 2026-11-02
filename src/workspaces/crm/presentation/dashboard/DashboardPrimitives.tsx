import React from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, LockKeyhole } from "lucide-react";
import { formatApplicationError } from "@/shared/operations";
import type { DashboardRead } from "../../read-models/dashboard/connectedDashboardQueries";
import type { DashboardLocale } from "./dashboardPresentation";

export const dashboardFocus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500";

export function DashboardSkeleton({ metric = false }: { metric?: boolean }) {
  return <div aria-hidden="true" data-dashboard-skeleton className={metric ? "space-y-3 py-2" : "divide-y divide-slate-100"}>
    {metric ? <><div className="h-8 w-3/4 rounded bg-slate-100" /><div className="h-4 w-1/2 rounded bg-slate-100" /></> : Array.from({ length: 5 }, (_, index) => <div key={index} className="space-y-2 px-5 py-4"><div className="h-5 w-4/5 rounded bg-slate-100" /><div className="h-4 w-2/5 rounded bg-slate-100" /></div>)}
  </div>;
}

export function DashboardReadState<T>({ read, locale, retry, metric = false }: {
  read: DashboardRead<T> | undefined; locale: DashboardLocale; retry: () => void; metric?: boolean;
}) {
  if (!read) return <DashboardSkeleton metric={metric} />;
  if (read.state === "READY") return null;
  const vi = locale === "vi";
  return <div className={`${metric ? "py-3" : "px-5 py-7"} text-[13px] leading-5 text-slate-500`} data-dashboard-read-state={read.state}>
    {read.state === "FORBIDDEN" ? <p className="flex items-start gap-2"><LockKeyhole size={15} className="mt-0.5 shrink-0" aria-hidden="true" />{vi ? "Bạn không có quyền xem dữ liệu này." : "You do not have access to this data."}</p> : <>
      <p role="alert">{formatApplicationError(read.error, { locale, fallbackMessage: vi ? "Chưa tải được dữ liệu." : "Could not load data." })}</p>
      <button type="button" onClick={retry} className={`mt-2 min-h-9 rounded-md px-1 font-semibold text-violet-700 hover:underline ${dashboardFocus}`}>{vi ? "Thử lại" : "Retry"}</button>
    </>}
  </div>;
}

export function DashboardMetric<T>({ id, label, read, value, context, href, locale, retry, count, numeric, attention = false, guidance }: {
  id: string; label: string; read: DashboardRead<T> | undefined; value: React.ReactNode; context: React.ReactNode;
  href: string; locale: DashboardLocale; retry: () => void; count?: number | undefined; numeric?: number | undefined; attention?: boolean; guidance: string;
}) {
  return <section data-dashboard-metric={id} data-state={read?.state ?? "LOADING"} data-count={count} data-value={numeric} data-guidance-id={guidance} className="min-w-0 rounded-xl border border-slate-200 bg-white">
    {read?.state === "READY" ? <Link to={href} className={`group block h-full rounded-xl p-5 hover:bg-slate-50 ${dashboardFocus}`}>
      <div className="flex items-center justify-between gap-2"><h2 className="text-[13px] font-medium text-slate-600">{label}</h2><ArrowUpRight size={15} aria-hidden="true" className="shrink-0 text-slate-400 group-hover:text-violet-600" /></div>
      <div className={`my-2 break-words text-[28px] font-semibold leading-tight tracking-tight tabular-nums ${attention ? "text-rose-700" : "text-slate-950"}`}>{value}</div>
      <div className="text-xs leading-5 text-slate-500">{context}</div>
    </Link> : <div className="p-5"><h2 className="text-[13px] font-medium text-slate-600">{label}</h2><DashboardReadState read={read} locale={locale} retry={retry} metric /></div>}
  </section>;
}

export function DashboardPanel({ id, title, subtitle, href, locale, children }: {
  id: string; title: string; subtitle: string; href?: string; locale: DashboardLocale; children: React.ReactNode;
}) {
  return <section data-dashboard-section={id} className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
    <header className="flex min-h-20 items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
      <div className="min-w-0"><h2 className="text-base font-semibold text-slate-900">{title}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p></div>
      {href && <Link to={href} className={`flex min-h-10 shrink-0 items-center rounded-md px-1 text-xs font-semibold text-violet-700 hover:text-violet-900 ${dashboardFocus}`}>{locale === "vi" ? "Xem tất cả" : "View all"}</Link>}
    </header>{children}
  </section>;
}

export function DashboardEmpty({ children }: { children: React.ReactNode }) {
  return <p data-dashboard-empty className="px-5 py-8 text-[13px] leading-6 text-slate-500">{children}</p>;
}
