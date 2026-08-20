import React from "react";
import { RecordDetailFrame } from "@/components/crm/detail-archetype";
import { CommercialLineagePanel } from "@/components/crm/CommercialLineagePanel";
import { DealDetailActivityTimeline } from "./DealDetailActivityTimeline";
import { DealDetailCommercialWorkspace } from "./DealDetailCommercialWorkspace";
import { DealDetailDialogs } from "./DealDetailDialogs";
import { DealDetailHeaderSection } from "./DealDetailHeaderSection";
import { DealDetailSidebar } from "./DealDetailSidebar";
import type { DealDetailController, DealDetailProductCatalog } from "./dealDetailView.types";

export function DealDetailView({
  controller,
  productCatalog,
}: {
  controller: DealDetailController;
  productCatalog: DealDetailProductCatalog;
}) {
  const { deal, locale } = controller;

  return (
    <RecordDetailFrame id="deal-detail-workspace" className="relative text-xs text-slate-700">
      <DealDetailHeaderSection controller={controller} />
      <div data-deal-detail-layout="responsive" className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-8">
          <DealDetailCommercialWorkspace controller={controller} />
          <DealDetailActivityTimeline controller={controller} />
        </div>
        <DealDetailSidebar controller={controller} />
      </div>
      <CommercialLineagePanel anchorType="DEAL" anchorId={deal.id} locale={locale} />
      <DealDetailDialogs controller={controller} productCatalog={productCatalog} />
    </RecordDetailFrame>
  );
}
