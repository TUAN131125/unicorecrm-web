import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

const read = (relativePath: string) => readPresentationComposition(path.resolve(relativePath), "utf8");

const leadForm = read("src/components/LeadForm.tsx");
assert.match(leadForm, /data-contained-form-layout="true"/);
assert.match(leadForm, /crm-form-surface flex h-full min-h-0/);
assert.doesNotMatch(leadForm, /crm-form-action-bar sticky bottom-0/);
assert.doesNotMatch(leadForm, /max-h-\[calc\(85vh-140px\)\]/);
const globalStyles = read("src/index.css");
assert.match(globalStyles, /crm-form-surface\[data-contained-form-layout="true"\][\s\S]*position:\s*relative;[\s\S]*bottom:\s*auto;/);

const opportunity = read("src/workflows/lead-qualification/application/executeLeadOpportunity.ts");
for (const marker of ["relationship.contactName", "relationship.contactEmail", "relationship.organizationName", "relationship.organizationAddress"]) {
  assert.ok(opportunity.includes(marker), `Lead qualification must preserve ${marker}.`);
}

const directSale = read("src/workflows/lead-qualification/application/executeLeadDirectSale.ts");
assert.ok(directSale.includes("recipientEmail: relationship.contactEmail"));
assert.ok(directSale.includes("customerName: relationship.organizationName || relationship.contactName"));

const dealDetail = read("src/modules/deals/presentation/pages/DealDetailPage.tsx");
assert.ok(dealDetail.includes("getProductCatalogSnapshot"));
assert.ok(dealDetail.includes("products={productCatalog}"));
assert.equal(dealDetail.includes("MOCK_PRODUCTS"), false);

const quoteBuilder = read("src/modules/quotes/presentation/pages/QuoteBuilderPage.tsx");
assert.ok(quoteBuilder.includes("referencedDeal.customerName || referencedDeal.organizationAccountName || referencedDeal.contactName"));
assert.equal(quoteBuilder.includes("referencedDeal.address || QUOTE_COMPANY_PROFILE.address"), false);

const paymentQueries = read("src/modules/payments/application/queries/paymentQueries.ts");
assert.ok(paymentQueries.includes("isCodCollectibleObligation"));
assert.ok(paymentQueries.includes('obligation.timing === "ON_DELIVERY"'));
assert.ok(paymentQueries.includes('obligation.fulfillmentGate === "NONE"'));

const shippingCreate = read("src/modules/shipping/presentation/pages/ShippingBookingCreatePage.tsx");
assert.ok(shippingCreate.includes("initializedContextRef"));
assert.ok(shippingCreate.includes("hydratedOrderRef"));

const productForm = read("src/modules/products/presentation/components/ProductFormModal.tsx");
assert.ok(productForm.includes("ct.displayNameVi || ct.displayNameEn || ct.code"));
assert.equal(productForm.includes("ct.nameVi"), false);

const topBar = read("src/app/shell/layout/TopBar.tsx");
const search = read("src/app/search/crmGlobalSearch.ts");
assert.ok(topBar.includes("buildCrmGlobalSearchRecords"));
for (const moduleKey of ["leads", "contacts", "organizations", "deals", "quotes", "orders", "shipping", "payments", "tasks"]) {
  assert.ok(search.includes(`moduleKey: "${moduleKey}"`), `Global search must index ${moduleKey}.`);
}

const lineage = read("src/components/crm/CommercialLineagePanel.tsx");
assert.ok(lineage.includes("Chuỗi nguồn thương mại"));
for (const page of [
  "src/modules/deals/presentation/pages/DealDetailPage.tsx",
  "src/modules/quotes/presentation/pages/QuoteDetailPage.tsx",
  "src/modules/orders/presentation/pages/OrderDetailPage.tsx",
  "src/modules/payments/presentation/pages/PaymentDetailPage.tsx",
  "src/modules/shipping/presentation/pages/ShippingBookingDetailPage.tsx",
]) assert.ok(read(page).includes("<CommercialLineagePanel"), `${page} must expose commercial lineage.`);

const verifyRunner = read("scripts/quality/run-quality-pipeline.mjs");
assert.ok(verifyRunner.includes("QUALITY_GATE_TIMEOUT_MS"));
assert.ok(verifyRunner.includes("TIMEOUT"));
assert.ok(verifyRunner.includes("NATIVE_DIALOG_AUDIT_OUTPUT"));
assert.ok(verifyRunner.includes("run-node-gate.mjs"));

const appShell = read("src/app/shell/layout/AppShell.tsx");
assert.ok(appShell.includes("hasDirtyUnsavedWork"));
assert.match(appShell, /hasDirtyUnsavedWork && \(\s*<UnsavedNavigationGuard/);
assert.doesNotMatch(appShell, /useBlocker\(hasDirtyUnsavedWork\s*\?/);
assert.ok(read("index.html").includes('href="/favicon.svg"'));
assert.ok(fs.existsSync(path.resolve("public/favicon.svg")));

console.log("QC88 remaining remediation contracts: PASS");
