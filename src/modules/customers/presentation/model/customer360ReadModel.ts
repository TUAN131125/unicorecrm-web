import {
  getPurchaseEvidenceListSnapshot,
  type PurchaseEvidence,
} from "@/modules/commercial-evidence";
import {
  getContactsSnapshot,
  resolveOrganizationContacts,
  resolveOrganizationPrimaryContact,
  type Contact,
} from "@/modules/contacts";
import type { Lead } from "@/modules/leads";
import { getDealsSnapshot, type Deal } from "@/modules/deals";
import { getOrderListSnapshot, type CustomerOrder } from "@/modules/orders";
import {
  getOrganizationAccountsSnapshot,
  type OrganizationAccount,
} from "@/modules/organizations";
import {
  getPaymentObligationsSnapshot,
  getPaymentsSnapshot,
  type PaymentObligation,
  type PaymentTransaction,
} from "@/modules/payments";
import { getQuotesSnapshot, type Quote } from "@/modules/quotes";
import { getInvoicesSnapshot, getReceivablesSnapshot, type Invoice, type ReceivableEntry } from "@/modules/invoices";
import {
  getReturnsSnapshot,
  type ReturnRequest,
  type ReturnResolutionIntent,
} from "@/modules/returns";
import { getShippingSnapshot, type ShippingBooking } from "@/modules/shipping";
import { getSupportCasesSnapshot, type SupportCase } from "@/modules/support";
import { getTaskActivitySnapshot, type Activity, type Task } from "@/modules/tasks";
import { relationshipRefKey } from "@/platform/identity";
import { auditRelationshipIntegrity, type RelationshipIntegrityIssue } from "@/platform/relationship-integrity";
import { getWorkspaceContextSnapshot } from "@/platform/workspace-context";
import type {
  Customer,
  CustomerCareCard,
} from "../../domain/model/customer.types";
import { getCustomerCareCardsSnapshot, getCustomersSnapshot } from "../../public/api";
import { buildCustomerRelationshipGraph } from "./customerRelationshipGraph";

import type { Customer360ReadModel, CustomerIdentityView, CustomerTimelineItem } from "./customer360ReadModel.types";
export type * from "./customer360ReadModel.types";

export function resolveCustomerIdentity(
  customer: Customer,
): CustomerIdentityView {
  const contacts = getContactsSnapshot();
  if (customer.relationshipRef.type === "CONTACT") {
    const contact = contacts.find(
      (item) => item.id === customer.relationshipRef.id,
    );
    return {
      displayName: contact?.fullName || contact?.name || customer.customerCode,
      email: contact?.personalEmail || contact?.workEmail || contact?.email,
      phone: contact?.mobilePhone || contact?.phone || contact?.workPhone,
      address: contact?.address,
      ownerId: customer.careOwnerId || contact?.ownerId,
      contact,
      primaryContact: contact,
      contacts: contact ? [contact] : [],
    };
  }

  const organization = getOrganizationAccountsSnapshot().find(
    (item) => item.id === customer.relationshipRef.id,
  );
  const organizationContacts = resolveOrganizationContacts(customer.relationshipRef.id, contacts, organization);
  const primaryContact = resolveOrganizationPrimaryContact(customer.relationshipRef.id, contacts, organization);
  return {
    displayName: organization?.displayName || customer.customerCode,
    email: organization?.email,
    phone: organization?.phone,
    address: organization?.address,
    taxCode: organization?.taxCode,
    ownerId: customer.careOwnerId || organization?.ownerId,
    organization,
    primaryContact,
    contacts: organizationContacts,
  };
}

/** Demo-only local projection. Connected mode must use getCustomer360 through CustomerApiRuntime. */
export function buildCustomer360ReadModel(
  customer: Customer,
): Customer360ReadModel {
  const graph = buildCustomerRelationshipGraph(customer);
  const key = graph.relationshipKey;
  const leads = graph.leads;
  const deals = graph.deals;
  const quotes = graph.quotes;
  const orders = graph.orders;
  const orderIds = new Set(orders.map((order) => order.id));
  const payments = getPaymentsSnapshot();
  const paymentObligations = getPaymentObligationsSnapshot().filter((item) =>
    orderIds.has(item.orderId),
  );
  const paymentTransactions = payments.transactions.filter((item) =>
    orderIds.has(item.orderId),
  );
  const invoiceSnapshot = getInvoicesSnapshot();
  const invoices = invoiceSnapshot.invoices.filter((invoice) =>
    relationshipRefKey(invoice.buyerRef) === key || Boolean(invoice.sourceLinks.orderId && orderIds.has(invoice.sourceLinks.orderId)),
  );
  const invoiceIds = new Set(invoices.map((invoice) => invoice.id));
  const receivables = getReceivablesSnapshot().filter((entry) => invoiceIds.has(entry.invoiceId));
  const shippingBookings = getShippingSnapshot().filter(
    (booking) =>
      booking.sourceType === "ORDER" && orderIds.has(booking.sourceId),
  );
  const returnSnapshot = getReturnsSnapshot();
  const returns = returnSnapshot.requests.filter(
    (request) =>
      orderIds.has(request.orderId) ||
      relationshipRefKey(request.buyerRef) === key,
  );
  const returnIds = new Set(returns.map((request) => request.id));
  const returnIntents = returnSnapshot.intents.filter((intent) =>
    returnIds.has(intent.returnId),
  );
  const supportCases = graph.supportCases;
  const tasks = graph.tasks;
  const activities = graph.activities;
  const careCards = getCustomerCareCardsSnapshot(customer.id);
  const identity = resolveCustomerIdentity(customer);
  const evidence = getPurchaseEvidenceListSnapshot().filter(
    (item) =>
      !item.reversalOfEvidenceId && relationshipRefKey(item.buyerRef) === key,
  );
  const allPayments = getPaymentsSnapshot();
  const allReturns = getReturnsSnapshot();
  const allWork = getTaskActivitySnapshot();
  const integritySummary = auditRelationshipIntegrity({
    workspaceId: getWorkspaceContextSnapshot().workspaceId,
    contacts: getContactsSnapshot(),
    organizations: getOrganizationAccountsSnapshot(),
    customers: getCustomersSnapshot(),
    deals: getDealsSnapshot(),
    quotes: getQuotesSnapshot(),
    orders: getOrderListSnapshot(),
    paymentObligations: getPaymentObligationsSnapshot(),
    paymentTransactions: allPayments.transactions,
    shippingBookings: getShippingSnapshot(),
    returns: allReturns.requests,
    supportCases: getSupportCasesSnapshot(),
    tasks: allWork.tasks,
    activities: allWork.activities,
  });
  const customerRelatedIds = new Set([
    customer.id,
    customer.relationshipRef.id,
    ...graph.contactIds,
    ...graph.linkedRecordIds,
    ...paymentObligations.map((record) => record.id),
    ...paymentTransactions.map((record) => record.id),
    ...invoices.map((record) => record.id),
    ...shippingBookings.map((record) => record.id),
    ...returns.map((record) => record.id),
    ...tasks.map((record) => record.id),
    ...activities.map((record) => record.id),
  ]);
  const integrityIssues = integritySummary.issues.filter((issue) =>
    (issue.relationshipRef && relationshipRefKey(issue.relationshipRef) === key)
    || customerRelatedIds.has(issue.recordId)
    || issue.relatedRecordIds?.some((recordId) => customerRelatedIds.has(recordId)),
  );

  const productsById = new Map<
    string,
    Customer360ReadModel["productsPurchased"][number]
  >();
  for (const order of orders.filter((item) => item.state === "COMPLETED")) {
    const purchasedAt = order.completedAt || order.orderDate || order.createdAt || order.updatedAt || "";
    for (const line of order.items) {
      const productId = line.productId || line.id;
      const existing = productsById.get(productId);
      const amount =
        line.lineTotal ?? (line.unitPriceSnapshot ?? 0) * line.quantity;
      productsById.set(
        productId,
        existing
          ? {
              ...existing,
              quantity: existing.quantity + line.quantity,
              amount: existing.amount + amount,
              firstPurchasedAt:
                existing.firstPurchasedAt < purchasedAt
                  ? existing.firstPurchasedAt
                  : purchasedAt,
              lastPurchasedAt:
                existing.lastPurchasedAt > purchasedAt
                  ? existing.lastPurchasedAt
                  : purchasedAt,
            }
          : {
              productId,
              productName: line.productNameSnapshot || productId,
              quantity: line.quantity,
              amount,
              firstPurchasedAt: purchasedAt,
              lastPurchasedAt: purchasedAt,
            },
      );
    }
  }

  const timeline: CustomerTimelineItem[] = [
    {
      id: `customer-created-${customer.id}`,
      kind: "CUSTOMER" as const,
      title: "",
      eventType: "CUSTOMER_CREATED_FROM_PURCHASE" as const,
      params: { customerCode: customer.customerCode },
      occurredAt: customer.createdAt,
      recordRef: { moduleKey: "customers", recordId: customer.id },
    },
    ...leads.flatMap((lead) => {
      const items: CustomerTimelineItem[] = [
        {
          id: `lead-${lead.id}`,
          kind: "LEAD",
          title: "",
          eventType: "LEAD_JOURNEY",
          params: { name: lead.name, outcome: lead.qualificationOutcome },
          statusCode: lead.leadWorkState,
          occurredAt: lead.updatedAt || lead.createdAt,
          recordRef: { moduleKey: "leads", recordId: lead.id },
        },
      ];
      for (const activity of lead.activities ?? [])
        items.push({
          id: `lead-activity-${lead.id}-${activity.id}`,
          kind: "LEAD",
          title: activity.title,
          detail: activity.description,
          occurredAt: activity.createdAt,
          recordRef: { moduleKey: "leads", recordId: lead.id },
        });
      return items;
    }),
    ...deals.flatMap((deal) => {
      const items: CustomerTimelineItem[] = [
        {
          id: `deal-${deal.id}`,
          kind: "DEAL",
          title: "",
          eventType: "DEAL_CREATED",
          params: { name: deal.name },
          statusCode: String(deal.stage),
          occurredAt: deal.createdAt,
          recordRef: { moduleKey: "deals", recordId: deal.id },
        },
      ];
      for (const activity of deal.activities ?? [])
        items.push({
          id: `deal-activity-${deal.id}-${activity.id}`,
          kind: "DEAL",
          title: activity.title,
          detail: activity.description,
          occurredAt: activity.createdAt,
          recordRef: { moduleKey: "deals", recordId: deal.id },
        });
      return items;
    }),
    ...quotes.map((quote) => ({
      id: `quote-${quote.id}`,
      kind: "QUOTE" as const,
      title: "",
      eventType: "QUOTE_UPDATED" as const,
      params: { number: quote.quoteNumber },
      statusCode: quote.status,
      occurredAt: quote.updatedAt || quote.createdAt,
      recordRef: { moduleKey: "quotes", recordId: quote.id },
    })),
    ...orders.map((order) => ({
      id: `order-${order.id}`,
      kind: "ORDER" as const,
      title: "",
      eventType: "ORDER_UPDATED" as const,
      params: { number: order.orderNumber || order.id },
      statusCode: order.state,
      occurredAt: order.updatedAt || order.createdAt || order.orderDate || "",
      recordRef: { moduleKey: "orders", recordId: order.id },
    })),
    ...paymentTransactions.map((payment) => ({
      id: `payment-${payment.id}`,
      kind: "PAYMENT" as const,
      title: "",
      eventType: "PAYMENT_RECORDED" as const,
      params: { kind: payment.kind, amount: `${payment.amount.toLocaleString()} ${payment.currency}` },
      statusCode: payment.status,
      occurredAt: payment.occurredAt,
      recordRef: { moduleKey: "payments", recordId: payment.id },
    })),
    ...invoices.map((invoice) => ({
      id: `invoice-${invoice.id}`,
      kind: "INVOICE" as const,
      title: invoice.invoiceNumber ?? "Invoice draft",
      eventType: "INVOICE_UPDATED" as const,
      params: { number: invoice.invoiceNumber ?? invoice.id, amount: `${invoice.totals.grandTotal.amount} ${invoice.totals.grandTotal.currency}` },
      statusCode: invoice.lifecycleState,
      occurredAt: invoice.issuedAt ?? invoice.updatedAt,
      recordRef: { moduleKey: "invoices", recordId: invoice.id },
    })),
    ...shippingBookings
      .filter((booking) => booking.externalStatus === "DELIVERED")
      .map((booking) => ({
        id: `shipping-${booking.id}`,
        kind: "SHIPPING" as const,
        title: "",
        eventType: "SHIPPING_DELIVERED" as const,
        params: { code: booking.code, trackingCode: booking.trackingCode },
        occurredAt: booking.deliveredAt || booking.updatedAt,
        recordRef: { moduleKey: "shipping", recordId: booking.id },
      })),
    ...returns.map((request) => ({
      id: `return-${request.id}`,
      kind: "RETURN" as const,
      title: "",
      eventType: "RETURN_UPDATED" as const,
      params: { code: request.code },
      statusCode: request.status,
      occurredAt: request.updatedAt,
      recordRef: { moduleKey: "returns", recordId: request.id },
    })),
    ...careCards.map((card) => ({
      id: `care-${card.id}`,
      kind: "CARE" as const,
      title: card.title,
      detail: card.status,
      occurredAt: card.updatedAt,
      recordRef: { moduleKey: "customers", recordId: card.id },
    })),
    ...supportCases.map((supportCase) => ({
      id: `support-${supportCase.id}`,
      kind: "SUPPORT" as const,
      title: supportCase.title,
      detail: supportCase.status,
      occurredAt: supportCase.updatedAt || supportCase.createdAt,
      recordRef: { moduleKey: "support", recordId: supportCase.id },
    })),
    ...tasks.map((task) => ({
      id: `task-${task.id}`,
      kind: "TASK" as const,
      title: task.title,
      detail: task.status,
      occurredAt: task.updatedAt,
      recordRef: task.recordRef
        ? {
            moduleKey: task.recordRef.moduleKey,
            recordId: task.recordRef.recordId,
          }
        : undefined,
    })),
    ...activities.map((activity) => ({
      id: `activity-${activity.id}`,
      kind: "ACTIVITY" as const,
      title: activity.subject,
      detail: activity.body,
      occurredAt: activity.occurredAt,
      recordRef: activity.recordRef
        ? {
            moduleKey: activity.recordRef.moduleKey,
            recordId: activity.recordRef.recordId,
          }
        : undefined,
      activityType: activity.type,
    })),
    ...identity.contacts.flatMap((contact) => {
      const contactName = contact.fullName || contact.name;
      const notes: CustomerTimelineItem[] = [];
      if (contact.notes)
        notes.push({
          id: `contact-note-${contact.id}`,
          kind: "NOTE",
          title: "",
          eventType: "CONTACT_NOTE",
          params: { contactName },
          detail: contact.notes,
          occurredAt: contact.updatedAt || contact.createdAt,
          recordRef: { moduleKey: "contacts", recordId: contact.id },
        });
      if (contact.internalNotes)
        notes.push({
          id: `contact-internal-note-${contact.id}`,
          kind: "NOTE",
          title: "",
          eventType: "CONTACT_INTERNAL_NOTE",
          params: { contactName },
          detail: contact.internalNotes,
          occurredAt: contact.updatedAt || contact.createdAt,
          recordRef: { moduleKey: "contacts", recordId: contact.id },
        });
      for (const activity of contact.activities ?? []) {
        notes.push({
          id: `contact-activity-${contact.id}-${activity.id}`,
          kind: String(activity.type).toLowerCase().includes("note")
            ? "NOTE"
            : "ACTIVITY",
          title: activity.title,
          detail: activity.description,
          occurredAt: activity.createdAt,
          recordRef: { moduleKey: "contacts", recordId: contact.id },
          activityType: String(activity.type).toUpperCase(),
        });
      }
      return notes;
    }),
  ].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));

  return {
    customer,
    identity,
    leads,
    deals,
    quotes,
    orders,
    paymentObligations,
    paymentTransactions,
    invoices,
    receivables,
    shippingBookings,
    returns,
    returnIntents,
    supportCases,
    tasks,
    activities,
    careCards,
    purchaseEvidence: evidence,
    timeline,
    integrity: {
      status: integrityIssues.some((issue) => issue.severity === "ERROR")
        ? "BLOCKED"
        : integrityIssues.length > 0
          ? "NEEDS_REVIEW"
          : "HEALTHY",
      errorCount: integrityIssues.filter((issue) => issue.severity === "ERROR").length,
      warningCount: integrityIssues.filter((issue) => issue.severity === "WARNING").length,
      issues: integrityIssues,
    },
    metrics: {
      revenue: orders
        .filter((order) => order.state === "COMPLETED")
        .reduce((sum, order) => sum + (order.totalAmount ?? 0), 0),
      leadCount: leads.length,
      orderCount: orders.length,
      openTaskCount: tasks.filter((task) => task.status === "OPEN").length,
      overdueTaskCount: tasks.filter(
        (task) =>
          task.status === "OPEN" && new Date(task.dueAt).getTime() < Date.now(),
      ).length,
      openSupportCount: supportCases.filter(
        (item) => !["resolved", "closed", "cancelled"].includes(item.status),
      ).length,
      supportRiskCount: supportCases.filter(
        (item) =>
          !["resolved", "closed", "cancelled"].includes(item.status) &&
          (item.slaStatus === "breached" ||
            item.slaStatus === "at_risk" ||
            item.priority === "critical"),
      ).length,
      openDealCount: deals.filter(
        (deal) => !["WON", "LOST"].includes(String(deal.stage).toUpperCase()),
      ).length,
      quoteCount: quotes.length,
      productCount: productsById.size,
      purchaseCount: evidence.length,
      openInvoiceCount: receivables.filter((entry) => entry.settlementState !== "PAID").length,
      overdueReceivableCount: receivables.filter((entry) => entry.settlementState === "OVERDUE").length,
      activeReturnCount: returns.filter(
        (request) => !["CLOSED", "REJECTED"].includes(request.status),
      ).length,
      returnAttentionCount:
        returns.filter((request) =>
          ["REQUESTED", "RECEIVED", "RESOLVED"].includes(request.status),
        ).length +
        returnIntents.filter((intent) => intent.status === "FAILED").length,
    },
    productsPurchased: [...productsById.values()].sort((left, right) =>
      right.lastPurchasedAt.localeCompare(left.lastPurchasedAt),
    ),
  };
}
