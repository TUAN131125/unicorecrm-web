import { subscribeToPurchaseEvidence } from "@/modules/commercial-evidence";
import { getContactsSnapshot } from "@/modules/contacts";
import { getStoredCustomersSnapshot, refreshCustomersFromPurchaseEvidence } from "@/modules/customers";
import { getDealsSnapshot, replaceDeals } from "@/modules/deals";
import { getOrderListSnapshot, getOrdersSnapshot, replaceOrders } from "@/modules/orders";
import { getOrganizationAccountsSnapshot } from "@/modules/organizations";
import { getQuotesSnapshot, replaceQuotes } from "@/modules/quotes";
import { getSupportCasesSnapshot, replaceSupportCases } from "@/modules/support";
import { getTaskActivitySnapshot, replaceTaskActivitySnapshot } from "@/modules/tasks";
import { relationshipRefKey, type RelationshipRef } from "@/platform/identity";
import type { CustomerConversionReconciliationResult } from "../application/ports/CustomerConversionPort";


export function reconcileCustomerConversionRuntime(now = new Date().toISOString()): CustomerConversionReconciliationResult {
  const beforeIds = new Set(getStoredCustomersSnapshot().map((customer) => customer.id));
  const customers = refreshCustomersFromPurchaseEvidence();
  const createdCustomerIds = customers.filter((customer) => !beforeIds.has(customer.id)).map((customer) => customer.id);
  const customerByRelationship = new Map(customers.map((customer) => [relationshipRefKey(customer.relationshipRef), customer]));
  const customerByAlias = new Map(customers.flatMap((customer) => [customer.id, customer.customerCode, ...(customer.legacyAliases ?? [])].map((alias) => [alias, customer] as const)));

  let linkedDeals = 0;
  const deals = getDealsSnapshot().map((deal) => {
    const customer = customerByRelationship.get(relationshipRefKey(deal.buyerRef));
    if (!customer || deal.customerId === customer.id) return deal;
    linkedDeals += 1;
    return { ...deal, customerId: customer.id };
  });
  if (linkedDeals) replaceDeals(deals);

  let linkedQuotes = 0;
  const quotes = getQuotesSnapshot().map((quote) => {
    const customer = customerByRelationship.get(relationshipRefKey(quote.buyerRef));
    if (!customer || quote.customerId === customer.id) return quote;
    linkedQuotes += 1;
    return { ...quote, customerId: customer.id };
  });
  if (linkedQuotes) replaceQuotes(quotes);

  let linkedOrders = 0;
  const orderList = getOrderListSnapshot();
  const nextById = new Map(orderList.map((order) => {
    const customer = customerByRelationship.get(relationshipRefKey(order.buyerRef));
    if (!customer || order.customerId === customer.id) return [order.id, order] as const;
    linkedOrders += 1;
    return [order.id, { ...order, customerId: customer.id }] as const;
  }));
  if (linkedOrders) {
    const current = getOrdersSnapshot();
    replaceOrders(Object.fromEntries(Object.entries(current).map(([partition, records]) => [partition, records.map((order) => nextById.get(order.id) ?? order)])));
  }

  let linkedSupportCases = 0;
  const supportCases = getSupportCasesSnapshot().map((supportCase) => {
    const customer = resolveCustomerForRelationship(customerByRelationship, supportCase.relationshipRef)
      ?? (supportCase.customerId ? customerByAlias.get(supportCase.customerId) : undefined);
    if (!customer) return supportCase;
    const relationshipMatches = supportCase.relationshipRef
      ? relationshipRefKey(supportCase.relationshipRef) === relationshipRefKey(customer.relationshipRef)
      : false;
    if (supportCase.customerId === customer.id && relationshipMatches) return supportCase;
    linkedSupportCases += 1;
    return { ...supportCase, customerId: customer.id, relationshipRef: customer.relationshipRef };
  });
  if (linkedSupportCases) replaceSupportCases(supportCases);

  const taskSnapshot = getTaskActivitySnapshot();
  let linkedTasks = 0;
  let linkedActivities = 0;
  const tasks = taskSnapshot.tasks.map((task) => {
    const customer = resolveCustomerForRelationship(customerByRelationship, task.relationshipRef)
      ?? (task.customerId ? customerByAlias.get(task.customerId) : undefined);
    if (!customer) return task;
    const relationshipMatches = task.relationshipRef
      ? relationshipRefKey(task.relationshipRef) === relationshipRefKey(customer.relationshipRef)
      : false;
    if (task.customerId === customer.id && relationshipMatches) return task;
    linkedTasks += 1;
    return { ...task, customerId: customer.id, relationshipRef: customer.relationshipRef };
  });
  const activities = taskSnapshot.activities.map((activity) => {
    const customer = resolveCustomerForRelationship(customerByRelationship, activity.relationshipRef)
      ?? (activity.customerId ? customerByAlias.get(activity.customerId) : undefined);
    if (!customer) return activity;
    const relationshipMatches = activity.relationshipRef
      ? relationshipRefKey(activity.relationshipRef) === relationshipRefKey(customer.relationshipRef)
      : false;
    if (activity.customerId === customer.id && relationshipMatches) return activity;
    linkedActivities += 1;
    return { ...activity, customerId: customer.id, relationshipRef: customer.relationshipRef };
  });

  for (const customerId of createdCustomerIds) {
    const customer = customers.find((item) => item.id === customerId);
    if (!customer) continue;
    activities.unshift({
      id: `activity_customer_created_${customer.id}`,
      workspaceId: customer.workspaceId,
      type: "SYSTEM",
      subject: "Customer created from purchase evidence",
      body: `Customer ${customer.customerCode} was created automatically after effective purchase evidence.`,
      actorId: "system:customer-conversion",
      occurredAt: now,
      customerId: customer.id,
      relationshipRef: customer.relationshipRef,
      recordRef: { moduleKey: "customers", recordId: customer.id, label: customer.customerCode },
      sourceRef: { type: "PURCHASE_EVIDENCE", id: relationshipRefKey(customer.relationshipRef) },
    });
    linkedActivities += 1;
  }

  if (linkedTasks || linkedActivities) replaceTaskActivitySnapshot({ tasks, activities });

  return { createdCustomerIds, linkedDeals, linkedQuotes, linkedOrders, linkedSupportCases, linkedTasks, linkedActivities };
}

export function startCustomerConversionRuntime(): () => void {
  reconcileCustomerConversionRuntime();
  return subscribeToPurchaseEvidence(() => reconcileCustomerConversionRuntime());
}

function resolveCustomerForRelationship<T extends { id: string }>(customerByRelationship: Map<string, T>, relationshipRef?: RelationshipRef): T | undefined {
  return relationshipRef ? customerByRelationship.get(relationshipRefKey(relationshipRef)) : undefined;
}
