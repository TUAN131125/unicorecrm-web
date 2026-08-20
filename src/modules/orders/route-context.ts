import { getContactsSnapshot, subscribeToContacts } from "@/modules/contacts";
import { getDealsSnapshot, subscribeToDeals } from "@/modules/deals";
import { getQuotesSnapshot, subscribeToQuotes } from "@/modules/quotes";
import { getPaymentsSnapshot, subscribeToPayments } from "@/modules/payments";
import { getShippingSnapshot, subscribeToShipping } from "@/modules/shipping";
import { useSubscribableSnapshot } from "@/platform/react";

export function useOrderReferences() {
  return {
    contacts: useSubscribableSnapshot(getContactsSnapshot, subscribeToContacts),
    quotes: useSubscribableSnapshot(getQuotesSnapshot, subscribeToQuotes),
    deals: useSubscribableSnapshot(getDealsSnapshot, subscribeToDeals),
    payments: useSubscribableSnapshot(getPaymentsSnapshot, subscribeToPayments),
    shippingBookings: useSubscribableSnapshot(getShippingSnapshot, subscribeToShipping),
  };
}
