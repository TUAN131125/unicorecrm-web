import { getContactsSnapshot } from "@/modules/contacts";
import { getDealsSnapshot } from "@/modules/deals";
import { getLeadsSnapshot } from "@/modules/leads";
import { getOrganizationAccountsSnapshot } from "@/modules/organizations";
import { getOrderListSnapshot } from "@/modules/orders";
import { getInvoicesSnapshot, getReceivablesSnapshot } from "@/modules/invoices";
import { getPaymentsSnapshot } from "@/modules/payments";
import { getQuotesSnapshot } from "@/modules/quotes";
import { getShippingSnapshot } from "@/modules/shipping";
import { getTaskActivitySnapshot } from "@/modules/tasks";

export interface CrmGlobalSearchRecord {
  id: string;
  moduleKey: string;
  path: string;
  label: string;
  description: string;
  typeLabelVi: string;
  typeLabelEn: string;
  searchableText: string;
  record: unknown;
}

type AccessRecord = (moduleKey: string, record: unknown) => boolean;

export function normalizeCrmSearchText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("vi-VN")
    .trim();
}

function searchable(...values: unknown[]): string {
  return normalizeCrmSearchText(values.filter(Boolean).join(" "));
}

export function buildCrmGlobalSearchRecords(canAccess: AccessRecord = () => true): CrmGlobalSearchRecord[] {
  const records: CrmGlobalSearchRecord[] = [];
  const add = (record: CrmGlobalSearchRecord) => {
    if (canAccess(record.moduleKey, record.record)) records.push(record);
  };

  getLeadsSnapshot().forEach((lead) => add({
    id: `lead:${lead.id}`, moduleKey: "leads", path: `leads/${lead.id}`,
    label: lead.name || lead.companyName || lead.id,
    description: [lead.companyName, lead.email, lead.phone].filter(Boolean).join(" · "),
    typeLabelVi: "Lead", typeLabelEn: "Lead",
    searchableText: searchable(lead.id, lead.name, lead.companyName, lead.email, lead.phone, lead.companyPhone, lead.taxCode, lead.source),
    record: lead,
  }));

  getContactsSnapshot().forEach((contact) => add({
    id: `contact:${contact.id}`, moduleKey: "contacts", path: `contacts/${contact.id}`,
    label: contact.fullName || contact.name || contact.id,
    description: [contact.organizationName || contact.companyName, contact.email || contact.workEmail, contact.phone || contact.mobilePhone].filter(Boolean).join(" · "),
    typeLabelVi: "Liên hệ", typeLabelEn: "Contact",
    searchableText: searchable(contact.id, contact.contactCode, contact.code, contact.fullName, contact.name, contact.organizationName, contact.companyName, contact.email, contact.workEmail, contact.personalEmail, contact.phone, contact.mobilePhone, contact.workPhone, contact.zaloId),
    record: contact,
  }));

  getOrganizationAccountsSnapshot().forEach((organization) => add({
    id: `organization:${organization.id}`, moduleKey: "organizations", path: `organizations/${organization.id}`,
    label: organization.displayName || organization.legalName || organization.id,
    description: [organization.taxCode, organization.email, organization.phone].filter(Boolean).join(" · "),
    typeLabelVi: "Tổ chức", typeLabelEn: "Organization",
    searchableText: searchable(organization.id, organization.displayName, organization.legalName, organization.taxCode, organization.domain, organization.email, organization.phone, organization.website, organization.address),
    record: organization,
  }));

  getDealsSnapshot().forEach((deal) => add({
    id: `deal:${deal.id}`, moduleKey: "deals", path: `deals/${deal.id}`,
    label: deal.name || deal.id,
    description: [deal.customerName || deal.organizationAccountName || deal.contactName, deal.stage].filter(Boolean).join(" · "),
    typeLabelVi: "Cơ hội", typeLabelEn: "Deal",
    searchableText: searchable(deal.id, deal.name, deal.customerName, deal.organizationAccountName, deal.contactName, deal.contactEmail, deal.contactPhone, deal.leadName, deal.buyerRef.id),
    record: deal,
  }));

  getQuotesSnapshot().forEach((quote) => add({
    id: `quote:${quote.id}`, moduleKey: "quotes", path: `quotes/${quote.id}`,
    label: `${quote.quoteNumber} · ${quote.title}`,
    description: [quote.customerName, quote.recipientEmail, quote.status].filter(Boolean).join(" · "),
    typeLabelVi: "Báo giá", typeLabelEn: "Quote",
    searchableText: searchable(quote.id, quote.quoteNumber, quote.title, quote.customerName, quote.customerContact, quote.recipientEmail, quote.dealName, quote.leadName, quote.buyerRef.id),
    record: quote,
  }));

  getOrderListSnapshot().forEach((order) => add({
    id: `order:${order.id}`, moduleKey: "orders", path: `orders/${order.id}`,
    label: order.orderNumber || order.id,
    description: [order.customerName || order.contactName, order.recipientPhone, order.state].filter(Boolean).join(" · "),
    typeLabelVi: "Đơn hàng", typeLabelEn: "Order",
    searchableText: searchable(order.id, order.orderNumber, order.customerName, order.contactName, order.recipientName, order.recipientEmail, order.recipientPhone, order.sourceQuoteNumber, order.sourceDealName, order.buyerRef.id),
    record: order,
  }));

  const invoiceSnapshot = getInvoicesSnapshot();
  invoiceSnapshot.invoices.forEach((invoice) => add({
    id: `invoice:${invoice.id}`, moduleKey: "invoices", path: `invoices/${invoice.id}`,
    label: invoice.invoiceNumber || invoice.id,
    description: [invoice.buyerSnapshot.displayName, invoice.lifecycleState, invoice.deliveryState].filter(Boolean).join(" · "),
    typeLabelVi: "Hóa đơn", typeLabelEn: "Invoice",
    searchableText: searchable(invoice.id, invoice.invoiceNumber, invoice.buyerSnapshot.displayName, invoice.buyerSnapshot.legalName, invoice.buyerSnapshot.taxId, invoice.sourceLinks.orderId, invoice.lifecycleState, invoice.deliveryState),
    record: invoice,
  }));

  getReceivablesSnapshot().forEach((receivable) => add({
    id: `receivable:${receivable.invoiceId}`, moduleKey: "receivables", path: `receivables/${receivable.invoiceId}`,
    label: receivable.invoiceNumber,
    description: [receivable.buyerName, receivable.settlementState, receivable.dueDate].filter(Boolean).join(" · "),
    typeLabelVi: "Công nợ", typeLabelEn: "Receivable",
    searchableText: searchable(receivable.invoiceId, receivable.invoiceNumber, receivable.buyerName, receivable.buyerRef.id, receivable.settlementState, receivable.agingBucket, receivable.dueDate),
    record: receivable,
  }));

  getShippingSnapshot().forEach((booking) => add({
    id: `shipping:${booking.id}`, moduleKey: "shipping", path: `shipping/${booking.id}`,
    label: booking.code || booking.trackingCode || booking.id,
    description: [booking.trackingCode, booking.recipientSnapshot.name, booking.externalStatus].filter(Boolean).join(" · "),
    typeLabelVi: "Vận đơn", typeLabelEn: "Shipping",
    searchableText: searchable(booking.id, booking.code, booking.trackingCode, booking.externalBookingId, booking.sourceId, booking.recipientSnapshot.name, booking.recipientSnapshot.email, booking.recipientSnapshot.phone, booking.providerNameSnapshot),
    record: booking,
  }));

  const paymentSnapshot = getPaymentsSnapshot();
  paymentSnapshot.transactions.forEach((transaction) => add({
    id: `payment:${transaction.id}`, moduleKey: "payments", path: `payments/${transaction.id}`,
    label: transaction.externalReference || transaction.id,
    description: [transaction.orderId, transaction.method, transaction.status].filter(Boolean).join(" · "),
    typeLabelVi: "Thanh toán", typeLabelEn: "Payment",
    searchableText: searchable(transaction.id, transaction.externalReference, transaction.orderId, transaction.method, transaction.status, transaction.carrierReference, transaction.buyerRef.id),
    record: transaction,
  }));
  getTaskActivitySnapshot().tasks.forEach((task) => add({
    id: `task:${task.id}`, moduleKey: "tasks", path: `tasks/${task.id}`,
    label: task.title || task.id,
    description: [task.assigneeId, task.status, task.dueAt].filter(Boolean).join(" · "),
    typeLabelVi: "Công việc", typeLabelEn: "Task",
    searchableText: searchable(task.id, task.title, task.description, task.assigneeId, task.status, task.recordRef?.recordId, task.sourceRef?.id, task.relationshipRef?.id),
    record: task,
  }));

  return records;
}

export function filterCrmGlobalSearchRecords(records: CrmGlobalSearchRecord[], term: string, limit = 12): CrmGlobalSearchRecord[] {
  const query = normalizeCrmSearchText(term);
  if (!query) return [];
  return records
    .filter((record) => record.searchableText.includes(query))
    .sort((left, right) => {
      const leftLabel = normalizeCrmSearchText(left.label);
      const rightLabel = normalizeCrmSearchText(right.label);
      return Number(rightLabel.startsWith(query)) - Number(leftLabel.startsWith(query)) || leftLabel.localeCompare(rightLabel, "vi");
    })
    .slice(0, limit);
}
