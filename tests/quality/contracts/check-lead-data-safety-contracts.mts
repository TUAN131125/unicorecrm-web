import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => fs.readFileSync(path.resolve(relativePath), "utf8");

// Import must parse the selected CSV and commit only through the atomic command.
const importDialog = read("src/modules/leads/presentation/components/LeadImportDialog.tsx");
for (const forbidden of [
  "processUploadedFile",
  "rawPreviewData",
  "setTimeout(",
  "Phạm Văn Minh",
  "Nancy Nguyễn",
  "Trần Thanh Tú",
  "temporarily disabled",
]) {
  assert.equal(importDialog.includes(forbidden), false, `Lead import must not contain prototype behavior: ${forbidden}`);
}
for (const marker of [
  'type="file"',
  "selectedFile.text()",
  "buildLeadCsvImportPlan",
  "importLeadCsvPlanViaApi",
]) {
  assert.ok(importDialog.includes(marker), `Lead importer is missing the production CSV contract: ${marker}`);
}
assert.equal(
  importDialog.includes("importLeadCsvPlanSnapshot"),
  false,
  "The routed Lead importer must not bypass the authoritative API command through the local snapshot boundary.",
);

const leadPublicSource = read("src/modules/leads/public/leads.ts");
for (const marker of [
  "export function importLeadCsvPlanSnapshot",
  "return importLeadCsvPlanAtomically(leadRepository, plan, options)",
]) {
  assert.ok(leadPublicSource.includes(marker), `Lead public import boundary is missing the atomic contract: ${marker}`);
}

const leadListPage = read("src/modules/leads/presentation/pages/LeadListPage.tsx");
assert.equal(leadListPage.includes('id: "import-excel"'), false, "The UI must not claim unsupported Excel import.");
assert.ok(leadListPage.includes('id: "import-csv"'), "CSV import must use an explicit supported action.");
assert.ok(leadListPage.includes("<LeadImportDialog"), "The real CSV importer must be mounted by the Lead list.");
assert.ok(leadListPage.includes("canCreateLeads && canBulkLeads"), "Import UI must require create and bulk capabilities.");
assert.equal(leadListPage.includes('id: "auto-merge"'), false, "Destructive duplicate auto-merge must not be exposed.");
assert.ok(leadListPage.includes("canExportLeads = access.can(CAPABILITIES.LEADS_EXPORT)"));
assert.ok(leadListPage.includes("...(canExportLeads ? ["), "Export actions must be hidden without leads.export.");
assert.ok(leadListPage.includes("canDeleteLeads"), "Archive actions must remain capability-gated in the Lead UI.");

const leadRepositoryCommandsSource = read("src/modules/leads/application/commands/leadRepositoryCommands.ts");
assert.equal(leadRepositoryCommandsSource.includes("mergeDuplicateLeadsByPhone"), false, "Delete-by-dedup must not remain as a callable command.");
for (const marker of [
  'assertRuntimeCommandAccess(CAPABILITIES.LEADS_DELETE, "leads", lead)',
  'assertRuntimeCommandAccess(CAPABILITIES.LEADS_BULK, "leads", lead)',
  "Authorize the complete batch",
  "repository.replace(next)",
]) {
  assert.ok(leadRepositoryCommandsSource.includes(marker), `Missing bulk authorization contract: ${marker}`);
}

const leadExportCommandsSource = read("src/modules/leads/application/commands/leadExportCommands.ts");
for (const marker of [
  "assertRuntimeCapability(CAPABILITIES.LEADS_EXPORT)",
  'assertRuntimeCommandAccess(CAPABILITIES.LEADS_EXPORT, "leads", lead)',
  "exporter.exportCsv(leads, fileName)",
]) {
  assert.ok(leadExportCommandsSource.includes(marker), `Missing export authorization contract: ${marker}`);
}

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, String(value)); }
}

const browserStorage = new MemoryStorage();
Object.defineProperty(globalThis, "window", { value: { localStorage: browserStorage }, configurable: true });
Object.defineProperty(globalThis, "localStorage", { value: browserStorage, configurable: true });

const [identity, accessSeed, leadLifecycle, repositoryModule, repositoryCommands, exportCommands] = await Promise.all([
  import("@/platform/identity-auth"),
  import("@/platform/access-control/runtime/accessControlSeed"),
  import("@/modules/leads/domain/model/leadLifecycle.canonical"),
  import("@/modules/leads/infrastructure/InMemoryLeadRepository"),
  import("@/modules/leads/application/commands/leadRepositoryCommands"),
  import("@/modules/leads/application/commands/leadExportCommands"),
]);

const events = { publish: () => undefined, subscribe: () => () => undefined };
const makeLead = (id: string, ownerId: string) => ({
  id,
  name: `Lead ${id}`,
  title: "Manager",
  companyName: `Company ${id}`,
  email: `${id}@example.com`,
  phone: `090${id.replace(/\D/g, "").padEnd(7, "0").slice(0, 7)}`,
  source: "Website",
  score: 50,
  leadWorkState: leadLifecycle.LeadWorkState.NEW,
  ownerId,
  interestedProducts: [],
  createdAt: "2026-07-14T00:00:00.000Z",
  activities: [],
});

let exportedIds: string[] = [];
const exporter = {
  exportCsv: (leads: readonly { id: string }[]) => {
    exportedIds = leads.map((lead) => lead.id);
  },
};

const repSignIn = identity.signIn({
  email: "sales.rep@unicorecrm.local",
  password: "welcome123",
  deviceLabel: "lead data safety contract",
});
assert.equal(repSignIn.ok, true);
const repRepository = new repositoryModule.InMemoryLeadRepository([makeLead("rep-1", "u3")], events);
assert.throws(
  () => exportCommands.exportLeads(repRepository, exporter, ["rep-1"], "rep.csv"),
  /missing capability leads\.export/,
  "A Sales Representative must not bypass leads.export by calling the command directly.",
);
assert.deepEqual(exportedIds, [], "Denied export must not invoke the exporter.");
identity.signOut("LEAD_EXPORT_REP_DENIED");

const managerSignIn = identity.signIn({
  email: "sales.manager@unicorecrm.local",
  password: "welcome123",
  deviceLabel: "lead data safety contract",
});
assert.equal(managerSignIn.ok, true);

const workspaceId = "ws1";
const snapshot = accessSeed.createDefaultAccessControlSnapshot(workspaceId);
const managerRole = snapshot.roles.find((role) => role.sourceTemplateId === "sales-manager");
assert.ok(managerRole);
managerRole.capabilities = [...new Set([...managerRole.capabilities, "leads.delete"])];
const managerLeadScope = snapshot.dataScopes.find((policy) => policy.roleId === managerRole.roleId && policy.resourceKey === "leads");
assert.ok(managerLeadScope);
managerLeadScope.scope = "OWN";
browserStorage.setItem(`unicore_access_control_v1:${workspaceId}`, JSON.stringify(snapshot));

const ownLead = makeLead("own-2", "u2");
const foreignLead = makeLead("foreign-3", "u3");
const scopedRepository = new repositoryModule.InMemoryLeadRepository([ownLead, foreignLead], events);

assert.throws(
  () => exportCommands.exportLeads(scopedRepository, exporter, [ownLead.id, foreignLead.id], "scope.csv"),
  /outside the active leads data scope/,
  "Export must preflight every requested Lead against data scope.",
);
assert.deepEqual(exportedIds, [], "A mixed-scope export must fail atomically.");

const beforeDelete = scopedRepository.list();
assert.throws(
  () => repositoryCommands.archiveLeads(scopedRepository, [ownLead.id, foreignLead.id], { reason: "Retention policy scope test", actorId: "u2", actorName: "Sales Manager", now: "2026-07-09T00:00:00.000Z" }),
  /outside the active leads data scope/,
  "Bulk archive must reject an out-of-scope record.",
);
assert.deepEqual(scopedRepository.list(), beforeDelete, "Denied bulk archive must not change the repository.");

let transformCalls = 0;
assert.throws(
  () => repositoryCommands.updateManyLeads(scopedRepository, [ownLead.id, foreignLead.id], (lead) => {
    transformCalls += 1;
    return { ...lead, companyName: "Changed" };
  }),
  /outside the active leads data scope/,
  "Bulk update must preflight record authorization.",
);
assert.equal(transformCalls, 0, "No transform may run before the complete batch is authorized.");
assert.deepEqual(scopedRepository.list(), beforeDelete, "Denied bulk update must not change the repository.");

assert.throws(
  () => repositoryCommands.advanceEligibleLeadsToVerifying(scopedRepository, [ownLead.id, foreignLead.id]),
  /outside the active leads data scope/,
  "Bulk lifecycle actions must preflight record authorization.",
);
assert.deepEqual(scopedRepository.list(), beforeDelete, "Denied lifecycle batch must not change the repository.");

managerLeadScope.scope = "TEAM";
snapshot.revision += 1;
browserStorage.setItem(`unicore_access_control_v1:${workspaceId}`, JSON.stringify(snapshot));
exportedIds = [];
assert.equal(exportCommands.exportLeads(scopedRepository, exporter, [ownLead.id, foreignLead.id], "team.csv"), 2);
assert.deepEqual(exportedIds, [ownLead.id, foreignLead.id]);
repositoryCommands.archiveLeads(scopedRepository, [ownLead.id, foreignLead.id], { reason: "Retention policy scope test", actorId: "u2", actorName: "Sales Manager", now: "2026-07-09T00:00:00.000Z" });
assert.equal(scopedRepository.list().length, 2, "An authorized team-scoped archive must retain records after preflight.");
assert.equal(scopedRepository.list().every((lead) => Boolean(lead.archivedAt)), true);

identity.signOut("LEAD_DATA_SAFETY_COMPLETE");
console.log("Lead data safety contracts: PASS");
