import React from "react";
import { formatApplicationError } from "@/shared/operations";
import { Check, CircleDot } from "lucide-react";
import { dealPipelinePresentation } from "./dealDetailPresentation";
import { DealDetailField } from "./DealDetailField";
import type { DealDetailController } from "./dealDetailView.types";

export function DealDetailPipelineWorkspace({ controller: c }: { controller: DealDetailController }) {
  const { stages, terminal } = dealPipelinePresentation(c.deal, c.stageConfigs);
  const vi = c.locale === "vi";
  return <DealDetailField field="stageCode" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
    <p className="mb-3 break-words text-xs text-slate-500">Pipeline: {c.pipeline ? c.pipeline.name[c.locale] : c.pipelineQuery.loading ? (vi ? "Đang tải" : "Loading") : c.deal.pipelineId || "—"}</p>
    {c.pipelineQuery.error && <p role="alert" className="mb-3 text-xs text-red-700">{formatApplicationError(c.pipelineQuery.error, { locale: c.locale })}</p>}
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2"><CircleDot size={16} className="text-violet-600" /><h2 className="text-sm font-semibold text-slate-900">{vi ? "Tiến trình cơ hội" : "Opportunity progress"}</h2><span className="text-[11px] text-slate-400">· {stages.length} {vi ? "giai đoạn mở" : "open stages"}</span></div>
      {terminal && <span data-deal-outcome={terminal} className={`rounded-full px-3 py-1 text-xs font-semibold ${terminal === "won" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{vi ? terminal === "won" ? "Đã thắng" : "Đã thua" : terminal === "won" ? "Won" : "Lost"}</span>}
    </div>
    <div data-deal-detail-stage-map="responsive" className="max-w-full overflow-x-auto pb-2 crm-scroll-x" tabIndex={0} role="region" aria-label={vi ? "Các giai đoạn cơ hội" : "Opportunity stages"}>
      <ol className="flex gap-2" data-pipeline-stage-count={stages.length}>{stages.map((stage, index) => <li key={stage.code} aria-current={stage.current ? "step" : undefined} title={vi ? stage.labelVi : stage.labelEn}
        data-pipeline-stage={stage.code} data-stage-active={stage.isActive} className={`flex min-h-12 min-w-36 flex-1 basis-36 items-center gap-2 rounded-lg border px-3 py-2 ${stage.current ? "border-violet-300 bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-100" : stage.visited ? "border-emerald-200 bg-emerald-50/60 text-emerald-700" : "border-slate-200 text-slate-500"}`}>
        <span className={`flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold ${stage.current ? "bg-violet-600 text-white" : "border border-slate-200 bg-white"}`}>{stage.visited ? <Check size={13} /> : index + 1}</span>
        <span className="min-w-0"><span className="break-words break-words text-[11px] font-semibold">{vi ? stage.labelVi : stage.labelEn}</span>{!stage.isActive && <small className="text-[9px]">{vi ? "Ngừng sử dụng" : "Inactive"}</small>}</span>
      </li>)}</ol>
    </div>
    {!stages.some(stage => stage.current) && !terminal && <p className="mt-2 text-xs text-slate-500">{vi ? "Giai đoạn hiện tại:" : "Current stage:"} {c.getDealStageLabel(c.deal.stage)}</p>}
  </DealDetailField>;
}
