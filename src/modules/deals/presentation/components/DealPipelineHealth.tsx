import React from "react";
import { AlertTriangle, Clock3, History, TimerReset } from "lucide-react";
import { useI18n } from "@/i18n";
import type { Deal } from "../../domain/model/deal.types";
import { getDealPipelineHealth } from "../../domain/rules/dealPipelineHealth";
import { formatDate } from "@/shared/lib/format/date";

interface DealPipelineHealthBadgesProps {
  deal: Deal;
  compact?: boolean;
}

export function DealPipelineHealthBadges({ deal, compact = false }: DealPipelineHealthBadgesProps) {
  const { t, locale } = useI18n();
  const health = getDealPipelineHealth(deal);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5" data-guidance-id="deals.pipeline.health-indicators">
      <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-medium text-slate-600" title={t("deals.pipelineHealth.daysInStageDescription")}>
        <Clock3 size={10} /> {t("deals.pipelineHealth.daysInStage", { count: health.daysInStage })}
      </span>
      {!compact && (
        <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[9px] font-medium text-slate-500" title={formatDate(health.lastActivityAt, locale)}>
          <History size={10} /> {t("deals.pipelineHealth.lastActivity", { count: health.daysSinceLastActivity })}
        </span>
      )}
      {health.nextStepStatus !== "ON_TRACK" && (
        <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[9px] font-semibold ${health.nextStepStatus === "OVERDUE" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
          <AlertTriangle size={10} /> {t(health.nextStepStatus === "OVERDUE" ? "deals.pipelineHealth.nextStepOverdue" : "deals.pipelineHealth.nextStepMissing")}
        </span>
      )}
      {health.stale && (
        <span className="inline-flex items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-2 py-1 text-[9px] font-semibold text-orange-700">
          <TimerReset size={10} /> {t("deals.pipelineHealth.stale")}
        </span>
      )}
      <span className="inline-flex items-center rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-[9px] font-semibold text-violet-700">
        {t(`deals.forecast.${health.forecastCategory === "BEST_CASE" ? "bestCase" : health.forecastCategory.toLowerCase()}`)}
      </span>
    </div>
  );
}

export function DealForecastHistoryPanel({ deal }: { deal: Deal }) {
  const { t, locale } = useI18n();
  const entries = deal.forecastHistory || [];
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4" data-guidance-id="deals.detail.forecast-history">
      <div className="flex items-center gap-2">
        <History size={15} className="text-violet-600" />
        <h3 className="text-sm font-extrabold text-slate-900">{t("deals.forecastHistory.title")}</h3>
      </div>
      {entries.length === 0 ? (
        <p className="mt-3 text-xs font-medium text-slate-500">{t("deals.forecastHistory.empty")}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {entries.slice(0, 8).map((entry) => (
            <div key={entry.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-[11px] text-slate-600">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-extrabold text-slate-800">{entry.actor || t("common.system")}</span>
                <span>{formatDate(entry.occurredAt, locale)}</span>
              </div>
              <p className="mt-1 leading-5">
                {t("deals.forecastHistory.changeSummary", {
                  previousDate: formatDate(entry.previousExpectedCloseDate, locale),
                  nextDate: formatDate(entry.nextExpectedCloseDate, locale),
                  previousProbability: entry.previousProbability,
                  nextProbability: entry.nextProbability,
                  previousCategory: t(`deals.forecast.${entry.previousCategory === "BEST_CASE" ? "bestCase" : entry.previousCategory.toLowerCase()}`),
                  nextCategory: t(`deals.forecast.${entry.nextCategory === "BEST_CASE" ? "bestCase" : entry.nextCategory.toLowerCase()}`),
                })}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
