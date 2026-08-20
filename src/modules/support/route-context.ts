import { getContactsSnapshot, subscribeToContacts } from "@/modules/contacts";
import { getCustomerPresentationSnapshot as getCustomersSnapshot, subscribeToCustomerPresentation as subscribeToCustomers } from "@/modules/customers";
import { getOrdersSnapshot, subscribeToOrders } from "@/modules/orders";
import { getProductCatalogSnapshot, subscribeToProductCatalog } from "@/modules/products";
import { useSubscribableSnapshot } from "@/platform/react";

export function useSupportReferences() {
  const orders = useSubscribableSnapshot(getOrdersSnapshot, subscribeToOrders);
  return {
    customers: useSubscribableSnapshot(getCustomersSnapshot, subscribeToCustomers),
    contacts: useSubscribableSnapshot(getContactsSnapshot, subscribeToContacts),
    products: useSubscribableSnapshot(getProductCatalogSnapshot, subscribeToProductCatalog),
    orders: Object.values(orders).flat(),
  };
}
