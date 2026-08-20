import { getCustomerPresentationSnapshot as getCustomersSnapshot, subscribeToCustomerPresentation as subscribeToCustomers } from "@/modules/customers";
import { getDealsSnapshot, replaceDeals, subscribeToDeals } from "@/modules/deals";
import { useSubscribableSnapshot, useSubscribableState } from "@/platform/react";

export function useContactCommercialState() {
  const customers = useSubscribableSnapshot(getCustomersSnapshot, subscribeToCustomers);
  const [deals, setDeals] = useSubscribableState(getDealsSnapshot, subscribeToDeals, replaceDeals);
  return { customers, deals, setDeals };
}

export function useContactCommercialSnapshot() {
  const customers = useSubscribableSnapshot(getCustomersSnapshot, subscribeToCustomers);
  const deals = useSubscribableSnapshot(getDealsSnapshot, subscribeToDeals);
  return { customers, deals };
}
