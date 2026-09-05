import type {
  CreateLeadRequest,
  LeadCustomFieldValue,
  LeadDocument,
  LeadInterestedProductInput,
  ReplaceLeadProfileRequest,
} from "@/platform/api/generated/commercialApi";
import { ApiClientError } from "@/platform/api/errors";
import { moneyToDisplayNumber, normalizeDecimal } from "@/shared/money";
import type { LeadProfileInput } from "../../application/ports/LeadApiRuntime";
import type { Lead } from "../../domain/model/lead.types";

export function mapLeadDocumentToApplication(dto: LeadDocument): Lead {
  if (dto.activityProjection !== "NOT_INCLUDED") {
    throw projectionViolation("getLead/listLeads", "Lead activityProjection must be NOT_INCLUDED until a timeline contract is loaded.");
  }
  return {
    id: dto.id,
    name: dto.displayName,
    title: dto.title ?? "",
    companyName: dto.companyName ?? "",
    email: dto.email ?? "",
    phone: dto.phone ?? "",
    source: dto.source ?? "",
    score: dto.score,
    leadWorkState: dto.leadWorkState,
    ...(dto.qualificationOutcome === undefined ? {} : { qualificationOutcome: dto.qualificationOutcome }),
    ...(dto.relationshipRef === undefined ? {} : { relationshipRef: { type: dto.relationshipRef.type === "ORGANIZATION" ? "ORGANIZATION_ACCOUNT" : "CONTACT", id: dto.relationshipRef.id } }),
    ...((dto.dealRef ?? dto.qualifiedDealId) === undefined ? {} : { dealRef: dto.dealRef ?? dto.qualifiedDealId }),
    ownerId: dto.ownerId,
    interestedProducts: dto.interestedProducts.map((item) => ({
      id: item.id,
      productId: item.productId,
      ...(item.skuSnapshot === undefined ? {} : { skuSnapshot: item.skuSnapshot }),
      productNameSnapshot: item.productNameSnapshot,
      ...(item.productTypeSnapshot === undefined ? {} : { productTypeSnapshot: item.productTypeSnapshot }),
      interestLevel: item.interestLevel,
      ...(item.estimatedQuantity === undefined ? {} : { estimatedQuantity: item.estimatedQuantity }),
      ...(item.expectedBudget === undefined ? {} : {
        expectedBudget: moneyToDisplayNumber(item.expectedBudget),
        expectedBudgetMoney: item.expectedBudget,
      }),
      ...(item.note === undefined ? {} : { note: item.note }),
      createdAt: item.createdAt,
    })),
    ...(dto.nextFollowUpAt === undefined ? {} : { nextFollowUpAt: dto.nextFollowUpAt }),
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    ...(dto.salutation === undefined ? {} : { salutation: dto.salutation }),
    ...(dto.department === undefined ? {} : { department: dto.department }),
    ...(dto.workPhone === undefined ? {} : { workPhone: dto.workPhone }),
    ...(dto.otherPhone === undefined ? {} : { otherPhone: dto.otherPhone }),
    ...(dto.personalEmail === undefined ? {} : { personalEmail: dto.personalEmail }),
    ...(dto.zaloId === undefined ? {} : { zaloId: dto.zaloId }),
    ...(dto.facebook === undefined ? {} : { facebook: dto.facebook }),
    ...(dto.preferredChannel === undefined ? {} : { preferredChannel: dto.preferredChannel }),
    ...(dto.doNotCall === undefined ? {} : { doNotCall: dto.doNotCall }),
    ...(dto.doNotEmail === undefined ? {} : { doNotEmail: dto.doNotEmail }),
    ...(dto.doNotSms === undefined ? {} : { doNotSms: dto.doNotSms }),
    ...(dto.doNotZalo === undefined ? {} : { doNotZalo: dto.doNotZalo }),
    ...(dto.consent === undefined ? {} : {
      consent: {
        current: { ...dto.consent.current },
        ledger: dto.consent.ledger.map((entry) => ({
          id: entry.id,
          channel: entry.channel,
          decision: entry.decision,
          source: entry.source,
          occurredAt: entry.occurredAt,
          ...(entry.actorId === undefined ? {} : { actorId: entry.actorId }),
          ...(entry.evidence === undefined ? {} : { evidence: entry.evidence }),
          ...(entry.expiresAt === undefined ? {} : { expiresAt: entry.expiresAt }),
        })),
        ...(dto.consent.lawfulBasis === undefined ? {} : { lawfulBasis: dto.consent.lawfulBasis }),
        updatedAt: dto.consent.updatedAt,
      },
    }),
    ...(dto.companySize === undefined ? {} : { companySize: dto.companySize }),
    ...(dto.industry === undefined ? {} : { industry: dto.industry }),
    ...(dto.businessType === undefined ? {} : { businessType: dto.businessType }),
    ...(dto.website === undefined ? {} : { website: dto.website }),
    ...(dto.taxCode === undefined ? {} : { taxCode: dto.taxCode }),
    ...(dto.companyAddress === undefined ? {} : { companyAddress: dto.companyAddress }),
    ...(dto.country === undefined ? {} : { country: dto.country }),
    ...(dto.province === undefined ? {} : { province: dto.province }),
    ...(dto.district === undefined ? {} : { district: dto.district }),
    ...(dto.ward === undefined ? {} : { ward: dto.ward }),
    ...(dto.contactAddress === undefined ? {} : { contactAddress: dto.contactAddress, address: dto.contactAddress }),
    ...(dto.campaignId === undefined ? {} : { campaignId: dto.campaignId }),
    ...(dto.assignedTeam === undefined ? {} : { assignedTeam: dto.assignedTeam }),
    ...(dto.decisionRole === undefined ? {} : { decisionRole: dto.decisionRole }),
    ...(dto.budgetRange === undefined ? {} : { budgetRange: dto.budgetRange }),
    ...(dto.purchaseTimeline === undefined ? {} : { purchaseTimeline: dto.purchaseTimeline }),
    ...(dto.painPoint === undefined ? {} : { painPoint: dto.painPoint }),
    ...(dto.followUpNote === undefined ? {} : { followUpNote: dto.followUpNote }),
    ...(dto.description === undefined ? {} : { description: dto.description }),
    ...(dto.internalNotes === undefined ? {} : { internalNotes: dto.internalNotes }),
    ...(dto.notes === undefined ? {} : { notes: dto.notes }),
    ...(dto.priority === undefined ? {} : { priority: dto.priority }),
    ...(dto.tags === undefined ? {} : { tags: dto.tags }),
    ...(dto.customFields === undefined ? {} : { customFields: mapCustomFieldsToApplication(dto.customFields) }),
    ...(dto.duplicateResolution === undefined ? {} : {
      duplicateResolution: {
        status: dto.duplicateResolution.status,
        candidateLeadIds: [...dto.duplicateResolution.candidateLeadIds],
        matchedOn: [...dto.duplicateResolution.matchedOn],
        ...(dto.duplicateResolution.reviewedAt === undefined ? {} : { reviewedAt: dto.duplicateResolution.reviewedAt }),
        ...(dto.duplicateResolution.reviewedBy === undefined ? {} : { reviewedBy: dto.duplicateResolution.reviewedBy }),
        ...(dto.duplicateResolution.reason === undefined ? {} : { reason: dto.duplicateResolution.reason }),
        ...(dto.duplicateResolution.survivorLeadId === undefined ? {} : { survivorLeadId: dto.duplicateResolution.survivorLeadId }),
      },
    }),
    ...(dto.distinctFromLeadIds === undefined ? {} : { distinctFromLeadIds: [...dto.distinctFromLeadIds] }),
    ...(dto.mergedLeadIds === undefined ? {} : { mergedLeadIds: [...dto.mergedLeadIds] }),
    ...(dto.mergedIntoLeadId === undefined ? {} : { mergedIntoLeadId: dto.mergedIntoLeadId }),
    ...(dto.archivedAt === undefined ? {} : { archivedAt: dto.archivedAt }),
    ...(dto.archiveReason === undefined ? {} : { archiveReason: dto.archiveReason }),
    ...(dto.anonymizedAt === undefined ? {} : { anonymizedAt: dto.anonymizedAt }),
    ...(dto.anonymizationReason === undefined ? {} : { anonymizationReason: dto.anonymizationReason }),
    ...(dto.disqualifiedAt === undefined ? {} : { disqualifiedAt: dto.disqualifiedAt }),
    ...(dto.disqualifiedBy === undefined ? {} : { disqualifiedBy: dto.disqualifiedBy }),
    ...(dto.disqualificationReason === undefined ? {} : { disqualificationReason: dto.disqualificationReason }),
    ...(dto.disqualificationNote === undefined ? {} : { disqualificationNote: dto.disqualificationNote }),
    ...(dto.estimatedValue === undefined ? {} : {
      expectedValue: moneyToDisplayNumber(dto.estimatedValue),
      estimatedValue: dto.estimatedValue,
    }),
    resourceVersion: dto.version,
    activities: [],
    activitiesAuthority: "NOT_INCLUDED",
  };
}

export function mapCreateLeadInputToRequest(input: LeadProfileInput): CreateLeadRequest {
  return mapLeadProfileInputToRequest(input, "createLead", false, true) as CreateLeadRequest;
}

export function mapReplaceLeadProfileInputToRequest(input: LeadProfileInput): ReplaceLeadProfileRequest {
  return mapLeadProfileInputToRequest(input, "replaceLeadProfile", true, false) as ReplaceLeadProfileRequest;
}

function mapLeadProfileInputToRequest(
  input: LeadProfileInput,
  operationId: string,
  includeOwner: boolean,
  requireContactChannel: boolean,
): CreateLeadRequest | ReplaceLeadProfileRequest {
  const displayName = input.displayName.trim();
  const source = text(input.source);
  const ownerId = text(input.ownerId);
  const currency = input.estimatedValue?.currency.trim().toUpperCase();
  if (!displayName) throw requestViolation(operationId, "displayName", "Lead displayName is required.");
  if (requireContactChannel && ![input.phone, input.workPhone, input.otherPhone, input.email, input.personalEmail, input.zaloId, input.facebook].some((value) => text(value))) {
    throw requestViolation(operationId, "contactChannel", "Lead requires at least one contact channel.");
  }
  if (includeOwner && !ownerId) throw requestViolation(operationId, "ownerId", "Lead ownerId is required when replacing a profile.");
  if (input.estimatedValue !== undefined && !currency) {
    throw requestViolation(operationId, "estimatedValue.currency", "Lead estimatedValue currency is required when a value is supplied.");
  }
  return compact({
    displayName,
    salutation: text(input.salutation),
    title: text(input.title),
    department: text(input.department),
    phone: text(input.phone),
    workPhone: text(input.workPhone),
    otherPhone: text(input.otherPhone),
    email: text(input.email),
    personalEmail: text(input.personalEmail),
    zaloId: text(input.zaloId),
    facebook: text(input.facebook),
    preferredChannel: input.preferredChannel,
    doNotCall: input.doNotCall,
    doNotEmail: input.doNotEmail,
    companyName: text(input.companyName),
    companySize: text(input.companySize),
    industry: text(input.industry),
    businessType: text(input.businessType),
    website: text(input.website),
    taxCode: text(input.taxCode),
    companyAddress: text(input.companyAddress),
    country: text(input.country),
    province: text(input.province),
    district: text(input.district),
    ward: text(input.ward),
    contactAddress: text(input.contactAddress),
    source,
    campaignId: text(input.campaignId),
    ownerId: includeOwner ? ownerId : undefined,
    assignedTeam: text(input.assignedTeam),
    decisionRole: text(input.decisionRole),
    priority: input.priority,
    interestedProducts: input.interestedProducts?.map((item) => mapInterestedProduct(item, currency)),
    estimatedValue: input.estimatedValue === undefined
      ? undefined
      : { amount: normalizeDecimal(input.estimatedValue.amount), currency: currency! },
    budgetRange: text(input.budgetRange),
    purchaseTimeline: text(input.purchaseTimeline),
    painPoint: text(input.painPoint),
    nextFollowUpAt: text(input.nextFollowUpAt),
    followUpNote: text(input.followUpNote),
    tags: input.tags?.map((tag) => tag.trim()).filter(Boolean),
    description: text(input.description),
    internalNotes: text(input.internalNotes),
    customFields: input.customFields === undefined ? undefined : mapCustomFieldsToRequest(input.customFields),
  });
}

function mapInterestedProduct(
  item: LeadProfileInput["interestedProducts"] extends readonly (infer T)[] | undefined ? T : never,
  profileCurrency?: string,
): LeadInterestedProductInput {
  const productId = item.productId.trim();
  if (!productId) throw requestViolation("leadProfile", "interestedProducts.productId", "Lead interested product requires productId.");
  const expectedBudgetCurrency = item.expectedBudget?.currency.trim().toUpperCase() || profileCurrency;
  if (item.expectedBudget !== undefined && !expectedBudgetCurrency) {
    throw requestViolation("leadProfile", "interestedProducts.expectedBudget.currency", "Expected budget currency is required.");
  }
  return compact({
    productId,
    interestLevel: item.interestLevel,
    estimatedQuantity: item.estimatedQuantity,
    expectedBudget: item.expectedBudget === undefined ? undefined : {
      amount: normalizeDecimal(item.expectedBudget.amount),
      currency: expectedBudgetCurrency!,
    },
    note: text(item.note),
  });
}

function mapCustomFieldsToRequest(
  fields: Readonly<Record<string, string | number | boolean | readonly string[]>>,
): LeadCustomFieldValue[] {
  return Object.entries(fields).sort(([left], [right]) => left.localeCompare(right)).map(([fieldKey, value]) => {
    if (typeof value === "string") return { fieldKey, valueType: "STRING", stringValue: value };
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw requestViolation("leadProfile", `customFields.${fieldKey}`, "Custom numeric value must be finite.");
      return { fieldKey, valueType: "DECIMAL", decimalValue: normalizeDecimal(String(value)) };
    }
    if (typeof value === "boolean") return { fieldKey, valueType: "BOOLEAN", booleanValue: value };
    return { fieldKey, valueType: "STRING_ARRAY", stringArrayValue: [...value] };
  });
}

function mapCustomFieldsToApplication(fields: readonly LeadCustomFieldValue[]): Record<string, string | number | boolean | string[]> {
  return Object.fromEntries(fields.map((field) => {
    switch (field.valueType) {
      case "STRING": return [field.fieldKey, field.stringValue ?? ""];
      case "DECIMAL": return [field.fieldKey, Number(field.decimalValue ?? "0")];
      case "BOOLEAN": return [field.fieldKey, field.booleanValue ?? false];
      case "STRING_ARRAY": return [field.fieldKey, [...(field.stringArrayValue ?? [])]];
    }
  }));
}

function text(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

function requestViolation(operationId: string, field: string, message: string): ApiClientError {
  return new ApiClientError({
    code: "CONNECTED_CONTRACT_VIOLATION",
    message,
    retryable: false,
    details: { operationId, field, authority: "docs/api/openapi.json" },
  });
}

function projectionViolation(operationId: string, message: string): ApiClientError {
  return new ApiClientError({
    code: "CONNECTED_QUERY_CONTRACT_VIOLATION",
    message,
    retryable: false,
    details: { operationId, authority: "docs/api/openapi.json" },
  });
}
