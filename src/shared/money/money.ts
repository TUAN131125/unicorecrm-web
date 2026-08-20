export interface MoneyDto {
  /** Canonical decimal string. Never a JavaScript floating-point business value. */
  amount: string;
  currency: string;
}

interface DecimalParts {
  sign: 1 | -1;
  coefficient: bigint;
  scale: number;
}

function parseDecimal(value: string): DecimalParts {
  const normalized = value.trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) throw new Error(`Invalid decimal amount: ${value}`);
  const sign: 1 | -1 = normalized.startsWith("-") ? -1 : 1;
  const unsigned = normalized.replace(/^-/, "");
  const [integer, fraction = ""] = unsigned.split(".");
  return {
    sign,
    coefficient: BigInt(`${integer}${fraction}`),
    scale: fraction.length,
  };
}

function align(left: DecimalParts, right: DecimalParts): [bigint, bigint, number] {
  const scale = Math.max(left.scale, right.scale);
  const leftValue = BigInt(left.sign) * left.coefficient * (10n ** BigInt(scale - left.scale));
  const rightValue = BigInt(right.sign) * right.coefficient * (10n ** BigInt(scale - right.scale));
  return [leftValue, rightValue, scale];
}

function serialize(coefficient: bigint, scale: number): string {
  const sign = coefficient < 0n ? "-" : "";
  const absolute = coefficient < 0n ? -coefficient : coefficient;
  const raw = absolute.toString().padStart(scale + 1, "0");
  if (scale === 0) return `${sign}${raw}`;
  const integer = raw.slice(0, -scale) || "0";
  const fraction = raw.slice(-scale).replace(/0+$/, "");
  return fraction ? `${sign}${integer}.${fraction}` : `${sign}${integer}`;
}

export function normalizeDecimal(value: string): string {
  const parsed = parseDecimal(value);
  return serialize(BigInt(parsed.sign) * parsed.coefficient, parsed.scale);
}

export function money(amount: string, currency: string): MoneyDto {
  const normalizedCurrency = currency.trim().toUpperCase();
  if (!normalizedCurrency) throw new Error("Money currency is required.");
  return { amount: normalizeDecimal(amount), currency: normalizedCurrency };
}

export function assertSameCurrency(left: MoneyDto, right: MoneyDto): void {
  if (left.currency !== right.currency) throw new Error(`Currency mismatch: ${left.currency} and ${right.currency}`);
}

export function addMoney(left: MoneyDto, right: MoneyDto): MoneyDto {
  assertSameCurrency(left, right);
  const [a, b, scale] = align(parseDecimal(left.amount), parseDecimal(right.amount));
  return money(serialize(a + b, scale), left.currency);
}

export function subtractMoney(left: MoneyDto, right: MoneyDto): MoneyDto {
  assertSameCurrency(left, right);
  const [a, b, scale] = align(parseDecimal(left.amount), parseDecimal(right.amount));
  return money(serialize(a - b, scale), left.currency);
}

export function compareMoney(left: MoneyDto, right: MoneyDto): number {
  assertSameCurrency(left, right);
  const [a, b] = align(parseDecimal(left.amount), parseDecimal(right.amount));
  return a === b ? 0 : a > b ? 1 : -1;
}

export function isPositiveMoney(value: MoneyDto): boolean {
  return compareMoney(value, money("0", value.currency)) > 0;
}

export function sumMoney(values: readonly MoneyDto[], currency?: string): MoneyDto {
  const resolvedCurrency = currency ?? values[0]?.currency;
  if (!resolvedCurrency) throw new Error("Currency is required to sum an empty Money collection.");
  return values.reduce((total, value) => addMoney(total, value), money("0", resolvedCurrency));
}


export function multiplyMoney(value: MoneyDto, multiplier: string): MoneyDto {
  const left = parseDecimal(value.amount);
  const right = parseDecimal(multiplier);
  const coefficient = BigInt(left.sign) * left.coefficient * BigInt(right.sign) * right.coefficient;
  return money(serialize(coefficient, left.scale + right.scale), value.currency);
}

export function percentageOfMoney(value: MoneyDto, percentage: string): MoneyDto {
  return multiplyMoney(multiplyMoney(value, percentage), "0.01");
}

export function minMoney(left: MoneyDto, right: MoneyDto): MoneyDto {
  return compareMoney(left, right) <= 0 ? left : right;
}

/** Display-only conversion. Never use the returned number for financial decisions. */
export function formatMoneyDto(value: MoneyDto, locale = "vi-VN"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: value.currency, maximumFractionDigits: 4 }).format(Number(value.amount));
}

/** Display-only conversion. Never use the returned number for authoritative financial decisions or mutation payloads. */
export function moneyToDisplayNumber(value: MoneyDto): number {
  const parsed = Number(normalizeDecimal(value.amount));
  if (!Number.isFinite(parsed)) throw new Error(`Money amount is not displayable: ${value.amount}`);
  return parsed;
}

/** Display-only decimal conversion for percentages and quantities. */
export function decimalToDisplayNumber(value: string): number {
  const parsed = Number(normalizeDecimal(value));
  if (!Number.isFinite(parsed)) throw new Error(`Decimal value is not displayable: ${value}`);
  return parsed;
}
