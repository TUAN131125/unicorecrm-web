import { normalizeDecimal, type MoneyDto } from "@/shared/money";

export type DashboardLocale = "vi" | "en";
export const dashboardNumberLocale = (locale: DashboardLocale) => locale === "vi" ? "vi-VN" : "en-US";

/** Display only: retain the canonical decimal, even beyond Number's precision. */
export function dashboardMoney(value: MoneyDto, locale: DashboardLocale) {
  const language = dashboardNumberLocale(locale);
  const normalized = normalizeDecimal(value.amount);
  const negative = normalized.startsWith("-");
  const [integer = "0", fraction = ""] = normalized.replace(/^-/, "").split(".");
  const magnitude = BigInt(integer);
  const formatter = new Intl.NumberFormat(language, { style: "currency", currency: value.currency, maximumFractionDigits: 0 });
  const signed = negative ? magnitude === 0n ? -0 : -magnitude : magnitude;
  const parts = formatter.formatToParts(signed);
  const decimal = new Intl.NumberFormat(language).formatToParts(1.1).find(part => part.type === "decimal")?.value ?? ".";
  const minimum = new Intl.NumberFormat(language, { style: "currency", currency: value.currency }).resolvedOptions().minimumFractionDigits ?? 0;
  const digits = fraction.padEnd(minimum, "0");
  let lastNumber = 0;
  parts.forEach((part, index) => { if (part.type === "integer") lastNumber = index; });
  const full = parts.map((part, index) => part.value + (index === lastNumber && digits ? decimal + digits : "")).join("");
  const unit = [{ power: 9, vi: "tỷ", en: "B" }, { power: 6, vi: "triệu", en: "M" }, { power: 3, vi: "nghìn", en: "K" }].find(item => magnitude >= 10n ** BigInt(item.power));
  if (!unit) return { full, compact: full };
  const coefficient = BigInt(integer + fraction);
  const divisor = 10n ** BigInt(fraction.length + unit.power);
  const scaled = (coefficient * 1000n + divisor / 2n) / divisor;
  const tail = (scaled % 1000n).toString().padStart(3, "0").replace(/0+$/, "");
  const number = new Intl.NumberFormat(language).format(scaled / 1000n) + (tail ? decimal + tail : "");
  const currency = value.currency === "VND" ? "₫" : value.currency;
  return { full, compact: `${negative ? "−" : ""}${number}${locale === "vi" ? ` ${unit.vi}` : unit.en} ${currency}` };
}

export function dashboardDate(value: string, locale: DashboardLocale, timeZone: string, dateOnly = false) {
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return locale === "vi" ? "Chưa có ngày" : "Date unavailable";
  // Expected close date is a calendar date; do not shift it to another timezone.
  return date.toLocaleString(dashboardNumberLocale(locale), {
    ...(dateOnly ? {} : { timeZone }), day: "2-digit", month: "2-digit",
    ...(dateOnly ? {} : { hour: "2-digit", minute: "2-digit" }),
  });
}
