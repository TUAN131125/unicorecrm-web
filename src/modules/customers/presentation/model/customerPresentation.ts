import { getPurchaseEvidenceListSnapshot } from "@/modules/commercial-evidence";
import { getContactsSnapshot } from "@/modules/contacts";
import { getOrderListSnapshot } from "@/modules/orders";
import { getOrganizationAccountsSnapshot } from "@/modules/organizations";
import type { Customer as CustomerRecord } from "../../domain/model/customer.types";
import { getCustomerMigrationProfileSnapshot, getCustomersSnapshot } from "../../public/api";
import { relationshipRefKey } from "@/platform/identity";
import type { Customer } from "./customerDisplay.types";

function legacyStatus(status: CustomerRecord["status"]): Customer["status"] {
  switch (status) {
    case "NEW": return "new_customer";
    case "ACTIVE": return "active";
    case "AT_RISK": return "at_risk";
    case "INACTIVE": return "inactive";
    case "CHURNED": return "churned";
    case "DO_NOT_CONTACT": return "do_not_contact";
    case "ARCHIVED": return "archived";
  }
}

function legacyHealth(health: CustomerRecord["health"]): Customer["health"] {
  return health === "RISK" ? "Cảnh báo" : health === "WATCH" ? "Trung bình" : "Tốt";
}

export function projectCustomerForPresentation(customer: CustomerRecord): Customer {
  const contacts = getContactsSnapshot();
  const organizations = getOrganizationAccountsSnapshot();
  const orders = getOrderListSnapshot();
  const profile = getCustomerMigrationProfileSnapshot(customer.relationshipRef);
  const relatedOrders = orders.filter((order) => relationshipRefKey(order.buyerRef) === relationshipRefKey(customer.relationshipRef));
  const effectiveEvidence = getPurchaseEvidenceListSnapshot().filter((item) => !item.reversalOfEvidenceId && relationshipRefKey(item.buyerRef) === relationshipRefKey(customer.relationshipRef));
  const orderRevenue = relatedOrders.filter((order) => order.state === "COMPLETED").reduce((sum, order) => sum + (order.totalAmount ?? 0), 0);
  const profileRevenue = profile?.totalRevenue ?? 0;
  const totalRevenue = Math.max(profileRevenue, orderRevenue);
  const orderProducts = relatedOrders.flatMap((order) => order.items.map((line) => ({
    id: `owned_${order.id}_${line.id}`,
    productId: line.productId,
    productNameSnapshot: line.productNameSnapshot,
    quantity: line.quantity,
    purchaseDate: order.completedAt ?? order.orderDate,
    amount: line.lineTotal,
    status: "active" as const,
  })));

  if (customer.relationshipRef.type === "CONTACT") {
    const contact = contacts.find((item) => item.id === customer.relationshipRef.id);
    const displayName = contact?.fullName || contact?.name || customer.customerCode;
    return {
      id: customer.id,
      customerCode: customer.customerCode,
      type: "INDIVIDUAL",
      displayName,
      name: displayName,
      fullName: displayName,
      individualName: displayName,
      phone: contact?.mobilePhone || contact?.phone,
      email: contact?.personalEmail || contact?.workEmail || contact?.email,
      address: contact?.address,
      segment: customer.segment as Customer["segment"],
      source: contact?.source,
      status: legacyStatus(customer.status),
      ownerId: customer.careOwnerId || contact?.ownerId,
      tags: [...customer.tags],
      totalRevenue,
      lifetimeValue: totalRevenue,
      outstandingDebt: profile?.outstandingDebt ?? 0,
      purchaseCount: effectiveEvidence.length,
      lastPurchaseDate: customer.lastPurchaseAt ?? undefined,
      purchaseCycleDays: profile?.purchaseCycleDays,
      mrr: profile?.monthlyRecurringRevenue ?? 0,
      health: legacyHealth(customer.health),
      renewalDate: profile?.renewalAt,
      nextCareAt: customer.nextCareAt,
      lastCareAt: customer.lastCareAt,
      productsOwned: [...(profile?.ownedProducts ?? []).map((product) => ({
        id: product.id,
        productId: product.productId,
        productNameSnapshot: product.productName,
        quantity: product.quantity,
        purchaseDate: product.purchasedAt,
        amount: product.amount,
        expiryDate: product.expiresAt,
        status: product.status.toLowerCase() as Customer["productsOwned"][number]["status"],
      })), ...orderProducts],
    };
  }

  const account = organizations.find((item) => item.id === customer.relationshipRef.id);
  const displayName = account?.displayName || customer.customerCode;
  return {
    id: customer.id,
    customerCode: customer.customerCode,
    type: "COMPANY",
    displayName,
    name: displayName,
    fullName: displayName,
    companyName: displayName,
    phone: account?.phone,
    email: account?.email,
    taxCode: account?.taxCode,
    address: account?.address,
    segment: (customer.segment || account?.sizeBand) as Customer["segment"],
    industry: account?.industry,
    source: account?.source,
    status: legacyStatus(customer.status),
    ownerId: customer.careOwnerId || account?.ownerId,
    tags: [...customer.tags],
    totalRevenue,
    lifetimeValue: totalRevenue,
    outstandingDebt: profile?.outstandingDebt ?? 0,
    purchaseCount: effectiveEvidence.length,
    lastPurchaseDate: customer.lastPurchaseAt ?? undefined,
    purchaseCycleDays: profile?.purchaseCycleDays,
    mrr: profile?.monthlyRecurringRevenue ?? 0,
    health: legacyHealth(customer.health),
    renewalDate: profile?.renewalAt,
    nextCareAt: customer.nextCareAt,
    lastCareAt: customer.lastCareAt,
    productsOwned: [...(profile?.ownedProducts ?? []).map((product) => ({
      id: product.id,
      productId: product.productId,
      productNameSnapshot: product.productName,
      quantity: product.quantity,
      purchaseDate: product.purchasedAt,
      amount: product.amount,
      expiryDate: product.expiresAt,
      status: product.status.toLowerCase() as Customer["productsOwned"][number]["status"],
    })), ...orderProducts],
  };
}

export function getCustomerPresentationSnapshot(): Customer[] {
  return getCustomersSnapshot().map(projectCustomerForPresentation);
}

export function getCustomerPresentationRecordSnapshot(idOrAlias: string): Customer | undefined {
  const customers = getCustomersSnapshot();
  const found = customers.find((customer) => customer.id === idOrAlias || customer.customerCode === idOrAlias || customer.legacyAliases?.includes(idOrAlias));
  return found ? projectCustomerForPresentation(found) : undefined;
}
