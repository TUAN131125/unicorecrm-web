import {
  createAuthoritativeResource,
  runBackendProjection,
  subscribeModuleQueryInvalidation,
  type AuthoritativePage,
  type AuthoritativeResource,
} from "@/shared/application";
import { getQuoteApiRuntime, quoteRepository } from "../composition/quoteApplicationServices";
import type { Quote } from "../../domain/model/quote.types";

const PAGE_SIZE = 250;
const MAX_PAGES = 20;
const collection = createCollectionResource();
const details = new Map<string, AuthoritativeResource<Quote>>();

export function getQuoteCollectionResource(): AuthoritativeResource<AuthoritativePage<Quote>> { return collection; }

export function getQuoteDetailResource(quoteId: string): AuthoritativeResource<Quote> {
  let resource = details.get(quoteId);
  if (!resource) {
    resource = createDetailResource(quoteId);
    details.set(quoteId, resource);
  }
  return resource;
}

function createCollectionResource(): AuthoritativeResource<AuthoritativePage<Quote>> {
  const resource = createAuthoritativeResource(async (signal) => {
    const page = await loadAllPages((cursor) => getQuoteApiRuntime().queries.list({ limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) }, signal));
    runBackendProjection("quotes", () => quoteRepository.replace(page.items));
    return page;
  });
  subscribeModuleQueryInvalidation("quotes", async () => { if (resource.getSnapshot().state !== "IDLE") await resource.refresh(); });
  return resource;
}

function createDetailResource(quoteId: string): AuthoritativeResource<Quote> {
  const resource = createAuthoritativeResource(async (signal) => {
    const quote = await getQuoteApiRuntime().queries.get(quoteId, signal);
    runBackendProjection("quotes", () => upsertQuote(quote));
    return quote;
  });
  subscribeModuleQueryInvalidation("quotes", async () => { if (resource.getSnapshot().state !== "IDLE") await resource.refresh(); });
  return resource;
}

function upsertQuote(quote: Quote): void {
  const current = quoteRepository.list();
  quoteRepository.replace(current.some((item) => item.id === quote.id)
    ? current.map((item) => item.id === quote.id ? quote : item)
    : [quote, ...current]);
}

async function loadAllPages<T>(load: (cursor?: string) => Promise<AuthoritativePage<T>>): Promise<AuthoritativePage<T>> {
  const items: T[] = [];
  let cursor: string | undefined;
  let totalCount: number | undefined;
  let authority: AuthoritativePage<T>["authority"] = "backend";
  let loadedAt = new Date().toISOString();
  for (let index = 0; index < MAX_PAGES; index += 1) {
    const page = await load(cursor);
    items.push(...page.items);
    totalCount = page.pageInfo.totalCount ?? totalCount;
    authority = page.authority;
    loadedAt = page.loadedAt;
    if (!page.pageInfo.hasNextPage) return { items, pageInfo: { hasNextPage: false, totalCount: totalCount ?? items.length }, loadedAt, authority };
    cursor = page.pageInfo.nextCursor;
    if (!cursor) throw new Error("QUOTE_AUTHORITATIVE_CURSOR_REQUIRED");
  }
  throw new Error("QUOTE_AUTHORITATIVE_PAGE_LIMIT_EXCEEDED");
}
