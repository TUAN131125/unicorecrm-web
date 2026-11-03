import React from "react";
import { resolveWorkspaceMemberLabel } from "@/platform/member-directory";
import { dealDisplayDate } from "./dealDetailPresentation";
import { DealPipelineHealthBadges } from "../components/DealPipelineHealth";
import { DealDetailField } from "./DealDetailField";
import { DealDetailQuoteWorkspace } from "./DealDetailQuoteWorkspace";
import { DealDetailProducts } from "./DealDetailProducts";
import { DealDetailOrderWorkspace } from "./DealDetailOrderWorkspace";
import type { DealDetailController } from "./dealDetailView.types";

export function DealDetailOverview({ controller: c }: { controller: DealDetailController }) {
  const { deal, locale } = c; const vi = locale === "vi";
  return <div className="space-y-6" data-deal-overview>
    {(c.relatedQuotes.length > 0 || c.quoteQuery.loading) && <DealDetailQuoteWorkspace controller={c} compact />}
    <DealDetailOrderWorkspace controller={c} />
    <div><h2 className="text-base font-semibold text-slate-900">{vi ? "Thông tin cơ hội" : "Opportunity information"}</h2><p className="mt-1 text-xs text-slate-500">{vi ? "Thông tin phục vụ kế hoạch và quyết định bán hàng" : "Context for your sales plan and decisions"}</p></div>
    <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
      <Detail field="buyerRef" label={vi ? "Người mua" : "Buyer"}>{"name" in c.buyerLabel ? c.buyerLabel.name : "—"}</Detail>
      <Detail field="stageCode" label={vi ? "Giai đoạn hiện tại" : "Current stage"}>{c.getDealStageLabel(deal.stage)}</Detail>
      <Detail field="forecastCategory" label={vi ? "Nhóm dự báo" : "Forecast category"}>{deal.forecastCategory ? c.t(`deals.forecast.${deal.forecastCategory === "BEST_CASE" ? "bestCase" : deal.forecastCategory.toLowerCase()}`) : "—"}</Detail>
      <Detail field="ownerId" label={vi ? "Chủ sở hữu" : "Owner"}>{resolveWorkspaceMemberLabel(deal.ownerId, locale)}</Detail>
      <Detail field="expectedCloseDate" label={vi ? "Ngày dự kiến chốt" : "Expected close date"}>{dealDisplayDate(deal.expectedCloseDate, locale, c.timeZone)}</Detail>
    </dl>
    <DealDetailField field="nextActionSummary"><DealDetailField field="stageEnteredAt"><DealDetailField field="forecastCategory"><div className="border-t border-slate-100 pt-5"><h3 className="mb-2 text-xs font-semibold text-slate-800">{vi ? "Tình trạng theo dõi" : "Follow-up health"}</h3><DealPipelineHealthBadges deal={deal} /></div></DealDetailField></DealDetailField></DealDetailField>
    <DealDetailField field="notes"><div className="border-t border-slate-100 pt-5"><h3 className="mb-2 text-xs font-semibold text-slate-800">{vi ? "Ghi chú cơ hội" : "Deal notes"}</h3><p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{deal.notes || (vi ? "Chưa có ghi chú." : "No notes yet.")}</p></div></DealDetailField>
    <DealDetailProducts controller={c} />
  </div>;
}
function Detail({ field, label, children }: { field: string; label: string; children: React.ReactNode }) {
  return <DealDetailField field={field} className="min-w-0"><dt className="mb-1 text-[11px] text-slate-500">{label}</dt><dd className="break-words text-sm font-medium text-slate-800">{children || "—"}</dd></DealDetailField>;
}
