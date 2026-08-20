import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import fs from "node:fs";
import path from "node:path";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

const root = repositoryRoot;
const read = (relativePath: string) => readPresentationComposition(path.join(root, relativePath), "utf8");
const assertIncludes = (source: string, marker: string, context: string) => {
  if (!source.includes(marker)) throw new Error(`${context}: missing ${marker}`);
};

const customerList = read("src/modules/customers/presentation/pages/CustomerListPage.tsx");

const contactList = read("src/modules/contacts/presentation/pages/ContactListPage.tsx");
const contactStatistics = read("src/modules/contacts/presentation/list/ContactStatisticsPanel.tsx");
const customerStatistics = read("src/modules/customers/presentation/list/CustomerStatisticsPanel.tsx");
const leadList = read("src/modules/leads/presentation/pages/LeadListPage.tsx");
const leadStatistics = read("src/modules/leads/presentation/components/LeadStatisticsModal.tsx");
const customerTable = read("src/modules/customers/presentation/list/CustomerTable.tsx");
const customerCards = read("src/modules/customers/presentation/list/CustomerCardList.tsx");
const customerDetail = read("src/modules/customers/presentation/pages/Customer360Page.tsx");
const taskCreateModal = read("src/modules/tasks/presentation/components/TaskCreateModal.tsx");
const customerHeader = read("src/modules/customers/presentation/detail/CustomerRecordHeader.tsx");
const customerTabs = read("src/modules/customers/presentation/detail/CustomerDetailTabs.tsx");
const relationshipDetailTabs = read("src/components/crm/relationship-detail/RelationshipDetailTabs.tsx");
const relationshipWorkspaceCatalog = read("src/components/crm/relationship-detail/relationshipWorkspaceCatalog.ts");
const relationshipRecordNavigation = read("src/components/crm/relationship-detail/relationshipRecordNavigation.ts");
const customerTabContent = read("src/modules/customers/presentation/detail/CustomerDetailTabContent.tsx");
const contactTabs = read("src/modules/contacts/presentation/detail/ContactDetailTabs.tsx");
const contactTabContent = read("src/modules/contacts/presentation/detail/ContactDetailTabContent.tsx");
const contactDetailView = read("src/modules/contacts/presentation/views/ContactDetailView.tsx");
const contactDetailController = read("src/modules/contacts/presentation/hooks/useContactDetailController.tsx");
const contactTransactionOperations = read("src/modules/contacts/presentation/detail/tabs/ContactTransactionOperationsTabs.tsx");
const organizationTabs = read("src/modules/organizations/presentation/detail/OrganizationDetailTabs.tsx");
const organizationDetail = read("src/modules/organizations/presentation/pages/OrganizationAccountDetailPage.tsx");
const customerInsight = read("src/modules/customers/presentation/detail/CustomerInsightPanel.tsx");
const contactInsight = read("src/modules/contacts/presentation/detail/ContactInsightPanel.tsx");
const organizationInsight = read("src/modules/organizations/presentation/detail/OrganizationInsightPanel.tsx");
const leadInsight = read("src/modules/leads/presentation/components/LeadDetailActivityPanel.tsx");
const relationshipActionBar = read("src/components/crm/relationship-panel/RelationshipPanelActionBar.tsx");
const relationshipQuickActionModal = read("src/components/crm/relationship-panel/RelationshipQuickActionModal.tsx");
const canonicalActivityForms = read("src/modules/tasks/presentation/components/ActivityCreateModals.tsx");
const customerQuickActivityModal = read("src/modules/customers/presentation/detail/CustomerQuickActivityModal.tsx");
const organizationQuickActivityModal = read("src/modules/organizations/presentation/detail/OrganizationQuickActivityModal.tsx");
const contactLogCallModal = read("src/modules/contacts/presentation/detail/actions/ContactLogCallModal.tsx");
const leadDetailModals = read("src/modules/leads/presentation/components/LeadDetailModals.tsx");
const customerInfo = read("src/modules/customers/presentation/detail/CustomerDetailInfoTab.tsx");
const customerOverview = read("src/modules/customers/presentation/detail/CustomerOverviewTab.tsx");
const customerAssessment = read("src/modules/customers/presentation/model/customerOverviewAssessment.ts");
const customerEdit = read("src/modules/customers/presentation/detail/CustomerEditModal.tsx");
const workCalendar = read("src/workspaces/crm/presentation/pages/WorkCalendarPage.tsx");

for (const marker of [
  "ListPageFrame",
  "ListPageHeader",
  "PageHeaderActions",
  "ListToolbar",
  "ListBulkActionBar",
  "ListStatePanel",
  "CustomerSavedViewSelector",
  "CustomerCardList",
  "CustomerTable",
  "CustomerFilterPopover",
  "CustomerColumnSettingsDrawer",
  "CustomerStatisticsPanel",
]) assertIncludes(customerList, marker, "Customer list Contact-archetype contract");


assertIncludes(contactList, 'showStats={true}', "Contact statistics toolbar action");
assertIncludes(contactList, 'statsLabel={t("common.statistics")}', "Contact statistics label");
if (contactList.includes('id: "contact-statistics"')) throw new Error("Contact must keep a single Statistics action in the toolbar, not duplicate it in the page header");
assertIncludes(customerList, 'statsLabel={isVi ? "Thống kê" : "Statistics"}', "Customer statistics label");
if (customerList.includes('id: "customer-statistics"')) throw new Error("Customer must keep a single Statistics action in the toolbar, not duplicate it in the page header");
for (const [name, source] of [["Contact", contactStatistics], ["Customer", customerStatistics], ["Lead", leadStatistics]] as const) {
  assertIncludes(source, "<Modal", `${name} statistics centered modal`);
  if (source.includes("<Drawer")) throw new Error(`${name} statistics must open in a centered modal instead of a right-side drawer`);
}
assertIncludes(leadList, 'showStats={true}', "Lead statistics toolbar action");
assertIncludes(leadList, 'statsLabel={locale === "vi" ? "Thống kê" : "Statistics"}', "Lead statistics label");
assertIncludes(leadList, "LeadStatisticsModal", "Lead statistics modal integration");

assertIncludes(customerList, '<ListPageFrame id="customer-workspace" className="text-slate-700">', "Customer list frame parity");
assertIncludes(customerList, 'className="p-2.5 text-slate-600 hover:text-violet-700 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 shadow-xs transition-all flex items-center justify-center h-10 w-10 cursor-pointer"', "Customer list refresh control parity");
assertIncludes(customerTable, 'className="overflow-x-auto crm-scroll-x font-sans rounded-2xl border border-slate-200 shadow-sm"', "Customer table shell parity");
assertIncludes(customerCards, 'className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-3 font-sans"', "Customer card grid parity");
assertIncludes(customerCards, 'border rounded-2xl p-4 space-y-3 bg-white shadow-sm transition-all', "Customer card surface parity");

for (const marker of [
  "RecordDetailFrame",
  "CustomerRecordHeader",
  "CustomerDetailTabs",
  "CustomerDetailTabContent",
  "CustomerInsightPanel",
]) assertIncludes(customerDetail, marker, "Customer detail Contact-archetype contract");

assertIncludes(customerDetail, '<RecordDetailFrame id="customer-detail-page-workspace" className="min-w-0 space-y-4 rounded-2xl bg-slate-50 p-1 text-[11px] text-slate-700">', "Customer detail frame parity");
assertIncludes(customerDetail, 'className="relative min-w-0 xl:min-h-[calc(100vh-170px)]"', "Customer detail viewport-stable workspace contract");
assertIncludes(customerDetail, 'xl:flex-1', "Customer detail flexible main-column contract");
assertIncludes(customerDetail, 'min-h-[580px] overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm xl:min-h-[calc(100vh-170px)]', "Customer detail stable content surface");
assertIncludes(customerDetail, 'className="p-4 text-left text-slate-800 sm:p-5"', "Customer detail content-padding parity");
assertIncludes(customerDetail, 'xl:sticky xl:top-4 xl:h-[calc(100vh-140px)] xl:w-[350px]', "Customer detail viewport-sticky Flow panel contract");
assertIncludes(relationshipDetailTabs, "DetailPanelToggle", "Shared relationship tab-bar panel control");
assertIncludes(relationshipDetailTabs, "min-w-0 flex-1", "Shared relationship tabs stay to the left of the panel control");
assertIncludes(customerDetail, 'customerPresentationPreferences.set(RIGHT_PANEL_PREFERENCE_KEY, next)', "Customer panel visibility persistence");
assertIncludes(customerDetail, 'title={isVi ? "Thêm công việc cho Customer"', "Customer assigned-task form");
assertIncludes(taskCreateModal, 'size="md"', "Canonical Task workflow form sizing");

assertIncludes(customerHeader, 'className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-sm text-left"', "Customer record-header parity");
assertIncludes(relationshipDetailTabs, 'className="flex min-w-0 items-center gap-2 border-b border-slate-100 bg-slate-50/50 pr-2"', "Shared relationship responsive-tabs parity");
assertIncludes(customerInsight, '2xl:h-full 2xl:min-h-0 2xl:w-[350px]', "Customer Flow panel fills sticky viewport slot");
assertIncludes(customerInsight, 'className="flex-1 overflow-y-auto pr-1 crm-scroll-y space-y-2 min-h-[300px]"', "Customer interaction-feed parity");
for (const [name, source] of [
  ["Lead", leadInsight],
  ["Organization", organizationInsight],
  ["Contact", contactInsight],
  ["Customer", customerInsight],
] as const) {
  assertIncludes(source, "RelationshipPanelActionBar", `${name} shared relationship action rail`);
  for (const actionId of ["call", "task", "meeting", "email", "sms", "note"]) {
    assertIncludes(source, `id: "${actionId}"`, `${name} common relationship action ${actionId}`);
  }
}
assertIncludes(relationshipActionBar, "grid w-full items-center gap-1", "Relationship actions remain on one row");
assertIncludes(relationshipActionBar, "gridTemplateColumns", "Relationship actions distribute evenly across the panel width");
assertIncludes(relationshipActionBar, "h-9 w-9 justify-self-center", "Relationship quick actions retain consistent square controls");
assertIncludes(customerInsight, 'className="absolute left-4 right-4 top-[62px] z-30', "Customer interaction filters open as a bounded popover");
assertIncludes(customerInsight, 'grid grid-cols-4 gap-1', "Customer interaction filters use a stable compact grid");
assertIncludes(customerInsight, 'setIsFilterExpanded(false)', "Customer interaction filter closes after selection/reset");
assertIncludes(relationshipQuickActionModal, 'size="md"', "Relationship quick-action forms share the same medium width");
assertIncludes(relationshipQuickActionModal, 'crm-form-surface space-y-4 text-left', "Relationship quick-action forms share field rhythm");
assertIncludes(relationshipQuickActionModal, 'footer={(', "Relationship quick-action forms share a fixed footer");
for (const marker of ["CallActivityCreateModal", "MeetingActivityCreateModal", "EmailActivityCreateModal", "SmsActivityCreateModal", "NoteActivityCreateModal"]) {
  assertIncludes(canonicalActivityForms, marker, `Canonical relationship activity form ${marker}`);
}
assertIncludes(leadDetailModals, "CallActivityCreateModal", "Lead uses canonical activity forms");
assertIncludes(organizationQuickActivityModal, "RelationshipActivityCreateModal", "Organization uses the canonical relationship activity router");
assertIncludes(contactLogCallModal, "CallActivityCreateModal", "Contact uses canonical activity forms");
assertIncludes(customerQuickActivityModal, "RelationshipActivityCreateModal", "Customer uses the canonical relationship activity router");
if (organizationInsight.includes("grid-cols-3") || organizationInsight.includes("xl:grid-cols-3")) {
  throw new Error("Organization quick actions must remain on one row and must not fall back to a 3-column grid");
}
for (const actionId of ["opportunity", "quote", "order", "care"]) assertIncludes(customerInsight, `id: "${actionId}"`, `Customer-specific relationship action ${actionId}`);
assertIncludes(contactInsight, 'id: "opportunity"', "Contact create-opportunity relationship action");
for (const marker of ["fieldSearch", "showEmptyFields", "Hiển thị dữ liệu trống", "Chưa cung cấp"]) assertIncludes(customerInfo, marker, "Customer detailed-info completeness");
assertIncludes(customerEdit, 'size="lg"', "Customer full edit modal large-size contract");
assertIncludes(customerDetail, 'useState<CustomerDetailTab>("overview")', "Customer overview is the default landing tab");
assertIncludes(relationshipDetailTabs, 'id: "overview"', "Shared relationship overview top-level tab");
if (relationshipDetailTabs.includes('id: "more"') || relationshipDetailTabs.includes('| "more"')) {
  throw new Error("Customer More top-level tab must stay removed because its content is owned by existing grouped workspaces");
}
assertIncludes(customerTabs, 'motionId="customer-primary-tabs"', "Customer stable responsive tab rail");
for (const marker of ["data-customer-overview=\"ai-first\"", "data-customer-ai-brief=\"canonical\"", "AI tổng quan khách hàng", "Đề xuất hoạt động tiếp theo", "buildCustomerRelationshipAssessment", "OverviewKpi", "SnapshotField"]) assertIncludes(customerOverview, marker, "Customer overview AI-first contract");
if (/font-(?:black|extrabold)/.test(customerOverview)) throw new Error("Customer overview must keep a restrained normal/medium/semibold hierarchy");
for (const marker of ["sm:grid-cols-2", "xl:grid-cols-4", "lg:grid-cols-3"]) assertIncludes(customerOverview, marker, "Customer overview responsive composition");
for (const removedDuplicate of ["Hoạt động gần đây", "Recent activity", "RecentChangeRow"]) {
  if (customerOverview.includes(removedDuplicate)) throw new Error(`Customer overview must not duplicate the interaction panel: ${removedDuplicate}`);
}
for (const marker of ["support-sla-breached", "overdue-work", "stale-opportunities", "purchase-inactivity", "missing-primary-contact"]) assertIncludes(customerAssessment, marker, "Customer explainable health assessment signal");

for (const tab of ["overview", "relationship", "sales", "transactions", "service", "work", "attachments"]) {
  assertIncludes(relationshipDetailTabs, `| "${tab}"`, `Shared relationship grouped top-level ${tab} workspace`);
}
for (const removedTab of ["detailInfo", "notes", "contacts", "purchaseHistory", "purchasedProducts", "opportunities", "orders", "quotations", "payments", "returns", "care", "support", "activeTasks"]) {
  if (relationshipDetailTabs.includes(`| "${removedTab}"`)) throw new Error(`Duplicate relationship top-level tab must stay removed: ${removedTab}`);
}
for (const wrapper of [
  ["Customer", customerTabs, 'motionId="customer-primary-tabs"'],
  ["Contact", contactTabs, 'motionId="contact-primary-tabs"'],
  ["Organization", organizationTabs, 'motionId="organization-primary-tabs"'],
] as const) {
  assertIncludes(wrapper[1], "RelationshipDetailTabs", `${wrapper[0]} shared primary-tab wrapper`);
  assertIncludes(wrapper[1], wrapper[2], `${wrapper[0]} stable primary-tab motion id`);
}
for (const marker of ["CustomerWorkspace", 'workspaceKey="relationship"', 'workspaceKey="sales"', 'workspaceKey="transactions"', 'workspaceKey="service"', 'workspaceKey="work"', "InvoicesTab", "CustomerActivitiesTab"]) {
  assertIncludes(customerTabContent, marker, "Customer grouped coordinator workspace contract");
}
for (const marker of [
  'relationship: ["profile", "people", "notes"]',
  'sales: ["opportunities", "quotations"]',
  'transactions: ["orders", "invoices", "payments", "shipping", "returns", "products", "history"]',
  'service: ["support"]',
  'work: ["tasks", "activities"]',
]) assertIncludes(relationshipWorkspaceCatalog, marker, "Canonical relationship sub-workspace order");
if (relationshipWorkspaceCatalog.includes('"campaigns"')) throw new Error("Campaigns must not return as a canonical relationship workspace; campaign participation belongs to its owner module.");

for (const [name, source] of [
  ["Customer", customerTabContent],
  ["Contact", contactTabContent],
  ["Organization", organizationDetail],
] as const) {
  for (const tabId of ["profile", "people", "notes", "opportunities", "quotations", "orders", "invoices", "payments", "shipping", "returns", "products", "history", "support", "tasks", "activities"]) {
    assertIncludes(source, `id: "${tabId}"`, `${name} canonical coordinator subtab ${tabId}`);
  }
}
for (const obsoleteFile of ["ContactCampaignsTab.tsx", "ContactMoreTab.tsx"]) {
  const obsoletePath = ["src", "modules", "contacts", "presentation", "detail", "tabs", obsoleteFile].join("/");
  if (fs.existsSync(path.join(root, obsoletePath))) throw new Error(`Obsolete local-only Contact workspace must stay removed: ${obsoleteFile}`);
}
for (const marker of ["ContactRelationshipsTab", "ContactActivitiesTab", "ContactTransactionOperationsTabs"]) {
  assertIncludes(contactTabContent, marker === "ContactTransactionOperationsTabs" ? "ContactPaymentsTab" : marker, "Contact relationship coordinator composition");
}
for (const marker of ["customerAliases", "matchesRelationship", "sourceLinks.orderId", "relatedReceivables", "relatedPayments", "relatedShipping", "relatedReturns", "relatedSupport", "relatedTasks", "relatedActivities"]) {
  assertIncludes(organizationDetail, marker, "Organization authoritative cross-module relationship graph");
}
for (const marker of ["relationshipRecordPath", 'support: "/support/cases"', "encodeURIComponent(recordId)"]) {
  assertIncludes(relationshipRecordNavigation, marker, "Shared owner-module record navigation");
}
for (const [name, source] of [
  ["Customer", customerTabContent],
  ["Contact", contactDetailView],
  ["Organization", organizationDetail],
] as const) assertIncludes(source, "relationshipRecordPath", `${name} owner-module record routing`);
for (const [name, source] of [
  ["Customer", customerDetail],
  ["Contact", contactDetailView],
  ["Organization", organizationDetail],
] as const) {
  assertIncludes(source, "xl:min-h-[calc(100vh-170px)]", `${name} canonical responsive detail workspace breakpoint`);
  assertIncludes(source, "xl:sticky xl:top-4 xl:h-[calc(100vh-140px)] xl:w-[350px]", `${name} canonical interaction-panel geometry`);
  assertIncludes(source, "min-h-[580px] overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm", `${name} canonical detail content surface`);
}
for (const marker of ["RelationshipWorkspace", 'workspaceKey="contact-relationship"', 'workspaceKey="contact-sales"', 'workspaceKey="contact-transactions"', 'workspaceKey="contact-service"', 'workspaceKey="contact-work"', "ContactInvoicesTab", "ContactPaymentsTab", "ContactShippingTab", "ContactReturnsTab", "ContactPurchaseHistoryTab"]) {
  assertIncludes(contactTabContent, marker, "Contact grouped coordinator workspace contract");
}
for (const marker of ["getPaymentsSnapshot", "subscribeToPayments", "getShippingSnapshot", "subscribeToShipping", "getReturnsSnapshot", "subscribeToReturns", "contactPayments", "contactShipping", "contactReturns"]) {
  assertIncludes(contactDetailController, marker, "Contact authoritative cross-module orchestration");
}
for (const marker of ["ContactPaymentsTab", "ContactShippingTab", "ContactReturnsTab", "ContactPurchaseHistoryTab", "onOpenRecord"]) {
  assertIncludes(contactTransactionOperations, marker, "Contact cross-module transaction workspace");
}
for (const marker of ["contactPayments", "contactShipping", "contactReturns", "purchaseHistory"]) {
  assertIncludes(contactDetailView, marker, "Contact detail orchestration view model");
}
for (const marker of ['transactions: ["orders", "invoices", "payments", "shipping", "returns", "products", "history"]', 'invoices: { vi: "Hóa đơn", en: "Invoices" }']) {
  assertIncludes(relationshipWorkspaceCatalog, marker, "Canonical relationship workspace catalog");
}
for (const marker of ["organization-relationship", "organization-sales", "organization-transactions", "organization-service", "organization-work", "relatedProducts", "relatedHistory"]) {
  assertIncludes(organizationDetail, marker, "Organization grouped coordinator workspace contract");
}
for (const marker of ["AnimatePresence", "motion.aside", 'mode="popLayout"', "useReducedMotion", "RecordTabTransition", "transitionKey={activeTab}", "requestedSubTab", "selectCustomerView"]) assertIncludes(customerDetail, marker, "Customer motion and deep-link workspace contract");
if (customerDetail.includes("motion.main") || customerDetail.includes('layout="size"')) {
  throw new Error("Customer tab content must match Organization Detail and must not retain a competing main-layout animation");
}
assertIncludes(workCalendar, 'task.assigneeId === currentMemberId', "Assigned Tasks in Work Calendar");

console.log("Customer/Contact UI parity contracts: PASS");
