import type { QuoteRepository } from "../ports/QuoteRepository";
import { QuoteStatus, type Quote } from "../../domain/model/quote.types";
import { withCanonicalQuotePricing } from "../../domain/rules/quoteCalculations";
import { assertQuoteInvariant, assertQuoteMutationAllowed } from "../../domain/rules/quoteVersioning";
import { CAPABILITIES, assertRuntimeCommandAccess, assertRuntimeCapability } from "@/platform/access-control";
import { createDurableId } from "@/shared/ids";
import { assertDestructiveActionAllowed } from "@/shared/application";

export type QuoteCollectionUpdater = Quote[] | ((current: Quote[]) => Quote[]);


function canonicalize(quote: Quote): Quote {
  return assertQuoteInvariant(withCanonicalQuotePricing(structuredClone(quote)));
}

function assertUniqueQuoteIdentity(quotes: readonly Quote[]): void {
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

export function allocateQuoteIdentity(
  repository: QuoteRepository,
  now: Date | string = new Date(),
  idFactory: () => string = () => createDurableId("quote"),
): { id: string; quoteNumber: string } {
  const date = typeof now === "string" ? new Date(now) : now;
  const year = Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
  const prefix = `Q-${year}-`;
  const existing = repository.list();
  const maxSequence = existing.reduce((max, quote) => {
    if (!quote.quoteNumber.startsWith(prefix)) return max;
    const sequence = Number(quote.quoteNumber.slice(prefix.length));
    return Number.isInteger(sequence) ? Math.max(max, sequence) : max;
  }, 0);
  let id = `quote_${idFactory()}`;
  while (existing.some((quote) => quote.id === id)) id = `quote_${idFactory()}`;
  return { id, quoteNumber: `${prefix}${String(maxSequence + 1).padStart(4, "0")}` };
}

export function updateQuoteCollection(repository: QuoteRepository, updater: QuoteCollectionUpdater): Quote[] {
  assertRuntimeCapability(CAPABILITIES.QUOTES_UPDATE);
  const current = repository.list();
  const next = typeof updater === "function" ? updater(current) : updater;
  const currentById = new Map(current.map((quote) => [quote.id, quote]));
  const validated = next.map((quote) => {
    const previous = currentById.get(quote.id);
    if (previous) assertQuoteMutationAllowed(previous, quote);
    const canonical = canonicalize(quote);
    return canonical;
  });
  assertUniqueQuoteIdentity(validated);
  repository.replace(validated);
  return repository.list();
}

export function saveQuote(repository: QuoteRepository, quote: Quote): Quote {
  const current = repository.list();
  const previous = current.find((item) => item.id === quote.id);
  if (previous) assertQuoteMutationAllowed(previous, quote);
  const canonical = canonicalize(quote);
  assertRuntimeCommandAccess(previous ? CAPABILITIES.QUOTES_UPDATE : CAPABILITIES.QUOTES_CREATE, "quotes", previous);
  const next = previous
    ? current.map((item) => item.id === quote.id ? canonical : item)
    : [canonical, ...current];
  assertUniqueQuoteIdentity(next);
  repository.replace(next);
  return structuredClone(canonical);
}

export function updateQuote(repository: QuoteRepository, quoteId: string, transform: (quote: Quote) => Quote): Quote | undefined {
  let updated: Quote | undefined;
  const next = repository.list().map((quote) => {
    if (quote.id !== quoteId) return quote;
    assertRuntimeCommandAccess(CAPABILITIES.QUOTES_UPDATE, "quotes", quote);
    const proposed = transform(structuredClone(quote));
    assertQuoteMutationAllowed(quote, proposed);
    const transformed = canonicalize(proposed);
    updated = transformed;
    return transformed;
  });
  assertUniqueQuoteIdentity(next);
  repository.replace(next);
  return updated ? structuredClone(updated) : undefined;
}

export function updateManyQuotes(repository: QuoteRepository, quoteIds: readonly string[], transform: (quote: Quote) => Quote): number {
  assertRuntimeCapability(CAPABILITIES.QUOTES_UPDATE);
  const ids = new Set(quoteIds);
  let count = 0;
  const next = repository.list().map((quote) => {
    if (!ids.has(quote.id)) return quote;
    assertRuntimeCommandAccess(CAPABILITIES.QUOTES_UPDATE, "quotes", quote);
    const proposed = transform(structuredClone(quote));
    assertQuoteMutationAllowed(quote, proposed);
    const transformed = canonicalize(proposed);
    count += 1;
    return transformed;
  });
  assertUniqueQuoteIdentity(next);
  repository.replace(next);
  return count;
}

export interface QuoteArchiveCommandInput {
  reason: string;
  actorId: string;
  actorName?: string;
  now?: string;
}

export function archiveQuote(repository: QuoteRepository, quoteId: string, input: QuoteArchiveCommandInput): Quote {
  const target = repository.getById(quoteId);
  if (!target) throw new Error("Quote was not found.");
  assertRuntimeCommandAccess(CAPABILITIES.QUOTES_DELETE, "quotes", target);
  assertDestructiveActionAllowed({ recordType: "Quote", retentionClass: "DURABLE", action: "ARCHIVE", reason: input.reason });
  const now = input.now ?? new Date().toISOString();
  const next: Quote = { ...target, archivedAt: now, archiveReason: input.reason.trim(), updatedAt: now };
  repository.replace(repository.list().map((quote) => quote.id === quoteId ? next : quote));
  return structuredClone(next);
}

export function archiveQuotes(repository: QuoteRepository, quoteIds: readonly string[], input: QuoteArchiveCommandInput): Quote[] {
  assertRuntimeCapability(CAPABILITIES.QUOTES_DELETE);
  const ids = new Set(quoteIds);
  const archived: Quote[] = [];
  const now = input.now ?? new Date().toISOString();
  const next = repository.list().map((quote) => {
    if (!ids.has(quote.id)) return quote;
    assertRuntimeCommandAccess(CAPABILITIES.QUOTES_DELETE, "quotes", quote);
    assertDestructiveActionAllowed({ recordType: "Quote", retentionClass: "DURABLE", action: "ARCHIVE", reason: input.reason });
    const value: Quote = { ...quote, archivedAt: now, archiveReason: input.reason.trim(), updatedAt: now };
    archived.push(value);
    return value;
  });
  repository.replace(next);
  return structuredClone(archived);
}
