import {
  createAuthoritativeResource,
  runBackendProjection,
  subscribeModuleQueryInvalidation,
  type AuthoritativePage,
  type AuthoritativeResource,
} from "@/shared/application";
import type { ShippingBooking } from "../../domain/model/shipping.types";
import {
  getShippingApiRuntime,
  getShippingApplicationServices,
  shippingRepository,
} from "../composition/shippingApplicationServices";

const PAGE_SIZE = 250;
const MAX_PAGES = 20;
const collection = createCollectionResource();
const details = new Map<string, AuthoritativeResource<ShippingBooking>>();

export function getShippingBookingCollectionResource(): AuthoritativeResource<AuthoritativePage<ShippingBooking>> {
  return collection;
}

export function getShippingBookingDetailResource(id: string): AuthoritativeResource<ShippingBooking> {
  let resource = details.get(id);
  if (!resource) {
    resource = createDetailResource(id);
    details.set(id, resource);
  }
  return resource;
}

function createCollectionResource(): AuthoritativeResource<AuthoritativePage<ShippingBooking>> {
  const resource = createAuthoritativeResource(async (signal) => {
    const api = getShippingApiRuntime();
    const [page, providers, pickup, returns] = await Promise.all([
      loadAllPages((cursor) => api.queries.list({ limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) }, signal)),
      api.queries.listProviders(signal),
      api.queries.listPickupLocations(signal),
      api.queries.listReturnLocations(signal),
    ]);
    runBackendProjection("shipping", () => {
      shippingRepository.replace(page.items);
      const services = getShippingApplicationServices();
      services.providers.replace?.(providers);
      services.configuration.replaceLocations?.(pickup, returns);
    });
    return page;
  });
  subscribeModuleQueryInvalidation("shipping", async () => {
    if (resource.getSnapshot().state !== "IDLE") await resource.refresh();
  });
  return resource;
}

function createDetailResource(id: string): AuthoritativeResource<ShippingBooking> {
  const resource = createAuthoritativeResource(async (signal) => {
    const item = await getShippingApiRuntime().queries.get(id, signal);
    runBackendProjection("shipping", () => {
      const current = shippingRepository.list();
      shippingRepository.replace(current.some((candidate) => candidate.id === item.id)
        ? current.map((candidate) => candidate.id === item.id ? item : candidate)
        : [...current, item]);
    });
    return item;
  });
  subscribeModuleQueryInvalidation("shipping", async () => {
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
    if (!cursor) throw new Error("SHIPPING_AUTHORITATIVE_CURSOR_REQUIRED");
  }
  throw new Error("SHIPPING_AUTHORITATIVE_PAGE_LIMIT_EXCEEDED");
}
