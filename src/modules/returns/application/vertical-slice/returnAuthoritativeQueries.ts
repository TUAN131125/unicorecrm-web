import {
  createAuthoritativeResource,
  runBackendProjection,
  subscribeModuleQueryInvalidation,
  type AuthoritativePage,
  type AuthoritativeResource,
} from "@/shared/application";
import type { ReturnRequest } from "../../domain/model/return.types";
import { getReturnApiRuntime, returnRepository } from "../composition/returnApplicationServices";

const PAGE_SIZE = 250;
const MAX_PAGES = 20;
const collection = createCollectionResource();
const details = new Map<string, AuthoritativeResource<ReturnRequest>>();

export function getReturnCollectionResource(): AuthoritativeResource<AuthoritativePage<ReturnRequest>> {
  return collection;
}

export function getReturnDetailResource(id: string): AuthoritativeResource<ReturnRequest> {
  let resource = details.get(id);
  if (!resource) {
    resource = createDetailResource(id);
    details.set(id, resource);
  }
  return resource;
}

function createCollectionResource(): AuthoritativeResource<AuthoritativePage<ReturnRequest>> {
  const resource = createAuthoritativeResource(async (signal) => {
    const page = await loadAllPages((cursor) => getReturnApiRuntime().queries.list({ limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) }, signal));
    runBackendProjection("returns", () => {
      const current = returnRepository.snapshot();
      returnRepository.replace({ requests: page.items, intents: current.intents });
    });
    return page;
  });
  subscribeModuleQueryInvalidation("returns", async () => {
    if (resource.getSnapshot().state !== "IDLE") await resource.refresh();
  });
  return resource;
}

function createDetailResource(id: string): AuthoritativeResource<ReturnRequest> {
  const resource = createAuthoritativeResource(async (signal) => {
    const item = await getReturnApiRuntime().queries.get(id, signal);
    runBackendProjection("returns", () => {
      const current = returnRepository.snapshot();
      const requests = current.requests.some((candidate) => candidate.id === item.id)
        ? current.requests.map((candidate) => candidate.id === item.id ? item : candidate)
        : [...current.requests, item];
      returnRepository.replace({ requests, intents: current.intents });
    });
    return item;
  });
  subscribeModuleQueryInvalidation("returns", async () => {
    if (resource.getSnapshot().state !== "IDLE") await resource.refresh();
  });
  return resource;
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
    if (!cursor) throw new Error("RETURN_AUTHORITATIVE_CURSOR_REQUIRED");
  }
  throw new Error("RETURN_AUTHORITATIVE_PAGE_LIMIT_EXCEEDED");
}
