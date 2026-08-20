import type { Capability } from "@/platform/access-control";

export type PilotActorRole =
  | "SALES"
  | "SALES_MANAGER"
  | "FINANCE"
  | "OPERATIONS"
  | "WORKSPACE_ADMIN"
  | "PRODUCT_ENGINEERING";

export type PilotStepId =
  | "lead-ingress"
  | "owner-and-sla"
  | "customer-conversion"
  | "deal-pipeline"
  | "quote-approval"
  | "order-creation"
  | "payment-reconciliation"
  | "shipping-delivery"
  | "return-resolution"
  | "support-and-reconciliation";

export type PilotCheckStatus = "PASS" | "FAIL" | "BLOCKED" | "NEEDS_EVIDENCE";
export type PilotOverallStatus = "READY_FOR_BROWSER_PILOT" | "NEEDS_ACTION" | "BLOCKED";

export interface LocalizedPilotText {
  vi: string;
  en: string;
}

export interface PilotStepDefinition {
  id: PilotStepId;
  sequence: number;
  title: LocalizedPilotText;
  purpose: LocalizedPilotText;
  actorRoles: PilotActorRole[];
  routeKey: string;
  requiredCapabilities: Capability[];
  manualEvidenceRequired: boolean;
  expectedEvidence: LocalizedPilotText[];
}

export interface PilotMetricDefinition {
  id:
    | "lead-create-duration"
    | "deal-create-duration"
    | "form-abandonment-rate"
    | "missing-owner-next-step-rate"
    | "lead-sla-rate"
    | "outside-crm-action-count"
    | "dashboard-report-reconciliation-delta"
    | "order-operations-quality-rate";
  label: LocalizedPilotText;
  unit: "milliseconds" | "rate" | "count" | "currency-delta";
  lowerIsBetter: boolean;
  target?: number;
  evidenceOwner: LocalizedPilotText;
}

export interface PilotIngressEvidence {
  channel: "manual" | "import" | "webhook";
  leadId: string;
  dedupeKey: string;
  result: "CREATED" | "MATCHED_EXISTING";
  integrationId?: string;
  attempts?: number;
  retryLogged?: boolean;
}

export interface PilotLeadEvidence {
  id: string;
  workspaceId: string;
  ownerId: string;
  relationshipKey?: string;
  convertedContactId?: string;
  convertedOrganizationId?: string;
  nextFollowUpAt?: string;
  firstResponseAt?: string;
  source: string;
}

export interface PilotContactEvidence {
  id: string;
  workspaceId: string;
  ownerId?: string;
  relationshipKey: string;
  organizationId?: string;
  convertedFromLeadId?: string;
}

export interface PilotOrganizationEvidence {
  id: string;
  workspaceId: string;
  ownerId?: string;
  relationshipKey: string;
  primaryContactId?: string;
  convertedFromLeadId?: string;
}

export interface PilotDealEvidence {
  id: string;
  workspaceId: string;
  ownerId: string;
  relationshipKey: string;
  leadId?: string;
  stage: string;
  expectedCloseDate?: string;
  nextActionAt?: string;
  nextActionSummary?: string;
}

export interface PilotQuoteEvidence {
  id: string;
  workspaceId: string;
  relationshipKey: string;
  dealId?: string;
  status: string;
  approvalStatus?: string;
  approvalRequired?: boolean;
  approvedAt?: string;
  discountTotal: number;
  grandTotal: number;
}

export interface PilotOrderEvidence {
  id: string;
  workspaceId: string;
  relationshipKey: string;
  sourceQuoteId?: string;
  sourceDealId?: string;
  state: string;
  grandTotal: number;
}

export interface PilotPaymentEvidence {
  id: string;
  workspaceId: string;
  orderId: string;
  relationshipKey: string;
  kind: "OBLIGATION" | "PAYMENT" | "REFUND";
  status: string;
  amount: number;
  reconciliationState?: string;
}

export interface PilotShippingEvidence {
  id: string;
  workspaceId: string;
  sourceType: "ORDER" | "RETURN";
  sourceId: string;
  purpose: string;
  bookingStatus: string;
  externalStatus: string;
  deliveredAt?: string;
  attempts: number;
}

export interface PilotReturnEvidence {
  id: string;
  workspaceId: string;
  orderId: string;
  relationshipKey: string;
  status: string;
  receivedAt?: string;
  resolutionType?: string;
  resolutionEvidenceId?: string;
}

export interface PilotSupportEvidence {
  id: string;
  workspaceId: string;
  relationshipKey?: string;
  orderId?: string;
  ownerId?: string;
  status: string;
  firstResponseDueAt?: string;
  firstRespondedAt?: string;
  taskIds: string[];
}

export interface PilotTaskEvidence {
  id: string;
  workspaceId: string;
  assigneeId: string;
  status: string;
  recordId?: string;
  relationshipKey?: string;
}

export interface PilotOwnershipAuditEvidence {
  recordId: string;
  action: "CREATED" | "REASSIGNED";
  nextOwnerId: string;
  reason: string;
}

export interface PilotIntegrationEvidence {
  connectorId: string;
  providerKind: "DEVELOPMENT" | "EXTERNAL_PROVIDER";
  authenticated: boolean;
  idempotencyVerified: boolean;
  retryVerified: boolean;
  reconciliationVerified: boolean;
  lastSuccessAt?: string;
}

export interface PilotMetricObservation {
  metricId: PilotMetricDefinition["id"];
  value: number;
  observedAt: string;
  actorRole?: PilotActorRole;
  dimensions?: Record<string, string>;
  note?: string;
}

export interface PilotAcceptanceDataset {
  workspaceId: string;
  salesMemberIds: string[];
  managerMemberIds: string[];
  financeMemberIds: string[];
  operationsMemberIds: string[];
  adminMemberIds: string[];
  ingress: PilotIngressEvidence[];
  leads: PilotLeadEvidence[];
  contacts: PilotContactEvidence[];
  organizations: PilotOrganizationEvidence[];
  deals: PilotDealEvidence[];
  quotes: PilotQuoteEvidence[];
  orders: PilotOrderEvidence[];
  payments: PilotPaymentEvidence[];
  shipping: PilotShippingEvidence[];
  returns: PilotReturnEvidence[];
  support: PilotSupportEvidence[];
  tasks: PilotTaskEvidence[];
  ownershipAudit: PilotOwnershipAuditEvidence[];
  relationshipBlockingIssues: number;
  relationshipWarnings: number;
  dashboardReportDelta: number;
  guidanceCoverageVerified: boolean;
  roleScopeVerified: boolean;
  auditLedgerVerified: boolean;
  integrationEvidence: PilotIntegrationEvidence[];
  metricObservations: PilotMetricObservation[];
}

export interface PilotCheckResult {
  id: string;
  status: PilotCheckStatus;
  summary: LocalizedPilotText;
  details?: LocalizedPilotText;
  recordIds?: string[];
}

export interface PilotStepResult {
  definition: PilotStepDefinition;
  status: PilotCheckStatus;
  checks: PilotCheckResult[];
}

export interface PilotAcceptanceResult {
  workspaceId: string;
  evaluatedAt: string;
  overallStatus: PilotOverallStatus;
  steps: PilotStepResult[];
  passedSteps: number;
  failedSteps: number;
  blockedSteps: number;
  needsEvidenceSteps: number;
  blockers: LocalizedPilotText[];
  metricCoverage: Array<{
    definition: PilotMetricDefinition;
    observations: PilotMetricObservation[];
  }>;
}

export interface PilotManualEvidence {
  stepId: PilotStepId;
  status: "PASS" | "FAIL";
  note: string;
  actorId: string;
  actorRole: PilotActorRole;
  occurredAt: string;
}

export interface PilotAcceptanceWorkspaceState {
  version: 1;
  workspaceId: string;
  manualEvidence: PilotManualEvidence[];
  metricObservations: PilotMetricObservation[];
  lastRun?: PilotAcceptanceResult;
}
