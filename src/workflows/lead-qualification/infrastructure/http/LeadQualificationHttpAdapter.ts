import type {
  CommercialApiClient,
  LeadQualificationRelationshipRequest,
  LeadQualificationWorkflowResponse,
  QualifyLeadDirectSaleRequest,
  QualifyLeadNurtureRequest,
  QualifyLeadOpportunityRequest,
} from "@/platform/api/generated/commercialApi";
import { ApiClientError } from "@/platform/api/errors";
import { normalizeDecimal } from "@/shared/money";
import type {
  LeadQualificationApiResult,
  LeadQualificationCommandOptions,
  LeadQualificationCommandPort,
} from "../../application/ports/LeadQualificationApiRuntime";
import type {
  ExecuteLeadDirectSaleCommand,
  ExecuteLeadNurtureCommand,
  ExecuteLeadOpportunityCommand,
  LeadRelationshipInput,
} from "../../domain/leadQualification.types";

export class LeadQualificationHttpAdapter implements LeadQualificationCommandPort {
  constructor(private readonly api: CommercialApiClient) {}

  async qualifyForNurture(
    command: ExecuteLeadNurtureCommand,
    options: LeadQualificationCommandOptions,
  ): Promise<LeadQualificationApiResult> {
    const leadId = requireLeadId("qualifyLeadForNurture", command.leadId);
    const reason = command.reason.trim();
    const revisitAt = requireUtcDateTime("qualifyLeadForNurture", "revisitAt", command.revisitAt);
    if (!reason) throw contractViolation("qualifyLeadForNurture", "reason", "NURTURE qualification requires a reason.");
    const body: QualifyLeadNurtureRequest = compact({
      relationship: mapRelationship(command.relationship, "qualifyLeadForNurture"),
      revisitAt,
      reason,
      note: text(command.note),
      ownerId: text(command.ownerId),
    });
    const response = await this.api.qualifyLeadForNurture<LeadQualificationWorkflowResponse, QualifyLeadNurtureRequest>(
      leadId,
      body,
      requestOptions("qualifyLeadForNurture", options),
    );
    return mapAuthoritativeWorkflowResponse("qualifyLeadForNurture", leadId, "NURTURE", response);
  }

  async qualifyForOpportunity(
    command: ExecuteLeadOpportunityCommand,
    options: LeadQualificationCommandOptions,
  ): Promise<LeadQualificationApiResult> {
    const leadId = requireLeadId("qualifyLeadForOpportunity", command.leadId);
    const normalizedCurrency = requireCurrency("qualifyLeadForOpportunity", command.currency);
    const dealName = command.deal.name.trim();
    const ownerId = command.deal.ownerId.trim();
    if (!dealName) throw contractViolation("qualifyLeadForOpportunity", "deal.name", "Opportunity qualification requires a Deal name.");
    if (!ownerId) throw contractViolation("qualifyLeadForOpportunity", "deal.ownerId", "Opportunity qualification requires a Deal owner.");
    const interestedProductIds = [...new Set(command.deal.interestedProductIds.map((value) => value.trim()).filter(Boolean))];
    if (!command.deal.needSummary?.trim() && interestedProductIds.length === 0) {
      throw contractViolation(
        "qualifyLeadForOpportunity",
        "deal.needSummary/interestedProductIds",
        "Opportunity qualification requires either a need summary or at least one interested product.",
      );
    }
    const body: QualifyLeadOpportunityRequest = compact({
      relationship: mapRelationship(command.relationship, "qualifyLeadForOpportunity"),
      deal: compact({
        name: dealName,
        needSummary: text(command.deal.needSummary),
        ownerId,
        expectedCloseDate: dateOnly(command.deal.expectedCloseDate, "qualifyLeadForOpportunity", "deal.expectedCloseDate"),
        interestedProductIds,
        estimatedValue: command.deal.estimatedValue === undefined ? undefined : {
          amount: normalizeNonNegativeDecimal("qualifyLeadForOpportunity", "deal.estimatedValue", command.deal.estimatedValue),
          currency: normalizedCurrency,
        },
        decisionProcess: text(command.deal.decisionProcess),
        buyingWindow: text(command.deal.buyingWindow),
        followUpTask: command.deal.followUpTask === undefined ? undefined : compact({
          title: requiredText("qualifyLeadForOpportunity", "deal.followUpTask.title", command.deal.followUpTask.title),
          dueAt: requireUtcDateTime("qualifyLeadForOpportunity", "deal.followUpTask.dueAt", command.deal.followUpTask.dueAt),
          description: text(command.deal.followUpTask.description),
        }),
      }),
    });
    const response = await this.api.qualifyLeadForOpportunity<LeadQualificationWorkflowResponse, QualifyLeadOpportunityRequest>(
      leadId,
      body,
      requestOptions("qualifyLeadForOpportunity", options),
    );
    return mapAuthoritativeWorkflowResponse("qualifyLeadForOpportunity", leadId, "OPPORTUNITY", response);
  }

  async qualifyForDirectSale(
    command: ExecuteLeadDirectSaleCommand,
    options: LeadQualificationCommandOptions,
  ): Promise<LeadQualificationApiResult> {
    const leadId = requireLeadId("qualifyLeadForDirectSale", command.leadId);
    const normalizedCurrency = requireCurrency("qualifyLeadForDirectSale", command.currency);
    if (command.lineItems.length === 0) {
      throw contractViolation("qualifyLeadForDirectSale", "lineItems", "Direct Sale qualification requires at least one line item.");
    }
    const body: QualifyLeadDirectSaleRequest = compact({
      relationship: mapRelationship(command.relationship, "qualifyLeadForDirectSale"),
      path: command.path,
      title: text(command.title),
      ownerId: text(command.ownerId),
      lineItems: command.lineItems.map((item, index) => {
        const productId = requiredText("qualifyLeadForDirectSale", `lineItems[${index}].productId`, item.productId);
        const name = requiredText("qualifyLeadForDirectSale", `lineItems[${index}].name`, item.name);
        return compact({
          productId,
          name,
          sku: text(item.sku),
          productType: text(item.productType),
          description: text(item.description),
          quantity: normalizePositiveDecimal("qualifyLeadForDirectSale", `lineItems[${index}].quantity`, item.quantity),
          unitPrice: {
            amount: normalizeNonNegativeDecimal("qualifyLeadForDirectSale", `lineItems[${index}].unitPrice`, item.unitPrice),
            currency: normalizedCurrency,
          },
          taxRate: item.taxRate === undefined ? undefined : normalizeNonNegativeDecimal("qualifyLeadForDirectSale", `lineItems[${index}].taxRate`, item.taxRate),
          taxMode: item.taxMode,
          billingCycle: text(item.billingCycle),
        });
      }),
    });
    const response = await this.api.qualifyLeadForDirectSale<LeadQualificationWorkflowResponse, QualifyLeadDirectSaleRequest>(
      leadId,
      body,
      requestOptions("qualifyLeadForDirectSale", options),
    );
    return mapAuthoritativeWorkflowResponse("qualifyLeadForDirectSale", leadId, "DIRECT_SALE", response);
  }
}

function mapRelationship(
  input: LeadRelationshipInput,
  operationId: string,
): LeadQualificationRelationshipRequest {
  const contactName = input.contact.name.trim();
  if (input.mode === "EXISTING") {
    const selectedId = requiredText(operationId, "relationship.selectedId", input.selectedId ?? "");
    return compact({
      kind: input.kind,
      mode: input.mode,
      selectedId,
      contact: compact({
        displayName: contactName,
        email: text(input.contact.email),
        phone: text(input.contact.phone),
        title: text(input.contact.title),
      }),
    });
  }
  if (!contactName) throw contractViolation(operationId, "relationship.contact.displayName", "A new relationship requires a contact display name.");
  const organization = input.organization;
  if (input.kind === "ORGANIZATION_ACCOUNT" && !organization?.displayName.trim()) {
    throw contractViolation(operationId, "relationship.organization.displayName", "A new Organization Account relationship requires a display name.");
  }
  return compact({
    kind: input.kind,
    mode: input.mode,
    contact: compact({
      displayName: contactName,
      email: text(input.contact.email),
      phone: text(input.contact.phone),
      title: text(input.contact.title),
    }),
    organization: input.kind !== "ORGANIZATION_ACCOUNT" || organization === undefined ? undefined : compact({
      displayName: requiredText(operationId, "relationship.organization.displayName", organization.displayName),
      legalName: text(organization.legalName),
      taxCode: text(organization.taxCode),
      domain: text(organization.domain),
      phone: text(organization.phone),
      email: text(organization.email),
      address: text(organization.address),
      industry: text(organization.industry),
    }),
  });
}

function requestOptions(operationId: string, options: LeadQualificationCommandOptions) {
  const idempotencyKey = options.idempotencyKey.trim();
  if (!idempotencyKey) throw contractViolation(operationId, "idempotencyKey", `${operationId} requires Idempotency-Key.`);
  if (!Number.isInteger(options.expectedVersion) || options.expectedVersion < 1) {
    throw contractViolation(operationId, "expectedVersion", `${operationId} requires a positive integer If-Match resource version.`);
  }
  return {
    idempotencyKey,
    expectedVersion: options.expectedVersion,
    ...(options.signal === undefined ? {} : { signal: options.signal }),
    retry: "idempotent" as const,
  };
}

function mapAuthoritativeWorkflowResponse(
  operationId: string,
  leadId: string,
  qualificationOutcome: "NURTURE" | "OPPORTUNITY" | "DIRECT_SALE",
  response: LeadQualificationWorkflowResponse,
): LeadQualificationApiResult {
  assertAuthoritativeResponse(operationId, response);
  if (response.aggregateId !== leadId || response.result.leadId !== leadId) {
    throw contractViolation(operationId, "aggregateId", `${operationId} must return the requested Lead aggregate.`);
  }
  if (response.version !== response.result.leadVersion) {
    throw contractViolation(operationId, "version", `${operationId} response version must match result.leadVersion.`);
  }
  if (response.result.qualificationOutcome !== qualificationOutcome) {
    throw contractViolation(operationId, "qualificationOutcome", `${operationId} returned an unexpected qualification outcome.`);
  }
  const relationshipRef = response.result.relationship.relationshipRef;
  return {
    result: compact({
      leadId,
      relationshipRef,
      contactId: response.result.contactId,
      organizationAccountId: response.result.organizationAccountId,
      taskId: response.result.taskId,
      dealId: response.result.dealId,
      quoteId: response.result.quoteId,
      orderId: response.result.orderId,
    }),
    createdResources: response.result.createdResources.map((resource) => ({ ...resource })),
    evidence: {
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
    },
  };
}

function assertAuthoritativeResponse(operationId: string, response: LeadQualificationWorkflowResponse): void {
  if (!response || typeof response !== "object") throw contractViolation(operationId, "response", `${operationId} response must be an object.`);
  for (const field of ["commandId", "correlationId", "aggregateId", "aggregateType", "occurredAt"] as const) {
    if (typeof response[field] !== "string" || !response[field].trim()) {
      throw contractViolation(operationId, field, `${operationId} response is missing authoritative ${field}.`);
    }
  }
  if (!Number.isInteger(response.version) || response.version < 1) throw contractViolation(operationId, "version", `${operationId} response version must be a positive integer.`);
  if (response.outcome !== "COMMITTED" && response.outcome !== "REPLAYED") throw contractViolation(operationId, "outcome", `${operationId} response outcome must be COMMITTED or REPLAYED.`);
  if (!response.occurredAt.endsWith("Z") || !Number.isFinite(Date.parse(response.occurredAt))) throw contractViolation(operationId, "occurredAt", `${operationId} response occurredAt must be UTC.`);
  if (!response.result || typeof response.result !== "object") throw contractViolation(operationId, "result", `${operationId} response is missing its result.`);
  if (!Array.isArray(response.result.createdResources)) throw contractViolation(operationId, "createdResources", `${operationId} response must declare createdResources.`);
  for (const resource of response.result.createdResources) {
    if (!resource.resourceId?.trim() || !Number.isInteger(resource.resourceVersion) || resource.resourceVersion < 1) {
      throw contractViolation(operationId, "createdResources", `${operationId} returned invalid downstream resource evidence.`);
    }
  }
}

function requireLeadId(operationId: string, value: string): string {
  return requiredText(operationId, "leadId", value);
}

function requiredText(operationId: string, field: string, value: string): string {
  const normalized = value.trim();
  if (!normalized) throw contractViolation(operationId, field, `${field} is required.`);
  return normalized;
}

function requireCurrency(operationId: string, value: string): string {
  const currency = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/u.test(currency)) throw contractViolation(operationId, "currency", `${operationId} requires a three-letter workspace currency.`);
  return currency;
}

function requireUtcDateTime(operationId: string, field: string, value: string): string {
  const candidate = value.trim();
  const parsed = new Date(candidate);
  if (!candidate || Number.isNaN(parsed.getTime())) throw contractViolation(operationId, field, `${field} must be a valid date-time.`);
  return parsed.toISOString();
}

function dateOnly(value: string | undefined, operationId: string, field: string): string | undefined {
  const candidate = value?.trim();
  if (!candidate) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(candidate) || Number.isNaN(Date.parse(`${candidate}T00:00:00.000Z`))) {
    throw contractViolation(operationId, field, `${field} must be a valid business date.`);
  }
  return candidate;
}

function normalizePositiveDecimal(operationId: string, field: string, value: number): string {
  if (!Number.isFinite(value) || value <= 0) throw contractViolation(operationId, field, `${field} must be greater than zero.`);
  return normalizeDecimal(String(value));
}

function normalizeNonNegativeDecimal(operationId: string, field: string, value: number): string {
  if (!Number.isFinite(value) || value < 0) throw contractViolation(operationId, field, `${field} must be non-negative.`);
  return normalizeDecimal(String(value));
}

function text(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

function contractViolation(operationId: string, field: string, message: string): ApiClientError {
  return new ApiClientError({
    code: "CONNECTED_CONTRACT_VIOLATION",
    message,
    retryable: false,
    details: { operationId, field, authority: "docs/api/openapi.json" },
  });
}
