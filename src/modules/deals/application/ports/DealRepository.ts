import type { Deal } from "../../domain/model/deal.types";

export interface DealRepository {
  list(): Deal[];
  getById(dealId: string): Deal | undefined;
  replace(deals: Deal[]): void;
  subscribe(listener: (deals: Deal[]) => void): () => void;
}
