import React from "react";
import { DealDetailPipelineWorkspace } from "./DealDetailPipelineWorkspace";
import { DealDetailQuoteWorkspace } from "./DealDetailQuoteWorkspace";
import type { DealDetailController } from "./dealDetailView.types";

export function DealDetailCommercialWorkspace({ controller }: { controller: DealDetailController }) {
  return (
    <>
      <DealDetailPipelineWorkspace controller={controller} />
      <DealDetailQuoteWorkspace controller={controller} />
    </>
  );
}
