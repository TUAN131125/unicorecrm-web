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
    openDealsCount?: number;
    completedOrdersCount?: number;
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

export interface OrganizationCommandPort {
  create(input: OrganizationCreateCommand): Promise<OrganizationAccount>;
  update(input: OrganizationUpdateCommand): Promise<OrganizationAccount>;
  archive(input: OrganizationArchiveCommand): Promise<OrganizationAccount>;
}

export interface OrganizationCreateCommand {
  displayName: string;
  legalName?: string; taxCode?: string; domain?: string; website?: string;
  industry?: string; sizeBand?: string; employeeCount?: number; annualRevenue?: number;
  email?: string; phone?: string; address?: string; source?: string;
  relationshipLevel?: OrganizationAccount["relationshipLevel"];
  notes?: string; status?: Exclude<OrganizationAccount["status"], "archived">;
}
export interface OrganizationUpdateCommand extends Partial<OrganizationCreateCommand> { organizationId: string; expectedVersion: number }
export interface OrganizationArchiveCommand { organizationId: string; expectedVersion: number }

export interface OrganizationApiRuntime {
  mode: OrganizationApiRuntimeMode;
  queries: OrganizationQueryPort;
  commands?: OrganizationCommandPort;
}
