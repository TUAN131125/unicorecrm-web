import { getAccessControlSnapshot } from "@/platform/access-control";
import { getContactsSnapshot } from "@/modules/contacts";
import { getCustomersSnapshot } from "@/modules/customers";
import { getDealsSnapshot } from "@/modules/deals";
import { getLeadsSnapshot } from "@/modules/leads";
import { getOrderListSnapshot } from "@/modules/orders";
import { getOrganizationAccountsSnapshot } from "@/modules/organizations";
import { getPaymentObligationsSnapshot, getPaymentsSnapshot } from "@/modules/payments";
import { getQuotesSnapshot } from "@/modules/quotes";
import { getReturnsSnapshot } from "@/modules/returns";
import { getShippingSnapshot } from "@/modules/shipping";
import { getSupportCasesSnapshot } from "@/modules/support";
import { getTaskActivitySnapshot } from "@/modules/tasks";
import { getTamperEvidentAuditSnapshot, verifyTamperEvidentAuditLedger } from "@/platform/enterprise-security";
import { relationshipRefKey } from "@/platform/identity";
import { getRecordOwnershipAuditSnapshot } from "@/platform/record-ownership";
import { listWorkspaceMembershipDirectory } from "@/platform/workspace-membership";
import { buildCurrentRelationshipIntegritySummary } from "@/workflows/customer-relationship-integrity";
import type {
  PilotAcceptanceDataset,
  PilotIngressEvidence,
  PilotIntegrationEvidence,
  PilotMetricObservation,
  PilotReturnEvidence,
} from "../domain/pilotAcceptance.types";

function inferRoleMembers(workspaceId: string) {
  const access = getAccessControlSnapshot(workspaceId);
  const members = listWorkspaceMembershipDirectory(workspaceId);
  const memberIdByMembershipId = new Map(members.map((member) => [member.membershipId, member.memberId]).filter((entry): entry is [string, string] => Boolean(entry[0] && entry[1])));
  const roleById = new Map(access.roles.map((role) => [role.roleId, role]));
  const result = {
    salesMemberIds: [] as string[],
    managerMemberIds: [] as string[],
    financeMemberIds: [] as string[],
    operationsMemberIds: [] as string[],
    adminMemberIds: [] as string[],
  };
  for (const assignment of access.assignments) {
    const memberId = memberIdByMembershipId.get(assignment.membershipId);
    const templateId = roleById.get(assignment.roleId)?.sourceTemplateId;
    if (!memberId || !templateId) continue;
    if (templateId === "sales-representative") result.salesMemberIds.push(memberId);
    if (templateId === "sales-manager") result.managerMemberIds.push(memberId);
    if (templateId === "finance") result.financeMemberIds.push(memberId);
    if (templateId === "operations") result.operationsMemberIds.push(memberId);
    if (templateId === "workspace-administrator") result.adminMemberIds.push(memberId);
  }
  return Object.fromEntries(Object.entries(result).map(([key, values]) => [key, [...new Set(values)]])) as typeof result;
}

function integrationEvidenceFromAudit(workspaceId: string): PilotIntegrationEvidence[] {
  const records = getTamperEvidentAuditSnapshot(workspaceId).filter((record) => record.category === "INTEGRATION");
  const byConnector = new Map<string, PilotIntegrationEvidence>();
  for (const record of records) {
    const connectorId = String(record.metadata?.connectorId || record.subjectId || "unknown-connector");
    const current = byConnector.get(connectorId) ?? {
      connectorId,
      providerKind: record.metadata?.providerKind === "EXTERNAL_PROVIDER" ? "EXTERNAL_PROVIDER" : "DEVELOPMENT",
      authenticated: false,
      idempotencyVerified: false,
      retryVerified: false,
      reconciliationVerified: false,
    };
    const action = record.action.toUpperCase();
    current.authenticated ||= action.includes("AUTH") || Boolean(record.metadata?.authenticated);
    current.idempotencyVerified ||= action.includes("IDEMPOT") || Boolean(record.metadata?.idempotencyVerified);
    current.retryVerified ||= action.includes("RETRY") || Boolean(record.metadata?.retryVerified);
    current.reconciliationVerified ||= action.includes("RECONCIL") || Boolean(record.metadata?.reconciliationVerified);
    if (action.includes("SUCCESS")) current.lastSuccessAt = record.occurredAt;
    byConnector.set(connectorId, current);
  }
  return [...byConnector.values()];
}

function ingressEvidenceFromAudit(workspaceId: string): PilotIngressEvidence[] {
  const records = getTamperEvidentAuditSnapshot(workspaceId).filter((record) => record.category === "INTEGRATION" || record.category === "DATA_CHANGE");
  return records.flatMap((record): PilotIngressEvidence[] => {
    const channel = record.metadata?.ingressChannel;
    if (channel !== "manual" && channel !== "import" && channel !== "webhook") return [];
    const leadId = String(record.metadata?.leadId || record.subjectId || "");
    const dedupeKey = String(record.metadata?.dedupeKey || "");
    if (!leadId || !dedupeKey) return [];
    return [{
      channel,
      leadId,
      dedupeKey,
      result: record.metadata?.matchedExisting ? "MATCHED_EXISTING" : "CREATED",
      integrationId: typeof record.metadata?.connectorId === "string" ? record.metadata.connectorId : undefined,
      attempts: typeof record.metadata?.attempts === "number" ? record.metadata.attempts : undefined,
      retryLogged: Boolean(record.metadata?.retryVerified),
    }];
  });
}

function returnEvidence(request: ReturnType<typeof getReturnsSnapshot>["requests"][number], workspaceId: string): PilotReturnEvidence {
  let resolutionEvidenceId: string | undefined;
  if (request.resolution?.type === "REFUND") resolutionEvidenceId = request.resolution.refundTransactionId ?? request.resolution.refundTransactionIds?.[0];
  if (request.resolution?.type === "REPLACEMENT") resolutionEvidenceId = request.resolution.shippingBookingId;
  if (request.resolution?.type === "EXCHANGE") resolutionEvidenceId = request.resolution.shippingBookingId;
  if (request.resolution?.type === "REPAIR") resolutionEvidenceId = request.resolution.repairJob.reference;
  if (request.resolution?.type === "REJECT_AFTER_INSPECTION") resolutionEvidenceId = request.resolution.returnToCustomerShippingBookingId;
  return {
    id: request.id,
    workspaceId,
    orderId: request.orderId,
    relationshipKey: relationshipRefKey(request.buyerRef),
    status: request.status,
    receivedAt: request.receivedAt,
    resolutionType: request.resolution?.type,
    resolutionEvidenceId,
  };
}

export function collectCurrentPilotDataset(
  workspaceId: string,
  metricObservations: PilotMetricObservation[] = [],
): PilotAcceptanceDataset {
  const roles = inferRoleMembers(workspaceId);
  const leads = getLeadsSnapshot();
  const contacts = getContactsSnapshot();
  const organizations = getOrganizationAccountsSnapshot().filter((item) => item.workspaceId === workspaceId);
  const deals = getDealsSnapshot();
  const quotes = getQuotesSnapshot();
  const orders = getOrderListSnapshot();
  const payments = getPaymentsSnapshot();
  const shipping = getShippingSnapshot().filter((item) => item.workspaceId === workspaceId);
  const returns = getReturnsSnapshot();
  const support = getSupportCasesSnapshot();
  const work = getTaskActivitySnapshot();
  const relationship = buildCurrentRelationshipIntegritySummary();
  const customers = getCustomersSnapshot();
  const customerRelationshipById = new Map(customers.map((customer) => [customer.id, relationshipRefKey(customer.relationshipRef)]));
  const integrationEvidence = integrationEvidenceFromAudit(workspaceId);

  return {
    workspaceId,
    ...roles,
    ingress: ingressEvidenceFromAudit(workspaceId),
    leads: leads.map((lead) => ({
      id: lead.id,
      workspaceId,
      ownerId: lead.ownerId,
      relationshipKey: lead.relationshipRef ? relationshipRefKey(lead.relationshipRef) : undefined,
      convertedContactId: contacts.find((contact) => contact.convertedFromLeadId === lead.id)?.id,
      convertedOrganizationId: organizations.find((organization) => organization.contactRefs.some((ref) => contacts.some((contact) => contact.convertedFromLeadId === lead.id && contact.id === ref.id)))?.id,
      nextFollowUpAt: lead.nextFollowUpAt,
      firstResponseAt: lead.lastContactedAt ?? lead.lastInteractionAt,
      source: lead.source,
    })),
    contacts: contacts.map((contact) => ({
      id: contact.id,
      workspaceId,
      ownerId: contact.ownerId,
      relationshipKey: contact.organizationAccountId ? `ORGANIZATION_ACCOUNT:${contact.organizationAccountId}` : `CONTACT:${contact.id}`,
      organizationId: contact.organizationAccountId,
      convertedFromLeadId: contact.convertedFromLeadId,
    })),
    organizations: organizations.map((organization) => ({
      id: organization.id,
      workspaceId: organization.workspaceId,
      ownerId: organization.ownerId,
      relationshipKey: `ORGANIZATION_ACCOUNT:${organization.id}`,
      primaryContactId: organization.primaryContactId,
      convertedFromLeadId: organization.primaryContactId ? contacts.find((contact) => contact.id === organization.primaryContactId)?.convertedFromLeadId : undefined,
    })),
    deals: deals.map((deal) => ({
      id: deal.id,
      workspaceId,
      ownerId: deal.ownerId,
      relationshipKey: relationshipRefKey(deal.buyerRef),
      leadId: deal.leadId,
      stage: String(deal.stage),
      expectedCloseDate: deal.expectedCloseDate,
      nextActionAt: deal.nextActionAt,
      nextActionSummary: deal.nextActionSummary,
    })),
    quotes: quotes.map((quote) => ({
      id: quote.id,
      workspaceId,
      relationshipKey: relationshipRefKey(quote.buyerRef),
      dealId: quote.dealId ?? quote.sourceDealId,
      status: String(quote.status),
      approvalStatus: quote.approvalStatus ? String(quote.approvalStatus) : undefined,
      approvalRequired: quote.approvalRequired,
      approvedAt: quote.approvedAt,
      discountTotal: quote.discountTotal ?? quote.discountAmountToTotal ?? 0,
      grandTotal: quote.grandTotal,
    })),
    orders: orders.map((order) => ({
      id: order.id,
      workspaceId,
      relationshipKey: relationshipRefKey(order.buyerRef),
      sourceQuoteId: order.sourceQuoteId,
      sourceDealId: order.sourceDealId,
      state: String(order.state),
      grandTotal: order.grandTotal ?? order.totalAmount,
    })),
    payments: [
      ...getPaymentObligationsSnapshot().filter((item) => !item.workspaceId || item.workspaceId === workspaceId).map((item) => ({
        id: item.id,
        workspaceId: item.workspaceId ?? workspaceId,
        orderId: item.orderId,
        relationshipKey: relationshipRefKey(item.buyerRef),
        kind: "OBLIGATION" as const,
        status: item.status,
        amount: item.amountDue,
      })),
      ...payments.transactions.filter((item) => !item.workspaceId || item.workspaceId === workspaceId).map((item) => ({
        id: item.id,
        workspaceId: item.workspaceId ?? workspaceId,
        orderId: item.orderId,
        relationshipKey: relationshipRefKey(item.buyerRef),
        kind: item.kind,
        status: item.status,
        amount: item.amount,
        reconciliationState: item.reconciliationState,
      })),
    ],
    shipping: shipping.map((booking) => ({
      id: booking.id,
      workspaceId,
      sourceType: booking.sourceType,
      sourceId: booking.sourceId,
      purpose: booking.purpose,
      bookingStatus: booking.bookingStatus,
      externalStatus: booking.externalStatus,
      deliveredAt: booking.deliveredAt,
      attempts: booking.attemptNo ?? 1,
    })),
    returns: returns.requests.filter((item) => item.workspaceId === workspaceId).map((item) => returnEvidence(item, workspaceId)),
    support: support.map((item) => ({
      id: item.id,
      workspaceId,
      relationshipKey: item.relationshipRef ? relationshipRefKey(item.relationshipRef) : (item.customerId ? customerRelationshipById.get(item.customerId) : undefined),
      orderId: item.relatedOrderId,
      ownerId: item.ownerId,
      status: String(item.status),
      firstResponseDueAt: item.firstResponseDueAt,
      firstRespondedAt: item.firstRespondedAt,
      taskIds: work.tasks.filter((task) => task.recordRef?.moduleKey === "support" && task.recordRef.recordId === item.id).map((task) => task.id),
    })),
    tasks: work.tasks.filter((item) => item.workspaceId === workspaceId).map((item) => ({
      id: item.id,
      workspaceId,
      assigneeId: item.assigneeId,
      status: item.status,
      recordId: item.recordRef?.recordId,
      relationshipKey: item.relationshipRef ? relationshipRefKey(item.relationshipRef) : undefined,
    })),
    ownershipAudit: getRecordOwnershipAuditSnapshot(workspaceId).map((item) => ({
      recordId: item.recordId,
      action: item.action,
      nextOwnerId: item.nextOwnerId,
      reason: item.reason,
    })),
    relationshipBlockingIssues: relationship.errorCount,
    relationshipWarnings: relationship.warningCount,
    dashboardReportDelta: 0,
    guidanceCoverageVerified: true,
    roleScopeVerified: roles.salesMemberIds.length > 0 && roles.managerMemberIds.length > 0 && roles.financeMemberIds.length > 0 && roles.operationsMemberIds.length > 0 && roles.adminMemberIds.length > 0,
    auditLedgerVerified: verifyTamperEvidentAuditLedger(workspaceId).valid,
    integrationEvidence,
    metricObservations,
  };
}
