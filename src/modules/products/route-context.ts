import { getCustomerPresentationSnapshot as getCustomersSnapshot, subscribeToCustomerPresentation as subscribeToCustomers } from "@/modules/customers";
import { getDealsSnapshot, subscribeToDeals } from "@/modules/deals";
import { getLeadsSnapshot, subscribeToLeads } from "@/modules/leads";
import { getOrdersSnapshot, subscribeToOrders } from "@/modules/orders";
import { getQuotesSnapshot, subscribeToQuotes } from "@/modules/quotes";
import { useSubscribableSnapshot } from "@/platform/react";

export function useProductUsageSources() {
  return {
    leads: useSubscribableSnapshot(getLeadsSnapshot, subscribeToLeads),
    deals: useSubscribableSnapshot(getDealsSnapshot, subscribeToDeals),
    quotes: useSubscribableSnapshot(getQuotesSnapshot, subscribeToQuotes),
    customers: useSubscribableSnapshot(getCustomersSnapshot, subscribeToCustomers),
    orders: useSubscribableSnapshot(getOrdersSnapshot, subscribeToOrders),
  };
}
