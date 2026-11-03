import React from "react";
import { DealForecastHistoryPanel } from "../components/DealPipelineHealth";
import { DealDetailField } from "./DealDetailField";
import { dealWeightedForecast, dealDisplayDate } from "./dealDetailPresentation";
import { formatCurrency } from "@/shared/lib/format/currency";
import type { DealDetailController } from "./dealDetailView.types";

export function DealDetailForecast({ controller: c }: { controller: DealDetailController }) {
  const vi = c.locale === "vi"; const weighted = dealWeightedForecast(c.deal);
  return <section className="space-y-5" data-deal-forecast>
    <div><h2 className="text-base font-semibold text-slate-900">{vi ? "Dự báo cơ hội" : "Opportunity forecast"}</h2><p className="mt-1 text-xs text-slate-500">{vi ? "Dự báo theo công thức, không phải dự đoán AI" : "Formula forecast, not an AI prediction"}</p></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <DealDetailField field="amount" className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"><p className="text-xs text-slate-500">{vi ? "Giá trị chưa trọng số" : "Unweighted amount"}</p><p className="mt-2 break-words text-lg font-semibold">{c.deal.currency ? formatCurrency(c.deal.amount, c.deal.currency, c.locale) : "—"}</p></DealDetailField>
      <DealDetailField field="amount"><DealDetailField field="opportunityScore" className="rounded-xl border border-violet-100 bg-violet-50/50 p-4"><p className="text-xs text-slate-500">{vi ? "Dự báo có trọng số" : "Weighted forecast"}</p><p className="mt-2 break-words text-lg font-semibold text-violet-700">{weighted ? formatCurrency(Number(weighted.amount), weighted.currency, c.locale) : "—"}</p></DealDetailField></DealDetailField>
    </div>
    <DealDetailField field="opportunityScore"><p className="mb-2 text-sm font-medium">{vi ? "Điểm cơ hội" : "Opportunity score"} · {c.deal.opportunityScore}%</p><progress className="h-2 w-full accent-violet-600" value={c.deal.opportunityScore} max={100} aria-label={vi ? "Điểm cơ hội" : "Opportunity score"} /></DealDetailField>
    <p className="text-xs text-slate-500">{vi ? "Giá trị cơ hội × Điểm cơ hội / 100. Không quy đổi tiền tệ." : "Deal amount × Opportunity score / 100. No currency conversion."}</p>
    <DealDetailField field="forecastCategory"><p className="text-sm">{vi ? "Nhóm dự báo:" : "Forecast category:"} <strong>{c.deal.forecastCategory ? c.t(`deals.forecast.${c.deal.forecastCategory === "BEST_CASE" ? "bestCase" : c.deal.forecastCategory.toLowerCase()}`) : "—"}</strong></p></DealDetailField>
    <DealDetailField field="expectedCloseDate"><p className="text-sm">{vi ? "Ngày dự kiến chốt:" : "Expected close:"} {dealDisplayDate(c.deal.expectedCloseDate, c.locale, c.timeZone)}</p></DealDetailField>
    <DealDetailField field="forecastHistory"><DealForecastHistoryPanel deal={c.deal} /></DealDetailField>
  </section>;
}
