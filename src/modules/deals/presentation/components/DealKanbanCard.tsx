import React from "react";
import { AlertTriangle, ArrowRight, Clock3, LoaderCircle, MoreHorizontal } from "lucide-react";
import type { Deal } from "../../domain/model/deal.types";
import { getDealPipelineHealth } from "../../domain/rules/dealPipelineHealth";
import { useI18n } from "@/i18n";
import { IconButton } from "@/shared/components/ui";
import { formatCurrency } from "@/shared/lib/format/currency";
import { formatDate, formatDateTime } from "@/shared/lib/format/date";
import "./DealKanbanCard.css";

interface DealKanbanCardProps {
  deal: Deal;
  ownerLabel: string;
  overdue: boolean;
  canAdvance: boolean;
  advancing: boolean;
  actionsOpen: boolean;
  onOpen: () => void;
  onOpenActions: React.MouseEventHandler<HTMLButtonElement>;
  onAdvance: () => void;
}

/** Presentation only. The pipeline retains navigation, drag/drop and command ownership. */
export function DealKanbanCard({
  deal, ownerLabel, overdue, canAdvance, advancing, actionsOpen,
  onOpen, onOpenActions, onAdvance,
}: DealKanbanCardProps) {
  const { t, locale } = useI18n();
  const health = getDealPipelineHealth(deal);
  const buyerName = (deal.buyerRef.type === "CONTACT" ? deal.contactName : deal.organizationAccountName)
    || deal.customerName;
  const amount = formatCurrency(deal.amount, deal.currency || "VND", locale);
  const actionSummary = deal.nextActionSummary?.trim();
  const actionDate = formatDate(deal.nextActionAt, locale, { day: "2-digit", month: "2-digit" });
  const hasNextAction = Boolean(actionSummary && actionDate);
  const warnings = [...new Set([
    overdue ? t("deals.badges.overdue") : "",
    health.nextStepStatus !== "ON_TRACK"
      ? t(health.nextStepStatus === "OVERDUE" ? "deals.pipelineHealth.nextStepOverdue" : "deals.pipelineHealth.nextStepMissing")
      : "",
    health.stale ? t("deals.pipelineHealth.stale") : "",
    deal.riskBadge?.trim() || "",
  ].filter(Boolean))].join(" · ");

  return (
    <>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <button
          type="button"
          draggable={false}
          className="min-w-0 flex-1 rounded text-left text-[13px] font-semibold leading-[18px] text-indigo-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          title={deal.name}
          onClick={(event) => { event.stopPropagation(); onOpen(); }}
        >
          <span className="deal-kanban-name">{deal.name}</span>
        </button>
        <IconButton
          variant="secondary"
          size="xs"
          draggable={false}
          onClick={onOpenActions}
          title={t("opportunities.actions.rowMenu", "Thao tác cơ hội")}
          aria-label={t("opportunities.actions.rowMenu", "Thao tác cơ hội")}
          aria-haspopup="menu"
          aria-expanded={actionsOpen}
        >
          <MoreHorizontal size={14} aria-hidden="true" />
        </IconButton>
      </div>

      <p className="deal-kanban-summary min-w-0 text-xs leading-4 text-slate-600" title={buyerName}>{buyerName || "—"}</p>

      <div className="flex min-w-0 items-center justify-between gap-2 leading-5">
        <span className="deal-kanban-summary min-w-0 text-[13px] font-semibold tabular-nums text-slate-800" title={amount}>{amount}</span>
        <span className="shrink-0 text-xs tabular-nums text-slate-500" title={t("deals.columns.probability")} aria-label={`${t("deals.columns.probability")}: ${deal.opportunityScore}%`}>
          {deal.opportunityScore}%
        </span>
      </div>

      {hasNextAction && (
        <div
          className={`flex min-w-0 items-center gap-1 text-xs leading-4 ${health.nextStepStatus === "OVERDUE" ? "text-rose-700" : "text-slate-600"}`}
          title={`${t("deals.card.nextActivity")}: ${actionSummary} · ${formatDateTime(deal.nextActionAt, locale)}`}
        >
          <Clock3 size={12} className="shrink-0" aria-hidden="true" />
          <span className="deal-kanban-summary min-w-0">{actionSummary}</span>
          <span className="shrink-0">· {actionDate}</span>
        </div>
      )}

      <div data-deal-next-stage-action="contained" className="mt-auto flex min-w-0 items-center gap-2 border-t border-slate-100 pt-1 text-xs text-slate-500">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 font-semibold text-indigo-700"
          role="img"
          title={`${t("deals.columns.owner")}: ${ownerLabel}`}
          aria-label={`${t("deals.columns.owner")}: ${ownerLabel}`}
        >
          {ownerLabel.charAt(0)}
        </span>
        <span
          className={`deal-kanban-summary min-w-0 tabular-nums ${overdue ? "font-medium text-rose-700" : ""}`}
          title={`${t("deals.columns.expectedClose")}: ${formatDate(deal.expectedCloseDate, locale)}`}
          aria-label={`${t("deals.columns.expectedClose")}: ${formatDate(deal.expectedCloseDate, locale)}`}
        >
          {formatDate(deal.expectedCloseDate, locale) || "—"}
        </span>
        {warnings && (
          <span role="img" aria-label={warnings} title={warnings} className={`shrink-0 ${overdue || health.nextStepStatus === "OVERDUE" ? "text-rose-700" : "text-amber-700"}`} data-guidance-id="deals.pipeline.health-indicators">
            <AlertTriangle size={14} aria-hidden="true" />
          </span>
        )}
        {canAdvance && (
          <span className="ml-auto shrink-0" onClick={(event) => event.stopPropagation()}>
            <IconButton
              variant="secondary"
              size="xs"
              className="text-indigo-700"
              draggable={false}
              data-deal-next-stage-button="contained"
              title={t("deals.actions.nextStage")}
              aria-label={t("deals.actions.nextStage")}
              aria-busy={advancing}
              disabled={advancing}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => { event.stopPropagation(); onAdvance(); }}
            >
              {advancing ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : <ArrowRight size={14} aria-hidden="true" />}
            </IconButton>
          </span>
        )}
      </div>
    </>
  );
}
