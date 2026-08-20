import React from "react";
import { DealDetailRelatedRecords } from "./DealDetailRelatedRecords";
import { DealDetailSidebarActions } from "./DealDetailSidebarActions";
import type { DealDetailController } from "./dealDetailView.types";

export function DealDetailSidebar({ controller }: { controller: DealDetailController }) {
  return (
    <div className="space-y-5 xl:col-span-4">
      <DealDetailSidebarActions controller={controller} />
      <DealDetailRelatedRecords controller={controller} />
    </div>
  );
}
