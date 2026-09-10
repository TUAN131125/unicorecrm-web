import type { ArchiveOrganizationRequest, ArchiveOrganizationResponse, CommercialApiClient, CreateOrganizationRequest, CreateOrganizationResponse, UpdateOrganizationRequest, UpdateOrganizationResponse } from "@/platform/api/generated/commercialApi";
import type { OrganizationArchiveCommand, OrganizationCommandPort, OrganizationCreateCommand, OrganizationUpdateCommand } from "../../application/ports/OrganizationApiRuntime";
import type { OrganizationAccount, OrganizationRelationshipLevel } from "../../domain/model/organizationAccount.types";
import { mapOrganizationDocument } from "./OrganizationApiMapper";

export class OrganizationHttpCommandAdapter implements OrganizationCommandPort {
  constructor(private readonly api: CommercialApiClient) {}
  async create(input: OrganizationCreateCommand): Promise<OrganizationAccount> {
    return result(await this.api.createOrganization<CreateOrganizationResponse>(toRequest(input), options()));
  }
  async update(input: OrganizationUpdateCommand): Promise<OrganizationAccount> {
    return result(await this.api.updateOrganization<UpdateOrganizationResponse>(input.organizationId, toUpdateRequest(input), options(input.expectedVersion)));
  }
  async archive(input: OrganizationArchiveCommand): Promise<OrganizationAccount> {
    return result(await this.api.archiveOrganization<ArchiveOrganizationResponse, ArchiveOrganizationRequest>(input.organizationId, {}, options(input.expectedVersion)));
  }
}

function toRequest(input: OrganizationCreateCommand): CreateOrganizationRequest {
  return compact({ ...input, relationshipLevel: toApiLevel(input.relationshipLevel) });
}
function toUpdateRequest(input: OrganizationUpdateCommand): UpdateOrganizationRequest {
  return compact({ ...input, organizationId: undefined, expectedVersion: undefined, relationshipLevel: toApiLevel(input.relationshipLevel) });
}
function toApiLevel(value?: OrganizationRelationshipLevel): CreateOrganizationRequest["relationshipLevel"] {
  return value === "new" ? "cold" : value === "developing" ? "good" : value === "strategic" ? "vip" : value;
}
function result(response: CreateOrganizationResponse | UpdateOrganizationResponse | ArchiveOrganizationResponse): OrganizationAccount {
  if (!response.result || response.aggregateId !== response.result.id) throw new Error("ORGANIZATION_MUTATION_CONTRACT_VIOLATION");
  return mapOrganizationDocument(response.result);
}
function options(expectedVersion?: number) { return { idempotencyKey: `organization-${crypto.randomUUID()}`, retry: "idempotent" as const, ...(expectedVersion === undefined ? {} : { expectedVersion }) }; }
function compact<T extends Record<string, unknown>>(value: T): T { return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== "")) as T; }
