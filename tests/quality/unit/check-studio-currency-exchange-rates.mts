import assert from "node:assert/strict";
import { convertMoneyPreview, findEffectiveExchangeRate, invertDecimal, listIsoCurrencies, money, snapshotExchangeRate } from "@/shared/money";
import type { ExchangeRate } from "@/platform/workspace-config";

const currencies = listIsoCurrencies("en");
for (const code of ["VND", "USD", "EUR", "JPY"]) assert.ok(currencies.some((item) => item.code === code), `ISO currency registry must contain ${code}`);
const rates: ExchangeRate[] = [
  { id: "old", fromCurrency: "USD", toCurrency: "VND", rate: "25000", effectiveAt: "2026-01-01T00:00:00.000Z", source: "MANUAL", providerConnectionId: null, status: "ACTIVE", version: 1 },
  { id: "new", fromCurrency: "USD", toCurrency: "VND", rate: "26000.125", effectiveAt: "2026-07-01T00:00:00.000Z", source: "MANUAL", providerConnectionId: null, status: "ACTIVE", version: 3 },
];
const effective = findEffectiveExchangeRate(rates, "USD", "VND", "2026-07-22T00:00:00.000Z");
assert.equal(effective?.id, "new");
assert.equal(convertMoneyPreview(money("2.5", "USD"), "VND", effective!).amount, "65000.3125");
assert.deepEqual(snapshotExchangeRate(effective!), { fromCurrency: "USD", toCurrency: "VND", rate: "26000.125", effectiveAt: "2026-07-01T00:00:00.000Z", source: "MANUAL", rateId: "new", rateVersion: 3 });
assert.equal(invertDecimal("2", 8), "0.5");
assert.throws(() => invertDecimal("0"));
console.log("Studio currency and exchange rates: PASS (ISO registry, decimal-string preview, effective rate, immutable snapshot).");
