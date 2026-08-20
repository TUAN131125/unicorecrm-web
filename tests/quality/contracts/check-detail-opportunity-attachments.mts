import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import path from "node:path";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

const root = repositoryRoot;
const read = (file: string) => readPresentationComposition(path.join(root, file), "utf8");

const opportunityActions = read("src/components/crm/detail-archetype/OpportunityRowActions.tsx");
assert.match(opportunityActions, /min-h-8 min-w-\[88px\]/u, "Opportunity row actions must share one minimum height and width.");
assert.match(opportunityActions, /whitespace-normal/u, "Opportunity row action labels must wrap instead of clipping.");
assert.match(opportunityActions, /bg-violet-600/u, "Quote creation must use the shared create-action color.");
assert.match(opportunityActions, /bg-amber-50/u, "Stage progression must use the shared progression color.");

for (const consumer of [
  "src/modules/contacts/presentation/detail/tabs/ContactOpportunitiesTab.tsx",
  "src/modules/customers/presentation/detail/CustomerDetailTabContent.tsx",
]) {
  assert.match(read(consumer), /OpportunityRowActions/u, `${consumer} must use the shared opportunity action group.`);
}

for (const consumer of [
  "src/modules/contacts/presentation/detail/tabs/ContactAttachmentsTab.tsx",
  "src/modules/leads/presentation/pages/LeadDetailPage.tsx",
  "src/modules/customers/presentation/detail/CustomerDetailTabContent.tsx",
]) {
  assert.match(read(consumer), /RecordAttachmentsTab/u, `${consumer} must use the shared attachment tab.`);
}

const customerTabs = read("src/modules/customers/presentation/detail/CustomerDetailTabs.tsx");
assert.match(customerTabs, /RelationshipDetailTabs/u, "Customer detail must delegate its tab catalog to the shared relationship detail tabs.");
assert.match(read("src/components/crm/relationship-detail/RelationshipDetailTabs.tsx"), /id: "attachments"/u, "The shared relationship detail tabs must expose attachments.");

console.log("Detail opportunity and attachment parity contracts: PASS");
