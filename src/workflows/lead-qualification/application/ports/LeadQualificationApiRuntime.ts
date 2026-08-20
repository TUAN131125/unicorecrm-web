import type { MutationResourceVersion } from "@/shared/application";
import type {
  ExecuteLeadDirectSaleCommand,
  ExecuteLeadNurtureCommand,
  ExecuteLeadOpportunityCommand,
  LeadQualificationResult,
} from "../../domain/leadQualification.types";

export type LeadQualificationApiRuntimeMode = "demo" | "connected" | "test";

export interface LeadQualificationCommandOptions {
  idempotencyKey: string;
  expectedVersion: number;
  correlationId?: string;
  signal?: AbortSignal;
}

export interface LeadQualificationCreatedResource {
  resourceType: "CONTACT" | "ORGANIZATION_ACCOUNT" | "TASK" | "DEAL" | "QUOTE" | "ORDER";
  resourceId: string;
  resourceVersion: number;
}

export interface LeadQualificationMutationEvidence {
  authority: "backend" | "test";
  commandId: string;
  correlationId: string;
  aggregateId: string;
  aggregateType: string;
  version: MutationResourceVersion;
  occurredAt: string;
  outcome: "COMMITTED" | "REPLAYED";
  warnings: readonly string[];
  emittedEventIds: readonly string[];
  auditEvidenceIds: readonly string[];
}

export interface LeadQualificationApiResult {
  result: LeadQualificationResult;
  createdResources: readonly LeadQualificationCreatedResource[];
  evidence: LeadQualificationMutationEvidence;
}

export interface LeadQualificationCommandPort {
  qualifyForNurture(
    command: ExecuteLeadNurtureCommand,
    options: LeadQualificationCommandOptions,
  ): Promise<LeadQualificationApiResult>;
  qualifyForOpportunity(
    command: ExecuteLeadOpportunityCommand,
    options: LeadQualificationCommandOptions,
  ): Promise<LeadQualificationApiResult>;
  qualifyForDirectSale(
    command: ExecuteLeadDirectSaleCommand,
    options: LeadQualificationCommandOptions,
  ): Promise<LeadQualificationApiResult>;
}

export interface LeadQualificationApiRuntime {
  readonly mode: LeadQualificationApiRuntimeMode;
  readonly commands: LeadQualificationCommandPort;
}
