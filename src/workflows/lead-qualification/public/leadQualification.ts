import {
  createMutationMetadata,
  executeMutationCommand,
  invalidateModuleQueries,
  type MutationCommandMetadata,
  type MutationOutcome,
} from "@/shared/application";
import { ApplicationError } from "@/shared/domain";
import { getLeadSnapshot } from "@/modules/leads";
import { executeLeadDirectSale } from "../application/executeLeadDirectSale";
import { executeLeadNurture } from "../application/executeLeadNurture";
import { executeLeadOpportunity } from "../application/executeLeadOpportunity";
import type {
  ExecuteLeadDirectSaleCommand,
  ExecuteLeadNurtureCommand,
  ExecuteLeadOpportunityCommand,
  LeadQualificationResult,
} from "../domain/leadQualification.types";
import { createLeadQualificationRuntime } from "../application/composition/leadQualificationApplicationServices";
import { getLeadQualificationApiRuntime } from "../application/composition/leadQualificationApiRuntimeBinding";
import type {
  LeadQualificationApiResult,
  LeadQualificationCommandOptions,
} from "../application/ports/LeadQualificationApiRuntime";

export function executeLeadNurtureSnapshot(command: ExecuteLeadNurtureCommand): LeadQualificationResult {
  return executeLeadNurture(command, createLeadQualificationRuntime());
}

export function executeLeadOpportunitySnapshot(command: ExecuteLeadOpportunityCommand): LeadQualificationResult {
  return executeLeadOpportunity(command, createLeadQualificationRuntime());
}

export function executeLeadDirectSaleSnapshot(command: ExecuteLeadDirectSaleCommand): LeadQualificationResult {
  return executeLeadDirectSale(command, createLeadQualificationRuntime());
}

export async function executeLeadNurtureCommand(
  command: ExecuteLeadNurtureCommand,
  metadata: Partial<MutationCommandMetadata> = {},
): Promise<MutationOutcome<LeadQualificationResult>> {
  const resolved = createMutationMetadata(`lead.qualify-nurture:${command.leadId}`, metadata);
  const api = getLeadQualificationApiRuntime();
  if (api.mode === "connected") {
    const result = await api.commands.qualifyForNurture(command, requireConnectedOptions(command.leadId, "qualifyLeadForNurture", resolved));
    return commitConnectedOutcome("lead.qualify-nurture", result, resolved.idempotencyKey, ["leads", "contacts", "organizations", "tasks"]);
  }
  return executeMutationCommand(
    { commandType: "lead.qualify-nurture", aggregateType: "lead", aggregateId: command.leadId, payload: command },
    resolved,
    () => executeLeadNurture(command, createLeadQualificationRuntime()),
  );
}

export async function executeLeadOpportunityCommand(
  command: ExecuteLeadOpportunityCommand,
  metadata: Partial<MutationCommandMetadata> = {},
): Promise<MutationOutcome<LeadQualificationResult>> {
  const resolved = createMutationMetadata(`lead.qualify-opportunity:${command.leadId}`, metadata);
  const api = getLeadQualificationApiRuntime();
  if (api.mode === "connected") {
    const result = await api.commands.qualifyForOpportunity(
      command,
      requireConnectedOptions(command.leadId, "qualifyLeadForOpportunity", resolved),
    );
    return commitConnectedOutcome("lead.qualify-opportunity", result, resolved.idempotencyKey, ["leads", "contacts", "organizations", "tasks", "deals"]);
  }
  return executeMutationCommand(
    { commandType: "lead.qualify-opportunity", aggregateType: "lead", aggregateId: command.leadId, payload: command },
    resolved,
    () => executeLeadOpportunity(command, createLeadQualificationRuntime()),
  );
}

export async function executeLeadDirectSaleCommand(
  command: ExecuteLeadDirectSaleCommand,
  metadata: Partial<MutationCommandMetadata> = {},
): Promise<MutationOutcome<LeadQualificationResult>> {
  const resolved = createMutationMetadata(`lead.qualify-direct-sale:${command.leadId}`, metadata);
  const api = getLeadQualificationApiRuntime();
  if (api.mode === "connected") {
    const result = await api.commands.qualifyForDirectSale(
      command,
      requireConnectedOptions(command.leadId, "qualifyLeadForDirectSale", resolved),
    );
    return commitConnectedOutcome("lead.qualify-direct-sale", result, resolved.idempotencyKey, ["leads", "contacts", "organizations", "quotes", "orders"]);
  }
  return executeMutationCommand(
    { commandType: "lead.qualify-direct-sale", aggregateType: "lead", aggregateId: command.leadId, payload: command },
    resolved,
    () => executeLeadDirectSale(command, createLeadQualificationRuntime()),
  );
}

function requireConnectedOptions(
  leadId: string,
  operationId: string,
  metadata: MutationCommandMetadata,
): LeadQualificationCommandOptions {
  const lead = requireAuthoritativeLead(leadId, operationId);
  const expectedVersion = metadata.expectedVersion ?? lead.resourceVersion;
  if (!Number.isInteger(expectedVersion) || Number(expectedVersion) < 1) {
    throw new ApplicationError({
      code: "LEAD_QUALIFICATION_VERSION_REQUIRED",
      message: `${operationId} requires the authoritative Lead resource version.`,
      category: "CONFLICT",
      retryable: false,
      userMessage: "Không thể chốt qualification vì thiếu phiên bản Lead. Hãy tải lại hồ sơ rồi thử lại.",
      details: { module: "lead-qualification", operationId, leadId },
    });
  }
  return {
    idempotencyKey: metadata.idempotencyKey,
    expectedVersion: Number(expectedVersion),
    ...(metadata.correlationId === undefined ? {} : { correlationId: metadata.correlationId }),
    ...(metadata.signal === undefined ? {} : { signal: metadata.signal }),
  };
}

function requireAuthoritativeLead(leadId: string, operationId: string) {
  const lead = getLeadSnapshot(leadId);
  if (!lead) {
    throw new ApplicationError({
      code: "LEAD_NOT_FOUND",
      message: `${operationId} requires a loaded authoritative Lead projection.`,
      category: "NOT_FOUND",
      retryable: false,
      userMessage: "Không tìm thấy Lead hoặc hồ sơ chưa được tải từ backend.",
      details: { module: "lead-qualification", operationId, leadId },
    });
  }
  return lead;
}

async function commitConnectedOutcome(
  commandType: string,
  result: LeadQualificationApiResult,
  idempotencyKey: string,
  moduleKeys: readonly ("leads" | "contacts" | "organizations" | "tasks" | "deals" | "quotes" | "orders")[],
): Promise<MutationOutcome<LeadQualificationResult>> {
  await invalidateModuleQueries({
    moduleKeys,
    commandType,
    aggregateId: result.evidence.aggregateId,
    occurredAt: result.evidence.occurredAt,
  });
  return {
    data: result.result,
    commandId: result.evidence.commandId,
    commandType,
    aggregateType: result.evidence.aggregateType,
    aggregateId: result.evidence.aggregateId,
    idempotencyKey,
    correlationId: result.evidence.correlationId,
    occurredAt: result.evidence.occurredAt,
    version: result.evidence.version,
    outcome: result.evidence.outcome,
    warnings: [...result.evidence.warnings],
    emittedEvents: [...result.evidence.emittedEventIds],
    audit: { authority: "backend", evidenceIds: [...result.evidence.auditEvidenceIds] },
  };
}
