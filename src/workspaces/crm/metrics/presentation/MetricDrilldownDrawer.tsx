import React from "react";
import { ArrowLeft, ArrowRight, Calculator, Clock3, Database, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Drawer } from "@/shared/components/ui/Drawer";
import type { MetricResult } from "../domain/metric.types";

export interface MetricDrilldownDrawerProps {
  metric?: MetricResult;
  locale: "vi" | "en";
  isOpen: boolean;
  onClose: () => void;
  resolveRecordPath: (route: string) => string;
  returnPath?: string;
  formatValue: (metric: MetricResult) => string;
  formatAmount: (amount: number) => string;
}

function localized(text: { vi: string; en: string }, locale: "vi" | "en"): string {
  return text[locale];
}

export const MetricDrilldownDrawer: React.FC<MetricDrilldownDrawerProps> = ({
  metric,
  locale,
  isOpen,
  onClose,
  resolveRecordPath,
  returnPath,
  formatValue,
  formatAmount,
}) => {
  if (!metric) return null;
  const isVi = locale === "vi";
  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={localized(metric.definition.title, locale)}
      subtitle={localized(metric.definition.description, locale)}
      size="lg"
      className="crm-form-surface"
    >
      <div data-guidance-id="reports.metric.drilldown" className="space-y-5">
        {returnPath ? (
          <Link to={returnPath} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            <ArrowLeft size={14} />
            {isVi ? "Quay lại Dashboard" : "Back to Dashboard"}
          </Link>
        ) : null}

        <section className="rounded-2xl border border-violet-100 bg-violet-50 p-5">
          <div className="text-[11px] font-black uppercase tracking-[0.12em] text-violet-600">{isVi ? "Giá trị hiện tại" : "Current value"}</div>
          <div className="mt-2 break-words text-3xl font-black text-violet-950 [overflow-wrap:anywhere]">{formatValue(metric)}</div>
          {metric.denominator !== undefined ? (
            <div className="mt-2 text-xs font-semibold text-violet-700">
              {isVi ? `${metric.numerator ?? 0} trên ${metric.denominator} bản ghi` : `${metric.numerator ?? 0} of ${metric.denominator} records`}
            </div>
          ) : null}
          {metric.comparison?.status === "AVAILABLE" ? (
            <div className={`mt-2 text-xs font-bold ${(metric.comparison.deltaPercent ?? 0) < 0 ? "text-rose-700" : "text-emerald-700"}`}>
              {metric.comparison.deltaPercent}% {isVi ? "so với kỳ trước" : "vs previous period"}
            </div>
          ) : metric.comparison?.reason ? (
            <div className="mt-2 rounded-xl bg-white/80 px-3 py-2 text-xs font-semibold text-slate-600">{localized(metric.comparison.reason, locale)}</div>
          ) : null}
        </section>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-xs font-black text-slate-900"><Calculator size={14} className="text-violet-600" />{isVi ? "Công thức" : "Formula"}</div>
            <p className="mt-2 text-xs leading-5 text-slate-600">{localized(metric.definition.formula, locale)}</p>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-xs font-black text-slate-900"><Clock3 size={14} className="text-violet-600" />{isVi ? "Kỳ và cập nhật" : "Period and freshness"}</div>
            <p className="mt-2 text-xs leading-5 text-slate-600">{localized(metric.period.label, locale)} · {metric.timezone}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {metric.lastUpdatedAt ? new Date(metric.lastUpdatedAt).toLocaleString(isVi ? "vi-VN" : "en-US", { timeZone: metric.timezone }) : (isVi ? "Chưa có dữ liệu cập nhật" : "No source update yet")}
            </p>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-xs font-black text-slate-900"><Database size={14} className="text-violet-600" />{isVi ? "Nguồn dữ liệu" : "Data sources"}</div>
            <p className="mt-2 text-xs leading-5 text-slate-600">{metric.definition.sourceModules.join(", ")}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{localized(metric.definition.dateField, locale)}</p>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-xs font-black text-slate-900"><ShieldCheck size={14} className="text-violet-600" />{isVi ? "Trạng thái được tính" : "Included states"}</div>
            <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-600">
              {metric.definition.includedStates.map((state) => <li key={state.en}>• {localized(state, locale)}</li>)}
            </ul>
          </section>
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <header className="border-b border-slate-100 bg-slate-50 px-4 py-3">
            <h3 className="text-xs font-black text-slate-900">{isVi ? `Bản ghi nguồn (${metric.records.length})` : `Source records (${metric.records.length})`}</h3>
          </header>
          {metric.records.length === 0 ? (
            <div className="px-4 py-10 text-center text-xs font-semibold text-slate-400">{isVi ? "Không có bản ghi nguồn trong kỳ này." : "No source records in this period."}</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {metric.records.map((record) => (
                <Link key={`${record.module}:${record.id}`} to={resolveRecordPath(record.route)} className="flex min-w-0 items-center gap-3 px-4 py-3 hover:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <div className="crm-text-wrap text-xs font-bold text-slate-900">{record.primaryText}</div>
                    <div className="mt-1 flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-[10px] font-medium text-slate-500">
                      {record.secondaryText ? <span className="crm-text-wrap">{record.secondaryText}</span> : null}
                      {record.status ? <span>{record.status}</span> : null}
                      {record.occurredAt ? <span>{new Date(record.occurredAt).toLocaleDateString(isVi ? "vi-VN" : "en-US", { timeZone: metric.timezone })}</span> : null}
                    </div>
                  </div>
                  {record.amount !== undefined ? <div className="shrink-0 text-xs font-black text-slate-800">{formatAmount(record.amount)}</div> : null}
                  <ArrowRight size={14} className="shrink-0 text-slate-400" />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </Drawer>
  );
};
