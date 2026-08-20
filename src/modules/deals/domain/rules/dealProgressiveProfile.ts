import { DealStage, type Deal } from "../model/deal.types";
import { normalizeDealStageCode } from "./dealStages";

export type DealCreateMode = "QUICK" | "COMPLETE";
export type DealProfileField =
  | "name"
  | "buyerRef"
  | "ownerId"
  | "amount"
  | "forecastCategory";

export function getRequiredDealProfileFields(
  stage: Deal["stage"] = DealStage.DISCOVERY,
  mode: DealCreateMode = "COMPLETE",
): DealProfileField[] {
  const normalizedStage = normalizeDealStageCode(String(stage));
  const required: DealProfileField[] = ["name", "buyerRef", "ownerId"];

  if ([DealStage.PROPOSAL, DealStage.NEGOTIATION].includes(normalizedStage as DealStage)) {
    required.push("amount", "forecastCategory");
  }

  return [...new Set(required)];
}

export function validateDealProgressiveProfile(
  deal: Partial<Deal>,
  stage: Deal["stage"] = DealStage.DISCOVERY,
  mode: DealCreateMode = "COMPLETE",
): DealProfileField[] {
  return getRequiredDealProfileFields(stage, mode).filter((field) => {
    if (field === "buyerRef") return !deal.buyerRef?.id || !deal.buyerRef.type;
    if (field === "amount") return !Number.isFinite(deal.amount) || Number(deal.amount) <= 0;
    return !String(deal[field] ?? "").trim();
  });
}
