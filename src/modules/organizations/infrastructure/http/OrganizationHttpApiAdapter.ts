import type {
  CommercialApiClient,
  OrganizationDocument,
  OrganizationListResponse,
  OrganizationOverviewReadModel,
} from "@/platform/api/generated/commercialApi";
import type { AuthoritativePage, ModuleListQuery } from "@/shared/application";
import type {
  OrganizationOverviewProjection,
  OrganizationQueryPort,
} from "../../application/ports/OrganizationApiRuntime";
import type { OrganizationAccount } from "../../domain/model/organizationAccount.types";
import { mapOrganizationDocument, mapOrganizationOverviewReadModel } from "./OrganizationApiMapper";

const SUPPORTED_QUERY_KEYS = new Set(["cursor", "limit", "search", "status", "industry", "sizeBand", "ownerId"]);
const STATUSES = new Set<string>(["prospect", "active", "strategic", "inactive", "archived"]);

export class OrganizationHttpApiAdapter implements OrganizationQueryPort {
  constructor(private readonly client: CommercialApiClient) {}

  async list(query: ModuleListQuery = {}, signal?: AbortSignal): Promise<AuthoritativePage<OrganizationAccount>> {
    assertSupportedListQuery(query);
    const status = stringFilter(query, "status");
    if (status !== undefined && !STATUSES.has(status)) throw new Error("ORGANIZATION_QUERY_STATUS_INVALID");
    const response = await this.client.listOrganizations<OrganizationListResponse>({
      cursor: query.cursor,
      limit: query.limit,
      q: query.search,
      status: status as "prospect" | "active" | "strategic" | "inactive" | "archived" | undefined,
      industry: stringFilter(query, "industry"),
      sizeBand: stringFilter(query, "sizeBand"),
      ownerId: stringFilter(query, "ownerId"),
    }, signal);
    const items = response.items.map(mapOrganizationDocument);
    return {
      items,
      pageInfo: { ...response.pageInfo },
      authority: "backend",
      loadedAt: new Date().toISOString(),
    };
  }

  async get(organizationId: string, signal?: AbortSignal): Promise<OrganizationAccount> {
    const response = await this.client.getOrganization<OrganizationDocument>(organizationId, {}, signal);
    return mapOrganizationDocument(response);
  }

  async getOverview(organizationId: string, signal?: AbortSignal): Promise<OrganizationOverviewProjection> {
    const response = await this.client.getOrganizationOverview<OrganizationOverviewReadModel>(organizationId, {}, signal);
    return mapOrganizationOverviewReadModel(response);
  }
}

function stringFilter(query: ModuleListQuery, key: string): string | undefined {
  const value = query.filters?.[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new Error(`ORGANIZATION_QUERY_${key.toUpperCase()}_INVALID`);
  return value;
}

function assertSupportedListQuery(query: ModuleListQuery): void {
  const requested: Record<string, unknown> = {
    cursor: query.cursor, limit: query.limit, search: query.search,
    sortBy: query.sortBy, sortDirection: query.sortDirection, ...(query.filters ?? {}),
  };
  const unsupported = Object.entries(requested).filter(([, value]) => value !== undefined)
    .map(([key]) => key).filter((key) => !SUPPORTED_QUERY_KEYS.has(key));
  if (unsupported.length > 0) throw new Error(`ORGANIZATION_QUERY_UNSUPPORTED:${unsupported.join(",")}`);
}
