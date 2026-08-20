import { DealStage, type Deal, type DealActivity, type DealForecastCategory, type DealRecycleDecision, type DealWinEvidence } from "../../domain/model/deal.types";
import { assertDealInvariant, normalizeDealStageCode } from "../../domain/rules/dealStages";
import { createDealForecastHistoryEntry, deriveDealForecastCategory } from "../../domain/rules/dealPipelineHealth";
import type { DealRepository } from "../ports/DealRepository";
import { saveDeal, updateDeal } from "./dealRepositoryCommands";
import { CAPABILITIES, assertRuntimeCommandAccess } from "@/platform/access-control";
import { appendRecordOwnershipAudit, assertOwnerReassignment } from "@/platform/record-ownership";

export function createCanonicalDeal(repository: DealRepository, deal: Deal): Deal {
  const normalizedStage = normalizeDealStageCode(deal.stage);
  const canonical = assertDealInvariant({
    ...deal,
    stage: normalizedStage,
    stageEnteredAt: deal.stageEnteredAt || deal.createdAt,
    forecastCategory: deal.forecastCategory || deriveDealForecastCategory({
      stage: normalizedStage,
      opportunityScore: deal.opportunityScore,
    }),
    forecastHistory: deal.forecastHistory || [],
  });
  return saveDeal(repository, canonical);
}

export function changeDealStage(
  repository: DealRepository,
  dealId: string,
  stage: DealStage | string,
  activity?: DealActivity,
) {
  const normalizedStage = normalizeDealStageCode(stage);
  if (normalizedStage === DealStage.WON || normalizedStage === DealStage.LOST) {
    throw new Error("Use markDealWon or markDealLost for terminal Deal outcomes.");
  }
  return updateDeal(repository, dealId, (deal) => {
    const occurredAt = new Date().toISOString();
    const nextCategory = deriveDealForecastCategory({ stage: normalizedStage, opportunityScore: deal.opportunityScore });
    const historyEntry = createDealForecastHistoryEntry(deal, { forecastCategory: nextCategory, occurredAt });
    return assertDealInvariant({
      ...deal,
      stage: normalizedStage,
      stageEnteredAt: occurredAt,
      forecastCategory: nextCategory,
      forecastHistory: historyEntry ? [historyEntry, ...(deal.forecastHistory || [])] : (deal.forecastHistory || []),
      wonAt: undefined,
      lostAt: undefined,
      actualCloseDate: undefined,
      winEvidence: undefined,
      lostReason: undefined,
      lostReasonNote: undefined,
      recycleDecision: undefined,
      recycleEligible: undefined,
      revisitAt: undefined,
      updatedAt: occurredAt,
      activities: activity ? [activity, ...(deal.activities ?? [])] : deal.activities,
    });
  });
}

export function setDealNextAction(
  repository: DealRepository,
  dealId: string,
  input: { nextActionAt: string; nextActionSummary?: string; taskId?: string },
) {
  return updateDeal(repository, dealId, (deal) => assertDealInvariant({
    ...deal,
    nextActionAt: input.nextActionAt,
    nextActionSummary: input.nextActionSummary?.trim() || deal.nextActionSummary,
    nextActionRef: input.taskId ? { type: "TASK", id: input.taskId } : { type: "MANUAL" },
    updatedAt: new Date().toISOString(),
  }));
}

export function updateDealForecast(
  repository: DealRepository,
  dealId: string,
  input: {
    expectedCloseDate?: string;
    opportunityScore?: number;
    forecastCategory?: DealForecastCategory;
    actor?: string;
  },
): Deal | undefined {
  return updateDeal(repository, dealId, (deal) => {
    const occurredAt = new Date().toISOString();
    const historyEntry = createDealForecastHistoryEntry(deal, { ...input, occurredAt });
    const nextScore = input.opportunityScore ?? deal.opportunityScore;
    const nextCategory = input.forecastCategory || deal.forecastCategory || deriveDealForecastCategory({
      stage: deal.stage,
      opportunityScore: nextScore,
    });
    return assertDealInvariant({
      ...deal,
      expectedCloseDate: input.expectedCloseDate ?? deal.expectedCloseDate,
      opportunityScore: nextScore,
      forecastCategory: nextCategory,
      forecastHistory: historyEntry ? [historyEntry, ...(deal.forecastHistory || [])] : (deal.forecastHistory || []),
      updatedAt: occurredAt,
    });
  });
}

export function markDealWon(
  repository: DealRepository,
  dealId: string,
  evidence: DealWinEvidence,
  activity?: DealActivity,
): Deal | undefined {
  const current = repository.list().find((deal) => deal.id === dealId);
  assertRuntimeCommandAccess(CAPABILITIES.DEALS_CLOSE, "deals", current);
  return updateDeal(repository, dealId, (deal) => assertDealInvariant({
    ...deal,
    stage: DealStage.WON,
    stageEnteredAt: evidence.occurredAt,
    forecastCategory: "COMMIT",
    winEvidence: evidence,
    wonAt: evidence.occurredAt,
    actualCloseDate: evidence.occurredAt.slice(0, 10),
    nextActionAt: undefined,
    nextActionSummary: undefined,
    nextActionRef: undefined,
    updatedAt: evidence.occurredAt,
    activities: activity ? [activity, ...(deal.activities ?? [])] : deal.activities,
  }));
}

export function markDealLost(
  repository: DealRepository,
  dealId: string,
  input: {
    reason: string;
    note?: string;
    recycleDecision: DealRecycleDecision;
    revisitAt?: string;
    occurredAt: string;
  },
  activity?: DealActivity,
): Deal | undefined {
  const current = repository.list().find((deal) => deal.id === dealId);
  assertRuntimeCommandAccess(CAPABILITIES.DEALS_CLOSE, "deals", current);
  const recycleEligible = input.recycleDecision !== "DO_NOT_RECYCLE";
  return updateDeal(repository, dealId, (deal) => assertDealInvariant({
    ...deal,
    stage: DealStage.LOST,
    stageEnteredAt: input.occurredAt,
    forecastCategory: deal.forecastCategory || deriveDealForecastCategory(deal),
    lostReason: input.reason.trim(),
    lostReasonNote: input.note?.trim() || undefined,
    recycleDecision: input.recycleDecision,
    recycleEligible,
    revisitAt: recycleEligible ? input.revisitAt : undefined,
    lostAt: input.occurredAt,
    actualCloseDate: input.occurredAt.slice(0, 10),
    nextActionAt: undefined,
    nextActionSummary: undefined,
    nextActionRef: undefined,
    updatedAt: input.occurredAt,
    activities: activity ? [activity, ...(deal.activities ?? [])] : deal.activities,
  }));
}

export function appendDealActivity(repository: DealRepository, dealId: string, activity: DealActivity) {
  return updateDeal(repository, dealId, (deal) => ({
    ...deal,
    updatedAt: new Date().toISOString(),
    activities: [activity, ...(deal.activities ?? [])],
  }));
}

export function reassignDeal(
  repository: DealRepository,
  dealId: string,
  input: { ownerId: string; reason: string; activity?: DealActivity },
) {
  const current = repository.list().find((deal) => deal.id === dealId);
  if (!current) return undefined;
  const context = assertOwnerReassignment(
    "deals",
    CAPABILITIES.DEALS_ASSIGN,
    CAPABILITIES.DEALS_UPDATE,
    current,
    input.ownerId,
    input.reason,
  );
  const occurredAt = new Date().toISOString();
  let updated: Deal | undefined;
  repository.replace(repository.list().map((deal) => {
    if (deal.id !== dealId) return deal;
    const next = assertDealInvariant({
      ...deal,
      ownerId: input.ownerId,
      updatedAt: occurredAt,
      activities: input.activity ? [input.activity, ...(deal.activities ?? [])] : deal.activities,
    });
    updated = next;
    return next;
  }));
  if (current.ownerId !== input.ownerId) {
    appendRecordOwnershipAudit({
      resourceKey: "deals",
      recordId: dealId,
      action: "REASSIGNED",
      previousOwnerId: current.ownerId,
      nextOwnerId: input.ownerId,
      reason: input.reason.trim(),
    }, context);
  }
  return updated ? structuredClone(updated) : undefined;
}
