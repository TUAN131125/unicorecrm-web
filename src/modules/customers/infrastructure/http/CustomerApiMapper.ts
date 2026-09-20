import type {
  Customer360ReadModel,
  CustomerDocument,
} from "@/platform/api/generated/commercialApi";
import type { Customer360Projection } from "../../application/ports/CustomerApiRuntime";
import type { Customer } from "../../domain/model/customer.types";

export function mapCustomerDocument(value: CustomerDocument): Customer {
  return {
    id: value.id,
    workspaceId: value.workspaceId,
    customerCode: value.customerCode,
    type: value.type,
    relationshipRef: value.relationshipRef,
    status: value.status,
    health: value.health ?? null,
    healthAssessment: value.healthAssessment ? mapHealthAssessment(value.healthAssessment) : undefined,
    calculatedHealth: value.calculatedHealth,
    manualHealthOverride: value.manualHealthOverride,
    onboardingStatus: value.onboardingStatus,
    onboardingCompletedAt: value.onboardingCompletedAt,
    createdFromEvidenceId: value.createdFromEvidenceId,
    conversionPolicyVersion: value.conversionPolicyVersion,
    conversionCorrelationId: value.conversionCorrelationId,
    sourceSystem: value.sourceSystem,
    externalCustomerRef: value.externalCustomerRef,
    tier: value.tier,
    serviceLevel: value.serviceLevel,
    careCadenceDays: value.careCadenceDays,
    firstPurchaseAt: value.firstPurchaseAt ?? null,
    lastPurchaseAt: value.lastPurchaseAt ?? null,
    ownerId: value.ownerId,
    careOwnerId: value.careOwnerId,
    segment: value.segment,
    tags: value.tags ?? [],
    nextCareAt: value.nextCareAt,
    lastCareAt: value.lastCareAt,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    resourceVersion: value.version,
  };
}

export function mapCustomer360ReadModel(value: Customer360ReadModel): Customer360Projection {
  return {
    customer: mapCustomerDocument(value.customer),
    healthAssessment: value.healthAssessment ? mapHealthAssessment(value.healthAssessment) : undefined,
    identity: { ...value.identity },
    metrics: {
      ...value.metrics,
      lifetimeRevenue: value.metrics.lifetimeRevenue ? { ...value.metrics.lifetimeRevenue } : undefined,
      outstandingReceivables: value.metrics.outstandingReceivables ? { ...value.metrics.outstandingReceivables } : undefined,
    },
    linkedRecords: value.linkedRecords.map((record) => ({ ...record })),
    allowedActions: [...value.allowedActions],
    projectionVersion: value.projectionVersion,
    generatedAt: value.generatedAt,
    stakeholderContacts: value.stakeholderContacts.map((contact) => ({ ...contact })),
  };
}

function mapHealthAssessment(value: NonNullable<CustomerDocument["healthAssessment"]>) {
  return {
    ...value,
    score: value.score ?? null,
    lastPurchaseAt: value.lastPurchaseAt ?? null,
    expectedPurchaseCadenceDays: value.expectedPurchaseCadenceDays ?? null,
    daysSinceLastPurchase: value.daysSinceLastPurchase ?? null,
    algorithmVersion: "CUSTOMER_HEALTH_PURCHASE_RECENCY_V1" as const,
  };
}
