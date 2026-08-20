import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

const files = [
  "src/modules/invoices/presentation/pages/InvoiceListPage.tsx",
  "src/modules/invoices/presentation/pages/InvoiceDetailPage.tsx",
  "src/modules/invoices/presentation/pages/InvoiceFormPage.tsx",
  "src/modules/invoices/presentation/pages/ReceivablesPage.tsx",
  "src/modules/invoices/presentation/pages/ReceivableDetailPage.tsx",
  "src/modules/payments/presentation/pages/PaymentOperationsPage.tsx",
  "src/modules/orders/presentation/pages/OrderFormPage.tsx",
  "src/modules/orders/presentation/pages/OrderDetailPage.tsx",
  "src/modules/quotes/presentation/pages/QuoteBuilderPage.tsx",
];

for (const file of files) {
  const source = readPresentationComposition(file, "utf8");
  for (const pattern of [/font-black/, /font-extrabold/, /text-\[(?:[0-8])px\]/]) {
    assert.ok(!pattern.test(source), `${file} violates typography guard: ${pattern}`);
  }
}

const listTypographyOwner = readPresentationComposition("src/components/crm/list-archetype/ListDataTable.tsx", "utf8");
for (const marker of ["text-[10px]", "text-[11px]", "text-xs"]) {
  assert.ok(listTypographyOwner.includes(marker), `Shared list archetype must own the compact ${marker} typography scale`);
}

console.log("Order-to-cash typography guard: PASS");
