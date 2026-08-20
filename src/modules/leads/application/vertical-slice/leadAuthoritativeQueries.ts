import {
  createAuthoritativeResource,
  runBackendProjection,
  subscribeModuleQueryInvalidation,
  type AuthoritativePage,
  type AuthoritativeResource,
} from "@/shared/application";
import type { Lead } from "../../domain/model/lead.types";
import { getLeadApiRuntime } from "../composition/leadApplicationServices";
import { replaceLeads, saveLeadSnapshot } from "../../public/leads";

const COLLECTION_PAGE_SIZE = 250;
const COLLECTION_MAX_PAGES = 20;

const collection = createLeadCollectionResource();
const details = new Map<string, AuthoritativeResource<Lead>>();

export function getLeadCollectionResource(): AuthoritativeResource<AuthoritativePage<Lead>> {
  return collection;
}

export function getLeadDetailResource(leadId: string): AuthoritativeResource<Lead> {
  let resource = details.get(leadId);
  if (!resource) {
    resource = createLeadDetailResource(leadId);
    details.set(leadId, resource);
  }
  return resource;
}

function createLeadCollectionResource(): AuthoritativeResource<AuthoritativePage<Lead>> {
  const resource = createAuthoritativeResource(async (signal) => {
    const queryPort = getLeadApiRuntime().queries;
    const items: Lead[] = [];
    let cursor: string | undefined;
    let pageCount = 0;
    let totalCount: number | undefined;

    while (pageCount < COLLECTION_MAX_PAGES) {
      const page = await queryPort.list({
        limit: COLLECTION_PAGE_SIZE,
        ...(cursor === undefined ? {} : { cursor }),
      }, signal);
      items.push(...page.items);
      totalCount = page.pageInfo.totalCount ?? totalCount;
      pageCount += 1;

      if (!page.pageInfo.hasNextPage) {
        runBackendProjection("leads", () => replaceLeads(items));
        return {
          items,
          pageInfo: { hasNextPage: false, totalCount: totalCount ?? items.length },
          loadedAt: page.loadedAt || new Date().toISOString(),
          authority: page.authority,
        };
      }

      cursor = page.pageInfo.nextCursor;
      if (!cursor) throw new Error("LEADS_AUTHORITATIVE_CURSOR_REQUIRED");
    }

    throw new Error("LEADS_AUTHORITATIVE_PAGE_LIMIT_EXCEEDED");
  });
  subscribeModuleQueryInvalidation("leads", async () => {
    if (resource.getSnapshot().state !== "IDLE") await resource.refresh();
  });
  return resource;
}

function createLeadDetailResource(leadId: string): AuthoritativeResource<Lead> {
  const resource = createAuthoritativeResource(async (signal) => {
    const record = await getLeadApiRuntime().queries.get(leadId, signal);
    runBackendProjection("leads", () => saveLeadSnapshot(record));
    return record;
  });
  subscribeModuleQueryInvalidation("leads", async () => {
    if (resource.getSnapshot().state !== "IDLE") await resource.refresh();
  });
  return resource;
}
