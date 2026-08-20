import type { CommercialApiClient, LeadDocument, LeadList } from "@/platform/api/generated/commercialApi";
import { ApiClientError } from "@/platform/api/errors";
import type { AuthoritativePage } from "@/shared/application";
import type { LeadListQuery, LeadQueryPort } from "../../application/ports/LeadApiRuntime";
import type { Lead } from "../../domain/model/lead.types";
import { mapLeadDocumentToApplication } from "./LeadApiMapper";

const INTERNAL_PAGINATION_HINTS = new Set(["cursor", "limit"]);

export class LeadHttpQueryAdapter implements LeadQueryPort {
  constructor(private readonly api: CommercialApiClient) {}

  async list(query: LeadListQuery = {}, signal?: AbortSignal): Promise<AuthoritativePage<Lead>> {
    assertSupportedListQuery(query);
    const response = await this.api.listLeads<LeadList>({}, signal);
    if (!Array.isArray(response)) {
      throw queryViolation("listLeads", "Lead collection response must be an array.");
    }
    return {
      items: response.map((item) => mapLeadDocumentToApplication(item)),
      pageInfo: { hasNextPage: false, totalCount: response.length },
      loadedAt: new Date().toISOString(),
      authority: "backend",
    };
  }

  async get(leadId: string, signal?: AbortSignal): Promise<Lead> {
    const normalizedId = leadId.trim();
    if (!normalizedId) {
      throw queryViolation("getLead", "An authoritative Lead query requires a resource ID.");
    }
    const response = await this.api.getLead<LeadDocument>(normalizedId, {}, signal);
    return mapLeadDocumentToApplication(response);
  }
}

function assertSupportedListQuery(query: LeadListQuery): void {
  const requested: Record<string, unknown> = {
    cursor: query.cursor,
    limit: query.limit,
    search: query.search,
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
    ...(query.filters ?? {}),
  };
  const unsupported = Object.entries(requested)
    .filter(([, value]) => value !== undefined)
    .map(([key]) => key)
    .filter((key) => !INTERNAL_PAGINATION_HINTS.has(key));
  if (unsupported.length > 0) {
    throw queryViolation("listLeads", `Unsupported Lead list query parameters: ${unsupported.join(", ")}.`);
  }
}

function queryViolation(operationId: string, message: string): ApiClientError {
  return new ApiClientError({
    code: "CONNECTED_QUERY_CONTRACT_VIOLATION",
    message,
    retryable: false,
    details: { operationId, authority: "docs/api/openapi.json" },
  });
}
