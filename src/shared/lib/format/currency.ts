export const formatCurrency = (amount: number | null, currency: string, locale: string) =>
  amount === null || !currency ? "—" : new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", {
    style: "currency",
    currency,
  }).format(amount || 0);

export const formatVnd = (amount: number | null, locale: string) => formatCurrency(amount, "VND", locale);


export const formatCurrencyTotals = (
  entries: readonly { amount: number | null; currency?: string }[],
  locale: string,
): string => {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    if (entry.amount === null) continue;
    const currency = entry.currency || "VND";
    totals.set(currency, (totals.get(currency) || 0) + (entry.amount || 0));
  }
  return Array.from(totals.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, amount]) => formatCurrency(amount, currency, locale))
    .join(" · ") || "—";
};
