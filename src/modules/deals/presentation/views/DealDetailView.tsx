import React from "react";
import { RecordDetailFrame } from "@/components/crm/detail-archetype";
import { CommercialLineagePanel } from "@/components/crm/CommercialLineagePanel";
import { DealDetailActivityTimeline } from "./DealDetailActivityTimeline";
import { DealDetailCommercialWorkspace } from "./DealDetailCommercialWorkspace";
import { DealDetailDialogs } from "./DealDetailDialogs";
import { DealDetailHeaderSection } from "./DealDetailHeaderSection";
import { DealDetailSidebar } from "./DealDetailSidebar";
import { DealFollowUpTasks } from "../components/DealFollowUpTasks";
import type { DealDetailController, DealDetailProductCatalog } from "./dealDetailView.types";
import { DealDetailPipelineWorkspace } from "./DealDetailPipelineWorkspace";
import { DealDetailQuoteWorkspace } from "./DealDetailQuoteWorkspace";
import { DealDetailForecast } from "./DealDetailForecast";

export function DealDetailView({
  controller,
  productCatalog,
}: {
  controller: DealDetailController;
  productCatalog: DealDetailProductCatalog;
}) {
  const { deal, locale } = controller;

  return (
    <RecordDetailFrame id="deal-detail-workspace" className="relative min-w-0 text-xs text-slate-700">
      <DealDetailHeaderSection controller={controller} />
      <DealDetailPipelineWorkspace controller={controller} />
      <div data-deal-workspace="studio-pipeline" data-deal-detail-layout="responsive" className="grid min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div role="tablist" aria-label={locale === "vi" ? "Nội dung cơ hội" : "Opportunity workspace"} className="flex overflow-x-auto border-b border-slate-200 px-3" data-guidance-id="deals.detail.tabs">
            {([['overview', 'Tổng quan', 'Overview'], ['quotes', 'Báo giá', 'Quotes'], ['tasks', 'Công việc', 'Tasks'], ['activity', 'Hoạt động', 'Activity'], ['forecast', 'Dự báo', 'Forecast']] as const).map(([key, vi, en], index, tabs) => <button key={key} type="button" role="tab" id={`deal-tab-${key}`} aria-controls={`deal-panel-${key}`} aria-selected={controller.activeTab === key} tabIndex={controller.activeTab === key ? 0 : -1}
              onClick={() => controller.setActiveTab(key)} onKeyDown={event => { const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : undefined;
                if (next !== undefined) { event.preventDefault(); const tab = tabs[next]; if (tab) { controller.setActiveTab(tab[0]); document.getElementById(`deal-tab-${tab[0]}`)?.focus(); } } }}
              className={`shrink-0 border-b-2 px-4 py-4 text-xs font-semibold outline-offset-[-4px] focus-visible:outline-2 focus-visible:outline-violet-600 ${controller.activeTab === key ? "border-violet-600 text-violet-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{locale === "vi" ? vi : en}</button>)}
          </div>
          <div role="tabpanel" id={`deal-panel-${controller.activeTab}`} aria-labelledby={`deal-tab-${controller.activeTab}`} tabIndex={0} className="min-w-0 p-4 sm:p-5">
            {controller.activeTab === "overview" && <DealDetailCommercialWorkspace controller={controller} />}
            {controller.activeTab === "quotes" && <DealDetailQuoteWorkspace controller={controller} />}
            {controller.activeTab === "tasks" && <DealFollowUpTasks deal={deal} locale={locale} />}
            {controller.activeTab === "activity" && <DealDetailActivityTimeline controller={controller} />}
            {controller.activeTab === "forecast" && <DealDetailForecast controller={controller} />}
          </div>
        </div>
        <DealDetailSidebar controller={controller} />
      </div>
      <CommercialLineagePanel anchorType="DEAL" anchorId={deal.id} locale={locale} />
      <DealDetailDialogs controller={controller} productCatalog={productCatalog} />
    </RecordDetailFrame>
  );
}
