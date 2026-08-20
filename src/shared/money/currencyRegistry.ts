export interface IsoCurrencyDefinition {
  code: string;
  minorUnit: number;
}

export function listIsoCurrencies(locale = "en"): IsoCurrencyDefinition[] {
  const displayNames = new Intl.DisplayNames([locale], { type: "currency" });
  return Intl.supportedValuesOf("currency")
    .map((code) => ({
      code,
      minorUnit: new Intl.NumberFormat("en", { style: "currency", currency: code }).resolvedOptions().maximumFractionDigits ?? 2,
      name: displayNames.of(code) ?? code,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, locale))
    .map(({ code, minorUnit }) => ({ code, minorUnit }));
}

export function getCurrencyMinorUnit(currency: string): number {
  return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
}
