import type { AuthoritativePage, ModuleListQuery } from "@/shared/application";
import type { OrganizationAccount } from "../../domain/model/organizationAccount.types";

export type OrganizationApiRuntimeMode = "demo" | "connected" | "test";

export interface OrganizationPrimaryContactProjection {
  id: string;
  workspaceId: string;
  fullName: string;
  displayName?: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  department?: string;
  status: string;
  resourceVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationOverviewProjection {
  organization: OrganizationAccount;
  contactIds: string[];
  primaryContact?: OrganizationPrimaryContactProjection;
  metrics: {
    representativeCount: number;
    openDealsCount: number;
    completedOrdersCount: number;
    pipelineValue?: { amount: string; currency: string };
    orderValue?: { amount: string; currency: string };
  };
  linkedRecords: Array<{ moduleKey: string; recordId: string; label?: string }>;
  allowedActions: string[];
  projectionVersion: number;
  generatedAt: string;
}

export interface OrganizationQueryPort {
  list(query?: ModuleListQuery, signal?: AbortSignal): Promise<AuthoritativePage<OrganizationAccount>>;
  get(organizationId: string, signal?: AbortSignal): Promise<OrganizationAccount>;
  getOverview(organizationId: string, signal?: AbortSignal): Promise<OrganizationOverviewProjection>;
}

export interface OrganizationApiRuntime {
  mode: OrganizationApiRuntimeMode;
  queries: OrganizationQueryPort;
}
