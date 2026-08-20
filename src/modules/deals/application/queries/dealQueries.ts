import type { Deal, OpportunityStageConfig } from "../../domain/model/deal.types";
import { isLostStage, isWonStage } from "../../domain/rules/dealStages";

export interface DealQueryFilters {
  search?: string;
  ownerId?: string;
  stage?: string;
  minAmount?: number;
}

export function getDeal(deals: readonly Deal[], dealId: string): Deal | undefined {
  return deals.find((deal) => deal.id === dealId);
}

export function queryDeals(deals: readonly Deal[], filters: DealQueryFilters): Deal[] {
  const search = filters.search?.trim().toLocaleLowerCase();
  return deals.filter((deal) => {
    if (search && ![deal.name, deal.customerName, deal.contactName]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase().includes(search))) return false;
    if (filters.ownerId && filters.ownerId !== "all" && deal.ownerId !== filters.ownerId) return false;
    if (filters.stage && filters.stage !== "all" && deal.stage !== filters.stage) return false;
    if (filters.minAmount != null && deal.amount < filters.minAmount) return false;
    return true;
  });
}

export function getDealStats(deals: readonly Deal[], stages: readonly OpportunityStageConfig[]) {
  const open = deals.filter((deal) => !isWonStage(deal.stage, stages) && !isLostStage(deal.stage, stages));
  const won = deals.filter((deal) => isWonStage(deal.stage, stages));
  const lost = deals.filter((deal) => isLostStage(deal.stage, stages));
  return {
    total: deals.length,
    open: open.length,
    won: won.length,
    lost: lost.length,
    openValue: open.reduce((sum, deal) => sum + (deal.amount || 0), 0),
    wonValue: won.reduce((sum, deal) => sum + (deal.amount || 0), 0),
  };
}
