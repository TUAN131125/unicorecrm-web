import type { ExchangeRateRecord, ExchangeRateSnapshot } from "./exchangeRate.types";
import { money, multiplyMoney, type MoneyDto } from "./money";

export function findEffectiveExchangeRate(
  rates: readonly ExchangeRateRecord[],
  fromCurrency: string,
  toCurrency: string,
  at: string,
): ExchangeRateRecord | undefined {
  return rates
    .filter((rate) => rate.status === "ACTIVE"
      && rate.fromCurrency === fromCurrency
      && rate.toCurrency === toCurrency
      && rate.effectiveAt <= at)
    .sort((left, right) => right.effectiveAt.localeCompare(left.effectiveAt) || right.version - left.version)[0];
}

export function convertMoneyPreview(value: MoneyDto, toCurrency: string, rate: ExchangeRateRecord): MoneyDto {
  if (value.currency !== rate.fromCurrency || toCurrency !== rate.toCurrency) {
    throw new Error("Exchange rate pair does not match the requested conversion.");
  }
  return money(multiplyMoney(value, rate.rate).amount, toCurrency);
}

export function snapshotExchangeRate(rate: ExchangeRateRecord): ExchangeRateSnapshot {
  return {
    fromCurrency: rate.fromCurrency,
    toCurrency: rate.toCurrency,
    rate: rate.rate,
    effectiveAt: rate.effectiveAt,
    source: rate.source,
    rateId: rate.id,
    rateVersion: rate.version,
  };
}

export function invertDecimal(value: string, precision = 8): string {
  if (!/^\d+(?:\.\d+)?$/.test(value) || Number(value) <= 0) throw new Error("Exchange rate must be a positive decimal string.");
  const [integer = "0", fraction = ""] = value.split(".");
  const divisor = BigInt(`${integer}${fraction}`);
  const scale = 10n ** BigInt(fraction.length + precision);
  const raw = (scale / divisor).toString().padStart(precision + 1, "0");
  const whole = raw.slice(0, -precision) || "0";
  const decimals = raw.slice(-precision).replace(/0+$/, "");
  return decimals ? `${whole}.${decimals}` : whole;
}
