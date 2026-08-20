import type {
  CommercialApiClient,
  ContactDocument,
  ContactList,
  ContactRelationshipSummaryReadModel,
} from "@/platform/api/generated/commercialApi";
import type { AuthoritativePage, ModuleListQuery } from "@/shared/application";
import type {
  ContactQueryPort,
  ContactRelationshipSummary,
} from "../../application/ports/ContactApiRuntime";
import type { Contact } from "../../domain/model/contact.types";
import { mapContactDocument, mapContactRelationshipSummary } from "./ContactApiMapper";

export class ContactHttpApiAdapter implements ContactQueryPort {
  constructor(private readonly client: CommercialApiClient) {}

  async list(_query: ModuleListQuery = {}, signal?: AbortSignal): Promise<AuthoritativePage<Contact>> {
    const response = await this.client.listContacts<ContactList>({}, signal);
    const items = response.map(mapContactDocument);
    return {
      items,
      pageInfo: { hasNextPage: false, totalCount: items.length },
      authority: "backend",
      loadedAt: new Date().toISOString(),
    };
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
