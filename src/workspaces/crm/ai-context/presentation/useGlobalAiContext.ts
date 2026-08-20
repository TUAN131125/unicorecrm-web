import { useMemo } from "react";
import { usePlatformState } from "@/platform/application-state";
import { parseCanonicalRoute } from "@/platform/navigation";
import { getContactsSnapshot, subscribeToContacts } from "@/modules/contacts";
import {
  getCustomersSnapshot,
  subscribeToCustomers,
} from "@/modules/customers";
import { getDealsSnapshot, subscribeToDeals } from "@/modules/deals";
import { getLeadsSnapshot, subscribeToLeads } from "@/modules/leads";
import { getOrdersSnapshot, subscribeToOrders } from "@/modules/orders";
import {
  getProductCatalogSnapshot,
  subscribeToProductCatalog,
} from "@/modules/products";
import { getQuotesSnapshot, subscribeToQuotes } from "@/modules/quotes";
import {
  getSupportCasesSnapshot,
  subscribeToSupportCases,
} from "@/modules/support";
import { getTaskActivitySnapshot, subscribeToTaskActivity } from "@/modules/tasks";
import { useRepositorySnapshot } from "@/workspaces/crm/read-models/core/useRepositorySnapshot";
import {
  buildCustomerAiContext,
  buildDealAiContext,
  buildGlobalAiContext,
  buildOrderAiContext,
  buildQuoteAiContext,
  buildSupportCaseAiContext,
  buildTaskAiContext,
} from "../application/aiContextBuilder";

export function useGlobalAiContext(pathname?: string) {
  const { session } = usePlatformState();
  const leads = useRepositorySnapshot(subscribeToLeads, getLeadsSnapshot);
  const customers = useRepositorySnapshot(
    subscribeToCustomers,
    getCustomersSnapshot,
  );
  const contacts = useRepositorySnapshot(
    subscribeToContacts,
    getContactsSnapshot,
  );
  const deals = useRepositorySnapshot(subscribeToDeals, getDealsSnapshot);
  const quotes = useRepositorySnapshot(subscribeToQuotes, getQuotesSnapshot);
  const orders = useRepositorySnapshot(subscribeToOrders, getOrdersSnapshot);
  const cases = useRepositorySnapshot(
    subscribeToSupportCases,
    getSupportCasesSnapshot,
  );
  const products = useRepositorySnapshot(
    subscribeToProductCatalog,
    getProductCatalogSnapshot,
  );
  const taskActivity = useRepositorySnapshot(
    subscribeToTaskActivity,
    getTaskActivitySnapshot,
  );

  return useMemo(() => {
    const state = {
      leads,
      customers,
      contacts,
      deals,
      quotes,
      orders,
      cases,
      products,
      tasks: taskActivity.tasks,
      actorId: session.principal.memberId,
    };
    const focus = resolveAiRouteFocus(pathname);
    if (focus?.type === "customer")
      return buildCustomerAiContext(focus.id, state);
    if (focus?.type === "deal") return buildDealAiContext(focus.id, state);
    if (focus?.type === "quote") return buildQuoteAiContext(focus.id, state);
    if (focus?.type === "order") return buildOrderAiContext(focus.id, state);
    if (focus?.type === "case")
      return buildSupportCaseAiContext(focus.id, state);
    if (focus?.type === "task") return buildTaskAiContext(focus.id, state);
    return buildGlobalAiContext(state);
  }, [
    leads,
    customers,
    contacts,
    deals,
    quotes,
    orders,
    cases,
    products,
    taskActivity,
    pathname,
    session.principal.memberId,
  ]);
}

function resolveAiRouteFocus(
  pathname?: string,
):
  | { type: "customer" | "deal" | "quote" | "order" | "case" | "task"; id: string }
  | undefined {
  if (!pathname) return undefined;
  const canonical = parseCanonicalRoute(pathname);
  const relativePath = canonical?.relativePath ? `/${canonical.relativePath}` : pathname;
  const patterns: Array<{
    type: "customer" | "deal" | "quote" | "order" | "case" | "task";
    pattern: RegExp;
  }> = [
    { type: "customer", pattern: /^\/customers\/([^/]+)$/ },
    { type: "deal", pattern: /^\/deals\/([^/]+)$/ },
    { type: "quote", pattern: /^\/quotes\/([^/]+)$/ },
    { type: "order", pattern: /^\/orders\/([^/]+)$/ },
    { type: "case", pattern: /^\/support\/cases\/([^/]+)$/ },
    { type: "task", pattern: /^\/tasks\/([^/]+)$/ },
  ];
  for (const entry of patterns) {
    const match = relativePath.match(entry.pattern);
    if (match?.[1])
      return { type: entry.type, id: decodeURIComponent(match[1]) };
  }
  return undefined;
}
