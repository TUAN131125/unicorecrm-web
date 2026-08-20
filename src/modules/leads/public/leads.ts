import { ApplicationError, type CRMActivity } from "@/shared/domain";
import type { RelationshipRef } from "@/platform/identity";
import {
  appendActivityToLead,
  closeLeadWithOutcome,
  reassignLead,
} from "../application/commands/leadCommands";
import { exportLeads } from "../application/commands/leadExportCommands";
import {
  advanceEligibleLeadsToVerifying,
  advanceNewLeadsToContacting,
  saveLead,
  updateLead,
  updateLeadCollection,
  updateManyLeads,
  type LeadCollectionUpdater,
} from "../application/commands/leadRepositoryCommands";
import {
  importLeadCsvPlanAtomically,
  type ImportLeadBatchOptions,
} from "../application/commands/leadImportCommands";
import type { LeadCsvImportPlan } from "../application/import/leadCsvImport";
import type { Lead } from "../domain/model/lead.types";
import type { LeadWorkState, QualificationOutcome } from "../domain/model/leadLifecycle.canonical";
import { isLeadConnectedApiRuntime, leadExporter, leadPreferences, leadRepository } from "../application/composition/leadApplicationServices";

export function getLeadsSnapshot(): Lead[] {
  return leadRepository.list().filter((lead) => !lead.archivedAt);
}

export function getRetainedLeadsSnapshot(): Lead[] {
  return leadRepository.list();
}

export function getLeadSnapshot(leadId: string): Lead | undefined {
  return leadRepository.getById(leadId);
}

export function replaceLeads(leads: Lead[]): void {
  updateLeadCollection(leadRepository, leads);
}

export function updateLeads(updater: LeadCollectionUpdater): Lead[] {
  return updateLeadCollection(leadRepository, updater);
}

export function subscribeToLeads(listener: (leads: Lead[]) => void): () => void {
  return leadRepository.subscribe((leads) => listener(leads.filter((lead) => !lead.archivedAt)));
}

export function saveLeadSnapshot(lead: Lead): Lead {
  return saveLead(leadRepository, lead);
}

export function updateLeadSnapshot(leadId: string, transform: (lead: Lead) => Lead): Lead | undefined {
  assertLocalLeadMutationAllowed("updateLeadSnapshot");
  return updateLead(leadRepository, leadId, transform);
}

export function updateManyLeadsSnapshot(leadIds: readonly string[], transform: (lead: Lead) => Lead): number {
  assertLocalLeadMutationAllowed("updateManyLeadsSnapshot");
  return updateManyLeads(leadRepository, leadIds, transform);
}

export function advanceNewLeadsToContactingSnapshot(leadIds: readonly string[]): number {
  assertLocalLifecycleSnapshotAllowed("advanceNewLeadsToContactingSnapshot");
  return advanceNewLeadsToContacting(leadRepository, leadIds);
}

export function advanceEligibleLeadsToVerifyingSnapshot(leadIds: readonly string[]): number {
  assertLocalLifecycleSnapshotAllowed("advanceEligibleLeadsToVerifyingSnapshot");
  return advanceEligibleLeadsToVerifying(leadRepository, leadIds);
}

function assertLocalLeadMutationAllowed(operationId: string): void {
  if (!isLeadConnectedApiRuntime()) return;
  throw new ApplicationError({
    code: "LEAD_LOCAL_MUTATION_FORBIDDEN",
    message: `${operationId} is demo-only. Connected mode must use the dedicated API boundary.`,
    category: "INFRASTRUCTURE",
    retryable: false,
    userMessage: "Thao tác Lead cục bộ đã bị chặn trong chế độ kết nối backend.",
    details: { module: "leads", operationId, authority: "docs/api/openapi.json" },
  });
}

function assertLocalLifecycleSnapshotAllowed(operationId: string): void {
  if (!isLeadConnectedApiRuntime()) return;
  throw new ApplicationError({
    code: "LEAD_BULK_LIFECYCLE_CONTRACT_BLOCKED",
    message: `${operationId} is a retired demo-only compatibility path. Connected mode uses advanceLeadWorkStateBatch.`,
    category: "CONFLICT",
    retryable: false,
    userMessage: "Đường ghi trạng thái cục bộ đã bị chặn; chế độ kết nối sử dụng API batch authoritative.",
    details: { module: "leads", operationId, authority: "docs/api/openapi.json" },
  });
}


export function closeLeadSnapshot(leadId: string, input: {
  outcome: QualificationOutcome;
  relationshipRef?: RelationshipRef;
  dealRef?: string;
  activity?: CRMActivity;
}): Lead | undefined {
  assertLocalLeadMutationAllowed("closeLeadSnapshot");
  return closeLeadWithOutcome(leadRepository, leadId, input);
}

export function appendLeadActivitySnapshot(leadId: string, activity: CRMActivity): Lead | undefined {
  assertLocalLeadMutationAllowed("appendLeadActivitySnapshot");
  return appendActivityToLead(leadRepository, leadId, activity);
}

export function reassignLeadSnapshot(leadId: string, input: {
  ownerId: string;
  reason: string;
  leadWorkState?: Exclude<LeadWorkState, "CLOSED">;
  activity?: CRMActivity;
}): Lead | undefined {
  assertLocalLeadMutationAllowed("reassignLeadSnapshot");
  return reassignLead(leadRepository, leadId, input);
}

export function exportLeadsSnapshot(leadIds: readonly string[], fileName: string): number {
  assertLocalLeadMutationAllowed("exportLeadsSnapshot");
  return exportLeads(leadRepository, leadExporter, leadIds, fileName);
}

export function importLeadCsvPlanSnapshot(
  plan: LeadCsvImportPlan,
  options: ImportLeadBatchOptions,
): Lead[] {
  assertLocalLeadMutationAllowed("importLeadCsvPlanSnapshot");
  return importLeadCsvPlanAtomically(leadRepository, plan, options);
}

export function getLeadPreference<T>(key: string, fallback: T): T {
  return leadPreferences.get(key, fallback);
}

export function setLeadPreference<T>(key: string, value: T): void {
  leadPreferences.set(key, value);
}

export function removeLeadPreference(key: string): void {
  leadPreferences.remove(key);
}

export { ingestLeadWebhook } from "../application/composition/leadApplicationServices";
export type { IngestLeadWebhookCommand, LeadWebhookIngressResult, LeadWebhookPayload } from "../application/composition/leadApplicationServices";

export { advanceLeadWorkStateBatchViaApi, advanceLeadWorkStateViaApi, anonymizeLeadViaApi, applyLeadTagBatchViaApi, archiveLeadViaApi, archiveLeadsViaApi, assignLeadOwnerBatchViaApi, assignLeadOwnerViaApi, claimLeadFromQueueViaApi, confirmLeadDuplicatesDistinctViaApi, createLeadFromFormViaApi, disqualifyLeadBatchViaApi, disqualifyLeadViaApi, handoverLeadWithTasksViaApi, importLeadCsvPlanViaApi, mergeLeadDuplicatesViaApi, recordLeadConsentViaApi, reopenDisqualifiedLeadViaApi, replaceLeadProfileFromFormViaApi, replaceLeadViaTransformViaApi, requestLeadExportViaApi, saveLeadForRuntime, scheduleLeadFollowUpBatchViaApi } from "../application/commands/leadApiCommands";
export type { AdvanceLeadWorkStateInput, AdvanceLeadWorkStateResult, AnonymizeLeadResult, ArchiveLeadBatchResult, ArchiveLeadResult, ConfirmLeadDuplicatesDistinctResult, CreateLeadInput, CreateLeadResult, DisqualifyLeadInput, DisqualifyLeadResult, LeadApiRuntime, LeadCommandOptions, LeadCommandPort, LeadProgressionTarget, LeadQueryPort, LeadVersionedCommandOptions, MergeLeadDuplicatesResult, RecordLeadConsentInput, RecordLeadConsentResult, ReopenDisqualifiedLeadResult } from "../application/ports/LeadApiRuntime";

export { logLeadActivityViaApi } from "../application/commands/leadActivityCommands";
