import type { AppEventBus } from "@/platform/events";
import type { DealRepository } from "../application/ports/DealRepository";
import type { Deal } from "../domain/model/deal.types";

export const DEALS_CHANGED_EVENT = "unicore.deals.changed";

export class InMemoryDealRepository implements DealRepository {
  private deals: Deal[];

  constructor(seed: readonly Deal[], private readonly events: AppEventBus) {
    this.deals = cloneDeals(seed);
  }

  list(): Deal[] {
    return cloneDeals(this.deals);
  }

  getById(dealId: string): Deal | undefined {
    const deal = this.deals.find((item) => item.id === dealId);
    return deal ? structuredClone(deal) : undefined;
  }

  replace(deals: Deal[]): void {
    this.deals = cloneDeals(deals);
    this.events.publish<Deal[]>(DEALS_CHANGED_EVENT, this.list());
  }

  subscribe(listener: (deals: Deal[]) => void): () => void {
    return this.events.subscribe<Deal[]>(DEALS_CHANGED_EVENT, listener);
  }
}

function cloneDeals(deals: readonly Deal[]): Deal[] {
  return structuredClone([...deals]);
}
