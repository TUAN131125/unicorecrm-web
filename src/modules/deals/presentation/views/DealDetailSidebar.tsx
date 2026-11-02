import React from "react";
import { DealDetailRelatedRecords } from "./DealDetailRelatedRecords";
import { DealDetailSidebarActions } from "./DealDetailSidebarActions";
import type { DealDetailController } from "./dealDetailView.types";
import { DealDetailNextActionPanel } from "./DealDetailNextActionPanel";

export function DealDetailSidebar({ controller }: { controller: DealDetailController }) {
  return (
    <aside className="grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-1">
      <DealDetailNextActionPanel controller={controller} />
      <DealDetailSidebarActions controller={controller} />
      <DealDetailRelatedRecords controller={controller} />
    </aside>
  );
}
