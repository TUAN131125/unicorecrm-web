import { collectSourceFiles } from "../../../scripts/quality/core/source-reader.mjs";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { Lead } from "@/modules/leads/domain/model/lead.types";
import { LeadWorkState, QualificationOutcome } from "@/modules/leads/domain/model/leadLifecycle.canonical";
import { INITIAL_LEAD_FILTERS, DEFAULT_LEAD_SORT } from "@/modules/leads/presentation/hooks/useLeadFilters";
import { DEFAULT_VISIBLE_COLUMNS } from "@/modules/leads/presentation/hooks/useLeadTable";
import {
  createLeadCustomSavedView,
  LEAD_SYSTEM_SAVED_VIEWS,
  normalizeLeadCustomSavedViews,
  updateLeadCustomSavedView,
  type LeadListPresentationSnapshot,
} from "@/modules/leads/presentation/model/leadSavedViewPreferences";

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

const [identity, accessSeed, repositoryModule, leadCommands, repositoryCommands, policyRuntime] = await Promise.all([
  import("@/platform/identity-auth"),
  import("@/platform/access-control/runtime/accessControlSeed"),
  import("@/modules/leads/infrastructure/InMemoryLeadRepository"),
  import("@/modules/leads/application/commands/leadCommands"),
  import("@/modules/leads/application/commands/leadRepositoryCommands"),
  import("@/modules/leads/application/policies/leadProgressiveProfilePolicyRuntime"),
]);

const signIn = identity.signIn({
  email: "sales.manager@unicorecrm.local",
  password: "welcome123",
  deviceLabel: "Lead business-rule contracts",
});
assert.equal(signIn.ok, true);

const workspaceId = "ws1";
const accessSnapshot = accessSeed.createDefaultAccessControlSnapshot(workspaceId);
const managerRole = accessSnapshot.roles.find((role) => role.sourceTemplateId === "sales-manager");
assert.ok(managerRole, "Sales Manager role must exist in the access-control seed.");
managerRole.capabilities = [...new Set([
  ...managerRole.capabilities,
  "leads.update",
  "leads.qualify",
  "leads.bulk",
  "leads.assign",
])];
const managerScope = accessSnapshot.dataScopes.find(
  (policy) => policy.roleId === managerRole.roleId && policy.resourceKey === "leads",
);
assert.ok(managerScope, "Sales Manager Lead scope must exist.");
managerScope.scope = "TEAM";
browserStorage.setItem(`unicore_access_control_v1:${workspaceId}`, JSON.stringify(accessSnapshot));

const makeLead = (overrides: Partial<Lead> & Pick<Lead, "id">): Lead => ({
  name: `Lead ${overrides.id}`,
  title: "Manager",
  companyName: "Acme",
  email: `${overrides.id}@example.com`,
  phone: "0901234567",
  source: "Website",
  score: 60,
  leadWorkState: LeadWorkState.NEW,
  ownerId: "u2",
  interestedProducts: [],
  createdAt: "2026-07-14T00:00:00.000Z",
  activities: [],
  ...overrides,
  id: overrides.id,
});

const newLead = makeLead({ id: "lead-new" });
const incompleteContacting = makeLead({
  id: "lead-incomplete",
  leadWorkState: LeadWorkState.CONTACTING,
  companyName: "",
  painPoint: "",
  nextFollowUpAt: undefined,
});
const completeContacting = makeLead({
  id: "lead-complete",
  leadWorkState: LeadWorkState.CONTACTING,
  painPoint: "Reduce manual qualification work",
  nextFollowUpAt: "2026-07-20T02:00:00.000Z",
});
const readinessContacting = makeLead({
  id: "lead-readiness",
  leadWorkState: LeadWorkState.CONTACTING,
  companyName: "",
  painPoint: "",
  nextFollowUpAt: undefined,
});
const notYetVerifying = makeLead({
  id: "lead-not-yet-verifying",
  leadWorkState: LeadWorkState.CONTACTING,
});
const disqualifiedLead = makeLead({
  id: "lead-disqualified",
  leadWorkState: LeadWorkState.CLOSED,
  qualificationOutcome: QualificationOutcome.DISQUALIFIED,
  disqualificationReason: "No fit",
  disqualificationNote: "Confirmed by qualification review",
  disqualifiedAt: "2026-07-14T01:00:00.000Z",
  disqualifiedBy: "u2",
});
const optedOutLead = makeLead({
  id: "lead-opted-out",
  leadWorkState: LeadWorkState.CONTACTING,
  doNotCall: true,
  doNotEmail: true,
});

const events = { publish: () => undefined, subscribe: () => () => undefined };
const repository = new repositoryModule.InMemoryLeadRepository(
  [newLead, incompleteContacting, completeContacting, readinessContacting, notYetVerifying, disqualifiedLead, optedOutLead],
  events,
);

const snapshotBeforeInvalidJump = repository.list();
assert.throws(
  () => leadCommands.changeLeadWorkState(repository, newLead.id, LeadWorkState.VERIFYING),
  /Invalid Lead lifecycle transition: NEW -> VERIFYING/,
  "A NEW Lead must not jump directly to VERIFYING.",
);
assert.deepEqual(repository.list(), snapshotBeforeInvalidJump, "A rejected lifecycle transition must not modify the repository.");

const verifiedWithoutOptionalEnrichment = leadCommands.changeLeadWorkState(
  repository,
  incompleteContacting.id,
  LeadWorkState.VERIFYING,
);
assert.equal(verifiedWithoutOptionalEnrichment?.leadWorkState, LeadWorkState.VERIFYING);
assert.equal(verifiedWithoutOptionalEnrichment?.companyName, "");
assert.equal(verifiedWithoutOptionalEnrichment?.painPoint, "");

const verified = leadCommands.changeLeadWorkState(repository, completeContacting.id, LeadWorkState.VERIFYING);
assert.equal(verified?.leadWorkState, LeadWorkState.VERIFYING);

policyRuntime.configureLeadProgressiveProfilePolicy({
  requiredFieldsByState: {
    [LeadWorkState.VERIFYING]: ["nextFollowUpAt"],
  },
});
assert.throws(
  () => leadCommands.changeLeadWorkState(repository, readinessContacting.id, LeadWorkState.VERIFYING),
  /Lead profile is incomplete for VERIFYING: nextFollowUpAt/,
  "Configured transition requirements must still be enforced at the command boundary.",
);
const verifiedThroughConfiguredRequirements = leadCommands.startLeadVerification(repository, readinessContacting.id, {
  nextFollowUpAt: "2026-07-21T02:00:00.000Z",
});
assert.equal(verifiedThroughConfiguredRequirements?.leadWorkState, LeadWorkState.VERIFYING);
assert.equal(verifiedThroughConfiguredRequirements?.nextFollowUpAt, "2026-07-21T02:00:00.000Z");
policyRuntime.resetLeadProgressiveProfilePolicy();

assert.throws(
  () => leadCommands.closeLeadWithOutcome(repository, notYetVerifying.id, {
    outcome: QualificationOutcome.NURTURE,
    relationshipRef: { type: "CONTACT", id: "contact-incomplete" },
  }),
  /must be VERIFYING/,
  "Positive qualification outcomes must not close a Lead before VERIFYING.",
);

assert.throws(
  () => repositoryCommands.updateLead(repository, newLead.id, (lead) => ({
    ...lead,
    leadWorkState: LeadWorkState.CONTACTING,
  })),
  /lifecycle changes must use the dedicated transition/i,
  "Generic updates must not bypass lifecycle commands.",
);
assert.equal(repository.list().find((lead) => lead.id === newLead.id)?.leadWorkState, LeadWorkState.NEW);

assert.throws(
  () => leadCommands.changeLeadWorkState(repository, disqualifiedLead.id, LeadWorkState.CONTACTING),
  /Invalid Lead lifecycle transition: CLOSED -> CONTACTING/,
  "A CLOSED Lead must not reopen through the generic transition command.",
);
const reopened = leadCommands.reopenLead(repository, disqualifiedLead.id);
assert.equal(reopened?.leadWorkState, LeadWorkState.CONTACTING);
assert.equal(reopened?.qualificationOutcome, undefined);
assert.equal(reopened?.disqualificationReason, undefined);
assert.equal(reopened?.recontactStatus, "reopened");

const communicationActivity = (type: "call" | "email" | "sms") => ({
  id: `activity-${type}`,
  title: type,
  description: type,
  createdAt: "2026-07-14T02:00:00.000Z",
  author: "Sales Manager",
  type,
});
const activityCountBefore = repository.list().find((lead) => lead.id === optedOutLead.id)?.activities.length;
assert.throws(
  () => leadCommands.appendActivityToLead(repository, optedOutLead.id, communicationActivity("call")),
  /opted out of phone and SMS/,
);
assert.throws(
  () => leadCommands.appendActivityToLead(repository, optedOutLead.id, communicationActivity("sms")),
  /opted out of phone and SMS/,
);
assert.throws(
  () => leadCommands.appendActivityToLead(repository, optedOutLead.id, communicationActivity("email")),
  /opted out of email/,
);
assert.equal(
  repository.list().find((lead) => lead.id === optedOutLead.id)?.activities.length,
  activityCountBefore,
  "Denied communication attempts must not append activities.",
);
const noted = leadCommands.appendActivityToLead(repository, optedOutLead.id, {
  id: "activity-note",
  title: "Internal note",
  createdAt: "2026-07-14T02:05:00.000Z",
  type: "note",
});
assert.equal(noted?.activities[0]?.type, "note", "Consent restrictions must not block internal notes.");

const savedSnapshot: LeadListPresentationSnapshot = {
  version: 1,
  searchTerm: "enterprise",
  filters: {
    ...INITIAL_LEAD_FILTERS,
    ownerId: "u2",
    qualificationOutcome: QualificationOutcome.NURTURE,
    overdue: false,
  },
  sort: { field: "score", direction: "desc" },
  orderedColumnIds: ["name", "companyName", "ownerId", "nextFollowUpAt"],
  layout: "kanban",
  ownershipScope: "TEAM",
};
const createdResult = createLeadCustomSavedView(LEAD_SYSTEM_SAVED_VIEWS, "Enterprise nurture", savedSnapshot, 42);
assert.equal(createdResult.ok, true);
if (!createdResult.ok) throw new Error("Expected saved-view creation to succeed.");
assert.deepEqual(createdResult.view.presentation, savedSnapshot, "Saved views must preserve the complete presentation snapshot.");
assert.notEqual(createdResult.view.presentation, savedSnapshot, "Saved views must clone caller-owned state.");

const revisedSnapshot: LeadListPresentationSnapshot = {
  ...savedSnapshot,
  searchTerm: "renewal",
  filters: { ...savedSnapshot.filters, qualificationOutcome: QualificationOutcome.DISQUALIFIED },
  sort: DEFAULT_LEAD_SORT,
  orderedColumnIds: [...DEFAULT_VISIBLE_COLUMNS],
  layout: "table",
  ownershipScope: "MINE",
};
const updatedResult = updateLeadCustomSavedView(createdResult.views, createdResult.view.key, "Disqualified renewal", revisedSnapshot);
assert.equal(updatedResult.ok, true);
if (!updatedResult.ok) throw new Error("Expected saved-view update to succeed.");
assert.equal(updatedResult.view.labelKey, "Disqualified renewal");
assert.deepEqual(updatedResult.view.presentation, revisedSnapshot);

const restoredViews = normalizeLeadCustomSavedViews(
  JSON.parse(JSON.stringify(updatedResult.views)),
  savedSnapshot,
);
assert.equal(restoredViews.length, 1);
assert.deepEqual(restoredViews[0]?.presentation, revisedSnapshot, "Persisted saved views must restore the complete snapshot.");
const legacyRestored = normalizeLeadCustomSavedViews([
  { key: "custom_legacy", labelKey: "Legacy view", isShared: false },
], savedSnapshot);
assert.deepEqual(legacyRestored[0]?.presentation, savedSnapshot, "Legacy name-only custom views must migrate to a safe fallback snapshot.");

assert.ok(LEAD_SYSTEM_SAVED_VIEWS.some((view) => view.key === "nurture"));
assert.ok(LEAD_SYSTEM_SAVED_VIEWS.some((view) => view.key === "disqualified"));
assert.equal(LEAD_SYSTEM_SAVED_VIEWS.some((view) => view.key === "unqualified_recontact"), false);
assert.equal(LEAD_SYSTEM_SAVED_VIEWS.some((view) => view.key === "unqualified_closed"), false);

const sourceRoot = path.join(repositoryRoot, "src/modules/leads");
const sourceFiles = collectSourceFiles(sourceRoot, {
  include: (_filePath: string, entryName: string) => /\.(?:ts|tsx)$/u.test(entryName),
});
const forbiddenLegacyRuntime = sourceFiles.filter((file) => {
  if (file.endsWith("lead.types.ts") || file.endsWith("leadLifecycle.ts") || file.endsWith("leadSavedViewPreferences.ts")) return false;
  const text = fs.readFileSync(file, "utf8");
  return text.includes("disqualificationType") || text.includes("unqualified_recontact") || text.includes("unqualified_closed");
});
assert.deepEqual(forbiddenLegacyRuntime, [], "Legacy disqualification semantics must not remain in active Lead runtime code.");

identity.signOut("LEAD_BUSINESS_RULE_CONTRACTS_COMPLETE");
console.log("Lead business-rule contracts: PASS");
