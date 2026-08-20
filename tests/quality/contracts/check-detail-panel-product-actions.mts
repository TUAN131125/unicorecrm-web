import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import path from "node:path";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

const root = repositoryRoot;
const read = (file: string) => readPresentationComposition(path.join(root, file), "utf8");

const panelToggle = read("src/components/detail/DetailPanelToggle.tsx");
const relationshipTabs = read("src/components/crm/relationship-detail/RelationshipDetailTabs.tsx");
assert.match(panelToggle, /PanelRightClose/u, "The shared tab-bar toggle must show the close-panel state.");
assert.match(panelToggle, /PanelRightOpen/u, "The shared tab-bar toggle must show the open-panel state.");
assert.match(panelToggle, /h-10 w-10 shrink-0/u, "The tab-bar toggle must have a stable square size and must not shrink.");
assert.match(panelToggle, /aria-pressed=\{isPanelVisible\}/u, "The tab-bar toggle must expose its current state.");

for (const marker of [/DetailPanelToggle/u, /min-w-0 flex-1/u, /overflowMode="dropdown"/u, /reflowKey=\{isRightPanelVisible\}/u]) {
  assert.match(relationshipTabs, marker, `Shared relationship detail tabs must own ${marker}.`);
}
for (const file of [
  "src/modules/contacts/presentation/detail/ContactDetailTabs.tsx",
  "src/modules/customers/presentation/detail/CustomerDetailTabs.tsx",
  "src/modules/organizations/presentation/detail/OrganizationDetailTabs.tsx",
]) {
  const source = read(file);
  assert.match(source, /RelationshipDetailTabs/u, `${file} must use the shared relationship-detail tab rail.`);
  assert.doesNotMatch(source, /absolute inset-y-0 -right-3/u, `${file} must not use an edge-overlaid panel handle.`);
}
{
  const source = read("src/modules/leads/presentation/pages/LeadDetailPage.tsx");
  assert.match(source, /DetailPanelToggle/u, "Lead detail must place the panel toggle in its tab bar.");
  assert.match(source, /min-w-0 flex-1/u, "Lead detail must keep all tabs to the left of the panel toggle.");
}

for (const file of [
  "src/modules/contacts/presentation/pages/ContactDetailPage.tsx",
  "src/modules/leads/presentation/components/LeadDetailActivityPanel.tsx",
  "src/modules/customers/presentation/pages/Customer360Page.tsx",
]) {
  const source = read(file);
  assert.doesNotMatch(source, /PanelHandle/u, `${file} must not render a floating panel handle.`);
  assert.doesNotMatch(source, /sticky top-\[50vh\] h-fit -translate-y-1\/2/u, `${file} must not reserve or overlay space for a floating handle.`);
}

for (const file of [
  "src/modules/deals/presentation/components/DealFormModal.tsx",
  "src/workflows/lead-qualification/presentation/pages/LeadSellNowPage.tsx",
  "src/modules/deals/presentation/pages/DealDetailPage.tsx",
  "src/modules/quotes/presentation/pages/QuoteBuilderPage.tsx",
  "src/modules/orders/presentation/components/OrderLineItemsEditor.tsx",
  "src/modules/leads/presentation/pages/LeadDetailPage.tsx",
]) {
  const source = read(file);
  assert.match(source, /actionIntent="create"/u, `${file} must use the shared create-action treatment for adding or selecting products.`);
}

for (const file of [
  "src/modules/deals/presentation/components/DealFormModal.tsx",
]) {
  const source = read(file);
  assert.match(source, /actionIntent="create"[\s\S]{0,180}min-w-\[132px\]/u, `${file} must use the shared create button size for product selection.`);
  assert.doesNotMatch(source, /className="py-1 px-2(?:\.5)?[^"]*bg-indigo-600/u, `${file} must not keep the legacy product-button color overrides.`);
}

for (const file of [
  "src/modules/contacts/presentation/detail/ContactCreateOpportunityModal.tsx",
  "src/modules/contacts/presentation/list/ContactOpportunityModal.tsx",
]) assert.match(read(file), /DealFormModal/u, `${file} must delegate product actions to the shared Deal form.`);

const orderLines = read("src/modules/orders/presentation/components/OrderLineItemsEditor.tsx");
assert.doesNotMatch(orderLines, /<button[\s\S]{0,300}Chọn từ danh mục sản phẩm/u, "Order product selection must use the shared Button component.");

console.log("Detail panel and product action contracts: PASS");
