export interface ProductUsageSummary {
  interestedLeads: number;
  openDeals: number;
  quotesCount: number;
  ordersCount: number;
  customersCount: number;
  wonRevenue: number;
  upcomingRenewals: number;
}

export interface ProductUsageSources {
  leads: readonly any[];
  deals: readonly any[];
  quotes: readonly any[];
  orders: readonly any[];
  customers: readonly any[];
}

export function getProductUsageSummary(productId: string, sources: ProductUsageSources): ProductUsageSummary {
  const interestedLeads = sources.leads.filter((lead) =>
    (lead.interestedProducts ?? []).some((item: any) =>
      typeof item === "string" ? item === productId : item.productId === productId,
    ),
  ).length;

  const openDeals = sources.deals.filter((deal) => {
    const isClosed = deal.stage === "WON" || deal.stage === "LOST";
    return !isClosed && (deal.lineItems ?? []).some((item: any) => item.productId === productId);
  }).length;

  const quotesCount = sources.quotes.filter((quote) =>
    (quote.lineItems ?? []).some((item: any) => item.productId === productId),
  ).length;

  const ordersCount = sources.orders.filter((order) =>
    (order.items ?? []).some((item: any) => item.productId === productId),
  ).length;

  let customersCount = 0;
  let wonRevenue = 0;
  let upcomingRenewals = 0;

  sources.customers.forEach((customer) => {
    const matches = (customer.productsOwned ?? []).filter((owned: any) => owned.productId === productId);
    if (matches.length === 0) return;

    customersCount += 1;
    matches.forEach((owned: any) => {
      wonRevenue += owned.amount ?? 0;
      if (!owned.renewalAt) return;
      const daysToRenewal = Math.ceil((new Date(owned.renewalAt).getTime() - Date.now()) / 86_400_000);
      if (daysToRenewal > 0 && daysToRenewal <= 30) upcomingRenewals += 1;
    });
  });

  return {
    interestedLeads,
    openDeals,
    quotesCount,
    ordersCount,
    customersCount,
    wonRevenue,
    upcomingRenewals,
  };
}

