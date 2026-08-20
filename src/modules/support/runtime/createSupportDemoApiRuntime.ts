import type { AuthoritativePage } from "@/shared/application";
import {
  addSupportCaseInternalNote,
  addSupportCaseReply,
  createSupportCase,
  reassignSupportCase,
  transitionCase,
  updateSupportCase,
} from "../application/commands/supportCaseCommands";
import type {
  AddSupportCaseInternalNoteInput,
  AddSupportCaseReplyInput,
  AssignSupportCaseInput,
  CreateSupportCaseInput,
  ReplaceSupportCaseProfileInput,
  SupportApiRuntime,
  SupportCommandOptions,
  SupportMutationEvidence,
  SupportMutationResult,
  SupportVersionedCommandOptions,
  TransitionSupportCaseInput,
} from "../application/ports/SupportApiRuntime";
import type { SupportCaseRepository } from "../application/ports/SupportCaseRepository";
import type { SupportCase } from "../domain/model/supportCase.types";

export function createSupportDemoApiRuntime(repository: SupportCaseRepository): SupportApiRuntime {
  return {
    mode: "demo",
    queries: {
      async list(): Promise<AuthoritativePage<SupportCase>> {
        const items = repository.list();
        return { items, pageInfo: { hasNextPage: false, totalCount: items.length }, loadedAt: new Date().toISOString(), authority: "demo" };
      },
      async get(caseId: string): Promise<SupportCase> {
        const item = repository.getById(caseId);
        if (!item) throw new Error(`SUPPORT_CASE_NOT_FOUND:${caseId}`);
        return item;
      },
    },
    commands: {
      async createSupportCase(input: CreateSupportCaseInput, options: SupportCommandOptions): Promise<SupportMutationResult> {
        const item = createSupportCase(repository.list(), {
          title: input.title,
          description: input.description,
          priority: input.priority,
          category: input.category,
          source: input.source,
          customerId: input.customerId ?? input.relationshipRef.id,
          customerName: input.customerName ?? input.relationshipRef.id,
          relationshipRef: input.relationshipRef,
          ...(input.contactId !== undefined ? { contactId: input.contactId } : {}),
          ...(input.contactName !== undefined ? { contactName: input.contactName } : {}),
          ...(input.contactEmail !== undefined ? { contactEmail: input.contactEmail } : {}),
          ...(input.contactPhone !== undefined ? { contactPhone: input.contactPhone } : {}),
          ...(input.relatedOrderId !== undefined ? { relatedOrderId: input.relatedOrderId } : {}),
          ...(input.relatedOrderNumber !== undefined ? { relatedOrderNumber: input.relatedOrderNumber } : {}),
          ...(input.relatedProductId !== undefined ? { relatedProductId: input.relatedProductId } : {}),
          ...(input.relatedProductName !== undefined ? { relatedProductName: input.relatedProductName } : {}),
          ...(input.relatedOwnedProductId !== undefined ? { relatedOwnedProductId: input.relatedOwnedProductId } : {}),
          ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
          ...(input.ownerName !== undefined ? { ownerName: input.ownerName } : {}),
          ...(input.nextFollowUpAt !== undefined ? { nextFollowUpAt: input.nextFollowUpAt } : {}),
          ...(input.firstResponseDueAt !== undefined ? { firstResponseDueAt: input.firstResponseDueAt } : {}),
          ...(input.resolutionDueAt !== undefined ? { resolutionDueAt: input.resolutionDueAt } : {}),
          locale: "vi",
        });
        const versioned = { ...item, resourceVersion: 1 };
        save(repository, versioned);
        return result(versioned, options, new Date().toISOString());
      },
      async replaceSupportCaseProfile(caseId: string, input: ReplaceSupportCaseProfileInput, options: SupportVersionedCommandOptions): Promise<SupportMutationResult> {
        const current = requireVersion(repository, caseId, options.expectedVersion);
        const updated = updateSupportCase(current, {
          title: input.title,
          description: input.description,
          priority: input.priority,
          category: input.category,
          source: input.source,
          channel: input.channel,
          relationshipRef: input.relationshipRef,
          customerId: input.customerId ?? current.customerId,
          customerName: input.customerName ?? current.customerName,
          contactId: input.contactId,
          contactName: input.contactName,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
          relatedOrderId: input.relatedOrderId,
          relatedOrderNumber: input.relatedOrderNumber,
          relatedProductId: input.relatedProductId,
          relatedProductName: input.relatedProductName,
          relatedOwnedProductId: input.relatedOwnedProductId,
          ownerId: input.ownerId,
          ownerName: input.ownerName,
          nextFollowUpAt: input.nextFollowUpAt,
          firstResponseDueAt: input.firstResponseDueAt,
          resolutionDueAt: input.resolutionDueAt,
          tags: input.tags ? [...input.tags] : undefined,
          resourceVersion: options.expectedVersion + 1,
        });
        save(repository, updated);
        return result(updated, options, updated.updatedAt);
      },
      async assignSupportCase(caseId: string, input: AssignSupportCaseInput, options: SupportVersionedCommandOptions): Promise<SupportMutationResult> {
        const current = requireVersion(repository, caseId, options.expectedVersion);
        const updated = { ...reassignSupportCase(current, { id: input.ownerId, name: input.ownerId }, { actorName: "Demo User", locale: "vi" }), resourceVersion: options.expectedVersion + 1 };
        save(repository, updated); return result(updated, options, updated.updatedAt);
      },
      async transitionSupportCase(caseId: string, input: TransitionSupportCaseInput, options: SupportVersionedCommandOptions): Promise<SupportMutationResult> {
        const current = requireVersion(repository, caseId, options.expectedVersion);
        const updated = { ...transitionCase(current, input.nextStatus, { actorName: "Demo User", locale: "vi", ...(input.resolutionSummary !== undefined ? { resolutionSummary: input.resolutionSummary } : {}) }), resourceVersion: options.expectedVersion + 1 };
        save(repository, updated); return result(updated, options, updated.updatedAt);
      },
      async addSupportCaseReply(caseId: string, input: AddSupportCaseReplyInput, options: SupportVersionedCommandOptions): Promise<SupportMutationResult> {
        const current = requireVersion(repository, caseId, options.expectedVersion);
        const updated = { ...addSupportCaseReply(current, input.body, { senderType: "agent", locale: "vi", actorName: "Demo User" }), resourceVersion: options.expectedVersion + 1 };
        save(repository, updated); return result(updated, options, updated.updatedAt);
      },
      async addSupportCaseInternalNote(caseId: string, input: AddSupportCaseInternalNoteInput, options: SupportVersionedCommandOptions): Promise<SupportMutationResult> {
        const current = requireVersion(repository, caseId, options.expectedVersion);
        const updated = { ...addSupportCaseInternalNote(current, input.body, { locale: "vi", actorName: "Demo User" }), resourceVersion: options.expectedVersion + 1 };
        save(repository, updated); return result(updated, options, updated.updatedAt);
      },
    },
  };
}

function save(repository: SupportCaseRepository, item: SupportCase): void {
  const current = repository.list();
  repository.replace(current.some((candidate) => candidate.id === item.id) ? current.map((candidate) => candidate.id === item.id ? item : candidate) : [...current, item]);
}

function requireVersion(repository: SupportCaseRepository, caseId: string, expectedVersion: number): SupportCase {
  const item = repository.getById(caseId);
  if (!item) throw new Error(`SUPPORT_CASE_NOT_FOUND:${caseId}`);
  const actual = item.resourceVersion ?? expectedVersion;
  if (actual !== expectedVersion) throw new Error(`SUPPORT_CASE_VERSION_CONFLICT:${caseId}`);
  return item;
}

function result(item: SupportCase, options: SupportCommandOptions, occurredAt: string): SupportMutationResult {
  return { supportCase: item, evidence: evidence(item, options, occurredAt) };
}

function evidence(item: SupportCase, options: SupportCommandOptions, occurredAt: string): SupportMutationEvidence {
  return {
    authority: "demo",
    commandId: options.idempotencyKey,
    correlationId: options.correlationId ?? `corr_${crypto.randomUUID()}`,
    aggregateId: item.id,
    aggregateType: "support-case",
    version: item.resourceVersion ?? 1,
    occurredAt,
    outcome: "DEMO_COMMITTED",
    warnings: [], emittedEventIds: [], auditEvidenceIds: [],
  };
}
