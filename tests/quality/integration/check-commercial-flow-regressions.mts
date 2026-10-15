import assert from "node:assert/strict";
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";
import { validateEmail, validatePhone } from "@/platform/contact-data";
import { getOpportunityFieldErrors, LeadQualificationValidationError, assertValidOpportunityCommand } from "@/workflows/lead-qualification/domain/leadQualification.rules";
import { getOrderFulfillmentFieldErrors, orderRequiresShipping } from "@/modules/orders/domain/rules/orderFulfillment";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

assert.equal(validatePhone(" +84 901-234-567 ").valid, true);
assert.equal(validatePhone("090abc1234").valid, false);
assert.equal(validatePhone("123").valid, false);
assert.equal(validatePhone("+1234567890123456").valid, false);
assert.equal(validateEmail(" buyer@example.com ").valid, true);
assert.equal(validateEmail("buyer @example.com").valid, false);

const invalidOpportunity = {
  leadId: "lead-1",
  dealsEnabled: true,
  currency: "VND",
  relationship: { kind: "CONTACT" as const, mode: "NEW" as const, contact: { name: "", email: "bad email", phone: "letters" } },
  deal: {
    name: "",
    needSummary: "",
    ownerId: "",
    expectedCloseDate: "",
    estimatedValue: -1,
    interestedProductIds: [],
    followUpTask: { title: "", dueAt: "not-a-date" },
  },
};
const opportunityErrors = getOpportunityFieldErrors(invalidOpportunity);
assert.ok(
  opportunityErrors["deal.name"]
    && opportunityErrors["deal.needSummary"]
    && opportunityErrors["deal.interestedProducts"]
    && opportunityErrors["deal.followUpTaskTitle"]
    && opportunityErrors["deal.followUpTaskDueAt"]
    && opportunityErrors["relationship.contact.email"],
);
assert.equal(opportunityErrors["deal.expectedCloseDate"], undefined, "An empty target close date must remain optional.");
assert.throws(() => assertValidOpportunityCommand(invalidOpportunity), LeadQualificationValidationError);

const validOpportunityBase = {
  leadId: "lead-2",
  dealsEnabled: true,
  currency: "VND",
  relationship: { kind: "CONTACT" as const, mode: "NEW" as const, contact: { name: "Buyer" } },
  deal: { name: "Opportunity", ownerId: "u1", interestedProductIds: [] as string[] },
};
assert.deepEqual(getOpportunityFieldErrors({
  ...validOpportunityBase,
  deal: { ...validOpportunityBase.deal, needSummary: "Need a CRM replacement" },
}), {}, "A concrete need must satisfy the opportunity intent rule without a selected product.");
assert.deepEqual(getOpportunityFieldErrors({
  ...validOpportunityBase,
  deal: { ...validOpportunityBase.deal, interestedProductIds: ["product-1"] },
}), {}, "A selected product must satisfy the opportunity intent rule without a separate need statement.");

const physicalOrder = {
  items: [{ fulfillmentKind: "PHYSICAL_SHIPMENT" as const }],
  recipientName: "",
  recipientPhone: "abc",
  recipientEmail: "bad email",
  shippingAddress: { line1: "", city: "" },
};
assert.equal(orderRequiresShipping(physicalOrder as any), true);
assert.deepEqual(Object.keys(getOrderFulfillmentFieldErrors(physicalOrder as any)).sort(), ["recipientEmail", "recipientName", "recipientPhone", "shippingAddress.city", "shippingAddress.line1"].sort());
assert.equal(orderRequiresShipping({ items: [{ fulfillmentKind: "DIGITAL" }] } as any), false);

const orderForm = readPresentationComposition(path.resolve("src/modules/orders/presentation/pages/OrderFormPage.tsx"), "utf8");
assert.ok(orderForm.includes("resolved.buyerRef") && orderForm.includes("buyerRef: buyerRef!"), "Quote-to-Order must carry canonical buyerRef without requiring a Customer projection.");
assert.equal(orderForm.includes('useState("u1")'), false, "Order owner must not be hard-coded.");

const payments = readPresentationComposition(path.resolve("src/modules/payments/presentation/pages/PaymentOperationsPage.tsx"), "utf8");
assert.ok(payments.includes("useSearchParams") && payments.includes('searchParams.get("orderId")') && payments.includes('searchParams.get("action")'));
assert.ok(payments.includes('const [error, setError]') && payments.includes('role="alert"'), "Payment operations must expose a typed action error surface.");

const overlay = readPresentationComposition(path.resolve("src/shared/components/ui/Dialog.tsx"), "utf8");
assert.ok(overlay.includes("OverlayLayerProvider") && overlay.includes("overlayLayer.baseZIndex + 20"));

const picker = readPresentationComposition(path.resolve("src/modules/products/presentation/components/ProductPickerModal.tsx"), "utf8");
assert.ok(picker.includes('type ProductPickerContext = "lead_interest" | "deal" | "quote" | "order"'), "The shared picker must serve all product-selection contexts.");
assert.ok(picker.includes("Search by product name or SKU") && picker.includes("Only active products are shown"), "The picker must use a simple searchable catalog instead of a full checkbox wall.");
assert.equal(picker.includes("DANH MỤC KHẢ DỤNG"), false, "The retired heavy product-picker heading must not return.");

const dealForm = readPresentationComposition(path.resolve("src/modules/deals/presentation/components/DealFormModal.tsx"), "utf8");
// Execute the production intent-validation branch, rather than matching its spelling.
// This is focused branch coverage, not connected form/API acceptance.
const dealAst = ts.createSourceFile("DealFormModal.tsx", dealForm, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const intentBranches: ts.IfStatement[] = [];
function findIntentBranch(node: ts.Node): void {
  if (ts.isIfStatement(node) && ts.isBlock(node.thenStatement)) {
    const assignsDemandError = node.thenStatement.statements.some(statement =>
      ts.isExpressionStatement(statement) && ts.isBinaryExpression(statement.expression)
      && statement.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && ts.isPropertyAccessExpression(statement.expression.left)
      && statement.expression.left.expression.getText(dealAst) === "nextErrors"
      && statement.expression.left.name.text === "demandSummary");
    if (assignsDemandError) intentBranches.push(node);
  }
  ts.forEachChild(node, findIntentBranch);
}
findIntentBranch(dealAst);
assert.equal(intentBranches.length, 1, "Exactly one production demand/interest validation branch must be exercised.");
const branchJs = ts.transpileModule(intentBranches[0]!.getText(dealAst), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const runIntentBranch = new Function("draft", "nextErrors", "vi", branchJs) as
  (draft: Record<string, unknown>, errors: Record<string, string>, vi: boolean) => void;
for (const [name, fields, rejected] of [
  ["empty intent", {}, true],
  ["whitespace intent", { demandSummary: "  ", notes: "  " }, true],
  ["need without products", { demandSummary: "Replace CRM" }, false],
  ["persisted profile notes without products", { notes: "Existing customer need" }, false],
  ["interest without separate description", { interestedProductIds: ["product-2"] }, false],
  ["need and interest", { demandSummary: "Replace CRM", interestedProductIds: ["product-2"] }, false],
  ["commercial lines cannot substitute for interest", { lineItems: [{ productId: "product-2", quantity: 1 }] }, true],
  ["removing final interest requires description", { interestedProductIds: [] }, true],
] as const) {
  const draft = { demandSummary: "", notes: "", interestedProductIds: [], lineItems: [], amountDecimal: "123.456789", currency: "USD", ...fields };
  const before = JSON.stringify(draft);
  const errors: Record<string, string> = {};
  runIntentBranch(draft, errors, false);
  assert.equal(Boolean(errors.demandSummary), rejected, name);
  assert.equal(Boolean(errors.products), rejected, `${name}: product error agrees`);
  assert.equal(JSON.stringify(draft), before, `${name}: validation preserves IDs and exact amount/currency`);
}
assert.ok(dealForm.includes('<DealInterestedProductsPicker ids={draft.interestedProductIds}'), "Deal selection must bind canonical interested IDs to the authorized catalog picker.");
assert.ok(dealForm.includes("createFollowUpTask") && dealForm.includes("Tạo công việc theo dõi sau khi lưu"), "Follow-up must be an optional Task owned by the Tasks workflow.");
assert.equal(/expectedCloseDate[^\n]*required/.test(dealForm), false, "Expected close date must remain optional in early opportunity creation.");

for (const [relativePath, context] of [
  ["src/modules/leads/presentation/components/LeadFormView.tsx", 'context="lead_interest"'],
  ["src/workflows/lead-qualification/presentation/views/LeadQualificationView.tsx", '<DealInterestedProductsPicker guidanceId="leads.qualification.products" ids={interestedProductIds} onChange={setInterestedProductIds}'],
  ["src/modules/quotes/presentation/components/QuoteBuilderProductPicker.tsx", 'context="quote"'],
  ["src/modules/orders/presentation/views/OrderFormView.tsx", 'context="order"'],
] as const) {
  const source = readPresentationComposition(path.resolve(relativePath), "utf8");
  assert.ok(source.includes(context), `${relativePath} must retain the authorized product-selection binding ${context}.`);
}

console.log("Commercial flow regression contracts: PASS");
