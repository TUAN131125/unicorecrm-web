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
import {
  getOrganizationAccountsSnapshot,
  subscribeToOrganizationAccounts,
} from "@/modules/organizations";
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
  buildContactAiContext,
  buildCustomerAiContext,
  buildDealAiContext,
  buildGlobalAiContext,
  buildOrderAiContext,
  buildOrganizationAiContext,
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
  const organizations = useRepositorySnapshot(
    subscribeToOrganizationAccounts,
    getOrganizationAccountsSnapshot,
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
      organizations,
      tasks: taskActivity.tasks,
      actorId: session.principal.memberId,
    };
    const focus = resolveAiRouteFocus(pathname);
    if (focus?.type === "customer")
      return buildCustomerAiContext(focus.id, state);
    if (focus?.type === "organization")
      return buildOrganizationAiContext(focus.id, state);
    if (focus?.type === "contact") return buildContactAiContext(focus.id, state);
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
    organizations,
    taskActivity,
    pathname,
    session.principal.memberId,
  ]);
}

/**
 * Focused AI entities that have a canonical context builder today. Owners
 * without one (payment, invoice, shipping, return, product) are documented as
 * gaps in the AI context builder and intentionally stay unmapped.
 */
type AiRouteFocusType =
  | "customer"
  | "organization"
  | "contact"
  | "deal"
  | "quote"
  | "order"
  | "case"
  | "task";

function resolveAiRouteFocus(
  pathname?: string,
):
  | { type: AiRouteFocusType; id: string }
  | undefined {
  if (!pathname) return undefined;
  const canonical = parseCanonicalRoute(pathname);
  const relativePath = canonical?.relativePath ? `/${canonical.relativePath}` : pathname;
  const patterns: Array<{ type: AiRouteFocusType; pattern: RegExp }> = [
    { type: "customer", pattern: /^\/customers\/([^/]+)$/ },
    { type: "organization", pattern: /^\/organizations\/([^/]+)$/ },
    { type: "contact", pattern: /^\/contacts\/([^/]+)$/ },
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
