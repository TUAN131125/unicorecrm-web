import type { ArchiveContactRequest, CommercialApiClient, ContactMutationResponse, CreateContactRequest, UpdateContactRequest } from "@/platform/api/generated/commercialApi";
import type { ContactArchiveCommand, ContactCommandPort, ContactCreateCommand, ContactUpdateCommand } from "../../application/ports/ContactApiRuntime";
import type { Contact } from "../../domain/model/contact.types";
import { mapContactDocument } from "./ContactApiMapper";

export class ContactHttpCommandAdapter implements ContactCommandPort {
  constructor(private readonly api: CommercialApiClient) {}

  async create(input: ContactCreateCommand): Promise<Contact> {
    const response = await this.api.createContact<ContactMutationResponse>(toRequest(input), options());
    return result(response);
  }

  async update(input: ContactUpdateCommand): Promise<Contact> {
    const response = await this.api.updateContact<ContactMutationResponse>(input.contactId, toRequest(input) satisfies UpdateContactRequest, options(input.expectedVersion));
    return result(response);
  }

  async archive(input: ContactArchiveCommand): Promise<Contact> {
    const response = await this.api.archiveContact<ContactMutationResponse>(input.contactId, {} satisfies ArchiveContactRequest, options(input.expectedVersion));
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

function options(expectedVersion?: number) {
  return {
    idempotencyKey: `contact-${crypto.randomUUID()}`,
    retry: "idempotent" as const,
    ...(expectedVersion === undefined ? {} : { expectedVersion }),
  };
}

function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}
