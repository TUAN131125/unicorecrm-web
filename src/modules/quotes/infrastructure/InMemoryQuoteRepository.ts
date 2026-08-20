import type { AppEventBus } from "@/platform/events";
import type { StoragePort } from "@/platform/persistence";
import type { QuoteRepository } from "../application/ports/QuoteRepository";
import type { Quote } from "../domain/model/quote.types";
import { withCanonicalQuotePricing } from "../domain/rules/quoteCalculations";
import { assertQuoteInvariant } from "../domain/rules/quoteVersioning";

export const QUOTES_CHANGED_EVENT = "unicore.quotes.changed";
const STORAGE_KEY = "snapshot";
const STORAGE_VERSION = 1;

interface PersistedQuoteSnapshot {
  version: number;
  records: Quote[];
}

export class InMemoryQuoteRepository implements QuoteRepository {
  private quotes: Quote[];

  constructor(seed: readonly Quote[], private readonly events: AppEventBus, private readonly storage?: StoragePort) {
    this.quotes = this.load(seed);
  }

  list(): Quote[] {
    return cloneQuotes(this.quotes);
  }

  getById(quoteId: string): Quote | undefined {
    const quote = this.quotes.find((item) => item.id === quoteId);
    return quote ? structuredClone(quote) : undefined;
  }

  replace(quotes: Quote[]): void {
    const canonical = quotes.map((quote) => assertQuoteInvariant(withCanonicalQuotePricing(structuredClone(quote))));
    this.assertUnique(canonical);
    this.persist(canonical);
    this.quotes = cloneQuotes(canonical);
    this.events.publish<Quote[]>(QUOTES_CHANGED_EVENT, this.list());
  }

  subscribe(listener: (quotes: Quote[]) => void): () => void {
    return this.events.subscribe<Quote[]>(QUOTES_CHANGED_EVENT, listener);
  }

  private load(seed: readonly Quote[]): Quote[] {
    const stored = this.storage?.get<unknown>(STORAGE_KEY);
    const candidates = Array.isArray(stored)
      ? stored
      : stored && typeof stored === "object" && Array.isArray((stored as PersistedQuoteSnapshot).records)
        ? (stored as PersistedQuoteSnapshot).records
        : seed;
    try {
      const canonical = candidates.map((quote) => assertQuoteInvariant(withCanonicalQuotePricing(structuredClone(quote as Quote))));
      this.assertUnique(canonical);
      if (this.storage && candidates === seed) this.persist(canonical);
      return cloneQuotes(canonical);
    } catch {
      const canonicalSeed = seed.map((quote) => assertQuoteInvariant(withCanonicalQuotePricing(structuredClone(quote))));
      this.storage?.remove(STORAGE_KEY);
      if (this.storage) this.persist(canonicalSeed);
      return cloneQuotes(canonicalSeed);
    }
  }

  private persist(quotes: Quote[]): void {
    if (!this.storage) return;
    const snapshot: PersistedQuoteSnapshot = { version: STORAGE_VERSION, records: cloneQuotes(quotes) };
    this.storage.set(STORAGE_KEY, snapshot);
    const verified = this.storage.get<PersistedQuoteSnapshot>(STORAGE_KEY);
    if (!verified || verified.version !== STORAGE_VERSION || JSON.stringify(verified.records) !== JSON.stringify(snapshot.records)) {
      throw new Error("Quote data could not be saved to browser storage. Your changes were not committed.");
    }
  }

  private assertUnique(quotes: readonly Quote[]): void {
    const ids = new Set<string>();
    const numberRoots = new Map<string, string>();
    for (const quote of quotes) {
      if (ids.has(quote.id)) throw new Error(`Duplicate Quote id: ${quote.id}`);
      const rootId = quote.rootQuoteId || quote.id;
      const existingRoot = numberRoots.get(quote.quoteNumber);
      if (existingRoot && existingRoot !== rootId) throw new Error(`Duplicate Quote number: ${quote.quoteNumber}`);
      ids.add(quote.id);
      numberRoots.set(quote.quoteNumber, rootId);
    }
  }
}

function cloneQuotes(quotes: readonly Quote[]): Quote[] {
  return structuredClone([...quotes]);
}
