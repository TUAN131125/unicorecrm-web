import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { Lead } from "@/modules/leads/domain/model/lead.types";
import { LeadWorkState } from "@/modules/leads/domain/model/leadLifecycle.canonical";
import { buildLeadCsvImportPlan } from "@/modules/leads/application/import/leadCsvImport";
import { importLeadCsvPlanAtomically } from "@/modules/leads/application/commands/leadImportCommands";
import type { LeadRepository } from "@/modules/leads/application/ports/LeadRepository";
import {
  dateTimeLocalValueToIso,
  isSameCalendarDateInTimeZone,
  toDateKeyInTimeZone,
} from "@/shared/lib/datetime/workspaceDateTime";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

const read = (relativePath: string) => readPresentationComposition(path.resolve(relativePath), "utf8");

const sharedInput = read("src/shared/components/ui/Input.tsx");
for (const marker of [
  "React.useId()",
  "htmlFor={controlId}",
  "aria-invalid={Boolean(error)",
  "aria-describedby={describedBy}",
  'role="alert"',
]) {
  assert.ok(sharedInput.includes(marker), `Shared field accessibility contract missing: ${marker}`);
}

for (const relativePath of [
  "src/shared/components/ui/SearchableSelect.tsx",
  "src/shared/components/ui/TemporalInput.tsx",
]) {
  const source = read(relativePath);
  for (const marker of ["controlId", "aria-describedby", "aria-invalid", 'role="alert"']) {
    assert.ok(source.includes(marker), `${relativePath} is missing ${marker}.`);
  }
}

const leadForm = read("src/components/LeadForm.tsx");
for (const marker of [
  "submitInFlightRef.current",
  "onDirtyChange?.(isDirty)",
  'window.addEventListener("beforeunload"',
  "focusFirstInvalidField",
  "dateTimeLocalValueToIso",
  "min={0}",
  "if (syncZalo) setZalo(phone)",
]) {
  assert.ok(leadForm.includes(marker), `Lead form recovery contract missing: ${marker}`);
}

const leadListPage = read("src/modules/leads/presentation/pages/LeadListPage.tsx");
const detailModals = read("src/modules/leads/presentation/components/LeadDetailModals.tsx");
for (const source of [leadListPage, detailModals]) {
  assert.ok(source.includes("useUnsavedChangesGuard"), "Lead create/edit modal must guard dirty dismissal.");
  assert.ok(source.includes("Discard unsaved changes?"), "Dirty dismissal must use an accessible confirmation dialog.");
}

assert.equal(toDateKeyInTimeZone("2026-07-14T17:30:00.000Z", "Asia/Ho_Chi_Minh"), "2026-07-15");
assert.equal(toDateKeyInTimeZone("2026-07-14T17:30:00.000Z", "Pacific/Honolulu"), "2026-07-14");
assert.equal(toDateKeyInTimeZone("2026-07-14T10:30:00.000Z", "Pacific/Kiritimati"), "2026-07-15");
assert.equal(dateTimeLocalValueToIso("2026-07-15T00:30", "Asia/Ho_Chi_Minh"), "2026-07-14T17:30:00.000Z");
assert.equal(isSameCalendarDateInTimeZone("2026-07-14T17:30:00.000Z", "2026-07-15T08:00:00.000Z", "Asia/Ho_Chi_Minh"), true);

const parsed = buildLeadCsvImportPlan([
  "Name,Phone,Email,Company,Preferred Channel",
  '"Nguyen, An",0901234567,an@example.com,"ACME, Vietnam",phone',
  "Tran Binh,,binh@example.com,Beta,email",
].join("\r\n"));
assert.equal(parsed.invalidRowCount, 0);
assert.equal(parsed.candidates.length, 2);
assert.equal(parsed.candidates[0]?.name, "Nguyen, An");
assert.equal(parsed.candidates[0]?.companyName, "ACME, Vietnam");
assert.match(parsed.checksum, /^fnv1a-[0-9a-f]{8}$/);

const invalidPlan = buildLeadCsvImportPlan([
  "Name,Phone,Email",
  "No Contact,,",
  "Valid,0901234567,",
].join("\n"));
assert.equal(invalidPlan.invalidRowCount, 1);

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, String(value)); }
}

class CountingLeadRepository implements LeadRepository {
  replaceCalls = 0;
  constructor(private leads: Lead[]) {}
  list(): Lead[] { return structuredClone(this.leads); }
  getById(leadId: string): Lead | undefined {
    const lead = this.leads.find((item) => item.id === leadId);
    return lead ? structuredClone(lead) : undefined;
  }
  replace(next: Lead[]): void {
    this.replaceCalls += 1;
    this.leads = structuredClone(next);
  }
  subscribe(): () => void { return () => undefined; }
}

const browserStorage = new MemoryStorage();
Object.defineProperty(globalThis, "window", { value: { localStorage: browserStorage }, configurable: true });
Object.defineProperty(globalThis, "localStorage", { value: browserStorage, configurable: true });

const [identity, accessSeed] = await Promise.all([
  import("@/platform/identity-auth"),
  import("@/platform/access-control/runtime/accessControlSeed"),
]);
const signIn = identity.signIn({
  email: "sales.manager@unicorecrm.local",
  password: "welcome123",
  deviceLabel: "Lead form recovery contracts",
});
assert.equal(signIn.ok, true);

const snapshot = accessSeed.createDefaultAccessControlSnapshot("ws1");
const managerRole = snapshot.roles.find((role) => role.sourceTemplateId === "sales-manager");
assert.ok(managerRole);
managerRole.capabilities = [...new Set([
  ...managerRole.capabilities,
  "leads.create",
  "leads.bulk",
  "leads.assign",
])];
const leadScope = snapshot.dataScopes.find((policy) => policy.roleId === managerRole.roleId && policy.resourceKey === "leads");
assert.ok(leadScope);
leadScope.scope = "TEAM";
browserStorage.setItem("unicore_access_control_v1:ws1", JSON.stringify(snapshot));

const existing: Lead = {
  id: "existing",
  name: "Existing Lead",
  title: "",
  companyName: "Existing Co",
  email: "existing@example.com",
  phone: "0909999999",
  source: "Website",
  score: 0,
  leadWorkState: LeadWorkState.NEW,
  ownerId: "u2",
  interestedProducts: [],
  createdAt: "2026-07-14T00:00:00.000Z",
  activities: [],
};
const repository = new CountingLeadRepository([existing]);
const beforeInvalid = repository.list();
assert.throws(
  () => importLeadCsvPlanAtomically(repository, invalidPlan, { defaultOwnerId: "u2", actorName: "Sales Manager" }),
  /invalid rows/i,
);
assert.equal(repository.replaceCalls, 0);
assert.deepEqual(repository.list(), beforeInvalid);

const duplicatePlan = buildLeadCsvImportPlan("Name,Email\nDuplicate,existing@example.com");
assert.throws(
  () => importLeadCsvPlanAtomically(repository, duplicatePlan, { defaultOwnerId: "u2", actorName: "Sales Manager" }),
  /matches an existing Lead contact/,
);
assert.equal(repository.replaceCalls, 0, "A rejected CSV import must not partially replace the repository.");
assert.deepEqual(repository.list(), beforeInvalid);

const rejectedPreferredChannelPlan = buildLeadCsvImportPlan("Name,Phone,Preferred Channel\nMismatch,0901111111,email");
assert.equal(rejectedPreferredChannelPlan.invalidRowCount, 1, "CSV preview must expose an unavailable preferred channel before commit.");
const badPreferredChannelPlan = buildLeadCsvImportPlan("Name,Phone\nMismatch,0901111111");
badPreferredChannelPlan.candidates[0]!.preferredChannel = "email";
badPreferredChannelPlan.rows[0]!.candidate!.preferredChannel = "email";
assert.throws(
  () => importLeadCsvPlanAtomically(repository, badPreferredChannelPlan, { defaultOwnerId: "u2", actorName: "Sales Manager" }),
  (caught: unknown) => {
    const error = caught as { code?: string; fieldErrors?: Record<string, string> };
    return error.code === "LEAD_CONTACT_DATA_INVALID"
      && Boolean(error.fieldErrors?.preferredChannel?.includes("available Lead contact channel"));
  },
);
assert.equal(repository.replaceCalls, 0);

const created = importLeadCsvPlanAtomically(repository, parsed, {
  defaultOwnerId: "u2",
  actorName: "Sales Manager",
  now: "2026-07-15T00:00:00.000Z",
  idFactory: (_candidate, index) => `imported-${index + 1}`,
});
assert.equal(created.length, 2);
assert.equal(repository.replaceCalls, 1, "A valid batch must commit exactly once.");
assert.deepEqual(repository.list().slice(0, 2).map((lead) => lead.id), ["imported-1", "imported-2"]);
assert.equal(repository.list().length, 3);

identity.signOut("LEAD_FORM_RECOVERY_COMPLETE");
console.log("Lead form recovery and import contracts: PASS");
