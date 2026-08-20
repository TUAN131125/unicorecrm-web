import type {
  CreateSupportCaseRequest,
  ReplaceSupportCaseProfileRequest,
  SupportCaseMutationResponse,
  SupportCaseReadModel,
} from "@/platform/api/generated/commercialApi";
import type { RelationshipRef } from "@/platform/identity";
import type {
  CreateSupportCaseInput,
  ReplaceSupportCaseProfileInput,
  SupportMutationEvidence,
  SupportMutationResult,
} from "../../application/ports/SupportApiRuntime";
import type { SupportCase } from "../../domain/model/supportCase.types";

export function mapSupportCaseReadModel(value: SupportCaseReadModel): SupportCase {
  return compact({
    id: value.id,
    caseNumber: value.caseNumber,
    title: value.title,
    description: value.description,
    status: value.status,
    priority: value.priority,
    category: value.category,
    source: value.source,
    channel: value.channel,
    customerId: value.customerId,
    customerName: value.customerName,
    relationshipRef: value.relationshipRef as RelationshipRef,
    contactId: value.contactId,
    contactName: value.contactName,
    contactEmail: value.contactEmail,
    contactPhone: value.contactPhone,
    relatedOrderId: value.relatedOrderId,
    relatedOrderNumber: value.relatedOrderNumber,
    relatedProductId: value.relatedProductId,
    relatedProductName: value.relatedProductName,
    relatedOwnedProductId: value.relatedOwnedProductId,
    ownerId: value.ownerId,
    ownerName: value.ownerName,
    team: value.team,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    firstResponseDueAt: value.firstResponseDueAt,
    resolutionDueAt: value.resolutionDueAt,
    firstRespondedAt: value.firstRespondedAt,
    resolvedAt: value.resolvedAt,
    closedAt: value.closedAt,
    nextFollowUpAt: value.nextFollowUpAt,
    reopenedAt: value.reopenedAt,
    slaStatus: value.slaStatus,
    tags: value.tags,
    resolutionSummary: value.resolutionSummary,
    internalSummary: value.internalSummary,
    activities: value.activities?.map((activity) => ({
      id: activity.id,
      type: activity.type,
      title: activity.title,
      description: activity.description,
      createdAt: activity.createdAt,
      actorName: activity.actorName,
    })),
    comments: value.comments?.map((comment) => ({
      id: comment.id,
      type: comment.type,
      body: comment.body,
      authorName: comment.authorName,
      createdAt: comment.createdAt,
      isInternal: comment.isInternal,
    })),
    resourceVersion: value.resourceVersion,
  }) as SupportCase;
}

export function mapCreateSupportCaseRequest(input: CreateSupportCaseInput): CreateSupportCaseRequest {
  return compact({
    title: input.title.trim(),
    description: input.description.trim(),
    priority: input.priority,
    category: input.category as CreateSupportCaseRequest["category"],
    source: input.source,
    channel: input.channel,
    relationshipRef: input.relationshipRef,
    contactId: input.contactId,
    relatedOrderId: input.relatedOrderId,
    relatedProductId: input.relatedProductId,
    relatedOwnedProductId: input.relatedOwnedProductId,
    ownerId: input.ownerId,
    nextFollowUpAt: input.nextFollowUpAt,
    firstResponseDueAt: input.firstResponseDueAt,
    resolutionDueAt: input.resolutionDueAt,
    tags: input.tags ? [...input.tags] : undefined,
  }) as CreateSupportCaseRequest;
}

export function mapReplaceSupportCaseProfileRequest(input: ReplaceSupportCaseProfileInput): ReplaceSupportCaseProfileRequest {
  return compact({
    title: input.title.trim(),
    description: input.description.trim(),
    priority: input.priority,
    category: input.category,
    source: input.source,
    channel: input.channel,
    relationshipRef: input.relationshipRef,
    contactId: input.contactId,
    relatedOrderId: input.relatedOrderId,
    relatedProductId: input.relatedProductId,
    relatedOwnedProductId: input.relatedOwnedProductId,
    ownerId: input.ownerId,
    nextFollowUpAt: input.nextFollowUpAt,
    firstResponseDueAt: input.firstResponseDueAt,
    resolutionDueAt: input.resolutionDueAt,
    tags: input.tags ? [...input.tags] : undefined,
  }) as ReplaceSupportCaseProfileRequest;
}

export function mapSupportMutationResponse(response: SupportCaseMutationResponse): SupportMutationResult {
  return {
    supportCase: mapSupportCaseReadModel(response.result.supportCase),
    evidence: mapEvidence(response),
  };
}

function mapEvidence(response: SupportCaseMutationResponse): SupportMutationEvidence {
  return {
    authority: "backend",
    commandId: response.commandId,
    correlationId: response.correlationId,
    aggregateId: response.aggregateId,
    aggregateType: response.aggregateType,
    version: response.version,
    occurredAt: response.occurredAt,
    outcome: response.outcome,
    warnings: response.warnings ?? [],
    emittedEventIds: response.emittedEventIds ?? [],
    auditEvidenceIds: response.auditEvidenceIds ?? [],
  };
}

function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}
