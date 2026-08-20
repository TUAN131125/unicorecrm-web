import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import path from "node:path";
import { queryPaymentTransactions } from "@/modules/payments/application/queries/paymentQueries";
import type { PaymentRepositorySnapshot } from "@/modules/payments/application/ports/PaymentRepository";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

const root = repositoryRoot;
const read = (file: string) => readPresentationComposition(path.join(root, file), "utf8");

const returnForm = read("src/modules/returns/presentation/pages/ReturnFormPage.tsx");
assert.ok(returnForm.includes('toWorkspacePath(workspace.workspaceKey, "crm", `returns/${request.id}`)'), "Return creation must navigate to its canonical workspace detail route");
assert.equal(returnForm.includes('navigate("../'), false, "Return creation must not use a route-relative parent jump");
assert.ok(returnForm.includes("orderRequiresShipping(order)") && returnForm.includes('resolveOrderLineFulfillmentKind(item) === "PHYSICAL_SHIPMENT"'), "Physical Return UI must reject service-only Orders and non-physical lines");
assert.ok(returnForm.includes("manualDeliveryEvidence:") && returnForm.includes("evidenceRef: manualEvidenceRef"), "Manual Return evidence must be submitted as a structured audited object");
assert.equal(/deliveredAt:\s*manualDeliveredAt/.test(returnForm), false, "A manually entered delivery timestamp must not be passed as raw Shipping evidence");

const returnCommands = read("src/modules/returns/application/commands/returnCommands.ts");
assert.ok(returnCommands.includes("Shipping delivery evidence requires both deliveredAt and booking reference"));
assert.ok(returnCommands.includes("Manual delivery evidence requires an evidence reference"));

const actionPolicy = read("src/modules/orders/presentation/model/orderActionPolicy.ts");
assert.ok(actionPolicy.includes("permissions.canCreateShipping && orderRequiresShipping(order)"), "Order actions must expose Shipping only for physical fulfillment");
const shippingRoute = read("src/modules/shipping/create-route.tsx");
const shippingForm = read("src/modules/shipping/presentation/pages/ShippingBookingCreatePage.tsx");
assert.ok(shippingRoute.includes('"NO_PHYSICAL_LINES"') && shippingRoute.includes("initialOrderIssue={initialOrderIssue}"));
assert.ok(shippingForm.includes("initialOrderIssue") && shippingForm.includes('role="alert"'), "Invalid Shipping deep links must remain visible instead of selecting another Order");

const paymentSnapshot: PaymentRepositorySnapshot = {
  obligations: [],
  migrationReviews: [],
  plans: [],
  scheduleLines: [],
  intents: [],
  refundIntents: [],
  paymentRecords: [],
  allocations: [],
  customerCredits: [],
  methodCatalog: [],
  providerCatalog: [],
  transactions: ["order-a", "order-b"].map((orderId, index) => ({
    id: `payment-${index}`,
    orderId,
    buyerRef: { type: "CONTACT" as const, id: `buyer-${index}` },
    kind: "PAYMENT" as const,
    status: "SUCCEEDED" as const,
    amount: 100,
    currency: "VND",
    occurredAt: `2026-07-1${index}T10:00:00.000Z`,
    source: "MANUAL" as const,
  })),
};
assert.deepEqual(queryPaymentTransactions(paymentSnapshot, { orderId: "order-b" }).map((item) => item.orderId), ["order-b"], "Payment orderId context must filter transactions");

const paymentPage = read("src/modules/payments/presentation/pages/PaymentOperationsPage.tsx");
assert.ok(paymentPage.includes('searchParams.get("orderId")') && paymentPage.includes('searchParams.get("action")'));
assert.ok(paymentPage.includes('searchParams.get("action") !== "record"') && paymentPage.includes("applyOrderToManual(orderId)"), "The record-payment intent must open its canonical action surface");
assert.ok(paymentPage.includes('next.delete("action")') && paymentPage.includes('next.delete("invoiceId")'), "Consumed payment action context must be cleared from the URL deterministically");
for (const file of [
  "src/modules/orders/presentation/pages/OrderDetailPage.tsx",
  "src/modules/orders/presentation/pages/OrderListPage.tsx",
]) {
  assert.ok(read(file).includes("action=record&orderId="), `${file} must express the Record payment action explicitly`);
}

const dashboard = read("src/workspaces/crm/presentation/pages/DashboardPage.tsx");
assert.ok(dashboard.includes("toWorkspacePath") && dashboard.includes("crmPath("));
assert.equal(/(?:<Link\s+to=|navigate\()\s*[`"']\//.test(dashboard), false, "Dashboard shortcuts must stay in the canonical workspace/product-space route");

const avatar = read("src/shared/components/ui/Avatar.tsx");
assert.ok(avatar.includes("normalizedSource") && avatar.includes("initials"));
const runtimeAssets = [
  "src/index.css",
  "src/platform/member-directory/index.ts",
  "src/modules/customers/presentation/list/CustomerCardList.tsx",
  "src/modules/customers/presentation/list/CustomerTable.tsx",
  "src/modules/leads/presentation/components/LeadMobileCardList.tsx",
  "src/modules/leads/presentation/components/LeadKanbanBoard.tsx",
  "src/modules/leads/presentation/components/LeadTable.tsx",
  "src/modules/contacts/presentation/list/ContactCardList.tsx",
].map(read).join("\n");
assert.equal(/fonts\.googleapis\.com|images\.unsplash\.com|googleusercontent\.com/.test(runtimeAssets), false, "Core CRM presentation must not depend on remote fonts or avatar placeholders");
assert.ok(read("src/modules/customers/presentation/list/CustomerTable.tsx").includes("<Avatar"), "Customer table must use the guarded avatar fallback");

const serviceOrderSeed = read("src/modules/payments/infrastructure/payment.seed.ts");
assert.equal(/obl_o5_cod|orderId:\s*"o5"[\s\S]{0,500}method:\s*"COD"/.test(serviceOrderSeed), false, "Service Order seed must not carry COD");

console.log("Operational routing, fulfillment, evidence, payment-context and offline-asset contracts: PASS");
