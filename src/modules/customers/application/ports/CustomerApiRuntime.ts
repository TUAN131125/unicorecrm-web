import type { AuthoritativePage, ModuleListQuery } from "@/shared/application";
import type { RelationshipRef } from "@/platform/identity";
import type { Customer, CustomerServiceLevel, CustomerTier } from "../../domain/model/customer.types";

export interface CreateCustomerRequest {
  relationshipRef: RelationshipRef;
  segment?: string;
  tags?: string[];
  tier?: CustomerTier;
  serviceLevel?: CustomerServiceLevel;
}

export interface UpdateCustomerRequest {
  segment?: string;
  tags?: string[];
  tier?: CustomerTier;
  serviceLevel?: CustomerServiceLevel;
  status?: "ACTIVE" | "INACTIVE";
}

export type CustomerApiRuntimeMode = "demo" | "connected" | "test";

export interface Customer360Projection {
  customer: Customer;
  identity: {
    displayName: string;
    contactId?: string;
    organizationId?: string;
    primaryContactId?: string;
    email?: string;
    phone?: string;
  };
  metrics: {
    leadCount?: number;
    openDealCount?: number;
    quoteCount?: number;
    orderCount?: number;
    openTaskCount?: number;
    openSupportCount?: number;
    openInvoiceCount?: number;
    overdueReceivableCount?: number;
    activeReturnCount?: number;
    lifetimeRevenue?: { amount: string; currency: string };
    outstandingReceivables?: { amount: string; currency: string };
  };
  linkedRecords: Array<{ moduleKey: string; recordId: string; label?: string }>;
  stakeholderContacts: Array<{ relationshipId: string; contactId: string; displayName: string; role: string; effectiveFrom: string; effectiveTo?: string }>;
  allowedActions: string[];
  projectionVersion: number;
  generatedAt: string;
}

export interface CustomerQueryPort {
  list(query?: ModuleListQuery, signal?: AbortSignal): Promise<AuthoritativePage<Customer>>;
  get(customerId: string, signal?: AbortSignal): Promise<Customer>;
  get360(customerId: string, signal?: AbortSignal): Promise<Customer360Projection>;
}

export interface CustomerCommandOptions {
  idempotencyKey: string;
  expectedVersion?: number;
  signal?: AbortSignal;
}

export interface CustomerCommandPort {
  create(input: CreateCustomerRequest, options: CustomerCommandOptions): Promise<Customer>;
  update(customerId: string, input: UpdateCustomerRequest, options: CustomerCommandOptions): Promise<Customer>;
  archive(customerId: string, options: CustomerCommandOptions): Promise<Customer>;
}

export interface CustomerApiRuntime {
  mode: CustomerApiRuntimeMode;
  queries: CustomerQueryPort;
  commands: CustomerCommandPort;
}
