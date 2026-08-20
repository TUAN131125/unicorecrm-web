import type { AuthoritativePage, ModuleListQuery } from "@/shared/application";
import type { Contact } from "../../domain/model/contact.types";

export type ContactApiRuntimeMode = "demo" | "connected" | "test";

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

export interface ContactApiRuntime {
  mode: ContactApiRuntimeMode;
  queries: ContactQueryPort;
}
