import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => fs.readFileSync(path.resolve(relativePath), "utf8");

const typesSource = read("src/modules/leads/domain/model/lead.types.ts");
for (const marker of [
  "LeadConsentLedgerEntry",
  "LeadConsentProfile",
  "LeadDuplicateResolution",
  "mergedIntoLeadId",
  "distinctFromLeadIds",
]) assert.ok(typesSource.includes(marker), `Lead identity model is missing ${marker}.`);

const commandsSource = read("src/modules/leads/application/commands/leadIdentityCommands.ts");
for (const marker of [
  "recordLeadConsent",
  "mergeLeadDuplicates",
  "confirmLeadDuplicatesDistinct",
  "assertConnectedDuplicateCluster",
  "LEAD_DUPLICATE_RELATIONSHIP_CONFLICT",
  "MERGED_INTO:",
]) assert.ok(commandsSource.includes(marker), `Lead identity command contract is missing ${marker}.`);
assert.equal(commandsSource.includes("repository.replace(repository.list().filter"), false, "Duplicate resolution must not delete source Leads.");

const queueSource = read("src/modules/leads/presentation/pages/LeadQueuePage.tsx");
assert.ok(queueSource.includes("LeadDuplicateReviewModal"), "Lead queue must expose human duplicate review.");
assert.ok(queueSource.includes("action-review-duplicate-"), "Duplicate review action must be stable and testable.");
const detailSource = read("src/modules/leads/presentation/views/LeadDetailView.tsx");
assert.ok(detailSource.includes("LeadConsentPanel"), "Lead detail must expose consent-ledger capture.");

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

const [identity, lifecycle, repositoryModule, identityCommands, duplicateQueries] = await Promise.all([
  import("@/platform/identity-auth"),
  import("@/modules/leads/domain/model/leadLifecycle.canonical"),
  import("@/modules/leads/infrastructure/InMemoryLeadRepository"),
  import("@/modules/leads/application/commands/leadIdentityCommands"),
  import("@/modules/leads/application/queries/leadDuplicateIndex"),
]);

const signIn = identity.signIn({
  email: "sales.manager@unicorecrm.local",
  password: "welcome123",
  deviceLabel: "lead identity governance contract",
});
assert.equal(signIn.ok, true);

const makeLead = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  name: `Lead ${id}`,
  title: "Manager",
  companyName: `Company ${id}`,
  email: `${id}@example.com`,
  phone: `090${id.replace(/\D/g, "").padEnd(7, "0").slice(0, 7)}`,
  source: "Website",
  score: 50,
  leadWorkState: lifecycle.LeadWorkState.NEW,
  ownerId: "u2",
  interestedProducts: [],
  createdAt: "2026-07-19T00:00:00.000Z",
  activities: [],
  ...overrides,
});
const events = { publish: () => undefined, subscribe: () => () => undefined };

const consentRepository = new repositoryModule.InMemoryLeadRepository([makeLead("consent-1")], events);
const denied = identityCommands.recordLeadConsent(consentRepository, "consent-1", {
  channel: "EMAIL",
  decision: "DENIED",
  source: "WEB_FORM",
  actorId: "u2",
  occurredAt: "2026-07-19T01:00:00.000Z",
});
assert.equal(denied.doNotEmail, true);
assert.equal(denied.consent?.ledger.length, 1);
const granted = identityCommands.recordLeadConsent(consentRepository, "consent-1", {
  channel: "EMAIL",
  decision: "GRANTED",
  source: "SIGNED_DOCUMENT",
  actorId: "u2",
  occurredAt: "2026-07-19T02:00:00.000Z",
});
assert.equal(granted.doNotEmail, false);
assert.equal(granted.consent?.ledger.length, 2, "Consent changes must append instead of overwrite evidence.");
assert.equal(granted.consent?.current.EMAIL, "GRANTED");

const distinctA = makeLead("distinct-a", { email: "same@example.com", phone: "0901000000" });
const distinctB = makeLead("distinct-b", { email: "same@example.com", phone: "0902000000" });
const distinctRepository = new repositoryModule.InMemoryLeadRepository([distinctA, distinctB], events);
assert.equal(duplicateQueries.buildLeadDuplicateIndex(distinctRepository.list()).duplicateLeadIds.size, 2);
identityCommands.confirmLeadDuplicatesDistinct(distinctRepository, {
  leadId: "distinct-a",
  candidateLeadIds: ["distinct-b"],
  reason: "Verified as two different people sharing a mailbox.",
  actorId: "u2",
  occurredAt: "2026-07-19T03:00:00.000Z",
});
assert.equal(duplicateQueries.buildLeadDuplicateIndex(distinctRepository.list()).duplicateLeadIds.size, 0);

const survivor = makeLead("merge-a", { email: "merge@example.com", phone: "0903000000", tags: ["primary"] });
const source = makeLead("merge-b", {
  email: "merge@example.com",
  phone: "0904000000",
  tags: ["webinar"],
  notes: "Source evidence",
  sourceLineage: [{ signalId: "source-1", source: "WEBHOOK", occurredAt: "2026-07-18T00:00:00.000Z" }],
});
const mergeRepository = new repositoryModule.InMemoryLeadRepository([survivor, source], events);
const mergeResult = identityCommands.mergeLeadDuplicates(mergeRepository, {
  survivorLeadId: "merge-a",
  duplicateLeadIds: ["merge-b"],
  reason: "Confirmed same identity after manual review.",
  actorId: "u2",
  occurredAt: "2026-07-19T04:00:00.000Z",
});
assert.equal(mergeRepository.list().length, 2, "Merge must preserve both durable records.");
const mergedSurvivor = mergeRepository.getById("merge-a");
const mergedSource = mergeRepository.getById("merge-b");
assert.ok(mergedSurvivor?.mergedLeadIds?.includes("merge-b"));
assert.ok(mergedSurvivor?.tags?.includes("webinar"));
assert.ok(mergedSurvivor?.sourceLineage?.some((entry) => entry.sourceRecordId === "merge-b"));
assert.equal(mergedSource?.mergedIntoLeadId, "merge-a");
assert.equal(mergedSource?.archivedAt, "2026-07-19T04:00:00.000Z");
assert.equal(mergeResult.length, 2);

const conflictRepository = new repositoryModule.InMemoryLeadRepository([
  makeLead("conflict-a", { email: "conflict@example.com", relationshipRef: { type: "CONTACT", id: "contact-a" } }),
  makeLead("conflict-b", { email: "conflict@example.com", relationshipRef: { type: "CONTACT", id: "contact-b" } }),
], events);
assert.throws(() => identityCommands.mergeLeadDuplicates(conflictRepository, {
  survivorLeadId: "conflict-a",
  duplicateLeadIds: ["conflict-b"],
  reason: "Should fail",
  actorId: "u2",
}), /LEAD_DUPLICATE_RELATIONSHIP_CONFLICT/);

identity.signOut("LEAD_IDENTITY_GOVERNANCE_COMPLETE");
console.log("Lead identity governance: PASS");
