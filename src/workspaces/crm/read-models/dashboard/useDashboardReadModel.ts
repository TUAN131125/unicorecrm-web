import { useMemo } from "react";
import { getLeadsSnapshot, subscribeToLeads } from "@/modules/leads";
import { getDealsSnapshot, subscribeToDeals } from "@/modules/deals";
import { getCustomersSnapshot, subscribeToCustomers } from "@/modules/customers";
import { getSupportCasesSnapshot, subscribeToSupportCases } from "@/modules/support";
import { getTaskActivitySnapshot, subscribeToTaskActivity } from "@/modules/tasks";
import { getQuotesSnapshot, subscribeToQuotes } from "@/modules/quotes";
import { getOrdersSnapshot, subscribeToOrders } from "@/modules/orders";
import { useWorkspaceRuntimeSettings } from "@/platform/workspace-config";
import { useRepositorySnapshot } from "../core/useRepositorySnapshot";

/** Local demo snapshots only. Connected Dashboard uses owner queries in useConnectedDashboardReadModel. */
export function useDashboardDemoReadModel() {
  const leads = useRepositorySnapshot(subscribeToLeads, getLeadsSnapshot);
  const deals = useRepositorySnapshot(subscribeToDeals, getDealsSnapshot);
  const customers = useRepositorySnapshot(subscribeToCustomers, getCustomersSnapshot);
  const cases = useRepositorySnapshot(subscribeToSupportCases, getSupportCasesSnapshot);
  const taskActivity = useRepositorySnapshot(subscribeToTaskActivity, getTaskActivitySnapshot);
  const quotes = useRepositorySnapshot(subscribeToQuotes, getQuotesSnapshot);
  const orders = useRepositorySnapshot(subscribeToOrders, getOrdersSnapshot);
  const configuration = useWorkspaceRuntimeSettings();

  return useMemo(() => ({
    leads,
    deals,
    customers,
    cases,
    tasks: taskActivity.tasks,
    activities: taskActivity.activities,
    quotes,
    orders,
    timezone: configuration.timeZone,
    baseCurrency: configuration.baseCurrency,
  }), [leads, deals, customers, cases, taskActivity.tasks, taskActivity.activities, quotes, orders, configuration.timeZone, configuration.baseCurrency]);
}
