import type { Deal, OpportunityStageConfig } from "../../domain/model/deal.types";
import { isLostStage, isWonStage } from "../../domain/rules/dealStages";
import { money, percentageOfMoney } from "@/shared/money";
import { formatDate } from "@/shared/lib/format/date";

export function dealDisplayDate(value: string | undefined, locale: string, timeZone: string) {
  // A contract DateOnly is a calendar day, not an instant to shift across zones.
  return formatDate(value, locale, { timeZone: value && /^\d{4}-\d{2}-\d{2}$/u.test(value) ? "UTC" : timeZone }) || "—";
}

export function dealCloseDateOverdue(value: string | undefined, timeZone: string, now = new Date()) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parts = new Intl.DateTimeFormat("en", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const day = ["year", "month", "day"].map(type => parts.find(part => part.type === type)?.value);
  return day.every(Boolean) && value < day.join("-");
}

/** Display only. Earlier positions are not evidence that a Deal visited a stage. */
export function dealPipelinePresentation(deal: Deal, configs: readonly OpportunityStageConfig[]) {
  const terminal = (deal.stageCategory === "WON" || isWonStage(deal.stage, configs)) ? "won" : (deal.stageCategory === "LOST" || isLostStage(deal.stage, configs)) ? "lost" : undefined;
  const visited = new Set((deal.activities ?? []).flatMap(activity =>
    activity.type === "stage" ? [activity.metadata?.fromStage, activity.metadata?.toStage].filter((code): code is string => Boolean(code)) : []));
  return {
    terminal,
    stages: [...configs].filter(stage => stage.category === "open" && (stage.isActive || stage.code === deal.stage))
      .sort((a, b) => a.order - b.order)
      .map(stage => ({ ...stage, current: stage.code === deal.stage, visited: stage.code !== deal.stage && visited.has(stage.code) })),
  };
}

/** Only active open stages of the assigned pipeline are transition targets. */
export function dealStageChoices(deal: Deal, configs: readonly OpportunityStageConfig[], connected: boolean) {
  if (isWonStage(deal.stage, configs) || isLostStage(deal.stage, configs) || deal.archivedAt) return [];
  return [...configs].filter(stage => stage.category === "open" && stage.isActive && stage.code !== deal.stage
)
    .sort((a, b) => a.order - b.order);
}

export function dealWeightedForecast(deal: Deal) {
  if (!deal.currency || !Number.isFinite(deal.amount) || !Number.isFinite(deal.opportunityScore)) return undefined;
  return percentageOfMoney(money(deal.amountDecimal ?? String(deal.amount), deal.currency), String(deal.opportunityScore));
}

/** Only same-module return targets are accepted, including the current workspace's canonical path. */
export function dealReturnTarget(returnTo: unknown, workspaceKey: string) {
  if (typeof returnTo !== "string") return "/deals";
  const canonical = `/w/${workspaceKey}/crm/deals`;
  return /^\/deals(?:\?[^#]*)?$/u.test(returnTo) || (returnTo === canonical || returnTo.startsWith(`${canonical}?`)) ? returnTo : "/deals";
}
