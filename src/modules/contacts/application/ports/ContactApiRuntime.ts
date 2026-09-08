import type { AuthoritativePage, ModuleListQuery } from "@/shared/application";
import type { Contact } from "../../domain/model/contact.types";

export type ContactApiRuntimeMode = "demo" | "connected" | "test";

export const CONTACT_CREATE_OPERATION = "contact.create";
export const CONTACT_UPDATE_OPERATION = "contact.update";

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

export interface ContactCommandPort {
  create(input: Contact): Promise<Contact>;
  update(contactId: string, input: Contact, expectedVersion: number): Promise<Contact>;
  archive(contactId: string, expectedVersion: number): Promise<Contact>;
}

export interface ContactApiRuntime {
  mode: ContactApiRuntimeMode;
  queries: ContactQueryPort;
  commands?: ContactCommandPort;
}
