import type {
  CommercialApiClient,
  ContactDocument,
  ContactList,
  ContactListSummary as ContactListSummaryDto,
  ListContactsQuery,
  ContactRelationshipSummaryReadModel,
} from "@/platform/api/generated/commercialApi";
import type { AuthoritativePage, ModuleListQuery } from "@/shared/application";
import type {
  ContactQueryPort,
  ContactRelationshipSummary,
  ContactListSummary,
} from "../../application/ports/ContactApiRuntime";
import type { Contact } from "../../domain/model/contact.types";
import { ApiClientError } from "@/platform/api/errors";
import { mapContactDocument, mapContactRelationshipSummary } from "./ContactApiMapper";

export class ContactHttpApiAdapter implements ContactQueryPort {
  constructor(private readonly client: CommercialApiClient) {}

  async list(query: ModuleListQuery = {}, signal?: AbortSignal): Promise<AuthoritativePage<Contact>> {
    const response = await this.client.listContacts<ContactList>(contactQuery(query), signal);
    if (!Array.isArray(response.items) || typeof response.pageInfo?.hasNextPage !== "boolean"
      || !Number.isSafeInteger(response.pageInfo.totalCount) || response.pageInfo.totalCount < 0
      || response.items.length > (query.limit ?? 25)
      || (response.pageInfo.hasNextPage && !response.pageInfo.nextCursor)) {
      throw queryViolation("Contact response requires bounded items and authoritative pageInfo.");
    }
    return {
      items: response.items.map(mapContactDocument),
      pageInfo: {
        hasNextPage: response.pageInfo.hasNextPage,
        nextCursor: response.pageInfo.nextCursor ?? undefined,
        totalCount: response.pageInfo.totalCount,
      },
      authority: "backend",
      loadedAt: new Date().toISOString(),
    };
  }

  async summary(query: ModuleListQuery = {}, signal?: AbortSignal): Promise<ContactListSummary> {
    const { cursor: _cursor, limit: _limit, ...filters } = contactQuery(query);
    const response = await this.client.getContactListSummary<ContactListSummaryDto>(filters, signal);
    if (!Number.isSafeInteger(response.totalCount) || response.totalCount < 0 || !response.statusCounts ||
      Object.values(response.statusCounts).some((count) => !Number.isSafeInteger(count) || count < 0)) {
      throw queryViolation("Contact summary requires authorized non-negative totals.");
    }
    return { totalCount: response.totalCount, statusCounts: { ...response.statusCounts } };
  }

  async get(contactId: string, signal?: AbortSignal): Promise<Contact> {
    const response = await this.client.getContact<ContactDocument>(contactId, {}, signal);
    return mapContactDocument(response);
  }

  async getRelationshipSummary(contactId: string, signal?: AbortSignal): Promise<ContactRelationshipSummary> {
    const response = await this.client.getContactRelationshipSummary<ContactRelationshipSummaryReadModel>(contactId, {}, signal);
    return mapContactRelationshipSummary(response);
  }
}

const FILTER_KEYS = new Set(["status", "ownerId", "ownerScope", "source", "relationshipLevel", "decisionRole", "doNotContact", "link", "nextFollowUpDate", "followUp"]);

function contactQuery(query: ModuleListQuery): ListContactsQuery {
  const filters = query.filters ?? {};
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined) continue;
    if (!FILTER_KEYS.has(key) || (key === "doNotContact" ? typeof value !== "boolean" : typeof value !== "string")) {
      throw queryViolation(`Unsupported Contact filter: ${key}.`);
    }
  }
  const sort = query.sortBy;
  if (sort !== undefined && !["recentlyUpdated", "nameAsc", "nextFollowUp"].includes(sort)) throw queryViolation(`Unavailable Contact sort: ${sort}.`);
  const expectedDirection = sort === "nameAsc" || sort === "nextFollowUp" ? "asc" : "desc";
  if (query.sortDirection !== undefined && query.sortDirection !== expectedDirection) throw queryViolation("Contact sort direction must match the canonical sort.");
  return { ...filters, cursor: query.cursor, limit: query.limit, search: query.search, sort } as ListContactsQuery;
}

function queryViolation(message: string): ApiClientError {
  return new ApiClientError({ code: "CONNECTED_QUERY_CONTRACT_VIOLATION", message, retryable: false,
    details: { operationId: "listContacts", authority: "docs/api/openapi.json" } });
}
