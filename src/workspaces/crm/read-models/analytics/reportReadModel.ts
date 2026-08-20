import { isPositiveQualificationOutcome, type Lead } from "@/modules/leads";
import type { Customer } from "@/modules/customers";
import { projectCustomerForPresentation } from "@/modules/customers";
import { DealStage, type Deal } from "@/modules/deals";
import { QuoteStatus, type Quote } from "@/modules/quotes";
import { flattenOrders, type CustomerOrder } from "@/modules/orders";
import { relationshipRefKey } from "@/platform/identity";

// 1. Calculate Lead Conversion Rate
export function calculateLeadConversionRate(leads: Lead[]): number {
  if (!leads || leads.length === 0) return 0;
  const convertedCount = leads.filter(
    (lead) => isPositiveQualificationOutcome(lead.qualificationOutcome)
  ).length;
  return Math.round((convertedCount / leads.length) * 100);
}

// 2. Calculate Quote Acceptance Rate
export function calculateQuoteAcceptanceRate(quotes: Quote[]): number {
  if (!quotes || quotes.length === 0) return 0;
  const acceptedQuotes = quotes.filter((q) => q.status === QuoteStatus.ACCEPTED).length;
  return Math.round((acceptedQuotes / quotes.length) * 100);
}

// 3. Calculate Completed Order Revenue
export function calculateCompletedOrderRevenue(orders: Record<string, CustomerOrder[]> | CustomerOrder[] | undefined): number {
  const flatOrders = flattenOrders(orders);
  return flatOrders
    .filter((o) => o.state === "COMPLETED")
    .reduce((sum, o) => sum + (o.grandTotal ?? o.totalAmount ?? 0), 0);
}

// 4. Calculate Open Pipeline Value
export function calculateOpenPipelineValue(deals: Deal[]): number {
  if (!deals || deals.length === 0) return 0;
  return deals
    .filter((d) => d.stage !== DealStage.WON && d.stage !== DealStage.LOST)
    .reduce((sum, d) => sum + (d.amount || 0), 0);
}

// 5. Calculate Funnel Metrics
export interface FunnelMetric {
  stage: string;
  count: number;
  value?: number;
  percentage: number;
  labelVi: string;
  labelEn: string;
}

export function calculateFunnelMetrics(
  leads: Lead[],
  deals: Deal[],
  quotes: Quote[],
  orders: Record<string, CustomerOrder[]> | CustomerOrder[] | undefined
): FunnelMetric[] {
  const flatOrders = flattenOrders(orders);
  const totalLeads = leads?.length || 0;
  const qualifiedLeads = leads?.filter((lead) => isPositiveQualificationOutcome(lead.qualificationOutcome)).length || 0;
  
  const opportunities = deals?.length || 0;
  const totalOppValue = deals?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0;

  const totalQuotes = quotes?.length || 0;
  const acceptedQuotes = quotes?.filter((q) => q.status === QuoteStatus.ACCEPTED).length || 0;

  const totalOrders = flatOrders?.length || 0;
  const completedOrders = flatOrders?.filter((o) => o.state === "COMPLETED").length || 0;

  const base = totalLeads || 1;

  return [
    {
      stage: "leads",
      count: totalLeads,
      percentage: 100,
      labelVi: "Khách hàng tiềm năng (Leads)",
      labelEn: "Leads"
    },
    {
      stage: "qualified",
      count: qualifiedLeads,
      percentage: Math.round((qualifiedLeads / base) * 100),
      labelVi: "Leads đủ điều kiện (Qualified)",
      labelEn: "Qualified Leads"
    },
    {
      stage: "opportunities",
      count: opportunities,
      value: totalOppValue,
      percentage: Math.round((opportunities / base) * 100),
      labelVi: "Cơ hội (Opportunities)",
      labelEn: "Opportunities"
    },
    {
      stage: "quotes",
      count: totalQuotes,
      percentage: Math.round((totalQuotes / base) * 100),
      labelVi: "Đã báo giá (Quotes)",
      labelEn: "Quotes Sent"
    },
    {
      stage: "acceptedQuotes",
      count: acceptedQuotes,
      percentage: Math.round((acceptedQuotes / base) * 100),
      labelVi: "Báo giá chấp nhận (Accepted)",
      labelEn: "Accepted Quotes"
    },
    {
      stage: "orders",
      count: totalOrders,
      percentage: Math.round((totalOrders / base) * 100),
      labelVi: "Đơn hàng được tạo (Orders)",
      labelEn: "Orders Created"
    },
    {
      stage: "completedOrders",
      count: completedOrders,
      percentage: Math.round((completedOrders / base) * 100),
      labelVi: "Đơn hàng hoàn tất (Completed)",
      labelEn: "Completed Orders"
    }
  ];
}

// 6. Calculate Top Customers by Order Value
export interface TopCustomerMetric {
  customerId: string;
  customerName: string;
  orderCount: number;
  totalSpent: number;
}

export function calculateTopCustomers(
  customers: Customer[],
  orders: Record<string, CustomerOrder[]> | CustomerOrder[] | undefined
): TopCustomerMetric[] {
  const flatOrders = flattenOrders(orders);
  const customerByRelationship = new Map(customers.map((customer) => [relationshipRefKey(customer.relationshipRef), customer]));
  const customerByAlias = new Map(customers.flatMap((customer) => [customer.id, customer.customerCode, ...(customer.legacyAliases ?? [])].map((alias) => [alias, customer] as const)));
  const customerMap: Record<string, { name: string; count: number; spent: number }> = {};

  for (const order of flatOrders) {
    const customer = customerByRelationship.get(relationshipRefKey(order.buyerRef))
      ?? (order.customerId ? customerByAlias.get(order.customerId) : undefined);
    if (!customer) continue;
    const customerId = customer.id;
    const name = projectCustomerForPresentation(customer).displayName;
    const amount = order.state === "COMPLETED" ? (order.grandTotal ?? order.totalAmount ?? 0) : 0;
    if (!customerMap[customerId]) customerMap[customerId] = { name, count: 0, spent: 0 };
    customerMap[customerId].count += 1;
    customerMap[customerId].spent += amount;
  }

  return Object.entries(customerMap)
    .map(([customerId, value]) => ({
      customerId,
      customerName: value.name,
      orderCount: value.count,
      totalSpent: value.spent,
    }))
    .sort((left, right) => right.totalSpent - left.totalSpent)
    .slice(0, 10);
}

export interface CustomerPopulationMetric {
  total: number;
  b2c: number;
  b2b: number;
  active: number;
  withTransactions: number;
  withoutTransactions: number;
}

export function calculateCustomerPopulation(
  customers: Customer[],
  orders: Record<string, CustomerOrder[]> | CustomerOrder[] | undefined,
): CustomerPopulationMetric {
  const customerRelationshipKeys = new Set(customers.map((customer) => relationshipRefKey(customer.relationshipRef)));
  const transactingRelationshipKeys = new Set(
    flattenOrders(orders)
      .map((order) => relationshipRefKey(order.buyerRef))
      .filter((key) => customerRelationshipKeys.has(key)),
  );
  return {
    total: customers.length,
    b2c: customers.filter((customer) => customer.type === "B2C").length,
    b2b: customers.filter((customer) => customer.type === "B2B").length,
    active: customers.filter((customer) => String(customer.status).toUpperCase() === "ACTIVE").length,
    withTransactions: transactingRelationshipKeys.size,
    withoutTransactions: Math.max(0, customers.length - transactingRelationshipKeys.size),
  };
}

// 7. Calculate Orders by Status
export interface StatusDistribution {
  status: string;
  count: number;
  totalValue: number;
  percentage: number;
}

export function calculateOrdersByStatus(orders: Record<string, CustomerOrder[]> | CustomerOrder[] | undefined): StatusDistribution[] {
  const flatOrders = flattenOrders(orders);
  if (flatOrders.length === 0) return [];

  const groups: Record<string, { count: number; val: number }> = {};
  flatOrders.forEach((o) => {
    const status = o.state || "draft";
    if (!groups[status]) {
      groups[status] = { count: 0, val: 0 };
    }
    groups[status].count += 1;
    groups[status].val += (o.grandTotal ?? o.totalAmount ?? 0);
  });

  const total = flatOrders.length;
  return Object.keys(groups).map((status) => ({
    status,
    count: groups[status].count,
    totalValue: groups[status].val,
    percentage: Math.round((groups[status].count / total) * 100),
  }));
}

// 8. Calculate Quotes by Status
export function calculateQuotesByStatus(quotes: Quote[]): StatusDistribution[] {
  if (!quotes || quotes.length === 0) return [];
  const groups: Record<string, { count: number; val: number }> = {};
  quotes.forEach((q) => {
    const status = q.status || "DRAFT";
    if (!groups[status]) {
      groups[status] = { count: 0, val: 0 };
    }
    groups[status].count += 1;
    groups[status].val += (q.grandTotal ?? q.subtotal ?? 0);
  });

  const total = quotes.length;
  return Object.keys(groups).map((status) => ({
    status,
    count: groups[status].count,
    totalValue: groups[status].val,
    percentage: Math.round((groups[status].count / total) * 100),
  }));
}

// 9. Calculate Deals by Stage
export function calculateDealsByStage(deals: Deal[]): StatusDistribution[] {
  if (!deals || deals.length === 0) return [];
  const groups: Record<string, { count: number; val: number }> = {};
  deals.forEach((d) => {
    const stage = d.stage || "DISCOVERY";
    if (!groups[stage]) {
      groups[stage] = { count: 0, val: 0 };
    }
    groups[stage].count += 1;
    groups[stage].val += (d.amount || 0);
  });

  const total = deals.length;
  return Object.keys(groups).map((stage) => ({
    status: stage,
    count: groups[stage].count,
    totalValue: groups[stage].val,
    percentage: Math.round((groups[stage].count / total) * 100),
  }));
}
