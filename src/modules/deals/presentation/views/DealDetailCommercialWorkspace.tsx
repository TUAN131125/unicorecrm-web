import React from "react";
import { DealDetailOverview } from "./DealDetailOverview";
import type { DealDetailController } from "./dealDetailView.types";

export function DealDetailCommercialWorkspace({ controller }: { controller: DealDetailController }) {
  return (
    <>
      <DealDetailOverview controller={controller} />
    </>
  );
}
