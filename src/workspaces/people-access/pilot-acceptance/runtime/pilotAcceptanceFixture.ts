import type { PilotAcceptanceDataset, PilotManualEvidence } from "../domain/pilotAcceptance.types";

const workspaceId = "pilot-workspace";
const relationshipKey = "ORGANIZATION_ACCOUNT:pilot-organization-001";

export function createPassingPilotAcceptanceFixture(input: { externalProvider?: boolean; manualEvidence?: boolean } = {}): {
  dataset: PilotAcceptanceDataset;
  manualEvidence: PilotManualEvidence[];
} {
  const dataset: PilotAcceptanceDataset = {
    workspaceId,
    salesMemberIds: ["pilot-member-sales-1", "pilot-member-sales-2"],
    managerMemberIds: ["pilot-member-manager"],
    financeMemberIds: ["pilot-member-finance"],
    operationsMemberIds: ["pilot-member-operations"],
    adminMemberIds: ["pilot-member-admin"],
    ingress: [
      { channel: "manual", leadId: "pilot-lead-001", dedupeKey: "pilot@example.invalid", result: "CREATED" },
      { channel: "import", leadId: "pilot-lead-002", dedupeKey: "+84000000001", result: "CREATED" },
      { channel: "webhook", leadId: "pilot-lead-001", dedupeKey: "pilot@example.invalid", result: "MATCHED_EXISTING", integrationId: "pilot-provider", attempts: 2, retryLogged: true },
    ],
    leads: [{ id: "pilot-lead-001", workspaceId, ownerId: "pilot-member-sales-1", relationshipKey, convertedContactId: "pilot-contact-001", convertedOrganizationId: "pilot-organization-001", nextFollowUpAt: "2026-07-13T09:30:00.000Z", firstResponseAt: "2026-07-13T08:30:00.000Z", source: "webhook" }],
    contacts: [{ id: "pilot-contact-001", workspaceId, ownerId: "pilot-member-sales-1", relationshipKey, organizationId: "pilot-organization-001", convertedFromLeadId: "pilot-lead-001" }],
    organizations: [{ id: "pilot-organization-001", workspaceId, ownerId: "pilot-member-sales-1", relationshipKey, primaryContactId: "pilot-contact-001", convertedFromLeadId: "pilot-lead-001" }],
    deals: [{ id: "pilot-deal-001", workspaceId, ownerId: "pilot-member-sales-1", relationshipKey, leadId: "pilot-lead-001", stage: "PROPOSAL", expectedCloseDate: "2026-07-31", nextActionAt: "2026-07-14T09:00:00.000Z", nextActionSummary: "Review accepted proposal" }],
    quotes: [{ id: "pilot-quote-001", workspaceId, relationshipKey, dealId: "pilot-deal-001", status: "ACCEPTED", approvalStatus: "APPROVED", approvalRequired: true, approvedAt: "2026-07-13T10:00:00.000Z", discountTotal: 500000, grandTotal: 10000000 }],
    orders: [{ id: "pilot-order-001", workspaceId, relationshipKey, sourceQuoteId: "pilot-quote-001", sourceDealId: "pilot-deal-001", state: "CONFIRMED", grandTotal: 10000000 }],
    payments: [
      { id: "pilot-obligation-001", workspaceId, orderId: "pilot-order-001", relationshipKey, kind: "OBLIGATION", status: "SETTLED", amount: 10000000 },
      { id: "pilot-payment-001", workspaceId, orderId: "pilot-order-001", relationshipKey, kind: "PAYMENT", status: "SUCCEEDED", amount: 10000000, reconciliationState: "MATCHED" },
      { id: "pilot-refund-001", workspaceId, orderId: "pilot-order-001", relationshipKey, kind: "REFUND", status: "SUCCEEDED", amount: 1000000, reconciliationState: "MATCHED" },
    ],
    shipping: [
      { id: "pilot-shipping-001", workspaceId, sourceType: "ORDER", sourceId: "pilot-order-001", purpose: "ORDER_OUTBOUND", bookingStatus: "BOOKED", externalStatus: "DELIVERED", deliveredAt: "2026-07-15T10:00:00.000Z", attempts: 2 },
    ],
    returns: [{ id: "pilot-return-001", workspaceId, orderId: "pilot-order-001", relationshipKey, status: "RESOLVED", receivedAt: "2026-07-17T08:00:00.000Z", resolutionType: "REFUND", resolutionEvidenceId: "pilot-refund-001" }],
    support: [{ id: "pilot-support-001", workspaceId, relationshipKey, orderId: "pilot-order-001", ownerId: "pilot-member-operations", status: "RESOLVED", firstResponseDueAt: "2026-07-18T09:00:00.000Z", firstRespondedAt: "2026-07-18T08:30:00.000Z", taskIds: ["pilot-task-001"] }],
    tasks: [{ id: "pilot-task-001", workspaceId, assigneeId: "pilot-member-operations", status: "COMPLETED", recordId: "pilot-support-001", relationshipKey }],
    ownershipAudit: [
      { recordId: "pilot-lead-001", action: "CREATED", nextOwnerId: "pilot-member-sales-1", reason: "Created by authenticated Sales member" },
      { recordId: "pilot-deal-001", action: "CREATED", nextOwnerId: "pilot-member-sales-1", reason: "Created from converted Lead" },
    ],
    relationshipBlockingIssues: 0,
    relationshipWarnings: 0,
    dashboardReportDelta: 0,
    guidanceCoverageVerified: true,
    roleScopeVerified: true,
    auditLedgerVerified: true,
    integrationEvidence: [{
      connectorId: "pilot-provider",
      providerKind: input.externalProvider === false ? "DEVELOPMENT" : "EXTERNAL_PROVIDER",
      authenticated: true,
      idempotencyVerified: true,
      retryVerified: true,
      reconciliationVerified: true,
      lastSuccessAt: "2026-07-13T08:00:00.000Z",
    }],
    metricObservations: [
      { metricId: "lead-create-duration", value: 42000, observedAt: "2026-07-13T08:10:00.000Z", actorRole: "SALES" },
      { metricId: "deal-create-duration", value: 55000, observedAt: "2026-07-13T09:10:00.000Z", actorRole: "SALES" },
      { metricId: "form-abandonment-rate", value: 0.08, observedAt: "2026-07-18T12:00:00.000Z" },
      { metricId: "missing-owner-next-step-rate", value: 0, observedAt: "2026-07-18T12:00:00.000Z" },
      { metricId: "lead-sla-rate", value: 1, observedAt: "2026-07-18T12:00:00.000Z" },
      { metricId: "outside-crm-action-count", value: 0, observedAt: "2026-07-18T12:00:00.000Z" },
      { metricId: "dashboard-report-reconciliation-delta", value: 0, observedAt: "2026-07-18T12:00:00.000Z" },
      { metricId: "order-operations-quality-rate", value: 1, observedAt: "2026-07-18T12:00:00.000Z" },
    ],
  };

  const manualEvidence: PilotManualEvidence[] = input.manualEvidence === false ? [] : [
    ["lead-ingress", "SALES"],
    ["owner-and-sla", "SALES_MANAGER"],
    ["customer-conversion", "SALES"],
    ["deal-pipeline", "SALES_MANAGER"],
    ["quote-approval", "SALES_MANAGER"],
    ["order-creation", "SALES"],
    ["payment-reconciliation", "FINANCE"],
    ["shipping-delivery", "OPERATIONS"],
    ["return-resolution", "OPERATIONS"],
    ["support-and-reconciliation", "PRODUCT_ENGINEERING"],
  ].map(([stepId, actorRole], index) => ({
    stepId: stepId as PilotManualEvidence["stepId"],
    status: "PASS" as const,
    note: "Verified in the deterministic pilot fixture.",
    actorId: `fixture-actor-${index + 1}`,
    actorRole: actorRole as PilotManualEvidence["actorRole"],
    occurredAt: `2026-07-18T${String(index + 8).padStart(2, "0")}:00:00.000Z`,
  }));

  return { dataset, manualEvidence };
}
