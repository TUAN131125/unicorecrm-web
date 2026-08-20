import {
  LocalMutationAuthority,
  MutationCommandError,
  createMutationMetadata,
  getMutationAuthority,
  runBackendProjection,
  type MutationCommandMetadata,
  type MutationOutcome,
} from "@/shared/application";
import type {
  CreateSupportCaseInput,
  ReplaceSupportCaseProfileInput,
  SupportMutationEvidence,
  SupportMutationResult,
} from "../application/ports/SupportApiRuntime";
import { getSupportApiRuntime, supportCaseRepository } from "../application/composition/supportApplicationServices";
import { updateSupportCase } from "../application/commands/supportCaseCommands";
import type { SupportCase, SupportCaseStatus } from "../domain/model/supportCase.types";

export type {
  AddSupportCaseInternalNoteInput,
  AddSupportCaseReplyInput,
  AssignSupportCaseInput,
  CreateSupportCaseInput,
  ReplaceSupportCaseProfileInput,
  SupportApiRuntime,
  SupportCaseListQuery,
  SupportCommandOptions,
  SupportMutationEvidence,
  SupportMutationResult,
  SupportVersionedCommandOptions,
  TransitionSupportCaseInput,
} from "../application/ports/SupportApiRuntime";
export type { SupportCase, SupportCaseStatus } from "../domain/model/supportCase.types";
export { getSupportApiRuntime } from "../application/composition/supportApplicationServices";

export function getSupportCasesSnapshot(): SupportCase[] { return supportCaseRepository.list(); }
export function getSupportCaseSnapshot(caseId: string): SupportCase | undefined { return supportCaseRepository.getById(caseId); }
/** Read-model projection only; not a production mutation authority. */
export function replaceSupportCases(cases: SupportCase[]): void { supportCaseRepository.replace(cases); }
/** Read-model projection only; not a production mutation authority. */
export function saveSupportCaseSnapshot(supportCase: SupportCase): void { projectSupportCase(supportCase); }

export async function createSupportCaseCommand(
  input: CreateSupportCaseInput,
  metadata: Partial<MutationCommandMetadata> = {},
): Promise<MutationOutcome<SupportCase>> {
  const options = createMutationMetadata(`support.create:${crypto.randomUUID()}`, metadata);
  const result = await getSupportApiRuntime().commands.createSupportCase(input, options);
  projectSupportCase(result.supportCase);
  return supportOutcome("support.create", options, result);
}

export async function replaceSupportCaseProfileCommand(
  caseId: string,
  input: ReplaceSupportCaseProfileInput,
  metadata: Partial<MutationCommandMetadata> = {},
): Promise<MutationOutcome<SupportCase>> {
  const options = versionedMetadata(caseId, "replace-profile", metadata);
  const result = await getSupportApiRuntime().commands.replaceSupportCaseProfile(caseId, input, options);
  projectSupportCase(result.supportCase);
  return supportOutcome("support.update", options, result);
}

export async function transitionSupportCaseCommand(
  caseId: string,
  status: SupportCaseStatus,
  options: { actorName: string; actorId?: string; locale: "vi" | "en"; resolutionSummary?: string },
  metadata: Partial<MutationCommandMetadata> = {},
): Promise<MutationOutcome<SupportCase>> {
  const commandOptions = versionedMetadata(caseId, "transition", { ...metadata, actor: metadata.actor ?? { id: options.actorId, name: options.actorName } });
  const result = await getSupportApiRuntime().commands.transitionSupportCase(caseId, {
    nextStatus: status,
    ...(options.resolutionSummary !== undefined ? { resolutionSummary: options.resolutionSummary } : {}),
  }, commandOptions);
  projectSupportCase(result.supportCase);
  return supportOutcome("support.transition", commandOptions, result);
}

export async function reassignSupportCaseCommand(
  caseId: string,
  owner: { id: string; name: string },
  options: { actorId?: string; actorName: string; locale: "vi" | "en" },
  metadata: Partial<MutationCommandMetadata> = {},
): Promise<MutationOutcome<SupportCase>> {
  const commandOptions = versionedMetadata(caseId, "assign", { ...metadata, actor: metadata.actor ?? { id: options.actorId, name: options.actorName } });
  const result = await getSupportApiRuntime().commands.assignSupportCase(caseId, { ownerId: owner.id }, commandOptions);
  projectSupportCase(result.supportCase);
  return supportOutcome("support.assign", commandOptions, result);
}

export async function addSupportCaseReplyCommand(
  caseId: string,
  body: string,
  options: { actorId?: string; actorName: string; locale: "vi" | "en" },
  metadata: Partial<MutationCommandMetadata> = {},
): Promise<MutationOutcome<SupportCase>> {
  const commandOptions = versionedMetadata(caseId, "add-reply", { ...metadata, actor: metadata.actor ?? { id: options.actorId, name: options.actorName } });
  const result = await getSupportApiRuntime().commands.addSupportCaseReply(caseId, { body }, commandOptions);
  projectSupportCase(result.supportCase);
  return supportOutcome("support.add-reply", commandOptions, result);
}

export async function addSupportCaseInternalNoteCommand(
  caseId: string,
  body: string,
  options: { actorId?: string; actorName: string; locale: "vi" | "en" },
  metadata: Partial<MutationCommandMetadata> = {},
): Promise<MutationOutcome<SupportCase>> {
  const commandOptions = versionedMetadata(caseId, "add-internal-note", { ...metadata, actor: metadata.actor ?? { id: options.actorId, name: options.actorName } });
  const result = await getSupportApiRuntime().commands.addSupportCaseInternalNote(caseId, { body }, commandOptions);
  projectSupportCase(result.supportCase);
  return supportOutcome("support.add-internal-note", commandOptions, result);
}

/** Demo projection bridge. Connected callers must use createSupportCaseCommand or replaceSupportCaseProfileCommand. */
export async function saveSupportCaseCommand(
  supportCase: SupportCase,
  options: { actorId?: string; actorName?: string } = {},
  metadata: Partial<MutationCommandMetadata> = {},
): Promise<MutationOutcome<SupportCase>> {
  const current = getSupportCaseSnapshot(supportCase.id);
  const input = profileInput(supportCase);
  return current
    ? replaceSupportCaseProfileCommand(supportCase.id, input, { ...metadata, expectedVersion: metadata.expectedVersion ?? current.resourceVersion, actor: metadata.actor ?? { id: options.actorId, name: options.actorName } })
    : createSupportCaseCommand(input, { ...metadata, actor: metadata.actor ?? { id: options.actorId, name: options.actorName } });
}

/** Demo-only generic patch bridge. Connected mode rejects partial Support patches. */
export async function updateSupportCaseCommand(
  caseId: string,
  patch: Partial<SupportCase>,
  _options: { actorId?: string; actorName?: string } = {},
): Promise<MutationOutcome<SupportCase>> {
  assertDemoSupportMutationAllowed("updateSupportCaseCommand");
  const current = getSupportCaseSnapshot(caseId);
  if (!current) throw new Error(`SUPPORT_CASE_NOT_FOUND:${caseId}`);
  const updated = updateSupportCase(current, patch);
  projectSupportCase(updated);
  return {
    data: updated,
    commandId: `demo_support_update_${caseId}`,
    commandType: "support.update",
    aggregateType: "support-case",
    aggregateId: caseId,
    idempotencyKey: `demo_support_update_${caseId}`,
    correlationId: `corr_${crypto.randomUUID()}`,
    occurredAt: updated.updatedAt,
    version: updated.resourceVersion ?? 1,
    outcome: "DEMO_COMMITTED",
    warnings: [], emittedEvents: [], audit: { authority: "demo", evidenceIds: [] },
  };
}

export function subscribeToSupportCases(listener: (cases: SupportCase[]) => void): () => void { return supportCaseRepository.subscribe(listener); }

function versionedMetadata(caseId: string, operation: string, metadata: Partial<MutationCommandMetadata>): MutationCommandMetadata & { expectedVersion: number } {
  const expectedVersion = metadata.expectedVersion ?? getSupportCaseSnapshot(caseId)?.resourceVersion;
  if (typeof expectedVersion !== "number") {
    throw new MutationCommandError({
      code: "SUPPORT_CASE_RESOURCE_VERSION_REQUIRED",
      message: `${operation} requires an authoritative Support Case resource version.`,
      category: "CONFLICT",
      retryable: false,
      details: { caseId, operation, authority: "docs/api/openapi.json" },
    });
  }
  return { ...createMutationMetadata(`support.${operation}:${caseId}`, metadata), expectedVersion };
}

function profileInput(value: SupportCase): ReplaceSupportCaseProfileInput {
  if (!value.relationshipRef) throw new MutationCommandError({ code: "SUPPORT_RELATIONSHIP_REQUIRED", message: "Support Case requires an authoritative relationship reference.", category: "VALIDATION", retryable: false });
  return {
    title: value.title,
    description: value.description,
    priority: value.priority,
    category: value.category,
    source: value.source,
    relationshipRef: value.relationshipRef,
    customerId: value.customerId,
    customerName: value.customerName,
    ...(value.channel !== undefined ? { channel: value.channel } : {}),
    ...(value.contactId !== undefined ? { contactId: value.contactId } : {}),
    ...(value.contactName !== undefined ? { contactName: value.contactName } : {}),
    ...(value.contactEmail !== undefined ? { contactEmail: value.contactEmail } : {}),
    ...(value.contactPhone !== undefined ? { contactPhone: value.contactPhone } : {}),
    ...(value.relatedOrderId !== undefined ? { relatedOrderId: value.relatedOrderId } : {}),
    ...(value.relatedOrderNumber !== undefined ? { relatedOrderNumber: value.relatedOrderNumber } : {}),
    ...(value.relatedProductId !== undefined ? { relatedProductId: value.relatedProductId } : {}),
    ...(value.relatedProductName !== undefined ? { relatedProductName: value.relatedProductName } : {}),
    ...(value.relatedOwnedProductId !== undefined ? { relatedOwnedProductId: value.relatedOwnedProductId } : {}),
    ...(value.ownerId !== undefined ? { ownerId: value.ownerId } : {}),
    ...(value.ownerName !== undefined ? { ownerName: value.ownerName } : {}),
    ...(value.nextFollowUpAt !== undefined ? { nextFollowUpAt: value.nextFollowUpAt } : {}),
    ...(value.firstResponseDueAt !== undefined ? { firstResponseDueAt: value.firstResponseDueAt } : {}),
    ...(value.resolutionDueAt !== undefined ? { resolutionDueAt: value.resolutionDueAt } : {}),
    ...(value.tags !== undefined ? { tags: value.tags } : {}),
  };
}

function projectSupportCase(supportCase: SupportCase): void {
  runBackendProjection("support", () => {
    const current = supportCaseRepository.list();
    supportCaseRepository.replace(current.some((item) => item.id === supportCase.id)
      ? current.map((item) => item.id === supportCase.id ? supportCase : item)
      : [...current, supportCase]);
  });
}

function supportOutcome(commandType: string, options: MutationCommandMetadata, result: SupportMutationResult): MutationOutcome<SupportCase> {
  return mutationOutcome(commandType, options, result.evidence, result.supportCase);
}

function mutationOutcome(commandType: string, options: MutationCommandMetadata, evidence: SupportMutationEvidence, data: SupportCase): MutationOutcome<SupportCase> {
  return {
    data,
    commandId: evidence.commandId,
    commandType,
    aggregateType: evidence.aggregateType,
    aggregateId: evidence.aggregateId,
    idempotencyKey: options.idempotencyKey,
    correlationId: evidence.correlationId,
    occurredAt: evidence.occurredAt,
    version: evidence.version,
    outcome: evidence.outcome,
    warnings: [...evidence.warnings],
    emittedEvents: [...evidence.emittedEventIds],
    audit: { authority: evidence.authority === "backend" ? "backend" : "demo", evidenceIds: [...evidence.auditEvidenceIds] },
  };
}

function assertDemoSupportMutationAllowed(operation: string): void {
  if (getMutationAuthority() instanceof LocalMutationAuthority) return;
  throw new MutationCommandError({
    code: "CONNECTED_COMMAND_REQUIRES_ASYNC_AUTHORITY",
    message: `${operation} is a demo-only Support mutation. Use the typed async Support API command in connected mode.`,
    category: "INFRASTRUCTURE", retryable: false,
    details: { operation, authority: "docs/api/openapi.json", decisionId: "DEC-PHASE12-SUPPORT-API-BOUNDARY" },
  });
}
