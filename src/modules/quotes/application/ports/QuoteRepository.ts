import type { Quote } from "../../domain/model/quote.types";

export interface QuoteRepository {
  list(): Quote[];
  getById(quoteId: string): Quote | undefined;
  replace(quotes: Quote[]): void;
  subscribe(listener: (quotes: Quote[]) => void): () => void;
}
