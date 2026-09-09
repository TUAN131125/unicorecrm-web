import type { CommercialApiClient, ContactMutationResponse, CreateContactRequest } from "@/platform/api/generated/commercialApi";
import type { ContactCreateCommand, ContactCreateCommandPort } from "../../application/ports/ContactApiRuntime";
import type { Contact } from "../../domain/model/contact.types";
import { mapContactDocument } from "./ContactApiMapper";

export class ContactHttpCommandAdapter implements ContactCreateCommandPort {
  constructor(private readonly api: CommercialApiClient) {}

  async create(input: ContactCreateCommand): Promise<Contact> {
    const response = await this.api.createContact<ContactMutationResponse>(toRequest(input), options());
    return result(response);
  }

}

function toRequest(contact: ContactCreateCommand): CreateContactRequest {
  return compact({
    fullName: contact.fullName.trim(),
    ownerId: contact.ownerId?.trim() || undefined,
    jobTitle: contact.jobTitle?.trim() || undefined,
    department: contact.department?.trim() || undefined,
    workEmail: contact.workEmail?.trim() || undefined,
    mobilePhone: contact.mobilePhone?.trim() || undefined,
    zaloId: contact.zaloId?.trim() || undefined,
    preferredContactChannel: contact.preferredContactChannel,
    address: contact.address?.trim() || undefined,
    source: contact.source?.trim() || undefined,
    decisionRole: contact.decisionRole,
    notes: contact.notes?.trim() || undefined,
    tags: contact.tags?.map((tag) => tag.trim()).filter(Boolean),
  });
}

function result(response: ContactMutationResponse): Contact {
  if (!response.result?.contact || response.aggregateId !== response.result.contact.id) {
    throw new Error("CONTACT_MUTATION_CONTRACT_VIOLATION");
  }
  return mapContactDocument(response.result.contact);
}

function options() {
  return {
    idempotencyKey: `contact-${crypto.randomUUID()}`,
    retry: "idempotent" as const,
  };
}

function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}
