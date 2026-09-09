import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = repositoryRoot;
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");
const assertContains = (source: string, token: string, message: string) => assert.ok(source.includes(token), message);
const assertNoFormControls = (relativePath: string, allowedTokens: string[] = []) => {
  const source = read(relativePath);
  const stripped = allowedTokens.reduce((current, token) => current.replaceAll(token, ""), source);
  for (const token of ["<form", "<Input", "<Select", "<Textarea", "<ProductPickerModal"]) {
    assert.ok(!stripped.includes(token), `${relativePath} must not recreate canonical form control ${token}.`);
  }
};

const contactCanonicalPath = "src/modules/contacts/presentation/components/ContactFormModal.tsx";
const contactCanonical = read(contactCanonicalPath);
for (const token of [
  "export function ContactFormModal",
  'export type ContactFormMode = "create" | "edit"',
  'id={`contact-${mode}-form`}',
  'data-guidance-id="contacts.form.canonical"',
  "loading={isSubmitting}",
  "setFormError",
]) {
  assertContains(contactCanonical, token, `${contactCanonicalPath} must retain ${token}.`);
}
for (const [adapter, mode] of [
  ["src/modules/contacts/presentation/list/ContactCreateModal.tsx", 'mode="create"'],
  ["src/modules/contacts/presentation/detail/ContactEditModal.tsx", 'mode="edit"'],
] as const) {
  const source = read(adapter);
  assertContains(source, "ContactFormModal", `${adapter} must delegate to ContactFormModal.`);
  assertContains(source, mode, `${adapter} must preserve ${mode}.`);
  assertNoFormControls(adapter);
}

const organizationCanonicalPath = "src/modules/organizations/presentation/components/OrganizationAccountFormModal.tsx";
const organizationCanonical = read(organizationCanonicalPath);
for (const token of [
  "export function OrganizationAccountFormModal",
  'export type OrganizationAccountFormMode = "create" | "edit"',
  'id={`organization-account-${mode}-form`}',
  "representativeName",
  "relationshipLevel",
]) {
  assertContains(organizationCanonical, token, `${organizationCanonicalPath} must retain ${token}.`);
}
for (const [adapter, mode] of [
  ["src/modules/organizations/presentation/list/OrganizationCreateModal.tsx", 'mode="create"'],
  ["src/modules/organizations/presentation/detail/OrganizationEditModal.tsx", 'mode="edit"'],
] as const) {
  const source = read(adapter);
  assertContains(source, "OrganizationAccountFormModal", `${adapter} must delegate to OrganizationAccountFormModal.`);
  assertContains(source, mode, `${adapter} must preserve ${mode}.`);
  assertNoFormControls(adapter);
}

const dealCanonicalPath = "src/modules/deals/presentation/components/DealFormModal.tsx";
const dealCanonical = read(dealCanonicalPath);
for (const token of [
  "export function DealFormModal",
  'export type DealFormMode = "create" | "edit"',
  'id={`deal-${mode}-form`}',
  'data-guidance-id="deals.form.canonical"',
  "mapSelectedPickerItemsToDealLineItems",
  "ProductPickerModal",
  "nextActionSummary",
  "forecastCategory",
]) {
  assertContains(dealCanonical, token, `${dealCanonicalPath} must retain ${token}.`);
}

for (const adapter of [
  "src/modules/contacts/presentation/list/ContactOpportunityModal.tsx",
  "src/modules/contacts/presentation/detail/ContactCreateOpportunityModal.tsx",
]) {
  const source = read(adapter);
  assertContains(source, "DealFormModal", `${adapter} must delegate opportunity creation to DealFormModal.`);
  assertContains(source, 'mode="create"', `${adapter} must use canonical create mode.`);
  assertNoFormControls(adapter);
}

const customer360 = read("src/modules/customers/presentation/pages/Customer360Page.tsx");
assertContains(customer360, "DealFormModal", "Customer 360 must use the canonical Deal/Opportunity form.");
assertContains(customer360, "mapSelectedPickerItemsToDealLineItems", "Customer 360 must map canonical product selections through the Deal helper.");
assert.ok(!customer360.includes("createDealDraft"), "Customer 360 must not retain a duplicate local Deal draft factory.");

const pipelineModals = read("src/modules/deals/presentation/components/DealPipelineModals.tsx");
assert.ok((pipelineModals.match(/<DealFormModal/g) ?? []).length === 2, "Deal pipeline must use one canonical form instance for create and one for edit.");
assertContains(pipelineModals, 'mode="create"', "Deal pipeline must preserve canonical create mode.");
assertContains(pipelineModals, 'mode="edit"', "Deal pipeline must preserve canonical edit mode.");

const dealsPublicBoundary = read("src/modules/deals/public/index.ts");
for (const token of ["DealFormModal", "DealFormDraft", "mapSelectedPickerItemsToDealLineItems"]) {
  assertContains(dealsPublicBoundary, token, `Deals public boundary must export ${token}.`);
}

const savedViewCanonicalPath = "src/components/crm/SavedViewNameModal.tsx";
const savedViewCanonical = read(savedViewCanonicalPath);
for (const token of [
  "export function SavedViewNameModal",
  'mode: "create" | "edit"',
  "autoFocus",
  "onNameChange",
  "onSubmit",
]) {
  assertContains(savedViewCanonical, token, `${savedViewCanonicalPath} must retain ${token}.`);
}
for (const caller of [
  "src/modules/leads/presentation/components/LeadAddViewModal.tsx",
  "src/modules/contacts/presentation/views/ContactListView.tsx",
  "src/modules/customers/presentation/pages/CustomerListPage.tsx",
]) {
  const source = read(caller);
  assertContains(source, "SavedViewNameModal", `${caller} must use the canonical Saved View form.`);
}
assertNoFormControls("src/modules/leads/presentation/components/LeadAddViewModal.tsx");

const contactQuoteTab = read("src/modules/contacts/presentation/detail/tabs/ContactQuotationsTab.tsx");
assertContains(contactQuoteTab, "onCreateQuoteClick(selectedDealId)", "Contact quote creation must route into the canonical Quote Builder.");
for (const duplicateQuoteState of [
  "const [quoteTitle",
  "const [quoteTotal",
  "const [quoteValidUntil",
  "quoteTitleField",
  "quoteTotalField",
  "validUntilField",
]) {
  assert.ok(!contactQuoteTab.includes(duplicateQuoteState), `Contact quote tab must not own duplicate Quote input state ${duplicateQuoteState}.`);
}

const orderColumnAdapter = read("src/modules/orders/presentation/list/OrderColumnSettingsModal.tsx");
assertContains(orderColumnAdapter, "ColumnSettingsDrawer", "Order column settings must use the shared canonical drawer.");
assert.ok(!orderColumnAdapter.includes("<Modal"), "Order column settings must not recreate a separate modal shell.");
assert.ok(!orderColumnAdapter.includes("onToggleColumn"), "Order column settings must save the canonical ordered selection atomically.");

console.log("Canonical CRM form contracts PASS: Contact, Organization, Deal/Opportunity and Saved View, Quote entry and column settings families are centralized; callers are adapters/context owners only.");
