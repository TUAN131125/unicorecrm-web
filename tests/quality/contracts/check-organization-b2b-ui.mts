import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = repositoryRoot;
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

const typeSource = read("src/modules/organizations/domain/model/organizationAccount.types.ts");
const seedSource = read("src/modules/organizations/infrastructure/organizationAccount.seed.ts");
const listPage = read("src/modules/organizations/presentation/pages/OrganizationAccountListPage.tsx");
const detailPage = read("src/modules/organizations/presentation/pages/OrganizationAccountDetailPage.tsx");
const recordHeader = read("src/modules/organizations/presentation/detail/OrganizationRecordHeader.tsx");
const overview = read("src/modules/organizations/presentation/detail/OrganizationOverviewTab.tsx");
const createModal = read("src/modules/organizations/presentation/list/OrganizationCreateModal.tsx");
const representativeModal = read("src/modules/organizations/presentation/detail/OrganizationRepresentativeModal.tsx");
const tabs = read("src/modules/organizations/presentation/detail/OrganizationDetailTabs.tsx");
const relationshipTabs = read("src/components/crm/relationship-detail/RelationshipDetailTabs.tsx");
const relationshipCatalog = read("src/components/crm/relationship-detail/relationshipWorkspaceCatalog.ts");
const helpers = read("src/modules/organizations/presentation/model/organizationAccountView.ts");
const contactsPublic = read("src/modules/contacts/public/contacts.ts");

assert.match(typeSource, /primaryContactId\?: string;/, "Organization must own a primary Contact reference, not a duplicated person identity.");
assert.match(typeSource, /contactRefs: ContactRelationshipRef\[\];/, "Organization must preserve Contact relationship references.");
assert.match(typeSource, /OrganizationAccountStatus/, "Organization needs its own B2B account status model.");
assert.match(seedSource, /primaryContactId:/, "Seed accounts should identify a primary representative for visual continuity.");

assert.match(createModal, /createOrganizationWithRepresentativeWorkflow/, "Create flow must use the atomic Organization + representative workflow.");
assert.match(createModal, /organization: account/, "Atomic create flow must pass the Organization aggregate.");
assert.match(createModal, /representative,/, "Atomic create flow must pass the representative Contact.");
assert.match(createModal, /organizationAccountId: organizationId/, "Representative Contact must link back to Organization.");
assert.match(createModal, /primaryContactId: contactId/, "Created Organization must identify its primary representative.");
assert.match(createModal, /contactRefs: \[\{ type: "CONTACT", id: contactId \}\]/, "Created Organization must use canonical Contact relationship refs.");
assert.match(createModal, /isPrimaryContact: true/, "Created representative Contact must be marked primary for compatibility/read models.");

assert.match(representativeModal, /createOrganizationRepresentativeWorkflow/, "Adding a representative must use the atomic relationship workflow.");
assert.match(representativeModal, /organizationAccountId: account\.id/, "Additional representatives must link through canonical Organization ID.");
assert.match(representativeModal, /relationship:/, "Organization representative creation must supply canonical relationship metadata.");

assert.match(listPage, /OrganizationTable/, "Organization list must provide table view comparable to Contact.");
assert.match(listPage, /OrganizationCardList/, "Organization list must provide card view comparable to Contact.");
assert.match(listPage, /getPrimaryOrganizationContact/, "Organization list must surface the primary individual representative.");
assert.match(listPage, /Khách hàng doanh nghiệp B2B/, "Organization UI must explicitly communicate B2B semantics.");

for (const tab of ["overview", "relationship", "sales", "transactions", "service", "work", "attachments"]) {
  assert.match(relationshipTabs, new RegExp(`\| "${tab}"`), `Shared relationship detail must expose ${tab} top-level workspace.`);
}
assert.match(tabs, /RelationshipDetailTabs/, "Organization detail must use the shared relationship-detail tab rail.");
assert.match(tabs, /motionId="organization-primary-tabs"/, "Organization detail must retain a stable tab motion identity.");
for (const workspace of ["organization-relationship", "organization-sales", "organization-transactions", "organization-service", "organization-work"]) {
  assert.match(detailPage, new RegExp(workspace), `Organization detail must expose the ${workspace} coordinator workspace.`);
}
for (const item of ["orders", "invoices", "payments", "shipping", "returns", "products", "history"]) {
  assert.match(detailPage, new RegExp(`id: "${item}"`), `Organization transactions must expose ${item}.`);
}
assert.match(relationshipCatalog, /transactions: \["orders", "invoices", "payments", "shipping", "returns", "products", "history"\]/, "Organization must follow the canonical relationship transaction order.");
assert.match(detailPage, /matchesRelationship\(.*buyerRef\)/, "Commercial records must be resolved through the canonical Organization/Customer relationshipRef.");
assert.match(detailPage, /invoice\.sourceLinks\.orderId/, "Invoices must remain discoverable through their owning Order lineage when buyerRef snapshots are incomplete.");
assert.match(detailPage, /matchesCustomerAlias/, "Legacy Customer identifiers must reconcile into the Organization coordinator without becoming new ownership.");
assert.match(detailPage, /OrganizationRepresentativesTab/, "Detail page must include a dedicated representative workspace.");
assert.match(detailPage, /PrimaryRepresentativeChanged/, "Detail page must support choosing the primary representative.");
assert.match(detailPage, /OrganizationInsightPanel/, "Organization Detail must expose the same interaction workspace archetype as Contact and Customer.");
assert.match(detailPage, /OrganizationQuickActivityModal/, "Organization Detail must support authoritative relationship activity capture.");
assert.match(detailPage, /RecordAttachmentsTab/, "Organization Detail must include the shared attachment workspace.");
assert.match(detailPage, /getInvoicesSnapshot/, "Organization Detail must expose authoritative invoices linked by buyerRef.");
assert.match(detailPage, /getPaymentsSnapshot/, "Organization Detail must expose authoritative payments linked by buyerRef or orders.");
assert.match(detailPage, /getShippingSnapshot/, "Organization Detail must expose authoritative shipping linked by orders or returns.");
assert.match(detailPage, /getReturnsSnapshot/, "Organization Detail must expose authoritative returns linked by buyerRef or orders.");
assert.match(detailPage, /getReceivablesSnapshot/, "Organization Detail must expose authoritative receivables linked by invoices.");
assert.match(detailPage, /relatedProducts/, "Organization Detail must aggregate purchased products from authoritative order lines.");
assert.match(detailPage, /relatedHistory/, "Organization Detail must build cross-module transaction history.");
assert.match(relationshipTabs, /DetailPanelToggle/, "Shared relationship tabs must expose the interaction-panel toggle.");

assert.match(recordHeader, /data-organization-record-header="customer-pattern"/, "Organization header must use the compact Customer-detail action hierarchy.");
assert.match(recordHeader, /RowActionPortal/, "Secondary Organization actions must be grouped in one overflow menu.");
assert.match(recordHeader, /Thêm đại diện/, "Organization header must expose one clear primary representative action.");
assert.match(recordHeader, /Mở Customer 360/, "Customer 360 navigation must remain available from the grouped action menu.");
assert.doesNotMatch(recordHeader, /PageHeaderActions/, "Organization header must not scatter actions across independent action groups.");
assert.match(overview, /data-organization-overview="ai-first"/, "Organization overview must follow the AI-first Customer overview reading flow.");
assert.match(overview, /xl:grid-cols/, "Organization overview must defer split layouts until wide screens.");
assert.match(overview, /AI tổng quan tổ chức/, "Organization overview must explain the relationship and recommend a next action.");
assert.match(listPage, /useListPagination/, "Organization list must use the shared pagination state.");
assert.match(listPage, /ListPaginationBar/, "Organization list must render canonical pagination.");

const organizationDetailSources = [recordHeader, overview, detailPage, tabs];
for (const source of organizationDetailSources) {
  assert.doesNotMatch(source, /font-(?:black|extrabold)/, "Organization detail must keep typography within normal/medium/semibold hierarchy.");
}

assert.match(helpers, /isContactLinkedToOrganization\(contact, account\.id\)/, "Related Contact resolution must use the canonical many-to-many organization relationship ledger.");
assert.match(helpers, /contact\.id === account\.primaryContactId/, "Primary representative resolution must prefer Organization-owned primaryContactId.");
assert.match(helpers, /findContactOrganizationRelationship/, "Primary representative resolution must understand relationship-specific primary flags.");
assert.match(contactsPublic, /saveContactSnapshot/, "Contact public boundary must expose capability-checked Contact creation for Organization flows.");

for (const source of [listPage, detailPage, createModal, representativeModal]) {
  assert.doesNotMatch(source, /removeOrganizationAccount|deleteOrganizationAccount|handleDelete/, "Organization B2B UI must not introduce hard-delete actions.");
}

console.log("Organization B2B UI audit: PASS");
console.log("- Organization is the B2B buyer/account identity.");
console.log("- Contact remains the individual person identity.");
console.log("- Create flow links Organization + primary representative Contact.");
console.log("- List provides table/card views with primary representative visibility.");
console.log("- Detail uses seven canonical coordinator tabs with authoritative relationship, sales, transaction, service, work and attachment workspaces.");
console.log("- Detail uses the shared relationship interaction panel without hiding it behind action modals.");
console.log("- Header actions follow the compact Customer-detail hierarchy and overview is AI-first.");
console.log("- Organization list uses the canonical shared pagination model.");
console.log("- No hard-delete action was introduced in Organization presentation flows.");
