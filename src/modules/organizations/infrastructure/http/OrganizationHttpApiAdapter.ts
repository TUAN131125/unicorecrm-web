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

export class OrganizationHttpApiAdapter implements OrganizationQueryPort {
  constructor(private readonly client: CommercialApiClient) {}

  async list(_query: ModuleListQuery = {}, signal?: AbortSignal): Promise<AuthoritativePage<OrganizationAccount>> {
    const response = await this.client.listOrganizations<OrganizationListResponse>({}, signal);
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
