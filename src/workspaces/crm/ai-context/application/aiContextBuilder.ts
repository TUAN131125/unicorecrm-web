import type { Lead } from "@/modules/leads";
import {
  buildCustomer360ReadModel,
  buildCustomerRelationshipAssessment,
  type Customer,
} from "@/modules/customers";
import type { Contact } from "@/modules/contacts";
import type { OrganizationAccount } from "@/modules/organizations";
import { DealStage, type Deal } from "@/modules/deals";
import type { Quote } from "@/modules/quotes";
import type { SupportCase } from "@/modules/support";
import {
  flattenOrders,
  type CustomerOrder,
  type OrderCollection,
} from "@/modules/orders";
import type { Product } from "@/modules/products";
import type { Task } from "@/modules/tasks";

export interface GlobalAiState {
  leads: Lead[];
  customers: Customer[];
  contacts: Contact[];
  deals: Deal[];
  quotes: Quote[];
  orders: OrderCollection | CustomerOrder[];
  cases: SupportCase[];
  products: Product[];
  tasks?: Task[];
  /** Canonical Organization relationship records read through the module public API. */
  organizations?: OrganizationAccount[];
  actorId?: string;
}

export interface AiContextWrapper {
  globalContext: {
    leadsCount: number;
    customersCount: number;
    contactsCount: number;
    dealsCount: number;
    quotesCount: number;
    ordersCount: number;
    casesCount: number;
    productsCount: number;
    organizationsCount: number;
    tasksCount: number;
    openTasksCount: number;
    overdueTasksCount: number;
    totalPipelineValue: number;
    totalExpectedRevenue: number;
    totalOrdersValue: number;
    actorId?: string;
  };
  leads: Lead[];
  customers: Customer[];
  contacts: Contact[];
  deals: Deal[];
  quotes: Quote[];
  orders: CustomerOrder[];
  cases: SupportCase[];
  products: Product[];
  organizations: OrganizationAccount[];
  tasks: Task[];
  focusedItem?: {
    entityType:
      | "lead"
      | "customer"
      | "contact"
      | "organization"
      | "deal"
      | "quote"
      | "order"
      | "case"
      | "task"
      | "report";
    data: unknown;
    relatedItems?: Record<string, unknown>;
  };
}

export function buildGlobalAiContext(state: GlobalAiState): AiContextWrapper {
  const flatOrders = flattenOrders(state.orders);
  const tasks = state.tasks ?? [];
  const organizations = state.organizations ?? [];
  const openTasks = tasks.filter((task) => task.status === "OPEN");
  const overdueTasks = openTasks.filter((task) => new Date(task.dueAt).getTime() < Date.now());

  // Calculations
  const totalPipelineValue = state.deals
    .filter((d) => d.stage !== DealStage.WON && d.stage !== DealStage.LOST)
    .reduce((sum, d) => sum + (d.amount || 0), 0);

  const totalExpectedRevenue = state.deals
    .filter((d) => d.stage !== DealStage.WON && d.stage !== DealStage.LOST)
    .reduce(
      (sum, d) =>
        sum +
        (d.amount || 0) * ((d.opportunityScore || 0) / 100),
      0,
    );

  const totalOrdersValue = flatOrders
    .filter((o) => o.state === "COMPLETED" || o.state === "CONFIRMED")
    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  return {
    globalContext: {
      leadsCount: state.leads.length,
      customersCount: state.customers.length,
      contactsCount: state.contacts.length,
      dealsCount: state.deals.length,
      quotesCount: state.quotes.length,
      ordersCount: flatOrders.length,
      casesCount: state.cases.length,
      productsCount: state.products.length,
      organizationsCount: organizations.length,
      tasksCount: tasks.length,
      openTasksCount: openTasks.length,
      overdueTasksCount: overdueTasks.length,
      totalPipelineValue,
      totalExpectedRevenue,
      totalOrdersValue,
      actorId: state.actorId,
    },
    leads: state.leads,
    customers: state.customers,
    contacts: state.contacts,
    deals: state.deals,
    quotes: state.quotes,
    orders: flatOrders,
    cases: state.cases,
    products: state.products,
    organizations,
    tasks,
  };
}

export function buildCustomerAiContext(
  customerId: string,
  state: GlobalAiState,
): AiContextWrapper {
  const wrapper = buildGlobalAiContext(state);
  const customer = state.customers.find((item) => item.id === customerId);

  if (customer) {
    const readModel = buildCustomer360ReadModel(customer);
    const intelligence = buildCustomerRelationshipAssessment(readModel);

    wrapper.focusedItem = {
      entityType: "customer",
      data: customer,
      relatedItems: {
        readModel,
        intelligence,
        leads: readModel.leads,
        contacts: readModel.identity.contacts,
        deals: readModel.deals,
        quotes: readModel.quotes,
        orders: readModel.orders,
        cases: readModel.supportCases,
        tasks: readModel.tasks,
        returns: readModel.returns,
        returnIntents: readModel.returnIntents,
        timeline: readModel.timeline,
      },
    };
  }
  return wrapper;
}

export function buildDealAiContext(
  dealId: string,
  state: GlobalAiState,
): AiContextWrapper {
  const wrapper = buildGlobalAiContext(state);
  const deal = state.deals.find((d) => d.id === dealId);

  if (deal) {
    const customer = state.customers.find((c) => c.id === deal.customerId);
    const contact = state.contacts.find((c) => c.id === deal.contactId);
    const quotes = state.quotes.filter((q) => q.dealId === dealId);
    const flatOrders = flattenOrders(state.orders);
    const relatedOrders = flatOrders.filter((o) => o.sourceDealId === dealId);

    wrapper.focusedItem = {
      entityType: "deal",
      data: deal,
      relatedItems: {
        customer,
        contact,
        quotes,
        orders: relatedOrders,
      },
    };
  }
  return wrapper;
}

export function buildQuoteAiContext(
  quoteId: string,
  state: GlobalAiState,
): AiContextWrapper {
  const wrapper = buildGlobalAiContext(state);
  const quote = state.quotes.find((q) => q.id === quoteId);

  if (quote) {
    const deal = state.deals.find((d) => d.id === quote.dealId);
    const customer = state.customers.find((c) => c.id === quote.customerId);
    const flatOrders = flattenOrders(state.orders);
    const relatedOrders = flatOrders.filter((o) => o.sourceQuoteId === quoteId);

    wrapper.focusedItem = {
      entityType: "quote",
      data: quote,
      relatedItems: {
        deal,
        customer,
        orders: relatedOrders,
      },
    };
  }
  return wrapper;
}

export function buildOrderAiContext(
  orderId: string,
  state: GlobalAiState,
): AiContextWrapper {
  const wrapper = buildGlobalAiContext(state);
  const flatOrders = flattenOrders(state.orders);
  const order = flatOrders.find((o) => o.id === orderId);

  if (order) {
    const customer = state.customers.find((c) => c.id === order.customerId);
    const contact = state.contacts.find((c) => c.id === order.contactId);
    const deal = state.deals.find((d) => d.id === order.sourceDealId);
    const quote = state.quotes.find((q) => q.id === order.sourceQuoteId);

    wrapper.focusedItem = {
      entityType: "order",
      data: order,
      relatedItems: {
        customer,
        contact,
        deal,
        quote,
      },
    };
  }
  return wrapper;
}

export function buildSupportCaseAiContext(
  caseId: string,
  state: GlobalAiState,
): AiContextWrapper {
  const wrapper = buildGlobalAiContext(state);
  const caseItem = state.cases.find((c) => c.id === caseId);

  if (caseItem) {
    const customer = state.customers.find((c) => c.id === caseItem.customerId);
    const contact = state.contacts.find((c) => c.id === caseItem.contactId);
    const flatOrders = flattenOrders(state.orders);
    const order = flatOrders.find((o) => o.id === caseItem.relatedOrderId);

    wrapper.focusedItem = {
      entityType: "case",
      data: caseItem,
      relatedItems: {
        customer,
        contact,
        order,
      },
    };
  }
  return wrapper;
}

export function buildReportAiContext(state: GlobalAiState): AiContextWrapper {
  const wrapper = buildGlobalAiContext(state);
  wrapper.focusedItem = {
    entityType: "report",
    data: {
      reportsEnabled: true,
      mrrGrowthRate: 14.5,
      pipelineHealthScore: 82,
      caseSlaComplianceRate: 91.4,
    },
  };
  return wrapper;
}

export function buildTaskAiContext(
  taskId: string,
  state: GlobalAiState,
): AiContextWrapper {
  const wrapper = buildGlobalAiContext(state);
  const task = (state.tasks ?? []).find((item) => item.id === taskId);
  if (task) {
    const relatedCustomer = task.customerId
      ? state.customers.find((item) => item.id === task.customerId)
      : undefined;
    wrapper.focusedItem = {
      entityType: "task",
      data: task,
      relatedItems: { customer: relatedCustomer, recordRef: task.recordRef },
    };
  }
  return wrapper;
}

/**
 * Organization is a first-class focused AI entity. The builder reads canonical
 * Organization data and the CRM records related to it through public/read
 * boundaries only; it introduces no writes and does not restate Customer 360
 * business logic.
 */
export function buildOrganizationAiContext(
  organizationAccountId: string,
  state: GlobalAiState,
): AiContextWrapper {
  const wrapper = buildGlobalAiContext(state);
  const organization = (state.organizations ?? []).find((item) => item.id === organizationAccountId);
  if (!organization) return wrapper;

  const relatedContactIds = new Set(organization.contactRefs.map((ref) => ref.id));
  const contacts = state.contacts.filter((contact) => relatedContactIds.has(contact.id));
  const contactIds = new Set(contacts.map((contact) => contact.id));

  const deals = state.deals.filter(
    (deal) => (deal.buyerRef.type === "ORGANIZATION_ACCOUNT" && deal.buyerRef.id === organizationAccountId)
      || (deal.contactId ? contactIds.has(deal.contactId) : false),
  );
  const dealIds = new Set(deals.map((deal) => deal.id));
  const quotes = state.quotes.filter((quote) => (quote.dealId ? dealIds.has(quote.dealId) : false));
  const orders = wrapper.orders.filter(
    (order) => (order.sourceDealId ? dealIds.has(order.sourceDealId) : false)
      || (order.contactId ? contactIds.has(order.contactId) : false),
  );
  const cases = state.cases.filter((item) => (item.contactId ? contactIds.has(item.contactId) : false));
  const tasks = wrapper.tasks.filter(
    (task) => task.recordRef?.moduleKey === "organizations" && task.recordRef.recordId === organizationAccountId,
  );

  wrapper.focusedItem = {
    entityType: "organization",
    data: organization,
    relatedItems: {
      primaryContactId: organization.primaryContactId,
      contacts,
      deals,
      quotes,
      orders,
      cases,
      tasks,
    },
  };
  return wrapper;
}

/**
 * Contact is declared as a focused AI entity, so it owns a dedicated builder
 * rather than falling back to the global context.
 */
export function buildContactAiContext(
  contactId: string,
  state: GlobalAiState,
): AiContextWrapper {
  const wrapper = buildGlobalAiContext(state);
  const contact = state.contacts.find((item) => item.id === contactId);
  if (!contact) return wrapper;

  const organizations = (state.organizations ?? []).filter((account) =>
    account.contactRefs.some((ref) => ref.id === contactId),
  );
  const deals = state.deals.filter((deal) => deal.contactId === contactId);
  const dealIds = new Set(deals.map((deal) => deal.id));
  const quotes = state.quotes.filter((quote) => (quote.dealId ? dealIds.has(quote.dealId) : false));
  const orders = wrapper.orders.filter((order) => order.contactId === contactId);
  const cases = state.cases.filter((item) => item.contactId === contactId);
  const tasks = wrapper.tasks.filter(
    (task) => task.recordRef?.moduleKey === "contacts" && task.recordRef.recordId === contactId,
  );

  wrapper.focusedItem = {
    entityType: "contact",
    data: contact,
    relatedItems: { organizations, deals, quotes, orders, cases, tasks },
  };
  return wrapper;
}

/**
 * GAP — focused AI context is not yet supported for these owners. Each one needs
 * a canonical read boundary review before AI may summarize it:
 *
 * TODO(ai-context): payment  — Payment/receivable truth is financial data; a
 *   FINANCIAL data-class decision and a Payments read projection are required.
 * TODO(ai-context): invoice  — depends on the same receivables read boundary.
 * TODO(ai-context): shipping — Shipping booking state is owned by carrier
 *   integrations; the AI context must read a settled projection, not live state.
 * TODO(ai-context): return   — Return resolution evidence is workflow-owned and
 *   must be summarized from the resolution read model, not the aggregate.
 * TODO(ai-context): product  — Catalog focus has no product-detail AI journey yet.
 *
 * Until then `resolveAiRouteFocus` deliberately does not map those routes, and
 * the assistant answers from the global context instead of inventing a focus.
 */
export const UNSUPPORTED_FOCUSED_AI_ENTITIES = [
  "payment",
  "invoice",
  "shipping",
  "return",
  "product",
] as const;
