import { isPositiveQualificationOutcome, LeadWorkState, type Lead } from "@/modules/leads";
import { DealStage, type Deal } from "@/modules/deals";
import { QuoteStatus, type Quote } from "@/modules/quotes";
import { flattenOrders, type CustomerOrder } from "@/modules/orders";
import type { Customer } from "@/modules/customers";
import { projectCustomerForPresentation } from "@/modules/customers";
import type { SupportCase } from "@/modules/support";
import { relationshipRefKey } from "@/platform/identity";
import { CRM_METRIC_CATALOG, CRM_METRIC_IDS, type CrmMetricId } from "../domain/metricCatalog";
import type { CohortFunnelResult, MetricPeriod, MetricPeriodKey, MetricResult, MetricSourceRecord } from "../domain/metric.types";
import { isDateInMetricPeriod, resolveMetricPeriod, resolvePreviousMetricPeriod } from "./metricPeriod";

export interface CrmMetricDataset {
  leads: Lead[];
  deals: Deal[];
  quotes: Quote[];
  orders: Record<string, CustomerOrder[]> | CustomerOrder[] | undefined;
  customers: Customer[];
  cases: SupportCase[];
}

export interface BuildMetricInput extends CrmMetricDataset {
  metricId: CrmMetricId;
  periodKey: MetricPeriodKey;
  timezone: string;
  startDate?: string;
  endDate?: string;
  now?: Date;
}

function maxIso(values: Array<string | undefined>): string | undefined {
  return values.filter((value): value is string => Boolean(value)).sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0];
}

function orderOccurredAt(order: CustomerOrder): string | undefined {
  return order.completedAt ?? order.updatedAt ?? order.createdAt ?? order.orderDate;
}

function percent(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

function result(input: BuildMetricInput, period: MetricPeriod, value: number, records: MetricSourceRecord[], extra: Partial<MetricResult> = {}): MetricResult {
  return {
    definition: CRM_METRIC_CATALOG[input.metricId],
    value,
    status: records.length > 0 ? "READY" : "NO_DATA",
    period,
    timezone: input.timezone,
    records,
    ...extra,
  };
}

export function buildCrmMetric(input: BuildMetricInput): MetricResult {
  const now = input.now ?? new Date();
  const definition = CRM_METRIC_CATALOG[input.metricId];
  const period = resolveMetricPeriod(
    definition.periodMode === "SNAPSHOT" ? "all_time" : input.periodKey,
    now,
    input.timezone,
    { startDate: input.startDate, endDate: input.endDate },
  );
  const orders = flattenOrders(input.orders);

  switch (input.metricId) {
    case CRM_METRIC_IDS.MONTHLY_COMPLETED_REVENUE: {
      const relevant = orders.filter((order) => String(order.state).toUpperCase() === "COMPLETED" && isDateInMetricPeriod(orderOccurredAt(order), period, input.timezone));
      const records = relevant.map((order) => ({ id: order.id, module: "orders" as const, primaryText: order.orderNumber, secondaryText: order.customerName, status: String(order.state), occurredAt: orderOccurredAt(order), amount: order.grandTotal ?? order.totalAmount ?? 0, route: `orders/${order.id}` }));
      const value = records.reduce((sum, item) => sum + (item.amount ?? 0), 0);
      const base = result(input, period, value, records, { lastUpdatedAt: maxIso(relevant.map(orderOccurredAt)) });
      const previous = resolvePreviousMetricPeriod(period);
      if (previous) {
        const previousValue = orders
          .filter((order) => String(order.state).toUpperCase() === "COMPLETED" && isDateInMetricPeriod(orderOccurredAt(order), previous, input.timezone))
          .reduce((sum, order) => sum + (order.grandTotal ?? order.totalAmount ?? 0), 0);
        base.comparison = previousValue > 0
          ? { previousValue, delta: value - previousValue, deltaPercent: Math.round(((value - previousValue) / previousValue) * 1000) / 10, status: "AVAILABLE" }
          : { previousValue, delta: value - previousValue, status: "UNAVAILABLE", reason: { vi: "Không tính tăng trưởng vì kỳ trước bằng 0.", en: "Growth is unavailable because the previous period is zero." } };
      }
      return base;
    }
    case CRM_METRIC_IDS.ACTIVE_LEADS: {
      const relevant = input.leads.filter((lead) => lead.leadWorkState !== LeadWorkState.CLOSED);
      return result(input, period, relevant.length, relevant.map((lead) => ({ id: lead.id, module: "leads", primaryText: lead.name, secondaryText: lead.companyName, status: String(lead.leadWorkState), occurredAt: lead.updatedAt ?? lead.createdAt, route: `leads/${lead.id}` })), { lastUpdatedAt: maxIso(relevant.map((lead) => lead.updatedAt ?? lead.createdAt)) });
    }
    case CRM_METRIC_IDS.OPEN_PIPELINE_VALUE: {
      const relevant = input.deals.filter((deal) => ![DealStage.WON, DealStage.LOST].includes(deal.stage as DealStage));
      const records = relevant.map((deal) => ({ id: deal.id, module: "deals" as const, primaryText: deal.name, secondaryText: deal.customerName, status: String(deal.stage), occurredAt: deal.updatedAt ?? deal.createdAt, amount: deal.amount, route: `deals/${deal.id}` }));
      return result(input, period, records.reduce((sum, item) => sum + (item.amount ?? 0), 0), records, { lastUpdatedAt: maxIso(relevant.map((deal) => deal.updatedAt ?? deal.createdAt)) });
    }
    case CRM_METRIC_IDS.OPEN_SUPPORT_CASES: {
      const relevant = input.cases.filter((item) => !["RESOLVED", "CLOSED", "CANCELLED"].includes(String(item.status).toUpperCase()));
      return result(input, period, relevant.length, relevant.map((item) => ({ id: item.id, module: "support", primaryText: item.title, secondaryText: item.customerName, status: String(item.status), occurredAt: item.updatedAt ?? item.createdAt, route: `support/cases/${item.id}` })), { lastUpdatedAt: maxIso(relevant.map((item) => item.updatedAt ?? item.createdAt)) });
    }
    case CRM_METRIC_IDS.LEAD_QUALIFICATION_RATE: {
      const denominatorRecords = input.leads.filter((lead) => isDateInMetricPeriod(lead.createdAt, period, input.timezone));
      const numeratorRecords = denominatorRecords.filter((lead) => isPositiveQualificationOutcome(lead.qualificationOutcome));
      const records = denominatorRecords.map((lead) => ({ id: lead.id, module: "leads" as const, primaryText: lead.name, secondaryText: lead.companyName, status: String(lead.qualificationOutcome ?? lead.leadWorkState), occurredAt: lead.createdAt, route: `leads/${lead.id}` }));
      return result(input, period, percent(numeratorRecords.length, denominatorRecords.length), records, { numerator: numeratorRecords.length, denominator: denominatorRecords.length, lastUpdatedAt: maxIso(denominatorRecords.map((lead) => lead.updatedAt ?? lead.createdAt)) });
    }
    case CRM_METRIC_IDS.QUOTE_ACCEPTANCE_RATE: {
      const denominatorRecords = input.quotes.filter((quote) => isDateInMetricPeriod(quote.createdAt, period, input.timezone));
      const numeratorRecords = denominatorRecords.filter((quote) => quote.status === QuoteStatus.ACCEPTED);
      const records = denominatorRecords.map((quote) => ({ id: quote.id, module: "quotes" as const, primaryText: quote.quoteNumber, secondaryText: quote.customerName, status: String(quote.status), occurredAt: quote.updatedAt ?? quote.createdAt, amount: quote.grandTotal, route: `quotes/${quote.id}` }));
      return result(input, period, percent(numeratorRecords.length, denominatorRecords.length), records, { numerator: numeratorRecords.length, denominator: denominatorRecords.length, lastUpdatedAt: maxIso(denominatorRecords.map((quote) => quote.updatedAt ?? quote.createdAt)) });
    }
    case CRM_METRIC_IDS.COMPLETED_ORDERS: {
      const relevant = orders.filter((order) => String(order.state).toUpperCase() === "COMPLETED" && isDateInMetricPeriod(orderOccurredAt(order), period, input.timezone));
      return result(input, period, relevant.length, relevant.map((order) => ({ id: order.id, module: "orders", primaryText: order.orderNumber, secondaryText: order.customerName, status: String(order.state), occurredAt: orderOccurredAt(order), amount: order.grandTotal ?? order.totalAmount ?? 0, route: `orders/${order.id}` })), { lastUpdatedAt: maxIso(relevant.map(orderOccurredAt)) });
    }
    case CRM_METRIC_IDS.CUSTOMER_TOTAL: {
      const unique = new Map(input.customers.map((customer) => [relationshipRefKey(customer.relationshipRef), customer]));
      const relevant = [...unique.values()];
      return result(input, period, relevant.length, relevant.map((customer) => ({ id: customer.id, module: "customers", primaryText: projectCustomerForPresentation(customer).displayName, status: String(customer.status), occurredAt: customer.updatedAt ?? customer.createdAt, route: `customers/${customer.id}` })), { lastUpdatedAt: maxIso(relevant.map((customer) => customer.updatedAt ?? customer.createdAt)) });
    }
  }
}

export function buildCohortFunnel(input: CrmMetricDataset & { periodKey: MetricPeriodKey; timezone: string; startDate?: string; endDate?: string; now?: Date }): CohortFunnelResult {
  const now = input.now ?? new Date();
  const period = resolveMetricPeriod(input.periodKey, now, input.timezone, { startDate: input.startDate, endDate: input.endDate });
  const cohortLeads = input.leads.filter((lead) => isDateInMetricPeriod(lead.createdAt, period, input.timezone));
  const leadIds = new Set(cohortLeads.map((lead) => lead.id));
  const qualified = cohortLeads.filter((lead) => isPositiveQualificationOutcome(lead.qualificationOutcome));
  const qualifiedLeadIds = new Set(qualified.map((lead) => lead.id));
  const deals = input.deals.filter((deal) => Boolean(deal.leadId && leadIds.has(deal.leadId)));
  const dealLeadById = new Map(deals.map((deal) => [deal.id, deal.leadId as string]));
  const dealLeadIds = new Set(dealLeadById.values());
  const resolveQuoteLeadId = (quote: Quote): string | undefined => {
    if (quote.sourceLeadId && leadIds.has(quote.sourceLeadId)) return quote.sourceLeadId;
    const dealId = quote.dealId ?? quote.sourceDealId;
    return dealId ? dealLeadById.get(dealId) : undefined;
  };
  const quoteLeadPairs = input.quotes.map((quote) => [quote, resolveQuoteLeadId(quote)] as const).filter((entry): entry is readonly [Quote, string] => Boolean(entry[1]));
  const quotes = quoteLeadPairs.map(([quote]) => quote);
  const quoteLeadById = new Map(quoteLeadPairs.map(([quote, leadId]) => [quote.id, leadId]));
  const quoteLeadIds = new Set(quoteLeadById.values());
  const acceptedQuotes = quoteLeadPairs.filter(([quote]) => quote.status === QuoteStatus.ACCEPTED).map(([quote]) => quote);
  const acceptedQuoteLeadIds = new Set(acceptedQuotes.map((quote) => quoteLeadById.get(quote.id)).filter((leadId): leadId is string => Boolean(leadId)));
  const resolveOrderLeadId = (order: CustomerOrder): string | undefined => {
    if (order.sourceLeadId && leadIds.has(order.sourceLeadId)) return order.sourceLeadId;
    if (order.sourceDealId && dealLeadById.has(order.sourceDealId)) return dealLeadById.get(order.sourceDealId);
    return order.sourceQuoteId ? quoteLeadById.get(order.sourceQuoteId) : undefined;
  };
  const orderLeadPairs = flattenOrders(input.orders).map((order) => [order, resolveOrderLeadId(order)] as const).filter((entry): entry is readonly [CustomerOrder, string] => Boolean(entry[1]));
  const orders = orderLeadPairs.map(([order]) => order);
  const orderLeadById = new Map(orderLeadPairs.map(([order, leadId]) => [order.id, leadId]));
  const orderLeadIds = new Set(orderLeadById.values());
  const completedOrders = orders.filter((order) => String(order.state).toUpperCase() === "COMPLETED");
  const completedOrderLeadIds = new Set(completedOrders.map((order) => orderLeadById.get(order.id)).filter((leadId): leadId is string => Boolean(leadId)));
  const base = cohortLeads.length || 1;
  const stage = (id: CohortFunnelResult["stages"][number]["id"], vi: string, en: string, reachedLeadIds: Set<string>, records: Array<{ id: string }>) => ({ id, label: { vi, en }, count: reachedLeadIds.size, percentageOfCohort: Math.round((reachedLeadIds.size / base) * 100), sourceRecordIds: records.map((record) => record.id) });
  return {
    mode: "COHORT",
    definition: { vi: "Cùng một nhóm Lead được tạo trong kỳ và các bản ghi thương mại truy vết trực tiếp từ nhóm đó.", en: "One cohort of leads created in the period and commercial records directly traceable to that cohort." },
    period,
    timezone: input.timezone,
    lastUpdatedAt: maxIso([
      ...cohortLeads.map((lead) => lead.updatedAt ?? lead.createdAt),
      ...deals.map((deal) => deal.updatedAt ?? deal.createdAt),
      ...quotes.map((quote) => quote.updatedAt ?? quote.createdAt),
      ...orders.map(orderOccurredAt),
    ]),
    stages: [
      stage("leads", "Lead trong cohort", "Cohort leads", leadIds, cohortLeads),
      stage("qualified", "Lead đạt điều kiện", "Qualified leads", qualifiedLeadIds, qualified),
      stage("deals", "Lead có cơ hội", "Leads with deals", dealLeadIds, deals),
      stage("quotes", "Lead có báo giá", "Leads with quotes", quoteLeadIds, quotes),
      stage("accepted_quotes", "Lead có báo giá được chấp nhận", "Leads with accepted quotes", acceptedQuoteLeadIds, acceptedQuotes),
      stage("orders", "Lead có đơn hàng", "Leads with orders", orderLeadIds, orders),
      stage("completed_orders", "Lead có đơn hàng hoàn tất", "Leads with completed orders", completedOrderLeadIds, completedOrders),
    ],
  };
}
