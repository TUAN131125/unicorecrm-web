import { getPurchaseEvidenceListSnapshot, subscribeToPurchaseEvidence } from "@/modules/commercial-evidence";
import { getContactsSnapshot, subscribeToContacts } from "@/modules/contacts";
import { getCustomersSnapshot, subscribeToCustomerRepository } from "@/modules/customers";
import { getDealsSnapshot, subscribeToDeals } from "@/modules/deals";
import { getShippingSnapshot, subscribeToShipping } from "@/modules/shipping";
import { getLeadsSnapshot, subscribeToLeads } from "@/modules/leads";
import { getOrderListSnapshot, subscribeToOrders } from "@/modules/orders";
import { getOrganizationAccountsSnapshot, subscribeToOrganizationAccounts } from "@/modules/organizations";
import { getPaymentsSnapshot, subscribeToPayments } from "@/modules/payments";
import { getQuotesSnapshot, subscribeToQuotes } from "@/modules/quotes";
import { getSupportCasesSnapshot, subscribeToSupportCases } from "@/modules/support";
import { getTaskActivitySnapshot, subscribeToTaskActivity } from "@/modules/tasks";
import type { RelationshipRef } from "@/platform/identity";
import { buildRelationshipTimeline } from "../read-models/buildRelationshipTimeline";
import type { RelationshipTimelineEvent } from "../read-models/relationshipTimeline.types";

function getSources() {
  return {
    contacts: getContactsSnapshot(),
    customers: getCustomersSnapshot(),
    organizationAccounts: getOrganizationAccountsSnapshot(),
    leads: getLeadsSnapshot(),
    deals: getDealsSnapshot(),
    quotes: getQuotesSnapshot(),
    orders: getOrderListSnapshot(),
    payments: getPaymentsSnapshot(),
    shippingBookings: getShippingSnapshot(),
    evidence: getPurchaseEvidenceListSnapshot(),
    supportCases: getSupportCasesSnapshot(),
    tasks: getTaskActivitySnapshot(),
  };
}

export function getRelationshipTimelineSnapshot(relationshipRef: RelationshipRef): RelationshipTimelineEvent[] {
  return buildRelationshipTimeline(relationshipRef, getSources());
}

export function subscribeToRelationshipTimeline(
  relationshipRef: RelationshipRef,
  listener: (events: RelationshipTimelineEvent[]) => void,
): () => void {
  const notify = () => listener(getRelationshipTimelineSnapshot(relationshipRef));
  const unsubscribers = [
    subscribeToContacts(notify),
    subscribeToCustomerRepository(notify),
    subscribeToOrganizationAccounts(notify),
    subscribeToLeads(notify),
    subscribeToDeals(notify),
    subscribeToQuotes(notify),
    subscribeToOrders(notify),
    subscribeToPayments(notify),
    subscribeToShipping(notify),
    subscribeToPurchaseEvidence(notify),
    subscribeToSupportCases(notify),
    subscribeToTaskActivity(notify),
  ];
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}
