export * from "./deals";

export { saveDeal, updateDeal, updateManyDeals, archiveDeal, archiveDeals } from "../application/commands/dealRepositoryCommands";

export {
  createCanonicalDeal,
  changeDealStage,
  setDealNextAction,
  updateDealForecast,
  markDealWon,
  markDealLost,
  appendDealActivity,
  reassignDeal,
} from "../application/commands/dealCommands";

export { getDeal, queryDeals, getDealStats } from "../application/queries/dealQueries";

export {
  DEFAULT_DEAL_STAGES,
  getActiveDealStages,
  getStageLabel,
  getNextStage,
  isWonStage,
  isLostStage,
  isOpenStage,
  normalizeDealStageCode,
  normalizeDealStageConfigs,
  validateDealInvariant,
  assertDealInvariant,
} from "../domain/rules/dealStages";

export {
  getRequiredDealProfileFields,
  validateDealProgressiveProfile,
} from "../domain/rules/dealProgressiveProfile";

export { DealStage } from "../domain/model/deal.types";

export type {
  Deal,
  DealActivityType,
  DealActivity,
  DealLineItem,
  DealNextActionRef,
  DealRecycleDecision,
  DealForecastCategory,
  DealForecastHistoryEntry,
  DealWinEvidence,
  OpportunityStageConfig,
} from "../domain/model/deal.types";

export type { DealRepository } from "../application/ports/DealRepository";
export type {
  DealApiRuntime,
  DealApiRuntimeMode,
  DealCommandPort,
  DealQueryPort,
  DealForecastSummary,
  DealForecastCurrencyBucket,
} from "../application/ports/DealApiRuntime";

export { DealFormModal, mapSelectedPickerItemsToDealLineItems } from "../presentation/components/DealFormModal";

export type {
  DealFormDraft,
  DealFormMode,
  DealFormModalProps,
  DealOwnerOption,
  DealPriority,
  DealOpportunityType,
} from "../presentation/components/DealFormModal";

export {
  getDealCollectionResource,
  getDealDetailResource,
  getDealForecastSummaryResource,
} from "../application/vertical-slice/dealAuthoritativeQueries";
