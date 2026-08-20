import { createDurableId } from "@/shared/ids";
import { DealStage, type Deal, type DealForecastCategory, type DealForecastHistoryEntry } from "../model/deal.types";
import { normalizeDealStageCode } from "./dealStages";

const DAY_MS = 24 * 60 * 60 * 1000;

export type DealNextStepStatus = "ON_TRACK" | "MISSING" | "OVERDUE";

export interface DealPipelineHealth {
  stageEnteredAt: string;
  daysInStage: number;
  lastActivityAt: string;
  daysSinceLastActivity: number;
  nextStepStatus: DealNextStepStatus;
  stale: boolean;
  forecastCategory: DealForecastCategory;
}

function asTimestamp(value?: string): number | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function deriveDealForecastCategory(
  deal: Pick<Deal, "stage" | "opportunityScore">,
): DealForecastCategory {
  const stage = normalizeDealStageCode(String(deal.stage));
  if (stage === DealStage.NEGOTIATION || deal.opportunityScore >= 80) return "COMMIT";
  if ([DealStage.SOLUTION, DealStage.PROPOSAL].includes(stage as DealStage) || deal.opportunityScore >= 50) return "BEST_CASE";
  return "PIPELINE";
}

export function resolveDealStageEnteredAt(deal: Pick<Deal, "stageEnteredAt" | "createdAt" | "activities">): string {
  if (deal.stageEnteredAt && asTimestamp(deal.stageEnteredAt) !== null) return deal.stageEnteredAt;
  const stageActivity = (deal.activities || [])
    .filter((activity) => activity.type === "stage")
    .map((activity) => activity.createdAt)
    .filter((value): value is string => asTimestamp(value) !== null)
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0];
  return stageActivity || deal.createdAt;
}

export function resolveDealLastActivityAt(
  deal: Pick<Deal, "updatedAt" | "createdAt" | "activities">,
): string {
  const candidates = [deal.updatedAt, deal.createdAt, ...(deal.activities || []).map((activity) => activity.createdAt)]
    .filter((value): value is string => asTimestamp(value) !== null)
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime());
  return candidates[0] || deal.createdAt;
}

export function getDealPipelineHealth(deal: Deal, now = new Date()): DealPipelineHealth {
  const nowMs = now.getTime();
  const stageEnteredAt = resolveDealStageEnteredAt(deal);
  const lastActivityAt = resolveDealLastActivityAt(deal);
  const daysInStage = Math.max(0, Math.floor((nowMs - (asTimestamp(stageEnteredAt) || nowMs)) / DAY_MS));
  const daysSinceLastActivity = Math.max(0, Math.floor((nowMs - (asTimestamp(lastActivityAt) || nowMs)) / DAY_MS));
  const terminal = [DealStage.WON, DealStage.LOST].includes(normalizeDealStageCode(String(deal.stage)) as DealStage);
  const nextAt = asTimestamp(deal.nextActionAt);
  const hasNextStep = Boolean(deal.nextActionSummary?.trim() && nextAt !== null);
  const nextStepStatus: DealNextStepStatus = terminal
    ? "ON_TRACK"
    : !hasNextStep
      ? "MISSING"
      : (nextAt as number) < nowMs
        ? "OVERDUE"
        : "ON_TRACK";
  const stale = !terminal && (daysSinceLastActivity >= 14 || daysInStage >= 21);

  return {
    stageEnteredAt,
    daysInStage,
    lastActivityAt,
    daysSinceLastActivity,
    nextStepStatus,
    stale,
    forecastCategory: deal.forecastCategory || deriveDealForecastCategory(deal),
  };
}

export function createDealForecastHistoryEntry(
  deal: Deal,
  input: {
    expectedCloseDate?: string;
    opportunityScore?: number;
    forecastCategory?: DealForecastCategory;
    actor?: string;
    occurredAt?: string;
  },
): DealForecastHistoryEntry | null {
  const occurredAt = input.occurredAt || new Date().toISOString();
  const nextCategory = input.forecastCategory || deal.forecastCategory || deriveDealForecastCategory({
    stage: deal.stage,
    opportunityScore: input.opportunityScore ?? deal.opportunityScore,
  });
  const closeDateChanged = input.expectedCloseDate !== undefined && input.expectedCloseDate !== deal.expectedCloseDate;
  const probabilityChanged = input.opportunityScore !== undefined && input.opportunityScore !== deal.opportunityScore;
  const categoryChanged = nextCategory !== (deal.forecastCategory || deriveDealForecastCategory(deal));
  if (!closeDateChanged && !probabilityChanged && !categoryChanged) return null;

  return {
    id: createDurableId("deal_forecast"),
    occurredAt,
    actor: input.actor,
    previousExpectedCloseDate: deal.expectedCloseDate,
    nextExpectedCloseDate: input.expectedCloseDate ?? deal.expectedCloseDate,
    previousProbability: deal.opportunityScore,
    nextProbability: input.opportunityScore ?? deal.opportunityScore,
    previousCategory: deal.forecastCategory || deriveDealForecastCategory(deal),
    nextCategory,
  };
}
