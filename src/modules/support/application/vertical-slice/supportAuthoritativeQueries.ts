import {
  createAuthoritativeResource,
  runBackendProjection,
  subscribeModuleQueryInvalidation,
  type AuthoritativePage,
  type AuthoritativeResource,
} from "@/shared/application";
import type { SupportCase } from "../../domain/model/supportCase.types";
import { getSupportApiRuntime, supportCaseRepository } from "../composition/supportApplicationServices";

const PAGE_SIZE = 250;
const MAX_PAGES = 20;
const collection = createCollectionResource();
const details = new Map<string, AuthoritativeResource<SupportCase>>();

export function getSupportCaseCollectionResource(): AuthoritativeResource<AuthoritativePage<SupportCase>> { return collection; }

export function getSupportCaseDetailResource(caseId: string): AuthoritativeResource<SupportCase> {
  let resource = details.get(caseId);
  if (!resource) {
    resource = createDetailResource(caseId);
    details.set(caseId, resource);
  }
  return resource;
}

function createCollectionResource(): AuthoritativeResource<AuthoritativePage<SupportCase>> {
  const resource = createAuthoritativeResource(async (signal) => {
    const page = await loadAllPages((cursor) => getSupportApiRuntime().queries.list({ limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) }, signal));
    runBackendProjection("support", () => supportCaseRepository.replace(page.items));
    return page;
  });
  subscribeModuleQueryInvalidation("support", async () => { if (resource.getSnapshot().state !== "IDLE") await resource.refresh(); });
  return resource;
}

function createDetailResource(caseId: string): AuthoritativeResource<SupportCase> {
  const resource = createAuthoritativeResource(async (signal) => {
    const item = await getSupportApiRuntime().queries.get(caseId, signal);
    runBackendProjection("support", () => {
      const current = supportCaseRepository.list();
      supportCaseRepository.replace(current.some((candidate) => candidate.id === item.id)
        ? current.map((candidate) => candidate.id === item.id ? item : candidate)
        : [...current, item]);
    });
    return item;
  });
  subscribeModuleQueryInvalidation("support", async () => { if (resource.getSnapshot().state !== "IDLE") await resource.refresh(); });
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
    if (!cursor) throw new Error("SUPPORT_AUTHORITATIVE_CURSOR_REQUIRED");
  }
  throw new Error("SUPPORT_AUTHORITATIVE_PAGE_LIMIT_EXCEEDED");
}
