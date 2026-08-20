import type { PurchaseEvidence } from "@/modules/commercial-evidence";
import type { Contact } from "@/modules/contacts";
import type { Customer } from "@/modules/customers";
import type { Deal } from "@/modules/deals";
import type { ShippingBooking } from "@/modules/shipping";
import type { Lead } from "@/modules/leads";
import type { CustomerOrder } from "@/modules/orders";
import type { OrganizationAccount } from "@/modules/organizations";
import type { PaymentRepositorySnapshot } from "@/modules/payments";
import type { Quote } from "@/modules/quotes";
import type { SupportCase } from "@/modules/support";
import type { TaskActivitySnapshot } from "@/modules/tasks";
import { relationshipRefKey, type RelationshipRef } from "@/platform/identity";
import type { RelationshipTimelineEvent } from "./relationshipTimeline.types";

export interface RelationshipTimelineSources {
  contacts: readonly Contact[];
  customers: readonly Customer[];
  organizationAccounts: readonly OrganizationAccount[];
  leads: readonly Lead[];
  deals: readonly Deal[];
  quotes: readonly Quote[];
  orders: readonly CustomerOrder[];
  payments: PaymentRepositorySnapshot;
  shippingBookings: readonly ShippingBooking[];
  evidence: readonly PurchaseEvidence[];
  supportCases: readonly SupportCase[];
  tasks: TaskActivitySnapshot;
}

function matchesRef(a: RelationshipRef | undefined, b: RelationshipRef): boolean {
  return Boolean(a && relationshipRefKey(a) === relationshipRefKey(b));
}

function supportCaseMatches(
  supportCase: SupportCase,
  relationshipRef: RelationshipRef,
  contacts: readonly Contact[],
  accounts: readonly OrganizationAccount[],
  customers: readonly Customer[],
): boolean {
  const customer = customers.find((item) => matchesRef(item.relationshipRef, relationshipRef));
  const aliases = new Set(customer ? [customer.id, customer.customerCode, ...(customer.legacyAliases ?? [])] : []);
  if (aliases.has(supportCase.customerId)) return true;
  if (relationshipRef.type === "CONTACT") return supportCase.contactId === relationshipRef.id;
  return contacts.some((contact) => contact.organizationAccountId === relationshipRef.id && supportCase.contactId === contact.id);
}

function quoteOccurredAt(quote: Quote): string {
  return quote.acceptedAt
    || quote.rejectedAt
    || quote.expiredAt
    || quote.sentAt
    || quote.reviewRequestedAt
    || quote.updatedAt
    || quote.createdAt;
}

function orderOccurredAt(order: CustomerOrder): string {
  return order.completion?.occurredAt
    || order.cancelledAt
    || order.confirmedAt
    || order.updatedAt
    || order.createdAt
    || `${order.orderDate}T00:00:00.000Z`;
}

export function buildRelationshipTimeline(
  relationshipRef: RelationshipRef,
  sources: RelationshipTimelineSources,
): RelationshipTimelineEvent[] {
  const events: RelationshipTimelineEvent[] = [];
  const relatedOrders = sources.orders.filter((order) => matchesRef(order.buyerRef, relationshipRef));
  const relatedOrderIds = new Set(relatedOrders.map((order) => order.id));

  for (const lead of sources.leads.filter((item) => matchesRef(item.relationshipRef, relationshipRef))) {
    for (const lineage of lead.sourceLineage || []) {
      events.push({
        id: `lead-lineage:${lead.id}:${lineage.signalId}`,
        relationshipRef,
        type: "ACQUISITION",
        title: `Acquisition signal from ${lineage.source}`,
        description: `Lead ${lead.name} preserved source lineage.`,
        occurredAt: lineage.occurredAt,
        sourceRef: { type: "LEAD", id: lead.id },
      });
    }
    if (lead.qualificationOutcome) {
      events.push({
        id: `lead-qualification:${lead.id}`,
        relationshipRef,
        type: "QUALIFICATION",
        title: `Lead closed: ${lead.qualificationOutcome}`,
        description: lead.qualificationNotes || lead.disqualificationReason || lead.notes,
        occurredAt: lead.updatedAt || lead.lastInteractionAt || lead.createdAt,
        sourceRef: { type: "LEAD", id: lead.id },
        status: lead.qualificationOutcome,
      });
    }
  }

  for (const deal of sources.deals.filter((item) => matchesRef(item.buyerRef, relationshipRef))) {
    events.push({
      id: `deal-created:${deal.id}`,
      relationshipRef,
      type: "DEAL",
      title: `Deal created: ${deal.name}`,
      description: deal.description,
      occurredAt: deal.createdAt,
      sourceRef: { type: "DEAL", id: deal.id },
      status: String(deal.stage),
      metadata: { amount: deal.amount },
    });
    for (const activity of deal.activities || []) {
      events.push({
        id: `deal-activity:${deal.id}:${activity.id}`,
        relationshipRef,
        type: activity.type === "note" || activity.type === "task" ? "ACTIVITY" : "DEAL",
        title: activity.title,
        description: activity.description,
        occurredAt: activity.createdAt,
        sourceRef: { type: "DEAL", id: deal.id },
        status: String(deal.stage),
      });
    }
  }

  for (const quote of sources.quotes.filter((item) => matchesRef(item.buyerRef, relationshipRef))) {
    events.push({
      id: `quote:${quote.id}:${quote.status}`,
      relationshipRef,
      type: "QUOTE",
      title: `Quote ${quote.quoteNumber}: ${quote.status}`,
      description: quote.title,
      occurredAt: quoteOccurredAt(quote),
      sourceRef: { type: "QUOTE", id: quote.id },
      status: quote.status,
      metadata: { version: quote.version, amount: quote.grandTotal },
    });
  }

  for (const order of relatedOrders) {
    events.push({
      id: `order:${order.id}:${order.state}`,
      relationshipRef,
      type: "ORDER",
      title: `Order ${order.orderNumber}: ${order.state}`,
      description: order.notes,
      occurredAt: orderOccurredAt(order),
      sourceRef: { type: "ORDER", id: order.id },
      status: order.state,
      metadata: { amount: order.totalAmount },
    });
  }

  for (const transaction of sources.payments.transactions.filter((item) => relatedOrderIds.has(item.orderId))) {
    events.push({
      id: `payment:${transaction.id}`,
      relationshipRef,
      type: "PAYMENT",
      title: `${transaction.kind}: ${transaction.status}`,
      description: transaction.method ? `Method: ${transaction.method}` : undefined,
      occurredAt: transaction.occurredAt,
      sourceRef: { type: "PAYMENT", id: transaction.id },
      status: transaction.status,
      metadata: { amount: transaction.amount, currency: transaction.currency },
    });
  }

  for (const booking of sources.shippingBookings.filter((item) => item.sourceType === "ORDER" && relatedOrderIds.has(item.sourceId))) {
    events.push({
      id: `shipping:${booking.id}:${booking.externalStatus}`,
      relationshipRef,
      type: "SHIPPING",
      title: `Vận đơn ${booking.code}: ${booking.externalStatus}`,
      description: booking.lastErrorMessage || booking.trackingCode,
      occurredAt: booking.deliveredAt || booking.providerUpdatedAt || booking.updatedAt || booking.createdAt,
      sourceRef: { type: "SHIPPING_BOOKING", id: booking.id },
      status: booking.externalStatus,
      metadata: { purpose: booking.purpose, provider: booking.providerNameSnapshot },
    });
  }
  for (const evidence of sources.evidence.filter((item) => matchesRef(item.buyerRef, relationshipRef))) {
    events.push({
      id: `evidence:${evidence.evidenceId}`,
      relationshipRef,
      type: "PURCHASE_EVIDENCE",
      title: evidence.reversalOfEvidenceId ? "Purchase evidence reversed" : `Purchase evidence: ${evidence.evidenceType}`,
      description: evidence.reversalOfEvidenceId ? `Reversal of ${evidence.reversalOfEvidenceId}` : undefined,
      occurredAt: evidence.occurredAt,
      sourceRef: { type: "PURCHASE_EVIDENCE", id: evidence.evidenceId },
      status: evidence.evidenceType,
    });
  }

  for (const supportCase of sources.supportCases.filter((item) => supportCaseMatches(item, relationshipRef, sources.contacts, sources.organizationAccounts, sources.customers))) {
    events.push({
      id: `support:${supportCase.id}:${supportCase.status}`,
      relationshipRef,
      type: "SUPPORT",
      title: `${supportCase.caseNumber}: ${supportCase.title}`,
      description: supportCase.resolutionSummary || supportCase.description,
      occurredAt: supportCase.resolvedAt || supportCase.closedAt || supportCase.updatedAt || supportCase.createdAt,
      sourceRef: { type: "SUPPORT", id: supportCase.id },
      status: supportCase.status,
    });
  }

  const relatedContacts = relationshipRef.type === "CONTACT"
    ? sources.contacts.filter((contact) => contact.id === relationshipRef.id)
    : sources.contacts.filter((contact) => contact.organizationAccountId === relationshipRef.id);
  for (const contact of relatedContacts) {
    for (const activity of contact.activities || []) {
      events.push({
        id: `contact-activity:${contact.id}:${activity.id}`,
        relationshipRef,
        type: "ACTIVITY",
        title: activity.title,
        description: activity.description,
        occurredAt: activity.createdAt,
        sourceRef: { type: "CONTACT", id: contact.id },
        status: activity.type,
      });
    }
  }

  for (const task of sources.tasks.tasks.filter((item) => matchesRef(item.relationshipRef, relationshipRef))) {
    events.push({
      id: `task:${task.id}:${task.status}`,
      relationshipRef,
      type: "TASK",
      title: task.title,
      description: task.description || task.outcome,
      occurredAt: task.completedAt || task.cancelledAt || task.updatedAt || task.createdAt,
      sourceRef: { type: "TASK", id: task.id },
      status: task.status,
      metadata: { priority: task.priority },
    });
  }


  return events.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || a.id.localeCompare(b.id));
}
