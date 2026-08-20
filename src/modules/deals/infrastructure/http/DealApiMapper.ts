import type {
  ArchiveDealRequest,
  ArchiveDealsBatchRequest,
  AssignDealOwnerRequest,
  ChangeDealStageRequest,
  CreateDealRequest,
  DealBatchMutationResponse,
  DealForecastSummaryReadModel,
  DealMutationResponse,
  DealReadModel as ApiDealReadModel,
  MarkDealLostRequest,
  MarkDealWonRequest,
  ReplaceDealProfileRequest,
  UpdateDealForecastRequest,
  UpdateDealNextActionRequest,
} from "@/platform/api/generated/commercialApi";
import { normalizeDecimal } from "@/shared/money";
import type {
  ArchiveDealInput,
  ArchiveDealsBatchInput,
  AssignDealOwnerInput,
  ChangeDealStageInput,
  CreateDealInput,
  DealBatchMutationResult,
  DealForecastSummary,
  DealLineInput,
  DealMutationEvidence,
  DealMutationResult,
  MarkDealLostInput,
  MarkDealWonInput,
  ReplaceDealProfileInput,
  UpdateDealForecastInput,
  UpdateDealNextActionInput,
} from "../../application/ports/DealApiRuntime";
import { projectDealReadModel, type DealReadModel } from "../../application/read-models/dealReadModel";
import type { Deal } from "../../domain/model/deal.types";

export function mapDealReadModel(value: ApiDealReadModel): Deal {
  return projectDealReadModel(value as DealReadModel);
}

export function mapCreateDealRequest(input: CreateDealInput): CreateDealRequest {
  return compact({
    ...mapEditableProfileRequest(input),
    stageCode: input.stageCode.trim(),
    opportunityScore: normalizeDecimal(input.opportunityScore),
    ownerId: input.ownerId.trim(),
    expectedCloseDate: input.expectedCloseDate,
    forecastCategory: input.forecastCategory,
    nextActionAt: input.nextActionAt,
    nextActionSummary: input.nextActionSummary?.trim(),
    nextActionTaskId: input.nextActionTaskId?.trim(),
  }) as CreateDealRequest;
}

export function mapReplaceDealProfileRequest(input: ReplaceDealProfileInput): ReplaceDealProfileRequest {
  return mapEditableProfileRequest(input) as unknown as ReplaceDealProfileRequest;
}

export function mapChangeDealStageRequest(input: ChangeDealStageInput): ChangeDealStageRequest {
  return { stageCode: input.stageCode.trim() };
}

export function mapAssignDealOwnerRequest(input: AssignDealOwnerInput): AssignDealOwnerRequest {
  return { ownerId: input.ownerId.trim(), reason: input.reason.trim() };
}

export function mapUpdateDealForecastRequest(input: UpdateDealForecastInput): UpdateDealForecastRequest {
  return compact({
    expectedCloseDate: input.expectedCloseDate,
    opportunityScore: input.opportunityScore === undefined ? undefined : normalizeDecimal(input.opportunityScore),
    forecastCategory: input.forecastCategory,
  });
}

export function mapUpdateDealNextActionRequest(input: UpdateDealNextActionInput): UpdateDealNextActionRequest {
  return compact({
    nextActionAt: input.nextActionAt,
    nextActionSummary: input.nextActionSummary?.trim(),
    taskId: input.taskId?.trim(),
  });
}

export function mapMarkDealWonRequest(input: MarkDealWonInput): MarkDealWonRequest {
  return { evidence: input.evidence };
}

export function mapMarkDealLostRequest(input: MarkDealLostInput): MarkDealLostRequest {
  return compact({
    reason: input.reason.trim(),
    note: input.note?.trim(),
    recycleDecision: input.recycleDecision,
    revisitAt: input.revisitAt,
  });
}

export function mapArchiveDealRequest(input: ArchiveDealInput): ArchiveDealRequest {
  return { reason: input.reason.trim() };
}

export function mapArchiveDealsBatchRequest(input: ArchiveDealsBatchInput): ArchiveDealsBatchRequest {
  return {
    items: input.items.map((item) => ({ dealId: item.dealId.trim(), expectedVersion: item.expectedVersion })),
    reason: input.reason.trim(),
  };
}

export function mapDealMutationResponse(response: DealMutationResponse): DealMutationResult {
  return { deal: mapDealReadModel(response.result.deal), evidence: mapEvidence(response) };
}

export function mapDealBatchMutationResponse(response: DealBatchMutationResponse): DealBatchMutationResult {
  return { deals: response.result.deals.map(mapDealReadModel), evidence: mapEvidence(response) };
}

export function mapDealForecastSummary(value: DealForecastSummaryReadModel): DealForecastSummary {
  return {
    asOf: value.asOf,
    permissionFiltered: value.permissionFiltered,
    buckets: value.buckets.map((bucket) => ({
      currency: bucket.currency,
      openDealCount: bucket.openDealCount,
      overdueDealCount: bucket.overdueDealCount,
      closingThisMonthCount: bucket.closingThisMonthCount,
      openAmount: bucket.openAmount,
      commitAmount: bucket.commitAmount,
      bestCaseAmount: bucket.bestCaseAmount,
      pipelineAmount: bucket.pipelineAmount,
      weightedAmount: bucket.weightedAmount,
    })),
  };
}

function mapEditableProfileRequest(input: ReplaceDealProfileInput | CreateDealInput): Record<string, unknown> {
  return compact({
    name: input.name.trim(),
    buyerRef: input.buyerRef,
    amount: { amount: normalizeDecimal(input.amount.amount), currency: input.amount.currency.trim().toUpperCase() },
    contactId: input.contactId?.trim(),
    sourceLeadId: input.sourceLeadId?.trim(),
    interestedProductIds: input.interestedProductIds ? [...input.interestedProductIds] : undefined,
    lineItems: input.lineItems?.map(mapDealLine),
    notes: input.notes?.trim(),
  });
}

function mapDealLine(line: DealLineInput): Record<string, unknown> {
  return compact({
    productId: line.productId.trim(),
    quantity: normalizeDecimal(line.quantity),
    unitPrice: { amount: normalizeDecimal(line.unitPrice.amount), currency: line.unitPrice.currency.trim().toUpperCase() },
    discountRate: normalizeDecimal(line.discountRate),
    taxRate: line.taxRate === undefined ? undefined : normalizeDecimal(line.taxRate),
    taxMode: line.taxMode,
    billingCycleSnapshot: line.billingCycleSnapshot?.trim(),
    descriptionSnapshot: line.descriptionSnapshot?.trim(),
  });
}

function mapEvidence(response: DealMutationResponse | DealBatchMutationResponse): DealMutationEvidence {
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
