import {
  createAuthoritativeResource,
  runBackendProjection,
  subscribeModuleQueryInvalidation,
  type AuthoritativePage,
  type AuthoritativeResource,
} from "@/shared/application";
import type { DealForecastSummary } from "../ports/DealApiRuntime";
import { dealRepository, getDealApiRuntime } from "../composition/dealApplicationServices";
import type { Deal } from "../../domain/model/deal.types";

const PAGE_SIZE = 250;
const MAX_PAGES = 20;
const collection = createCollectionResource();
const pipelineCollections = new Map<string, AuthoritativeResource<AuthoritativePage<Deal>>>();
const details = new Map<string, AuthoritativeResource<Deal>>();
const forecastSummary = createForecastSummaryResource();

export function getDealCollectionResource(pipelineId?: string): AuthoritativeResource<AuthoritativePage<Deal>> {
  if (!pipelineId) return collection;
  let resource = pipelineCollections.get(pipelineId);
  if (!resource) { resource = createCollectionResource(pipelineId); pipelineCollections.set(pipelineId, resource); }
  return resource;
}

export function getDealDetailResource(dealId: string): AuthoritativeResource<Deal> {
  let resource = details.get(dealId);
  if (!resource) {
    resource = createDetailResource(dealId);
    details.set(dealId, resource);
  }
  return resource;
}

export function getDealForecastSummaryResource(): AuthoritativeResource<DealForecastSummary> { return forecastSummary; }

function createCollectionResource(pipelineId?: string): AuthoritativeResource<AuthoritativePage<Deal>> {
  const resource = createAuthoritativeResource(async (signal) => {
    const page = await loadAllPages((cursor) => getDealApiRuntime().queries.list({ limit: PAGE_SIZE, filters: { pipelineId }, ...(cursor ? { cursor } : {}) }, signal));
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    runBackendProjection("deals", () => dealRepository.replace(page.items));
    return page;
  });
  subscribeModuleQueryInvalidation("deals", async () => { if (resource.getSnapshot().state !== "IDLE") await resource.refresh(); });
  return resource;
}

function createDetailResource(dealId: string): AuthoritativeResource<Deal> {
  const resource = createAuthoritativeResource(async (signal) => {
    const deal = await getDealApiRuntime().queries.get(dealId, signal);
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    runBackendProjection("deals", () => upsertDeal(deal));
    return deal;
  });
  subscribeModuleQueryInvalidation("deals", async () => { if (resource.getSnapshot().state !== "IDLE") await resource.refresh(); });
  return resource;
}

function createForecastSummaryResource(): AuthoritativeResource<DealForecastSummary> {
  const resource = createAuthoritativeResource((signal) => getDealApiRuntime().queries.getForecastSummary({}, signal));
  subscribeModuleQueryInvalidation("deals", async () => { if (resource.getSnapshot().state !== "IDLE") await resource.refresh(); });
  return resource;
}

function upsertDeal(deal: Deal): void {
  const current = dealRepository.list();
  dealRepository.replace(current.some((item) => item.id === deal.id)
    ? current.map((item) => item.id === deal.id ? deal : item)
    : [deal, ...current]);
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
    if (!cursor) throw new Error("DEAL_AUTHORITATIVE_CURSOR_REQUIRED");
  }
  throw new Error("DEAL_AUTHORITATIVE_PAGE_LIMIT_EXCEEDED");
}
