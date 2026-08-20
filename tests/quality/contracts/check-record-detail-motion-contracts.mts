import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import path from "node:path";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

const root = repositoryRoot;
const read = (relative: string) => readPresentationComposition(path.join(root, relative), "utf8");

const tabs = read("src/shared/components/ui/Tabs.tsx");
const transition = read("src/shared/components/ui/RecordTabTransition.tsx");
const leadPage = read("src/modules/leads/presentation/pages/LeadDetailPage.tsx");
const leadPanel = read("src/modules/leads/presentation/components/LeadDetailActivityPanel.tsx");
const contactPage = read("src/modules/contacts/presentation/pages/ContactDetailPage.tsx");
const contactTabs = read("src/modules/contacts/presentation/detail/ContactDetailTabs.tsx");
const relationshipTabs = read("src/components/crm/relationship-detail/RelationshipDetailTabs.tsx");
const contactPanel = read("src/modules/contacts/presentation/detail/ContactInsightPanel.tsx");
const customerPage = read("src/modules/customers/presentation/pages/Customer360Page.tsx");
const customerTabs = read("src/modules/customers/presentation/detail/CustomerDetailTabs.tsx");
const customerContent = read("src/modules/customers/presentation/detail/CustomerDetailTabContent.tsx");
const organizationPage = read("src/modules/organizations/presentation/pages/OrganizationAccountDetailPage.tsx");
const organizationTabs = read("src/modules/organizations/presentation/detail/OrganizationDetailTabs.tsx");
const organizationPanel = read("src/modules/organizations/presentation/detail/OrganizationInsightPanel.tsx");

for (const marker of [
  "overflowMode",
  '"dropdown" | "scroll"',
  "motionId",
  "layoutId",
  "useReducedMotion",
  "reflowKey",
  "React.useLayoutEffect",
  "ResizeObserver",
  'data-responsive-tabs="v3"',
  'data-responsive-tabs-visible-rail="true"',
  "flex-nowrap",
  "overflow-hidden whitespace-nowrap",
  "measureLayout",
  "pre-paint width measurement",
]) {
  assert.match(tabs, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `ResponsiveTabs motion contract missing ${marker}`);
}
assert.equal(tabs.includes("resizeCommitTimerRef"), false, "Responsive tabs must not debounce panel-driven width changes.");
assert.equal(tabs.includes("setTimeout(() =>"), false, "Responsive tabs must not wait for the panel animation before moving tabs into overflow.");
for (const marker of ["AnimatePresence", 'mode="popLayout"', "useReducedMotion", 'data-tab-content-motion="v2"', 'layout={layoutMotion ? "position" : false}', "layoutMotion"]) {
  assert.ok(transition.includes(marker), `Shared record tab transition missing ${marker}`);
}

const detailPages = [
  { name: "Lead", source: leadPage, minHeight: 'minHeightClassName="min-h-[460px]"' },
  { name: "Contact", source: contactPage, minHeight: 'minHeightClassName="min-h-[460px]"' },
  { name: "Customer", source: customerPage, minHeight: 'minHeightClassName="min-h-[460px]"' },
  { name: "Organization", source: organizationPage, minHeight: null },
];

for (const page of detailPages) {
  for (const marker of ["RecordTabTransition", "transitionKey={activeTab}"]) {
    assert.ok(page.source.includes(marker), `${page.name} detail must use the shared Organization-style tab transition: ${marker}`);
  }
  assert.equal(page.source.includes("motion.main"), false, `${page.name} detail must not animate the main tab container in parallel.`);
  assert.equal(page.source.includes('layout="size"'), false, `${page.name} detail must not use a competing size-layout transition.`);
  if (page.minHeight) assert.ok(page.source.includes(page.minHeight), `${page.name} stable tab-content height missing ${page.minHeight}`);
}

assert.ok(leadPage.includes('motionId="lead-primary-tabs"'), "Lead stable tab rail missing its motion id.");
assert.ok(leadPage.includes("reflowKey={isRightPanelVisible}"), "Lead tabs must remeasure before paint when the panel changes.");
assert.ok(contactTabs.includes('motionId="contact-primary-tabs"'), "Contact stable tab rail missing its motion id.");
assert.ok(customerTabs.includes('motionId="customer-primary-tabs"'), "Customer stable tab rail missing its motion id.");
assert.ok(organizationTabs.includes('motionId="organization-primary-tabs"'), "Organization stable tab rail missing its motion id.");

for (const marker of [
  'overflowMode="dropdown"',
  'motionId="lead-primary-tabs"',
  'lg:min-h-[calc(100vh-170px)]',
]) assert.ok(leadPage.includes(marker), `Lead detail motion contract missing ${marker}`);
for (const marker of [
  "AnimatePresence",
  "motion.aside",
  "useReducedMotion",
  'lg:sticky lg:top-4 lg:h-[calc(100vh-140px)]',
  'mode="popLayout"',
]) assert.ok(leadPanel.includes(marker), `Lead activity panel motion contract missing ${marker}`);

for (const marker of ['overflowMode="dropdown"', "DetailPanelToggle", "min-w-0 flex-1", "reflowKey={isRightPanelVisible}"]) {
  assert.ok(relationshipTabs.includes(marker), `Shared relationship-detail tab rail missing ${marker}`);
}
for (const marker of ["RelationshipDetailTabs", 'motionId="contact-primary-tabs"', "isRightPanelVisible", "onToggleRightPanel"]) {
  assert.ok(contactTabs.includes(marker), `Contact relationship-tab wrapper missing ${marker}`);
}
for (const marker of ["AnimatePresence", "motion.aside", "useReducedMotion", 'mode="popLayout"']) {
  assert.ok(contactPage.includes(marker), `Contact side-panel motion contract missing ${marker}`);
}
assert.ok(contactPage.includes("const isPanelOpen = isRightPanelVisible;"), "Contact action modals must keep the interaction panel mounted.");
assert.equal(contactPage.includes("isRightPanelVisible && !isAnyContactModalOpen"), false, "Contact action modals must not collapse the interaction panel.");
for (const marker of ["AnimatePresence", "motion.div", "useReducedMotion", 'mode="popLayout"']) {
  assert.ok(contactPanel.includes(marker), `Contact interaction-panel internal motion contract missing ${marker}`);
}

for (const marker of ["RelationshipDetailTabs", 'motionId="customer-primary-tabs"', "isRightPanelVisible", "onToggleRightPanel"]) {
  assert.ok(customerTabs.includes(marker), `Customer relationship-tab wrapper missing ${marker}`);
}
assert.equal(relationshipTabs.includes('id: "more"'), false, "Shared relationship tab rail must not restore the duplicate More workspace");
assert.ok(customerPage.includes("const isPanelOpen = isRightPanelVisible;"), "Customer action modals must keep the interaction panel mounted.");
assert.equal(customerPage.includes("isRightPanelVisible && !isAnyCustomerModalOpen"), false, "Customer action modals must not collapse the interaction panel.");
assert.equal(customerContent.includes("AnimatePresence"), false, "Customer tab body must not run a second enter/exit animation beneath RecordTabTransition.");
assert.ok(customerContent.includes('className="min-h-[420px]"'), "Customer detail must preserve stable content height.");

for (const marker of ["RecordTabTransition", 'min-h-[580px]', 'xl:min-h-[calc(100vh-170px)]']) {
  assert.ok(organizationPage.includes(marker), `Organization workspace stability contract missing ${marker}`);
}
for (const marker of ["RelationshipDetailTabs", 'motionId="organization-primary-tabs"', "isRightPanelVisible", "onToggleRightPanel"]) {
  assert.ok(organizationTabs.includes(marker), `Organization relationship-tab wrapper missing ${marker}`);
}
for (const marker of ["AnimatePresence", "motion.aside", "useReducedMotion", 'mode="popLayout"', "OrganizationInsightPanel"]) {
  assert.ok(organizationPage.includes(marker), `Organization side-panel motion contract missing ${marker}`);
}
for (const marker of ["AnimatePresence", "motion.div", "useReducedMotion", 'mode="popLayout"']) {
  assert.ok(organizationPanel.includes(marker), `Organization interaction-panel internal motion contract missing ${marker}`);
}

console.log("Record detail motion contracts: PASS");
console.log("- Lead, Contact, Customer and Organization use one shared tab-content transition plus the tab indicator.");
console.log("- Main content containers do not run competing size/layout animations.");
console.log("- Optional right-side panels retain independent enter/exit motion without affecting tab content.");
