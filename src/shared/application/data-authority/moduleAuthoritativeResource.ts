import { createAuthoritativeResource, type AuthoritativeResource } from "../authoritativeResource";
import { getModuleDataAuthority } from "./moduleDataAuthorityBinding";
import { runBackendProjection } from "./connectedProjectionScope";
import { subscribeModuleQueryInvalidation } from "./moduleQueryInvalidation";
import type {
  AuthoritativePage,
  ModuleDataAuthorityKey,
  ModuleListQuery,
} from "./moduleDataAuthority";

export interface ModuleCollectionResourceOptions<T> {
  query?: Omit<ModuleListQuery, "cursor" | "limit">;
  pageSize?: number;
  maxPages?: number;
  project(records: readonly T[]): void;
}

/**
 * Transitional collection loader for presentation surfaces that still filter and
 * paginate in the browser. It follows backend cursors until the collection is
 * complete, then projects the authoritative DTOs into the module read cache.
 * Server-driven list pagination can replace this without changing the module
 * command boundaries.
 */
export function createModuleCollectionResource<T>(
  key: ModuleDataAuthorityKey,
  options: ModuleCollectionResourceOptions<T>,
): AuthoritativeResource<AuthoritativePage<T>> {
  const pageSize = options.pageSize ?? 250;
  const maxPages = options.maxPages ?? 20;

  const resource = createAuthoritativeResource(async (signal) => {
    const authority = getModuleDataAuthority(key);
    const items: T[] = [];
    let cursor: string | undefined;
    let pageCount = 0;
    let totalCount: number | undefined;

    while (pageCount < maxPages) {
      const page = await authority.queries.list<T>({
        ...options.query,
        limit: pageSize,
        ...(cursor === undefined ? {} : { cursor }),
      }, signal);
      items.push(...page.items);
      totalCount = page.pageInfo.totalCount ?? totalCount;
      pageCount += 1;

      if (!page.pageInfo.hasNextPage) {
        runBackendProjection(key, () => options.project(items));
        return {
          items,
          pageInfo: {
            hasNextPage: false,
            totalCount: totalCount ?? items.length,
          },
          loadedAt: new Date().toISOString(),
          authority: authority.source,
        };
      }

      cursor = page.pageInfo.nextCursor;
      if (!cursor) {
        throw new Error(`${key.toUpperCase()}_AUTHORITATIVE_CURSOR_REQUIRED`);
      }
    }

    throw new Error(`${key.toUpperCase()}_AUTHORITATIVE_PAGE_LIMIT_EXCEEDED`);
  });
  subscribeModuleQueryInvalidation(key, async () => {
    if (resource.getSnapshot().state !== "IDLE") await resource.refresh();
  });
  return resource;
}

export function createModuleDetailResource<T>(
  key: ModuleDataAuthorityKey,
  id: string,
  project: (record: T) => void,
): AuthoritativeResource<T> {
  const resource = createAuthoritativeResource(async (signal) => {
    const record = await getModuleDataAuthority(key).queries.get<T>(id, signal);
    runBackendProjection(key, () => project(record));
    return record;
  });
  subscribeModuleQueryInvalidation(key, async () => {
    if (resource.getSnapshot().state !== "IDLE") await resource.refresh();
  });
  return resource;
}
