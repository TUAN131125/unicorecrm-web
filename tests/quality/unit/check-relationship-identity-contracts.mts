import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import path from "node:path";
import {
  findBestContactIdentityMatch,
  findBestOrganizationIdentityMatch,
} from "../../../src/platform/identity/relationshipMatching";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

const root = repositoryRoot;
const read = (file: string) => readPresentationComposition(path.join(root, file), "utf8");

const contacts = [
  { id: "c1", fullName: "Nguyễn Minh Tuấn", workEmail: "tuan@example.com", mobilePhone: "+84 912 345 678" },
  { id: "c2", fullName: "Nguyễn Minh Tuấn", workEmail: "other@example.com", mobilePhone: "0900000000" },
];
assert.equal(findBestContactIdentityMatch(contacts, { name: "Nguyen Minh Tuan", email: "TUAN@example.com" })?.record.id, "c1");
assert.equal(findBestContactIdentityMatch(contacts, { phone: "0912 345 678" })?.record.id, "c1");
assert.equal(findBestContactIdentityMatch(contacts, { name: "Nguyễn Minh Tuấn" }), undefined, "Ambiguous name-only matches must not merge identities");

const organizations = [
  { id: "o1", displayName: "Công ty TNHH TechHub", taxCode: "0312-345-678", domain: "https://www.techhub.vn" },
  { id: "o2", displayName: "TechHub Services", taxCode: "999999999", domain: "services.techhub.vn" },
];
assert.equal(findBestOrganizationIdentityMatch(organizations, { displayName: "TechHub", taxCode: "0312345678" })?.record.id, "o1");
assert.equal(findBestOrganizationIdentityMatch(organizations, { domain: "www.techhub.vn/path" })?.record.id, "o1");

const leadRuntime = read("src/workflows/lead-qualification/runtime/createLeadQualificationRuntime.ts");
for (const marker of ["findBestContactIdentityMatch", "findBestOrganizationIdentityMatch", "resolveOrCreateLeadContact", "getWorkspaceContextSnapshot().workspaceId"]) {
  assert.ok(leadRuntime.includes(marker), `Lead relationship resolution must contain ${marker}`);
}
assert.ok(!leadRuntime.includes('workspaceId: "ws_demo"'), "Lead relationship resolution must not hardcode a workspace id");

const graph = read("src/modules/customers/presentation/model/customerRelationshipGraph.ts");
for (const marker of ["getLeadsSnapshot", "relationshipRefKey", "supportCase.relationshipRef", "sourceLeadId", "linkedRecordIds"]) {
  assert.ok(graph.includes(marker), `Customer relationship graph must contain ${marker}`);
}

const customerReadModel = [
  read("src/modules/customers/presentation/model/customer360ReadModel.ts"),
  read("src/modules/customers/presentation/model/customer360ReadModel.types.ts"),
].join("\n");
assert.ok(customerReadModel.includes("leads: Lead[]"), "Customer 360 must expose linked Lead history");
assert.ok(customerReadModel.includes('kind: "LEAD"'), "Customer timeline must include Lead journey entries");

const supportType = read("src/modules/support/domain/model/supportCase.types.ts");
assert.ok(supportType.includes("relationshipRef?: RelationshipRef"), "Support must retain canonical relationship identity");

const report = read("src/components/crm/RelationshipIntelligenceHero.tsx");
assert.ok(report.includes("detailSections?: RelationshipIntelligenceSection[]"), "Relationship report must accept dynamic sections");
assert.ok(report.includes("availableSections.length > 0"), "Relationship report must render only available sections");
assert.ok(!report.includes("signals: RelationshipIntelligenceSignal[]"), "Relationship report must not require a fixed signals block");
assert.ok(!report.includes("actions: RelationshipIntelligenceAction[]"), "Relationship report must not require a fixed actions block");

const contactDetail = read("src/modules/contacts/presentation/pages/ContactDetailPage.tsx");
for (const marker of ["relationshipRefKey", "canonicalQuotes", "taskActivity.tasks", "createTaskCommand", "completeTaskCommand", "rescheduleTaskCommand"]) {
  assert.ok(contactDetail.includes(marker), `Contact detail canonical integration must contain ${marker}`);
}
for (const forbidden of ["payments.obligations", "displayInvoices", "Proposal_CloudSuite_Enterprise.pdf", "INV-2026-004", "QT-2026NL-114", "tk-1", "act-init-task"]) {
  assert.ok(!contactDetail.includes(forbidden), `Contact detail must not seed hardcoded relationship data: ${forbidden}`);
}
const contactRoute = read("src/modules/contacts/detail-route.tsx");
for (const marker of ["getTaskActivitySnapshot", "subscribeToTaskActivity"]) {
  assert.ok(contactRoute.includes(marker), `Contact route must subscribe to canonical module data: ${marker}`);
}
for (const forbidden of ["getPaymentsSnapshot", "subscribeToPayments"]) {
  assert.ok(!contactRoute.includes(forbidden), `Contact route must not subscribe to legacy payment schedules as invoices: ${forbidden}`);
}

console.log("Relationship identity and reporting contracts: PASS");
