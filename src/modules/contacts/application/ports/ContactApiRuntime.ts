import type { AuthoritativePage, ModuleListQuery } from "@/shared/application";
import type { Contact, ContactDecisionRole } from "../../domain/model/contact.types";

export type ContactApiRuntimeMode = "demo" | "connected" | "test";

export const CONTACT_CREATE_OPERATION = "createContact";
export const CONTACT_UPDATE_OPERATION = "updateContact";
export const CONTACT_ARCHIVE_OPERATION = "archiveContact";

export interface ContactRelationshipLinkedCounts {
  tasks: number;
  activities: number;
  deals: number;
  quotes: number;
  orders: number;
  invoices: number;
  payments: number;
  shipping: number;
  returns: number;
  supportCases: number;
}

export interface ContactRelationshipSummary {
  contact: Contact;
  organizationIds: string[];
  customerIds: string[];
  linkedRecords: Array<{ moduleKey: string; recordId: string; label?: string }>;
  linkedRecordCounts: ContactRelationshipLinkedCounts;
  allowedActions: string[];
  projectionVersion: number;
  generatedAt: string;
}

export interface ContactQueryPort {
  list(query?: ModuleListQuery, signal?: AbortSignal): Promise<AuthoritativePage<Contact>>;
  get(contactId: string, signal?: AbortSignal): Promise<Contact>;
  getRelationshipSummary(contactId: string, signal?: AbortSignal): Promise<ContactRelationshipSummary>;
}

export interface ContactCreateCommandPort {
  create(input: ContactCreateCommand): Promise<Contact>;
  update(input: ContactUpdateCommand): Promise<Contact>;
}

export interface ContactCreateCommand {
  fullName: string;
  ownerId?: string;
  jobTitle?: string;
  department?: string;
  workEmail?: string;
  mobilePhone?: string;
  zaloId?: string;
  preferredContactChannel?: "phone" | "email" | "zalo" | "facebook" | "sms";
  address?: string;
  source?: string;
  decisionRole?: ContactDecisionRole;
  notes?: string;
  tags?: string[];
}

export interface ContactUpdateCommand extends ContactCreateCommand {
  contactId: string;
  expectedVersion: number;
}

export interface ContactApiRuntime {
  mode: ContactApiRuntimeMode;
  queries: ContactQueryPort;
  commands?: ContactCreateCommandPort;
}
