import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = repositoryRoot;
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

const canonicalPath = "src/modules/tasks/presentation/components/ActivityCreateModals.tsx";
const canonical = read(canonicalPath);

for (const token of [
  "CallActivityCreateModal",
  "MeetingActivityCreateModal",
  "EmailActivityCreateModal",
  "SmsActivityCreateModal",
  "NoteActivityCreateModal",
  "CallActivityDraft",
  "MeetingActivityDraft",
  "EmailActivityDraft",
  "SmsActivityDraft",
  "NoteActivityDraft",
  "ActivityContactPolicy",
]) {
  assert.ok(canonical.includes(token), `${canonicalPath} must retain ${token}.`);
}

const directCallers: Array<[string, string]> = [
  ["src/modules/contacts/presentation/detail/actions/ContactLogCallModal.tsx", "CallActivityCreateModal"],
  ["src/modules/contacts/presentation/detail/actions/ContactMeetingModal.tsx", "MeetingActivityCreateModal"],
  ["src/modules/contacts/presentation/detail/actions/ContactSendEmailModal.tsx", "EmailActivityCreateModal"],
  ["src/modules/contacts/presentation/detail/actions/ContactSendSmsModal.tsx", "SmsActivityCreateModal"],
  ["src/modules/contacts/presentation/detail/actions/ContactQuickNoteModal.tsx", "NoteActivityCreateModal"],
  ["src/modules/leads/presentation/components/LeadDetailModals.tsx", "CallActivityCreateModal"],
  ["src/modules/leads/presentation/components/LeadDetailModals.tsx", "MeetingActivityCreateModal"],
  ["src/modules/leads/presentation/components/LeadDetailModals.tsx", "EmailActivityCreateModal"],
  ["src/modules/leads/presentation/components/LeadDetailModals.tsx", "SmsActivityCreateModal"],
  ["src/modules/leads/presentation/views/LeadDetailView.tsx", "NoteActivityCreateModal"],
];

for (const [caller, component] of directCallers) {
  assert.ok(read(caller).includes(component), `${caller} must use canonical ${component}.`);
}

for (const adapter of [
  "src/modules/customers/presentation/detail/CustomerQuickActivityModal.tsx",
  "src/modules/organizations/presentation/detail/OrganizationQuickActivityModal.tsx",
]) {
  const source = read(adapter);
  assert.ok(source.includes("RelationshipActivityCreateModal"), `${adapter} must delegate to RelationshipActivityCreateModal.`);
  assert.ok(!source.includes("useState"), `${adapter} must not own duplicate activity form state.`);
  assert.ok(!source.includes("RelationshipQuickActionModal"), `${adapter} must not own duplicate activity form markup.`);
}

for (const adapter of directCallers.filter(([file]) => file.includes("contacts/presentation/detail/actions")).map(([file]) => file)) {
  const source = read(adapter);
  assert.ok(!source.includes("useState"), `${adapter} must remain a thin canonical-form adapter.`);
  assert.ok(!source.includes("RelationshipQuickActionModal"), `${adapter} must not recreate the relationship activity form shell.`);
}

const leadModalSource = read("src/modules/leads/presentation/components/LeadDetailModals.tsx");
assert.ok(!leadModalSource.includes("RelationshipQuickActionModal"), "Lead quick activities must not own duplicate modal form markup.");
assert.ok(!leadModalSource.includes('<form id="lead-quick-'), "Lead quick activities must not recreate local form elements.");

const leadViewSource = read("src/modules/leads/presentation/views/LeadDetailView.tsx");
assert.ok(!leadViewSource.includes("<form onSubmit={handleAddNoteFromComposer}"), "Lead notes must use NoteActivityCreateModal instead of an inline duplicate form.");
const leadProductsTabStart = leadViewSource.indexOf('activeTab === "products"');
const leadCampaignsTabStart = leadViewSource.indexOf('activeTab === "campaigns"');
const leadNoteModalIndex = leadViewSource.indexOf("<NoteActivityCreateModal");
assert.ok(leadProductsTabStart >= 0 && leadCampaignsTabStart > leadProductsTabStart, "Lead detail must retain product and campaign tab boundaries.");
assert.ok(leadNoteModalIndex > leadCampaignsTabStart, "Lead NoteActivityCreateModal must be mounted outside conditional tab content so it can open from Notes and quick actions.");
assert.ok(!leadViewSource.slice(leadProductsTabStart, leadCampaignsTabStart).includes("<NoteActivityCreateModal"), "Lead note modal must not be nested inside the Products tab.");
assert.ok(!leadViewSource.includes("noteFormText"), "Lead detail must not retain obsolete inline-note state after canonical modal migration.");

const contactNotesTab = read("src/modules/contacts/presentation/detail/tabs/ContactNotesTab.tsx");
assert.ok(contactNotesTab.includes("NoteActivityCreateModal"), "Contact Notes tab must use the canonical note create form.");
assert.ok(!contactNotesTab.includes("newTitle"), "Contact Notes tab must not own duplicate create-note title state.");
assert.ok(!contactNotesTab.includes("newBody"), "Contact Notes tab must not own duplicate create-note body state.");
assert.ok(!contactNotesTab.includes("handleAddNote"), "Contact Notes tab must not own a duplicate create-note submit handler.");

const dealTimeline = read("src/modules/deals/presentation/views/DealDetailActivityTimeline.tsx");
assert.ok(dealTimeline.includes("NoteActivityCreateModal"), "Deal timeline must use the canonical note create form.");
assert.ok(!dealTimeline.includes("<form onSubmit={handleAddDirectNote}"), "Deal timeline must not recreate an inline note form.");
assert.ok(!dealTimeline.includes("deals.detail.notePlaceholder"), "Deal timeline must not retain a one-field note composer.");

const publicBoundary = read("src/modules/tasks/public/index.ts");
for (const token of ["CallActivityCreateModal", "RelationshipActivityCreateModal", "NoteActivityCreateModal"]) {
  assert.ok(publicBoundary.includes(token), `Tasks public boundary must export ${token}.`);
}

console.log("Relationship activity form contracts PASS: 5 canonical forms, Lead/Contact/Customer/Organization/Deal standardized, zero duplicate adapter state.");
