import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import path from "node:path";
import {
  assertReassignmentAllowed,
  filterByOwnershipScope,
  resolveCreateOwnerId,
} from "@/platform/record-ownership/domain/recordOwnership.rules";
import type { RecordOwnershipContext } from "@/platform/record-ownership/domain/recordOwnership.types";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

const root = repositoryRoot;

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, String(value)); }
}

function context(canAssign: boolean): RecordOwnershipContext {
  const visibleOwners = [
    { memberId: "u3", displayName: "Lê Hoàng Sales", teamIds: ["sales"], isCurrent: true },
    { memberId: "u2", displayName: "Nguyễn Văn Manager", teamIds: ["sales"], isCurrent: false },
    { memberId: "u5", displayName: "Operations", teamIds: ["operations"], isCurrent: false },
  ];
  return {
    workspaceId: "workspace-b2b",
    accountId: "account-sales",
    memberId: "u3",
    displayName: "Lê Hoàng Sales",
    teamIds: ["sales"],
    dataScope: canAssign ? "TEAM" : "OWN",
    canAssign,
    visibleOwners,
    assignableOwners: canAssign ? visibleOwners : [visibleOwners[0]],
  };
}

const sales = context(false);
const manager = context(true);

assert.equal(resolveCreateOwnerId(undefined, sales), "u3", "Creation must default to the authenticated member.");
assert.equal(resolveCreateOwnerId("u3", sales), "u3");
assert.throws(
  () => resolveCreateOwnerId("u2", sales),
  /assignment scope/,
  "A member without assignment capability cannot create for another owner.",
);
assert.equal(resolveCreateOwnerId("u2", manager), "u2", "An authorized manager may assign within scope.");

assert.doesNotThrow(
  () => assertReassignmentAllowed("unassigned", "u3", "Claimed from the unassigned queue.", sales),
  "A member may claim an unassigned record for themselves.",
);
assert.throws(
  () => assertReassignmentAllowed("u2", "u3", "Move to my queue.", sales),
  /assignment capability/,
  "Self-claim must not be used to take a record from another owner.",
);
assert.throws(
  () => assertReassignmentAllowed("u3", "u2", "", manager),
  /requires a reason/,
  "Every actual owner change requires a reason.",
);
assert.doesNotThrow(() => assertReassignmentAllowed("u3", "u3", "", sales));
assert.doesNotThrow(() => assertReassignmentAllowed("u3", "u2", "Manager balancing the sales queue.", manager));

const records: Array<{ id: string; ownerId: string }> = [
  { id: "lead-own", ownerId: "u3" },
  { id: "lead-team", ownerId: "u2" },
  { id: "lead-other", ownerId: "u5" },
];
const canAccessTeam = (record: { id: string; ownerId: string }) => record.ownerId !== "u5";
assert.deepEqual(filterByOwnershipScope(records, "MINE", manager, canAccessTeam).map((record) => record.id), ["lead-own"]);
assert.deepEqual(filterByOwnershipScope(records, "TEAM", manager, canAccessTeam).map((record) => record.id), ["lead-own", "lead-team"]);
assert.deepEqual(filterByOwnershipScope(records, "ALLOWED", manager, canAccessTeam).map((record) => record.id), ["lead-own", "lead-team"]);

// Authenticated runtime characterization: this section runs with a browser-like
// storage boundary so command authorization, current membership, data scope and
// audit persistence are exercised together rather than only by source scanning.
const runtimeStorage = new MemoryStorage();
Object.defineProperty(globalThis, "window", { value: { localStorage: runtimeStorage }, configurable: true });
Object.defineProperty(globalThis, "localStorage", { value: runtimeStorage, configurable: true });

const [{ signIn, signOut }, { CAPABILITIES }, ownershipRuntime, leadRepositoryModule, leadCommandModule, dealRepositoryModule, dealCommandModule, leadTypes, dealTypes] = await Promise.all([
  import("@/platform/identity-auth"),
  import("@/platform/access-control"),
  import("@/platform/record-ownership/runtime/recordOwnershipRuntime"),
  import("@/modules/leads/infrastructure/InMemoryLeadRepository"),
  import("@/modules/leads/application/commands/leadCommands"),
  import("@/modules/deals/infrastructure/InMemoryDealRepository"),
  import("@/modules/deals/application/commands/dealCommands"),
  import("@/modules/leads/domain/model/leadLifecycle.canonical"),
  import("@/modules/deals/domain/model/deal.types"),
]);
const { saveLead } = await import("@/modules/leads/application/commands/leadRepositoryCommands");

const signedIn = signIn({ email: "sales.rep@unicorecrm.local", password: "welcome123", deviceLabel: "record ownership contract" });
assert.equal(signedIn.ok, true, "The Sales pilot account must authenticate for runtime ownership checks.");
const runtimeContext = ownershipRuntime.getRecordOwnershipContext("leads", CAPABILITIES.LEADS_ASSIGN);
assert.equal(runtimeContext?.memberId, "u3");
assert.equal(runtimeContext?.canAssign, false, "Sales Representative must not gain assignment capability through the UI layer.");

const leadRepository = new leadRepositoryModule.InMemoryLeadRepository([], { publish: () => undefined, subscribe: () => () => undefined });
const createdLead = saveLead(leadRepository, makeRuntimeLead("runtime-created", ""));
assert.equal(createdLead.ownerId, "u3", "Authenticated Lead creation must default to the signed-in member.");
assert.throws(() => saveLead(leadRepository, makeRuntimeLead("runtime-for-other", "u2")), /assignment scope/, "Sales cannot create a Lead for another owner.");

const unassignedLead = makeRuntimeLead("runtime-unassigned", "unassigned");
const foreignLead = makeRuntimeLead("runtime-foreign", "u2");
leadRepository.replace([unassignedLead, foreignLead, createdLead]);
const claimed = leadCommandModule.reassignLead(leadRepository, unassignedLead.id, {
  ownerId: "u3",
  reason: "Claimed from the unassigned queue.",
  leadWorkState: leadTypes.LeadWorkState.CONTACTING,
});
assert.equal(claimed?.ownerId, "u3");
assert.throws(() => leadCommandModule.reassignLead(leadRepository, foreignLead.id, { ownerId: "u3", reason: "Attempted takeover." }), /Access denied/, "Self-claim must not take a Lead from another owner.");

const dealRepository = new dealRepositoryModule.InMemoryDealRepository([], { publish: () => undefined, subscribe: () => () => undefined });
const createdDeal = dealCommandModule.createCanonicalDeal(dealRepository, makeRuntimeDeal("runtime-deal", ""));
assert.equal(createdDeal.ownerId, "u3", "Authenticated Deal creation must default to the signed-in member.");
assert.throws(() => dealCommandModule.createCanonicalDeal(dealRepository, makeRuntimeDeal("runtime-deal-other", "u2")), /assignment scope/, "Sales cannot create a Deal for another owner.");

const audit = ownershipRuntime.getRecordOwnershipAuditSnapshot();
assert.ok(audit.some((entry) => entry.resourceKey === "leads" && entry.recordId === createdLead.id && entry.action === "CREATED" && entry.nextOwnerId === "u3"));
assert.ok(audit.some((entry) => entry.resourceKey === "leads" && entry.recordId === unassignedLead.id && entry.action === "REASSIGNED" && entry.reason === "Claimed from the unassigned queue."));
assert.ok(audit.some((entry) => entry.resourceKey === "deals" && entry.recordId === createdDeal.id && entry.action === "CREATED" && entry.nextOwnerId === "u3"));
signOut("RECORD_OWNERSHIP_SALES_COMPLETE");

const managerSignIn = signIn({ email: "sales.manager@unicorecrm.local", password: "welcome123", deviceLabel: "record ownership manager contract" });
assert.equal(managerSignIn.ok, true);
const managerContext = ownershipRuntime.getRecordOwnershipContext("deals", CAPABILITIES.DEALS_ASSIGN);
assert.equal(managerContext?.memberId, "u2");
assert.equal(managerContext?.canAssign, true, "Sales Manager must be able to assign within the team scope.");
const managerDealRepository = new dealRepositoryModule.InMemoryDealRepository([], { publish: () => undefined, subscribe: () => () => undefined });
const teamAssignedDeal = dealCommandModule.createCanonicalDeal(managerDealRepository, makeRuntimeDeal("runtime-manager-assigned", "u3"));
assert.equal(teamAssignedDeal.ownerId, "u3");
const reassignedToManager = dealCommandModule.reassignDeal(managerDealRepository, teamAssignedDeal.id, {
  ownerId: "u2",
  reason: "Manager balancing the team pipeline.",
});
assert.equal(reassignedToManager?.ownerId, "u2");
signOut("RECORD_OWNERSHIP_MANAGER_COMPLETE");

const adminSignIn = signIn({ email: "admin@unicorecrm.local", password: "admin123", deviceLabel: "record ownership admin contract" });
assert.equal(adminSignIn.ok, true, "Administrative demo sign-in must create an AAL1 session.");
const adminContext = ownershipRuntime.getRecordOwnershipContext("leads", CAPABILITIES.LEADS_ASSIGN);
assert.equal(adminContext?.memberId, "u1");
assert.equal(adminContext?.canAssign, true);
const adminLeadRepository = new leadRepositoryModule.InMemoryLeadRepository([], { publish: () => undefined, subscribe: () => () => undefined });
const adminCreatedLead = saveLead(adminLeadRepository, makeRuntimeLead("runtime-admin-created", ""));
assert.equal(adminCreatedLead.ownerId, "u1", "Workspace Owner creation must still default to the authenticated owner when no override is requested.");
const adminAssignedLead = saveLead(adminLeadRepository, makeRuntimeLead("runtime-admin-assigned", "u5"));
assert.equal(adminAssignedLead.ownerId, "u5", "Workspace Owner may assign an allowed member explicitly.");
signOut("RECORD_OWNERSHIP_CONTRACT_COMPLETE");

const finalAudit = ownershipRuntime.getRecordOwnershipAuditSnapshot("ws1");
assert.ok(finalAudit.some((entry) => entry.recordId === teamAssignedDeal.id && entry.action === "REASSIGNED" && entry.actorMemberId === "u2"));
assert.ok(finalAudit.some((entry) => entry.recordId === adminAssignedLead.id && entry.nextOwnerId === "u5" && entry.actorMemberId === "u1"));

const sources = {
  leadRepository: read("src/modules/leads/application/commands/leadRepositoryCommands.ts"),
  leadCommands: read("src/modules/leads/application/commands/leadCommands.ts"),
  dealRepository: read("src/modules/deals/application/commands/dealRepositoryCommands.ts"),
  dealCommands: read("src/modules/deals/application/commands/dealCommands.ts"),
  leadPublic: read("src/modules/leads/public/leads.ts"),
  dealPublic: read("src/modules/deals/public/deals.ts"),
  contactOpportunityPorts: read("src/workflows/contact-opportunity-creation/application/ports/ContactOpportunityCreationPorts.ts"),
  contactOpportunityExecution: read("src/workflows/contact-opportunity-creation/application/executeContactOpportunityCreation.ts"),
  contactOpportunityRuntime: read("src/workflows/contact-opportunity-creation/runtime/createContactOpportunityCreationRuntime.ts"),
  contactList: read("src/modules/contacts/presentation/pages/ContactListPage.tsx"),
  contactDetail: read("src/modules/contacts/presentation/pages/ContactDetailPage.tsx"),
  leadQualificationRuntime: read("src/workflows/lead-qualification/runtime/createLeadQualificationRuntime.ts"),
  leadList: read("src/modules/leads/presentation/pages/LeadListPage.tsx"),
  dealController: read("src/modules/deals/presentation/hooks/useDealPipelineController.ts"),
  ownershipRuntime: read("src/platform/record-ownership/runtime/recordOwnershipRuntime.ts"),
  ownershipTypes: read("src/platform/record-ownership/domain/recordOwnership.types.ts"),
};

for (const [name, source] of Object.entries({ leadRepository: sources.leadRepository, dealRepository: sources.dealRepository })) {
  assert.match(source, /enforceCreateOwner\(/, `${name} must enforce owner at the command boundary.`);
  assert.match(source, /ownership changes must use reassign/i, `${name} must reject generic owner mutation.`);
  assert.match(source, /appendRecordOwnershipAudit\(/, `${name} must record creation ownership evidence.`);
}
for (const [name, source] of Object.entries({ leadCommands: sources.leadCommands, dealCommands: sources.dealCommands })) {
  assert.match(source, /assertOwnerReassignment\(/, `${name} must authorize reassignment centrally.`);
  assert.match(source, /action: "REASSIGNED"/, `${name} must append reassignment audit evidence.`);
  assert.match(source, /reason: input\.reason\.trim\(\)/, `${name} must persist the handover reason.`);
}
assert.match(sources.leadPublic, /replaceLeads[\s\S]*updateLeadCollection/, "The public Lead replacement path must not bypass application authorization.");
assert.match(sources.dealPublic, /replaceDeals[\s\S]*updateDealCollection/, "The public Deal replacement path must not bypass application authorization.");
assert.match(sources.contactOpportunityPorts, /create\(deal: Deal\): Deal/, "Contact-to-Deal workflow ports must return the canonical saved Deal.");
assert.match(sources.contactOpportunityExecution, /const createdDeal = ports\.deals\.create\(command\.deal\)/, "Contact-to-Deal workflow execution must use the normalized saved Deal.");
assert.match(sources.contactOpportunityRuntime, /createDealSnapshot\(deal\)/, "Contact-to-Deal creation must use the canonical Deal command.");
assert.match(sources.contactList, /const createdDeal = \(await createDealCommand\(newDeal\)\)\.data/, "Contact list Deal creation must retain the canonical command result.");
assert.match(sources.contactList, /notifyProduct[\s\S]*createdDeal\.ownerId[\s\S]*Open record|notifyProduct[\s\S]*createdDeal\.ownerId[\s\S]*Mở chi tiết/, "Contact list creation feedback must name the canonical owner and provide an open-record action.");
assert.match(sources.contactDetail, /const opportunityResult = executeContactOpportunityCreation/, "Contact detail creation must retain the canonical workflow result.");
assert.match(sources.contactDetail, /notifyProduct[\s\S]*opportunityResult\.deal\.ownerId[\s\S]*Open record|notifyProduct[\s\S]*opportunityResult\.deal\.ownerId[\s\S]*Mở chi tiết/, "Contact detail creation feedback must name the canonical owner and provide an open-record action.");
assert.match(sources.leadQualificationRuntime, /createDealSnapshot\(deal\)/, "Lead qualification must use the canonical Deal command.");
assert.match(sources.ownershipRuntime, /isSelfClaimReassignment/, "The runtime must distinguish safe self-claim from reassignment to another member.");
assert.match(sources.ownershipTypes, /unicore_record_ownership_audit|RecordOwnershipAuditEntry|OwnershipAuditAction/, "Ownership audit contracts must remain explicit.");
assert.match(sources.leadList, /data-guidance-id|guidancePrefix="leads\.list"/, "Lead ownership scope must remain guidance-addressable.");
assert.match(sources.dealController, /actionLabel:[\s\S]*Open record/, "Deal create feedback must provide an immediate open-record action.");
assert.match(sources.dealController, /ownerId: ownership\?\.memberId \|\| deal\.ownerId/, "Duplicated Deals must default to the authenticated member.");

const forbiddenDirectCreates = [
  "src/workflows/contact-opportunity-creation/runtime/createContactOpportunityCreationRuntime.ts",
  "src/modules/contacts/presentation/pages/ContactListPage.tsx",
  "src/workflows/lead-qualification/runtime/createLeadQualificationRuntime.ts",
];
for (const file of forbiddenDirectCreates) {
  const source = read(file);
  assert.equal(/updateDeals\(\(current\) => \[deal, \.\.\.current\]\)|setDeals\(\[newDeal, \.\.\.deals\]\)/.test(source), false, `${file} must not create Deals through a generic collection replacement.`);
}

console.log("Record ownership contracts: PASS (creation default, reassignment authorization, self-claim, scope filters, authenticated runtime, audit and UI feedback verified)");

function makeRuntimeLead(id: string, ownerId: string) {
  return {
    id,
    name: `Lead ${id}`,
    title: "Manager",
    companyName: "Pilot Company",
    email: `${id}@example.com`,
    phone: `090${id.length.toString().padStart(7, "0")}`,
    source: "Manual",
    score: 0,
    leadWorkState: leadTypes.LeadWorkState.NEW,
    ownerId,
    interestedProducts: [],
    createdAt: new Date().toISOString(),
    activities: [],
  };
}

function makeRuntimeDeal(id: string, ownerId: string) {
  const now = new Date().toISOString();
  return {
    id,
    name: `Deal ${id}`,
    buyerRef: { type: "CONTACT" as const, id: "contact-pilot" },
    stage: dealTypes.DealStage.DISCOVERY,
    amount: 10_000_000,
    opportunityScore: 40,
    ownerId,
    expectedCloseDate: "2026-08-31",
    nextActionAt: now,
    nextActionSummary: "Confirm next step",
    nextActionRef: { type: "MANUAL" as const },
    createdAt: now,
    updatedAt: now,
    interestedProducts: [],
    lineItems: [],
    activities: [],
  };
}

function read(relativePath: string): string {
  return readPresentationComposition(path.join(root, relativePath), "utf8");
}
