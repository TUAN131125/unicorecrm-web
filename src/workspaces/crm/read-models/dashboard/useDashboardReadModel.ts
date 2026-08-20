import { useMemo } from "react";
import { getLeadsSnapshot, subscribeToLeads } from "@/modules/leads";
import { getDealsSnapshot, subscribeToDeals } from "@/modules/deals";
import { getCustomersSnapshot, subscribeToCustomers } from "@/modules/customers";
import { getSupportCasesSnapshot, subscribeToSupportCases } from "@/modules/support";
import { getTaskActivitySnapshot, subscribeToTaskActivity } from "@/modules/tasks";
import { getQuotesSnapshot, subscribeToQuotes } from "@/modules/quotes";
import { getOrdersSnapshot, subscribeToOrders } from "@/modules/orders";
import { useWorkspaceOperationalConfiguration } from "@/platform/workspace-config";
import { useRepositorySnapshot } from "../core/useRepositorySnapshot";

export function useDashboardReadModel() {
  const leads = useRepositorySnapshot(subscribeToLeads, getLeadsSnapshot);
  const deals = useRepositorySnapshot(subscribeToDeals, getDealsSnapshot);
  const customers = useRepositorySnapshot(subscribeToCustomers, getCustomersSnapshot);
  const cases = useRepositorySnapshot(subscribeToSupportCases, getSupportCasesSnapshot);
  const taskActivity = useRepositorySnapshot(subscribeToTaskActivity, getTaskActivitySnapshot);
  const quotes = useRepositorySnapshot(subscribeToQuotes, getQuotesSnapshot);
  const orders = useRepositorySnapshot(subscribeToOrders, getOrdersSnapshot);
  const configuration = useWorkspaceOperationalConfiguration();

  return useMemo(() => ({
    leads,
    deals,
    customers,
    cases,
    tasks: taskActivity.tasks,
    activities: taskActivity.activities,
    quotes,
    orders,
    timezone: configuration.localeRegion.timezone,
    baseCurrency: configuration.localeRegion.currencies.baseCurrency,
  }), [leads, deals, customers, cases, taskActivity.tasks, taskActivity.activities, quotes, orders, configuration.localeRegion.timezone, configuration.localeRegion.currencies.baseCurrency]);
}
