import type { CommercialApiClient, LeadDocument, LeadListResponse, LeadWorkState } from "@/platform/api/generated/commercialApi";
import { ApiClientError } from "@/platform/api/errors";
import type { AuthoritativePage } from "@/shared/application";
import type { LeadListQuery, LeadQueryPort } from "../../application/ports/LeadApiRuntime";
import type { Lead } from "../../domain/model/lead.types";
import { mapLeadDocumentToApplication } from "./LeadApiMapper";

const SUPPORTED_QUERY_KEYS = new Set(["cursor", "limit", "search", "workState", "ownerId"]);
const LEAD_WORK_STATES = new Set<LeadWorkState>(["NEW", "CONTACTING", "VERIFYING", "CLOSED"]);

export class LeadHttpQueryAdapter implements LeadQueryPort {
  constructor(private readonly api: CommercialApiClient) {}

  async list(query: LeadListQuery = {}, signal?: AbortSignal): Promise<AuthoritativePage<Lead>> {
    assertSupportedListQuery(query);
    const workState = query.filters?.workState;
    const ownerId = query.filters?.ownerId;
    if (workState !== undefined && (typeof workState !== "string" || !LEAD_WORK_STATES.has(workState as LeadWorkState))) {
      throw queryViolation("listLeads", "workState must be a supported Lead lifecycle state.");
    }
    if (ownerId !== undefined && typeof ownerId !== "string") {
      throw queryViolation("listLeads", "ownerId must be a string.");
    }
    const response = await this.api.listLeads<LeadListResponse>({
      cursor: query.cursor,
      limit: query.limit,
      search: query.search,
      workState: workState as LeadWorkState | undefined,
      ownerId,
    }, signal);
    if (!Array.isArray(response.items) || typeof response.pageInfo?.hasNextPage !== "boolean") {
      throw queryViolation("listLeads", "Lead collection response must include items and authoritative pageInfo.");
    }
    return {
      items: response.items.map((item) => mapLeadDocumentToApplication(item)),
      pageInfo: {
        hasNextPage: response.pageInfo.hasNextPage,
        ...(response.pageInfo.nextCursor === undefined ? {} : { nextCursor: response.pageInfo.nextCursor }),
        ...(response.pageInfo.totalCount === undefined ? {} : { totalCount: response.pageInfo.totalCount }),
      },
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
    .filter((key) => !SUPPORTED_QUERY_KEYS.has(key));
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
