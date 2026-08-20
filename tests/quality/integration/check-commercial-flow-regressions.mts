import assert from "node:assert/strict";
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
assert.ok(dealForm.includes("!draft.demandSummary.trim() && draft.lineItems.length === 0"), "Deal intent must require either a need statement or selected products, not both.");
assert.ok(dealForm.includes("createFollowUpTask") && dealForm.includes("Tạo công việc theo dõi sau khi lưu"), "Follow-up must be an optional Task owned by the Tasks workflow.");
assert.equal(/expectedCloseDate[^\n]*required/.test(dealForm), false, "Expected close date must remain optional in early opportunity creation.");

for (const [relativePath, context] of [
  ["src/modules/leads/presentation/components/LeadFormView.tsx", 'context="lead_interest"'],
  ["src/workflows/lead-qualification/presentation/pages/LeadQualificationPage.tsx", 'context="lead_interest"'],
  ["src/modules/deals/presentation/components/DealFormModal.tsx", 'context="deal"'],
  ["src/modules/quotes/presentation/components/QuoteBuilderProductPicker.tsx", 'context="quote"'],
  ["src/modules/orders/presentation/views/OrderFormView.tsx", 'context="order"'],
] as const) {
  const source = readPresentationComposition(path.resolve(relativePath), "utf8");
  assert.ok(source.includes(context), `${relativePath} must use the shared ProductPickerModal context ${context}.`);
}

console.log("Commercial flow regression contracts: PASS");
