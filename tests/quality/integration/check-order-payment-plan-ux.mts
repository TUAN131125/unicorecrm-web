import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import path from "node:path";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

const root = repositoryRoot;
const orderForm = readPresentationComposition(path.join(root, "src/modules/orders/presentation/pages/OrderFormPage.tsx"), "utf8");
const sectionHeader = readPresentationComposition(path.join(root, "src/shared/components/ui/PageHeader.tsx"), "utf8");
const button = readPresentationComposition(path.join(root, "src/shared/components/ui/Button.tsx"), "utf8");

assert.ok(orderForm.includes("PAYMENT_PLAN_TYPE_LABELS"), "Payment plan types must have bilingual user-facing labels");
assert.ok(orderForm.includes("getPaymentMethodCatalogSnapshot"), "Payment methods must come from the authoritative catalog");
assert.ok(orderForm.includes("displayNameVi") && orderForm.includes("displayNameEn"), "Payment method catalog entries must render bilingual user-facing labels");
assert.ok(orderForm.includes("PAYMENT_GATE_LABELS"), "Fulfillment gates must have bilingual user-facing labels");
assert.equal(orderForm.includes("Điều khoản cũ"), false, "Order form must not expose legacy terminology");
assert.equal(orderForm.includes("xl:grid-cols-8"), false, "Payment plan controls must not be squeezed into eight columns");
assert.match(orderForm, /grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4/, "Payment installment controls need a responsive four-column maximum");
assert.match(orderForm, /icon=\{<Plus size=\{14\} \/>\}[\s\S]*?min-w-\[132px\]/, "Add installment must use the standard icon slot and stable minimum width");
assert.ok(orderForm.includes("Trash2"), "Payment installments need a clear remove action");
assert.equal(/<option key=\{value\} value=\{value\}>\{value\}<\/option>/.test(orderForm), false, "Payment option values must never render raw enum codes");

assert.ok(sectionHeader.includes("sm:flex-row"), "Section header must stack actions on narrow surfaces");
assert.ok(sectionHeader.includes("shrink-0 flex-wrap") || sectionHeader.includes("flex shrink-0 flex-wrap"), "Section header actions must not collapse into narrow multi-line buttons");
assert.ok(button.includes("inline-flex items-center justify-center gap-1.5 whitespace-nowrap"), "Button content must retain natural single-line action width");
assert.ok(button.includes("shrink-0") && button.includes('sm: "h-10'), "Button geometry must not collapse in responsive action groups");
assert.equal(button.includes("crm-text-wrap"), false, "Record-text wrapping must not be applied to shared action labels");

console.log("Order payment plan UX contracts: PASS");
