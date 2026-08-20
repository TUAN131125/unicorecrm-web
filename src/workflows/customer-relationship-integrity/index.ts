import { getContactsSnapshot } from "@/modules/contacts";
import { getCustomersSnapshot } from "@/modules/customers";
import { getDealsSnapshot } from "@/modules/deals";
import { getOrderListSnapshot } from "@/modules/orders";
import { getOrganizationAccountsSnapshot } from "@/modules/organizations";
import { getPaymentObligationsSnapshot, getPaymentsSnapshot } from "@/modules/payments";
import { getQuotesSnapshot } from "@/modules/quotes";
import { getReturnsSnapshot } from "@/modules/returns";
import { getShippingSnapshot } from "@/modules/shipping";
import { getSupportCasesSnapshot } from "@/modules/support";
import { getTaskActivitySnapshot } from "@/modules/tasks";
import { auditRelationshipIntegrity, type RelationshipIntegritySummary } from "@/platform/relationship-integrity";
import { getWorkspaceContextSnapshot } from "@/platform/workspace-context";

export function buildCurrentRelationshipIntegritySummary(): RelationshipIntegritySummary {
  const payments = getPaymentsSnapshot();
  const returns = getReturnsSnapshot();
  const work = getTaskActivitySnapshot();
  return auditRelationshipIntegrity({
    workspaceId: getWorkspaceContextSnapshot().workspaceId,
    contacts: getContactsSnapshot(),
    organizations: getOrganizationAccountsSnapshot(),
    customers: getCustomersSnapshot(),
    deals: getDealsSnapshot(),
    quotes: getQuotesSnapshot(),
    orders: getOrderListSnapshot(),
    paymentObligations: getPaymentObligationsSnapshot(),
    paymentTransactions: payments.transactions,
    shippingBookings: getShippingSnapshot(),
    returns: returns.requests,
    supportCases: getSupportCasesSnapshot(),
    tasks: work.tasks,
    activities: work.activities,
  });
}

export function getRelationshipIssuesForRecord(
  summary: RelationshipIntegritySummary,
  recordType: string,
  recordId: string,
) {
  return summary.issues.filter((issue) => issue.recordType === recordType && issue.recordId === recordId);
}
