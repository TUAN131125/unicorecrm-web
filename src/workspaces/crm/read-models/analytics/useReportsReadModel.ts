import { useMemo } from "react";
import { getContactsSnapshot, subscribeToContacts } from "@/modules/contacts";
import { getCustomersSnapshot, subscribeToCustomers } from "@/modules/customers";
import { getDealsSnapshot, subscribeToDeals } from "@/modules/deals";
import { getLeadsSnapshot, subscribeToLeads } from "@/modules/leads";
import { getOrdersSnapshot, subscribeToOrders } from "@/modules/orders";
import { getQuotesSnapshot, subscribeToQuotes } from "@/modules/quotes";
import { getSupportCasesSnapshot, subscribeToSupportCases } from "@/modules/support";
import { useRepositorySnapshot } from "../core/useRepositorySnapshot";

export function useReportsReadModel() {
  const leads = useRepositorySnapshot(subscribeToLeads, getLeadsSnapshot);
  const customers = useRepositorySnapshot(subscribeToCustomers, getCustomersSnapshot);
  const contacts = useRepositorySnapshot(subscribeToContacts, getContactsSnapshot);
  const deals = useRepositorySnapshot(subscribeToDeals, getDealsSnapshot);
  const quotes = useRepositorySnapshot(subscribeToQuotes, getQuotesSnapshot);
  const orders = useRepositorySnapshot(subscribeToOrders, getOrdersSnapshot);
  const cases = useRepositorySnapshot(subscribeToSupportCases, getSupportCasesSnapshot);

  return useMemo(
    () => ({ leads, customers, contacts, deals, quotes, orders, cases }),
    [leads, customers, contacts, deals, quotes, orders, cases],
  );
}
