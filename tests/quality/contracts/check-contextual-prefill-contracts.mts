import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = repositoryRoot;
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");
const contains = (source: string, token: string, message: string) => assert.ok(source.includes(token), message);
const excludes = (source: string, token: string, message: string) => assert.ok(!source.includes(token), message);

const organizationPage = read("src/modules/organizations/presentation/pages/OrganizationAccountDetailPage.tsx");
contains(organizationPage, "OrganizationCreateOpportunityModal", "Organization Detail must open the canonical Opportunity form.");
contains(organizationPage, "setDealOpen(true)", "Organization Detail must launch Opportunity creation locally.");
excludes(organizationPage, "/deals/new?organizationId", "Organization Detail must not navigate to the removed /deals/new route.");
for (const target of ["/quotes/new?organizationId=", "/orders/new?organizationId=", "/invoices/new?organizationId=", "/support/cases/new?organizationId="]) {
  contains(organizationPage, target, `Organization Detail must carry context into ${target}.`);
}
contains(organizationPage, "&contactId=${primaryContact.id}", "Organization support creation must carry the primary Contact when available.");

const organizationDeal = read("src/modules/organizations/presentation/detail/OrganizationCreateOpportunityModal.tsx");
for (const token of [
  "DealFormModal",
  'buyerRef: { type: "ORGANIZATION_ACCOUNT", id: account.id }',
  "organizationAccountId: account.id",
  "contactId: primaryContact?.id",
  "linkedCustomerId",
]) contains(organizationDeal, token, `Organization Opportunity context must retain ${token}.`);

const quoteController = read("src/modules/quotes/presentation/hooks/useQuoteBuilderController.tsx");
for (const token of [
  'searchParams.get("organizationId")',
  "getOrganizationAccountSnapshot(organizationIdParam)",
  "organizationPrimaryContact",
  'type: "ORGANIZATION_ACCOUNT" as const',
  "organizationCustomer?.id",
]) contains(quoteController, token, `Quote Builder must consume Organization context through ${token}.`);

const orderController = read("src/modules/orders/presentation/hooks/useOrderFormController.tsx");
for (const token of [
  'searchParams.get("organizationId")',
  'searchParams.get("duplicateId")',
  "recipientPrefill(",
  "applyRecipientPrefill(",
  "getPaymentObligationsForOrderSnapshot(duplicate.id)",
  'setSourceQuoteId(undefined)',
  'setSourceDealId(undefined)',
]) contains(orderController, token, `Order contextual prefill must retain ${token}.`);
contains(orderController, "setShippingAddressLine1(prefill.addressLine1)", "Order prefill must hydrate delivery address.");
contains(orderController, "setRecipientEmail(prefill.email)", "Order prefill must hydrate recipient email.");
contains(orderController, "setRecipientPhone(prefill.phone)", "Order prefill must hydrate recipient phone.");

const invoiceForm = read("src/modules/invoices/presentation/pages/InvoiceFormPage.tsx");
for (const token of [
  'searchParams.get("customerId")',
  'searchParams.get("contactId")',
  'searchParams.get("organizationId")',
  "resolveCustomerRelationshipContextSnapshot(customerIdParam)",
  "eligibleOrders.length === 1",
  "setSourceOrderId(eligibleOrders[0].id)",
  "hydratedSourceOrderRef.current === sourceOrder.id",
]) contains(invoiceForm, token, `Invoice contextual Order selection must retain ${token}.`);

const supportForm = read("src/modules/support/presentation/pages/SupportCaseFormPage.tsx");
for (const token of [
  'searchParams.get("organizationId")',
  "findCustomerByRelationshipRefSnapshot",
  "sourceOrganizationContact",
  "sourceOrganizationCustomer?.id",
  "sourceOrganization?.ownerId",
]) contains(supportForm, token, `Support creation must consume Organization context through ${token}.`);
contains(supportForm, "tổ chức chưa có Customer 360 liên kết", "Support must explain the missing Customer projection instead of silently dropping Organization context.");

const customerDetail = read("src/modules/customers/presentation/detail/CustomerDetailTabContent.tsx");
for (const target of ["/quotes/new?customerId=", "/orders/new?customerId=", "/invoices/new?customerId=", "/support/cases/new?customerId="]) {
  contains(customerDetail, target, `Customer Detail must preserve create-from-context navigation for ${target}.`);
}

const contactDetail = read("src/modules/contacts/presentation/views/ContactDetailView.tsx");
contains(contactDetail, "/invoices/new?customerId=", "Contact Detail must carry Customer and Contact context into Invoice creation.");
contains(contactDetail, "&contactId=${contact.id}", "Contact Detail must carry Contact identity into Invoice creation.");

console.log("Contextual prefill contracts PASS: Organization, Customer and Contact create actions are consumed by canonical forms; Order recipient hydration, invoice Order resolution and safe Order duplication are protected.");
