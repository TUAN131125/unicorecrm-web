import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PAYMENT_METHOD_CATALOG, PAYMENT_PROVIDER_CATALOG } from "@/modules/payments/infrastructure/paymentCatalog.seed";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";
assert.equal(new Set(PAYMENT_METHOD_CATALOG.map((item) => item.code)).size, PAYMENT_METHOD_CATALOG.length, "Method codes must be stable and unique");
assert.ok(PAYMENT_METHOD_CATALOG.some((item) => item.kind === "COD" && item.requiresPhysicalShipping));
for (const method of PAYMENT_METHOD_CATALOG.filter((item) => item.supportsIntent)) assert.ok(method.providerCodes?.every((code) => PAYMENT_PROVIDER_CATALOG.some((provider) => provider.code === code && provider.enabled)));
for (const file of ["src/modules/orders/presentation/pages/OrderFormPage.tsx", "src/modules/quotes/presentation/pages/QuoteBuilderPage.tsx", "src/modules/payments/presentation/pages/PaymentOperationsPage.tsx"]) {
  const source = readPresentationComposition(file, "utf8");
  assert.ok(source.includes("Catalog") || source.includes("catalog") || source.includes("paymentMethods"), `${file} must use catalog data`);
  for (const literal of ['<option value="BANK_TRANSFER">', '<option value="COD">', '<option value="CARD">', '<option value="E_WALLET">']) assert.ok(!source.includes(literal), `${file} must not hardcode payment method options`);
}
console.log("Payment method catalog contracts: PASS");
