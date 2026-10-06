import type { ArchiveContactRequest, CommercialApiClient, ContactMutationResponse, CreateContactCustomerRelationshipRequest, CreateContactOrganizationRelationshipRequest, CreateContactRequest, EndContactRelationshipRequest, UpdateContactCustomerRelationshipRequest, UpdateContactOrganizationRelationshipRequest, UpdateContactRequest } from "@/platform/api/generated/commercialApi";
import type { ContactArchiveCommand, ContactCommandOptions, ContactCommandPort, ContactCreateCommand, ContactUpdateCommand, CreateContactCustomerRelationshipCommand, CreateContactOrganizationRelationshipCommand, EndContactCustomerRelationshipCommand, EndContactOrganizationRelationshipCommand, UpdateContactCustomerRelationshipCommand, UpdateContactOrganizationRelationshipCommand } from "../../application/ports/ContactApiRuntime";
import type { Contact } from "../../domain/model/contact.types";
import { mapContactDocument } from "./ContactApiMapper";

export class ContactHttpCommandAdapter implements ContactCommandPort {
  constructor(private readonly api: CommercialApiClient) {}

  async create(input: ContactCreateCommand, metadata?: ContactCommandOptions): Promise<Contact> {
    const response = await this.api.createContact<ContactMutationResponse>(toRequest(input), options(undefined, metadata));
    return result(response);
  }

  async update(input: ContactUpdateCommand, metadata?: ContactCommandOptions): Promise<Contact> {
    const response = await this.api.updateContact<ContactMutationResponse>(input.contactId, toPatchRequest(input), options(input.expectedVersion, metadata));
    return result(response);
  }

  async archive(input: ContactArchiveCommand): Promise<Contact> {
    const response = await this.api.archiveContact<ContactMutationResponse>(input.contactId, {} satisfies ArchiveContactRequest, options(input.expectedVersion));
    return result(response);
  }

  async createOrganizationRelationship(input: CreateContactOrganizationRelationshipCommand, metadata?: ContactCommandOptions): Promise<Contact> {
    const body = compact({ organizationId: input.organizationId, role: input.role, isPrimaryAffiliation: input.isPrimaryAffiliation, effectiveFrom: input.effectiveFrom }) satisfies CreateContactOrganizationRelationshipRequest;
    return result(await this.api.createContactOrganizationRelationship<ContactMutationResponse>(input.contactId, body, options(input.expectedVersion, metadata)));
  }

  async updateOrganizationRelationship(input: UpdateContactOrganizationRelationshipCommand, metadata?: ContactCommandOptions): Promise<Contact> {
    const body = compact({ role: input.role, isPrimaryAffiliation: input.isPrimaryAffiliation }) satisfies UpdateContactOrganizationRelationshipRequest;
    return result(await this.api.updateContactOrganizationRelationship<ContactMutationResponse>(input.contactId, input.relationshipId, body, options(input.expectedVersion, metadata)));
  }

  async endOrganizationRelationship(input: EndContactOrganizationRelationshipCommand, metadata?: ContactCommandOptions): Promise<Contact> {
    const body = compact({ endedReason: input.endedReason, effectiveTo: input.effectiveTo }) satisfies EndContactRelationshipRequest;
    return result(await this.api.endContactOrganizationRelationship<ContactMutationResponse>(input.contactId, input.relationshipId, body, options(input.expectedVersion, metadata)));
  }

  async createCustomerRelationship(input: CreateContactCustomerRelationshipCommand, metadata?: ContactCommandOptions): Promise<Contact> {
    const body = compact({ customerId: input.customerId, role: input.role, effectiveFrom: input.effectiveFrom }) satisfies CreateContactCustomerRelationshipRequest;
    return result(await this.api.createContactCustomerRelationship<ContactMutationResponse>(input.contactId, body, options(input.expectedVersion, metadata)));
  }

  async updateCustomerRelationship(input: UpdateContactCustomerRelationshipCommand, metadata?: ContactCommandOptions): Promise<Contact> {
    const body = { role: input.role } satisfies UpdateContactCustomerRelationshipRequest;
    return result(await this.api.updateContactCustomerRelationship<ContactMutationResponse>(input.contactId, input.relationshipId, body, options(input.expectedVersion, metadata)));
  }

  async endCustomerRelationship(input: EndContactCustomerRelationshipCommand, metadata?: ContactCommandOptions): Promise<Contact> {
    const body = compact({ endedReason: input.endedReason, effectiveTo: input.effectiveTo }) satisfies EndContactRelationshipRequest;
    return result(await this.api.endContactCustomerRelationship<ContactMutationResponse>(input.contactId, input.relationshipId, body, options(input.expectedVersion, metadata)));
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

function toPatchRequest(input: ContactUpdateCommand): UpdateContactRequest {
  const { contactId: _contactId, expectedVersion: _expectedVersion, ...fields } = input;
  return compact(fields);
}

function result(response: ContactMutationResponse): Contact {
  if (!response.result?.contact || response.aggregateId !== response.result.contact.id) {
    throw new Error("CONTACT_MUTATION_CONTRACT_VIOLATION");
  }
  return mapContactDocument(response.result.contact);
}

function options(expectedVersion?: number, metadata?: ContactCommandOptions) {
  return {
    idempotencyKey: metadata?.idempotencyKey ?? `contact-${crypto.randomUUID()}`,
    retry: "idempotent" as const,
    ...(expectedVersion === undefined ? {} : { expectedVersion }),
  };
}

function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}
