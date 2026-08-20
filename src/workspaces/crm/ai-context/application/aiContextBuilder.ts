import type { Lead } from "@/modules/leads";
import {
  buildCustomer360ReadModel,
  buildCustomerRelationshipAssessment,
  type Customer,
} from "@/modules/customers";
import type { Contact } from "@/modules/contacts";
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
  tasks: Task[];
  focusedItem?: {
    entityType:
      | "lead"
      | "customer"
      | "contact"
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
