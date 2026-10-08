import type { CommercialApiClient, LeadListResponse } from "@/platform/api/generated/commercialApi";
import { validateOpenApiResponse } from "@/platform/api/contracts/openApiRuntimeValidation";
import { ApiClientError } from "@/platform/api/errors";
import type { AuthoritativePage } from "@/shared/application";
import type { LeadKanbanColumn, LeadListQuery } from "../../application/ports/LeadApiRuntime";
import type { Lead } from "../../domain/model/lead.types";
import { mapLeadDocumentToApplication } from "./LeadApiMapper";

export class LeadHttpKanbanQueryAdapter {
  constructor(private readonly api: CommercialApiClient) {}

  async column(column: LeadKanbanColumn, query: LeadListQuery = {}, signal?: AbortSignal): Promise<AuthoritativePage<Lead>> {
    const allowed = new Set(["workState", "ownerId", "assignmentState"]);
    if (query.sortBy !== undefined || query.sortDirection !== undefined
      || Object.entries(query.filters ?? {}).some(([key, value]) => value !== undefined && !allowed.has(key))) {
      throw new ApiClientError({ code: "CONNECTED_QUERY_CONTRACT_VIOLATION", message: "Unsupported Lead Kanban query.", retryable: false });
    }
    const workState = query.filters?.workState;
    const ownerId = query.filters?.ownerId;
    const assignmentState = query.filters?.assignmentState;
    if ((workState !== undefined && workState !== "NEW" && workState !== "CONTACTING" && workState !== "VERIFYING" && workState !== "CLOSED")
      || (ownerId !== undefined && typeof ownerId !== "string")
      || (assignmentState !== undefined && assignmentState !== "ASSIGNED" && assignmentState !== "UNASSIGNED")) {
      throw new ApiClientError({ code: "CONNECTED_QUERY_CONTRACT_VIOLATION", message: "Invalid Lead Kanban filter.", retryable: false });
    }
    const payload = await this.api.listLeadKanbanColumn<unknown>(column, {
      ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
      limit: query.limit ?? 50,
      ...(query.search === undefined ? {} : { search: query.search }),
      ...(workState === undefined ? {} : { workState }),
      ...(ownerId === undefined ? {} : { ownerId }),
      ...(assignmentState === undefined ? {} : { assignmentState }),
    }, signal);
    if (!validateOpenApiResponse("listLeadKanbanColumn", payload, 200).valid) {
      throw new ApiClientError({ code: "CONNECTED_QUERY_CONTRACT_VIOLATION", message: "Invalid Lead Kanban response.", retryable: false });
    }
    const response = payload as LeadListResponse;
    const count = response.pageInfo.totalCount;
    if (!Number.isSafeInteger(count) || Number(count) < 0 || response.items.length > (query.limit ?? 50)
      || (response.pageInfo.hasNextPage && !response.pageInfo.nextCursor)) {
      throw new ApiClientError({ code: "CONNECTED_QUERY_CONTRACT_VIOLATION", message: "Invalid Lead Kanban window metadata.", retryable: false });
    }
    return { items: response.items.map(mapLeadDocumentToApplication), pageInfo: response.pageInfo,
      loadedAt: new Date().toISOString(), authority: "backend" };
  }
}
