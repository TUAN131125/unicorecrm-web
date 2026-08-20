import { getContactsSnapshot, resolveOrganizationContacts } from "@/modules/contacts";
import { getDealsSnapshot, type Deal } from "@/modules/deals";
import { getLeadsSnapshot, type Lead } from "@/modules/leads";
import { getOrderListSnapshot, type CustomerOrder } from "@/modules/orders";
import { getOrganizationAccountsSnapshot } from "@/modules/organizations";
import { getQuotesSnapshot, type Quote } from "@/modules/quotes";
import { getSupportCasesSnapshot, type SupportCase } from "@/modules/support";
import { getTaskActivitySnapshot, type Activity, type Task } from "@/modules/tasks";
import { relationshipRefKey, type RelationshipRef } from "@/platform/identity";
import type { Customer } from "../../domain/model/customer.types";

export interface CustomerRelationshipGraph {
  relationshipRef: RelationshipRef;
  relationshipKey: string;
  aliases: Set<string>;
  contactIds: Set<string>;
  linkedRecordIds: Set<string>;
  leads: Lead[];
  deals: Deal[];
  quotes: Quote[];
  orders: CustomerOrder[];
  supportCases: SupportCase[];
  tasks: Task[];
  activities: Activity[];
}

export function buildCustomerRelationshipGraph(customer: Customer): CustomerRelationshipGraph {
  const relationshipKey = relationshipRefKey(customer.relationshipRef);
  const aliases = new Set([customer.id, customer.customerCode, ...(customer.legacyAliases ?? [])]);
  const contacts = getContactsSnapshot();
  const organizations = getOrganizationAccountsSnapshot();

  const contactIds = new Set<string>();
  if (customer.relationshipRef.type === "CONTACT") {
    contactIds.add(customer.relationshipRef.id);
  } else {
    const account = organizations.find((item) => item.id === customer.relationshipRef.id);
    for (const contact of resolveOrganizationContacts(customer.relationshipRef.id, contacts, account)) contactIds.add(contact.id);
  }

  const matchesCanonicalRef = (ref?: RelationshipRef): boolean => Boolean(ref && relationshipRefKey(ref) === relationshipKey);
  const matchesLegacyCustomer = (customerId?: string): boolean => Boolean(customerId && aliases.has(customerId));

  const deals = getDealsSnapshot().filter((deal) => matchesCanonicalRef(deal.buyerRef) || matchesLegacyCustomer(deal.customerId));
  const dealIds = new Set(deals.map((deal) => deal.id));

  const quotes = getQuotesSnapshot().filter((quote) =>
    matchesCanonicalRef(quote.buyerRef)
    || matchesLegacyCustomer(quote.customerId)
    || Boolean(quote.dealId && dealIds.has(quote.dealId)),
  );
  const quoteIds = new Set(quotes.map((quote) => quote.id));

  const orders = getOrderListSnapshot().filter((order) =>
    matchesCanonicalRef(order.buyerRef)
    || matchesLegacyCustomer(order.customerId)
    || Boolean(order.sourceDealId && dealIds.has(order.sourceDealId))
    || Boolean(order.sourceQuoteId && quoteIds.has(order.sourceQuoteId)),
  );
  const orderIds = new Set(orders.map((order) => order.id));

  const commercialLeadIds = new Set<string>();
  for (const deal of deals) if (deal.leadId) commercialLeadIds.add(deal.leadId);
  for (const quote of quotes) {
    if (quote.leadId) commercialLeadIds.add(quote.leadId);
    if (quote.sourceLeadId) commercialLeadIds.add(quote.sourceLeadId);
  }
  for (const order of orders) if (order.sourceLeadId) commercialLeadIds.add(order.sourceLeadId);

  const leads = getLeadsSnapshot().filter((lead) =>
    matchesCanonicalRef(lead.relationshipRef)
    || commercialLeadIds.has(lead.id),
  );

  const supportCases = getSupportCasesSnapshot().filter((supportCase) =>
    matchesCanonicalRef(supportCase.relationshipRef)
    || matchesLegacyCustomer(supportCase.customerId)
    || Boolean(supportCase.contactId && contactIds.has(supportCase.contactId))
    || Boolean(supportCase.relatedOrderId && orderIds.has(supportCase.relatedOrderId)),
  );
  const supportIds = new Set(supportCases.map((supportCase) => supportCase.id));

  const linkedRecordIds = new Set<string>([
    ...dealIds,
    ...quoteIds,
    ...orderIds,
    ...supportIds,
    ...leads.map((lead) => lead.id),
  ]);

  const taskSnapshot = getTaskActivitySnapshot();
  const matchesWorkRecord = (recordRef?: { recordId: string }): boolean => Boolean(recordRef && linkedRecordIds.has(recordRef.recordId));
  const tasks = taskSnapshot.tasks.filter((task) =>
    matchesCanonicalRef(task.relationshipRef)
    || matchesLegacyCustomer(task.customerId)
    || matchesWorkRecord(task.recordRef),
  );
  const activities = taskSnapshot.activities.filter((activity) =>
    matchesCanonicalRef(activity.relationshipRef)
    || matchesLegacyCustomer(activity.customerId)
    || matchesWorkRecord(activity.recordRef),
  );

  return {
    relationshipRef: customer.relationshipRef,
    relationshipKey,
    aliases,
    contactIds,
    linkedRecordIds,
    leads,
    deals,
    quotes,
    orders,
    supportCases,
    tasks,
    activities,
  };
}
