import type { CommercialApiClient, ContactMutationResponse, CreateContactRequest } from "@/platform/api/generated/commercialApi";
import type { ContactCreateCommandPort } from "../../application/ports/ContactApiRuntime";
import type { Contact } from "../../domain/model/contact.types";
import { mapContactDocument } from "./ContactApiMapper";

export class ContactHttpCommandAdapter implements ContactCreateCommandPort {
  constructor(private readonly api: CommercialApiClient) {}

  async create(input: Contact): Promise<Contact> {
    const response = await this.api.createContact<ContactMutationResponse>(toRequest(input), options());
    return result(response);
  }

}

function toRequest(contact: Contact): CreateContactRequest {
  return compact({
    fullName: contact.fullName.trim(),
    ownerId: contact.ownerId?.trim() || undefined,
    salutation: contact.salutation?.trim() || undefined,
    jobTitle: (contact.roleTitle ?? contact.title)?.trim() || undefined,
    department: contact.department?.trim() || undefined,
    roleAtCompany: contact.roleAtCompany?.trim() || undefined,
    workEmail: (contact.workEmail ?? contact.email)?.trim() || undefined,
    personalEmail: contact.personalEmail?.trim() || undefined,
    mobilePhone: (contact.mobilePhone ?? contact.phone)?.trim() || undefined,
    workPhone: contact.workPhone?.trim() || undefined,
    otherPhone: contact.otherPhone?.trim() || undefined,
    zaloId: (contact.zaloId ?? contact.zalo)?.trim() || undefined,
    facebook: contact.facebook?.trim() || undefined,
    preferredContactChannel: contact.preferredContactChannel,
    address: contact.address?.trim() || undefined,
    source: contact.source?.trim() || undefined,
    decisionRole: contact.decisionRole,
    relationshipLevel: contact.relationshipLevel,
    painPoint: contact.painPoint?.trim() || undefined,
    needSummary: contact.needSummary?.trim() || undefined,
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
