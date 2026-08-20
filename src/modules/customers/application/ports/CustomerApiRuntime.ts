import type { AuthoritativePage, ModuleListQuery } from "@/shared/application";
import type { Customer } from "../../domain/model/customer.types";

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
    leadCount: number;
    openDealCount: number;
    quoteCount: number;
    orderCount: number;
    openTaskCount: number;
    openSupportCount: number;
    openInvoiceCount: number;
    overdueReceivableCount: number;
    activeReturnCount: number;
    lifetimeRevenue?: { amount: string; currency: string };
    outstandingReceivables?: { amount: string; currency: string };
  };
  linkedRecords: Array<{ moduleKey: string; recordId: string; label?: string }>;
  allowedActions: string[];
  projectionVersion: number;
  generatedAt: string;
}

export interface CustomerQueryPort {
  list(query?: ModuleListQuery, signal?: AbortSignal): Promise<AuthoritativePage<Customer>>;
  get(customerId: string, signal?: AbortSignal): Promise<Customer>;
  get360(customerId: string, signal?: AbortSignal): Promise<Customer360Projection>;
}

export interface CustomerApiRuntime {
  mode: CustomerApiRuntimeMode;
  queries: CustomerQueryPort;
}
