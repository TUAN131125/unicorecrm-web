/** Compatibility helpers for Customer View presentation DTOs. */
import type { CustomerDisplay as Customer, CustomerProductOwned } from "./model/customerDisplay.types";
import { findCustomerByRelationshipRefSnapshot } from "../public/api";

export function getPurchasedProductsForContact(contact: any, customers: Customer[]): CustomerProductOwned[] {
  if (!contact) return [];
  const linkedCustomerId = (contact.organizationAccountId
    ? findCustomerByRelationshipRefSnapshot({ type: "ORGANIZATION_ACCOUNT", id: contact.organizationAccountId })
    : undefined)?.id ?? findCustomerByRelationshipRefSnapshot({ type: "CONTACT", id: contact.id })?.id;
  if (linkedCustomerId) {
    const customer = customers.find((item) => item.id === linkedCustomerId);
    if (customer?.productsOwned?.length) return customer.productsOwned;
  }
  const matchingCustomer = customers.find((item) => item.displayName === contact.companyName);
  return matchingCustomer?.productsOwned ?? contact.productsOwned ?? [];
}

export function getOwnedProductDisplay(productOwned: any, products?: any[]) {
  if (!productOwned) {
    return {
      productName: "Unknown product",
      sku: "",
      productType: "",
      quantity: 0,
      amount: 0,
      purchaseDate: "",
      sourceLabel: "",
      warrantyUntil: undefined,
      renewalAt: undefined,
      billingCycle: "",
      slaLevel: undefined,
      subscriptionStatus: undefined,
      status: "active" as const,
    };
  }
  const product = products?.find((item: any) => item.id === productOwned.productId);
  return {
    productName: productOwned.productNameSnapshot || productOwned.productName || product?.name || "Unknown product",
    sku: productOwned.skuSnapshot || product?.sku || productOwned.productId || "",
    productType: productOwned.productTypeSnapshot || product?.type || "license",
    quantity: productOwned.quantity || 1,
    amount: productOwned.amount || 0,
    purchaseDate: productOwned.purchaseDate || "",
    sourceLabel: productOwned.sourceLabel || "",
    warrantyUntil: productOwned.warrantyUntil,
    renewalAt: productOwned.renewalAt,
    billingCycle: productOwned.billingCycle,
    slaLevel: productOwned.slaLevel,
    subscriptionStatus: productOwned.subscriptionStatus,
    status: productOwned.status || "active",
  };
}
