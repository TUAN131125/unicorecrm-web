import {
  findContactOrganizationRelationship,
  getActiveContactOrganizationRelationships,
  isContactLinkedToOrganization,
  type Contact,
} from "@/modules/contacts";
import type { Deal } from "@/modules/deals";
import type { CustomerOrder } from "@/modules/orders";
import type { OrganizationAccount, OrganizationAccountStatus } from "../../domain/model/organizationAccount.types";

export interface OrganizationAccountMetrics {
  representativeCount: number;
  openDealsCount: number;
  pipelineValue: number;
  orderValue: number;
  completedOrdersCount: number;
}

export function getOrganizationContacts(
  account: OrganizationAccount,
  contacts: readonly Contact[],
): Contact[] {
  const ids = new Set(account.contactRefs.map((ref) => ref.id));
  return contacts.filter((contact) => isContactLinkedToOrganization(contact, account.id) || (ids.has(contact.id) && getActiveContactOrganizationRelationships(contact).length === 0));
}

export function getPrimaryOrganizationContact(
  account: OrganizationAccount,
  contacts: readonly Contact[],
): Contact | undefined {
  const related = getOrganizationContacts(account, contacts);
  return (
    related.find((contact) => contact.id === account.primaryContactId) ??
    related.find((contact) => findContactOrganizationRelationship(contact, account.id)?.isPrimaryRepresentative) ??
    related.find((contact) => findContactOrganizationRelationship(contact, account.id)?.decisionRole === "decision_maker") ??
    related[0]
  );
}

export function getOrganizationAccountMetrics(
  account: OrganizationAccount,
  contacts: readonly Contact[],
  deals: readonly Deal[],
  orders: readonly CustomerOrder[],
): OrganizationAccountMetrics {
  const relatedDeals = deals.filter(
    (deal) => deal.buyerRef.type === "ORGANIZATION_ACCOUNT" && deal.buyerRef.id === account.id,
  );
  const openDeals = relatedDeals.filter((deal) => deal.stage !== "WON" && deal.stage !== "LOST");
  const relatedOrders = orders.filter(
    (order) => order.buyerRef.type === "ORGANIZATION_ACCOUNT" && order.buyerRef.id === account.id,
  );

  return {
    representativeCount: getOrganizationContacts(account, contacts).length,
    openDealsCount: openDeals.length,
    pipelineValue: openDeals.reduce((total, deal) => total + deal.amount, 0),
    orderValue: relatedOrders.reduce(
      (total, order) => total + (order.grandTotal ?? order.totalAmount ?? 0),
      0,
    ),
    completedOrdersCount: relatedOrders.filter((order) => order.state === "COMPLETED").length,
  };
}

export function getOrganizationStatus(account: OrganizationAccount): OrganizationAccountStatus {
  if (account.status) return account.status;
  if (account.tags?.some((tag) => tag.toLowerCase().includes("strategic") || tag.toLowerCase().includes("vip"))) {
    return "strategic";
  }
  return "prospect";
}

export function getOrganizationStatusLabel(status: OrganizationAccountStatus): string {
  switch (status) {
    case "strategic": return "Chiến lược";
    case "active": return "Đang hoạt động";
    case "inactive": return "Ngừng hoạt động";
    case "archived": return "Lưu trữ";
    case "prospect":
    default:
      return "Tiềm năng";
  }
}

export function getOrganizationStatusBadgeClass(status: OrganizationAccountStatus): string {
  switch (status) {
    case "strategic": return "border-violet-200 bg-violet-50 text-violet-700";
    case "active": return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "inactive": return "border-slate-200 bg-slate-100 text-slate-600";
    case "archived": return "border-amber-200 bg-amber-50 text-amber-700";
    case "prospect":
    default:
      return "border-blue-200 bg-blue-50 text-blue-700";
  }
}

export function formatOrganizationCurrency(value: number, locale = "vi-VN"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

export function getOrganizationInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "TC";
}
