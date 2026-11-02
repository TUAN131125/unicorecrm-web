import type { MoneyDto } from "@/shared/money";

/** Formats a stored decimal without Number conversion, FX, rounding or currency substitution. */
export function formatCommercialMoney(value: MoneyDto | undefined, locale: string): string {
  if (!value || !/^-?\d+(\.\d+)?$/.test(value.amount) || !/^[A-Z]{3}$/.test(value.currency)) return "—";
  const language = locale === "vi" ? "vi-VN" : "en-US";
  const [integer = "0", fraction = ""] = value.amount.split(".");
  const formatter = new Intl.NumberFormat(language, { maximumFractionDigits: 0 });
  const decimal = new Intl.NumberFormat(language).formatToParts(1.1).find(part => part.type === "decimal")?.value ?? ".";
  const minor = new Intl.NumberFormat(language, { style: "currency", currency: value.currency }).resolvedOptions().maximumFractionDigits ?? 0;
  const digits = fraction.replace(/0+$/, "").padEnd(minor, "0");
  const sign = integer.startsWith("-") && BigInt(integer) === 0n ? "-" : "";
  return `${sign}${formatter.format(BigInt(integer))}${digits ? decimal + digits : ""} ${value.currency}`;
}
