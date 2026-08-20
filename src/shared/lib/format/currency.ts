export const formatCurrency = (amount: number, currency: string, locale: string) =>
  new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", {
    style: "currency",
    currency: currency || "VND",
    maximumFractionDigits: currency === "VND" ? 0 : 2,
  }).format(amount || 0);

export const formatVnd = (amount: number, locale: string) => formatCurrency(amount, "VND", locale);


export const formatCurrencyTotals = (
  entries: readonly { amount: number; currency?: string }[],
  locale: string,
): string => {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    const currency = entry.currency || "VND";
    totals.set(currency, (totals.get(currency) || 0) + (entry.amount || 0));
  }
  return Array.from(totals.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, amount]) => formatCurrency(amount, currency, locale))
    .join(" · ");
};
