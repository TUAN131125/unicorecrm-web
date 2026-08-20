import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const files = [
  "src/modules/payments/domain/model/paymentCollection.types.ts",
  "src/modules/payments/domain/model/paymentPlan.types.ts",
  "src/modules/payments/domain/rules/paymentPlanRules.ts",
  "src/modules/payments/application/commands/paymentPlanCommands.ts",
  "src/modules/payments/application/commands/paymentIntentCommands.ts",
  "src/modules/payments/application/commands/paymentAllocationCommands.ts",
  "src/modules/payments/application/commands/paymentCodCommands.ts",
  "src/modules/invoices/domain/model/invoice.types.ts",
  "src/modules/invoices/domain/rules/invoiceRules.ts",
  "src/modules/invoices/application/commands/invoiceCommands.ts",
  "src/modules/invoices/application/queries/invoiceQueries.ts",
];
for (const file of files) {
  const source = readFileSync(file, "utf8");
  assert.ok(!/parseFloat\s*\(|Number\s*\([^)]*\.amount\)|\.amount\s*[+\-*/]/.test(source), `${file} uses floating-point arithmetic on authoritative money`);
}
const moneySource = readFileSync("src/shared/money/money.ts", "utf8");
assert.ok(moneySource.includes("bigint"));
assert.ok(moneySource.includes("amount: string"));
assert.ok(moneySource.includes("Display-only conversion"));
assert.ok(!/parseFloat\s*\(/.test(moneySource));
console.log("Order-to-cash money-safety guard: PASS");
