import { useEffect, useState } from "react";
import type { OpportunityStageConfig } from "../../domain/model/deal.types";
import { getDealStagesSnapshot, resetDealStages, subscribeToDealStages } from "../../public/deals";

export function useDealStages() {
  const [stageConfigs, setStageConfigs] = useState<OpportunityStageConfig[]>(getDealStagesSnapshot);
  useEffect(() => subscribeToDealStages(setStageConfigs), []);
  return {
    stageConfigs,
    setStageConfigs,
    resetStageConfigs: resetDealStages,
  };
}
