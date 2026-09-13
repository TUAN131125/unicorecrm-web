import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  advanceEligibleLeadsToVerifying,
  advanceNewLeadsToContacting,
  saveLead,
  updateLead,
  updateManyLeads,
} from "../../../src/modules/leads/application/commands/leadRepositoryCommands";
import {
  changeLeadWorkState,
  closeLeadWithOutcome,
} from "../../../src/modules/leads/application/commands/leadCommands";
import {
  getLeadOutcomeCounts,
  getLeadWorkStateCounts,
} from "../../../src/modules/leads/application/queries/leadQueries";
import { buildLeadQueueGroups, filterLeadQueue } from "../../../src/modules/leads/application/queries/leadQueueQueries";
import {
  LeadWorkState,
  QualificationOutcome,
  type LeadWorkState as LeadWorkStateValue,
} from "../../../src/modules/leads/domain/model/leadLifecycle.canonical";
import type { Lead } from "../../../src/modules/leads/domain/model/lead.types";
import { InMemoryLeadRepository } from "../../../src/modules/leads/infrastructure/InMemoryLeadRepository";
import { LEAD_MODULE_MANIFEST } from "../../../src/modules/leads/manifest";
import { ModuleRegistry } from "../../../src/platform/module-registry/ModuleRegistry";
import { editableLeadCustomerConversionFields, isLeadCustomerConversionSuppressed, retainOrCreateConversionIntent } from "../../../src/workflows/lead-customer-conversion/application/conversionIntent";

const firstIntent = retainOrCreateConversionIntent(undefined, { subjectType: "CONTACT", subjectId: "contact-1", expectedVersion: 7 }, () => "key-1");
const inProgressRetry = retainOrCreateConversionIntent(firstIntent, { subjectType: "CONTACT", subjectId: "contact-1", expectedVersion: 99 }, () => "must-not-run");
assert.equal(inProgressRetry.idempotencyKey, "key-1", "in-progress retry retains the original idempotency key");
assert.equal(inProgressRetry.expectedVersion, 7, "in-progress retry retains the original admission version");
const changedSubject = retainOrCreateConversionIntent(firstIntent, { subjectType: "CONTACT", subjectId: "contact-2", expectedVersion: 8 }, () => "key-2");
assert.equal(changedSubject.idempotencyKey, "key-2", "subject change creates a new conversion intent key");
assert.equal(isLeadCustomerConversionSuppressed("customer-1"), true, "authoritative CustomerRef suppresses conversion");
assert.equal(isLeadCustomerConversionSuppressed(undefined), false, "a Lead without CustomerRef may be converted");
assert.deepEqual(editableLeadCustomerConversionFields, ["subjectType", "subjectId"], "conversion exposes no manual Lead version input");

const seed: Lead[] = [
  createLead("lead-1", "0901000001", LeadWorkState.NEW, "unassigned", 90, "2026-07-04T00:00:00.000Z"),
  createLead("lead-2", "0901000002", LeadWorkState.CONTACTING, "u1", 70, "2026-07-06T00:00:00.000Z"),
  createLead("lead-3", "0901000003", LeadWorkState.VERIFYING, "u2", 85, "2026-07-06T00:00:00.000Z"),
];

const listeners = new Map<string, Set<(payload: unknown) => void>>();
const repository = new InMemoryLeadRepository(seed, {
  publish: (eventName, payload) => listeners.get(eventName)?.forEach((listener) => listener(payload)),
  subscribe: (eventName, listener) => {
    const bucket = listeners.get(eventName) ?? new Set();
    bucket.add(listener as (payload: unknown) => void);
    listeners.set(eventName, bucket);
    return () => bucket.delete(listener as (payload: unknown) => void);
  },
});

let observedCount = 0;
const unsubscribe = repository.subscribe((leads) => { observedCount = leads.length; });
saveLead(repository, createLead("lead-4", "0901000004", LeadWorkState.NEW, "u1", 20, "2026-07-06T00:00:00.000Z"));
assert.equal(repository.list().length, 4);
assert.equal(observedCount, 4);
unsubscribe();

updateLead(repository, "lead-2", (lead) => ({ ...lead, companyName: "Updated Company" }));
assert.equal(repository.getById("lead-2")?.companyName, "Updated Company");

const updatedMany = updateManyLeads(repository, ["lead-1", "lead-2"], (lead) => ({ ...lead, ownerId: "u9" }));
assert.equal(updatedMany, 2);
assert.equal(repository.getById("lead-1")?.ownerId, "u9");

changeLeadWorkState(repository, "lead-2", LeadWorkState.VERIFYING);
assert.equal(repository.getById("lead-2")?.leadWorkState, LeadWorkState.VERIFYING);

const contacted = advanceNewLeadsToContacting(repository, ["lead-1", "lead-4"]);
assert.equal(contacted, 2);
const advanced = advanceEligibleLeadsToVerifying(repository, ["lead-1", "lead-4"]);
assert.equal(advanced, 2);
assert.equal(repository.getById("lead-1")?.leadWorkState, LeadWorkState.VERIFYING);

assert.throws(
  () => closeLeadWithOutcome(repository, "lead-3", { outcome: QualificationOutcome.NURTURE }),
  /relationshipRef/,
  "Positive outcomes must resolve a relationship",
);
assert.throws(
  () => closeLeadWithOutcome(repository, "lead-3", {
    outcome: QualificationOutcome.OPPORTUNITY,
    relationshipRef: { type: "CONTACT", id: "contact-3" },
  }),
  /dealRef/,
  "Opportunity outcome must reference a Deal",
);

closeLeadWithOutcome(repository, "lead-3", {
  outcome: QualificationOutcome.OPPORTUNITY,
  relationshipRef: { type: "CONTACT", id: "contact-3" },
  dealRef: "deal-3",
});
assert.equal(repository.getById("lead-3")?.leadWorkState, LeadWorkState.CLOSED);
assert.equal(repository.getById("lead-3")?.qualificationOutcome, QualificationOutcome.OPPORTUNITY);
assert.deepEqual(repository.getById("lead-3")?.relationshipRef, { type: "CONTACT", id: "contact-3" });
assert.equal(repository.getById("lead-3")?.dealRef, "deal-3");

closeLeadWithOutcome(repository, "lead-4", { outcome: QualificationOutcome.DISQUALIFIED });
assert.equal(repository.getById("lead-4")?.qualificationOutcome, QualificationOutcome.DISQUALIFIED);

const workStateCounts = getLeadWorkStateCounts(repository);
assert.equal(workStateCounts[LeadWorkState.CLOSED], 2);
const outcomeCounts = getLeadOutcomeCounts(repository);
assert.equal(outcomeCounts[QualificationOutcome.OPPORTUNITY], 1);
assert.equal(outcomeCounts[QualificationOutcome.DISQUALIFIED], 1);

const queueGroups = buildLeadQueueGroups(seed, new Date("2026-07-06T12:00:00.000Z").getTime());
assert.equal(queueGroups.unassigned.length, 1);
assert.equal(queueGroups.hot.length, 2);
assert.ok(queueGroups.sla.some((lead) => lead.id === "lead-1"));
assert.equal(filterLeadQueue(seed, "Company lead-2").length, 1);

const registry = new ModuleRegistry().register(LEAD_MODULE_MANIFEST);
assert.equal(registry.get("leads")?.routes.length, 6);

const presentationRoot = path.resolve("src/modules/leads/presentation");
for (const file of walkAllFiles(presentationRoot)) {
  if (!/\.(ts|tsx)$/.test(file)) continue;
  const source = fs.readFileSync(file, "utf8");
  assert.equal(/\blocalStorage\s*\./.test(source), false, `${file} must use PreferenceStore instead of direct browser storage`);
}

console.log("Lead module checks: OK");

function createLead(
  id: string,
  phone: string,
  leadWorkState: LeadWorkStateValue,
  ownerId: string,
  score: number,
  createdAt: string,
): Lead {
  return {
    id,
    name: `Lead ${id}`,
    title: "Manager",
    companyName: `Company ${id}`,
    email: `${id}@example.com`,
    phone,
    source: "Website",
    score,
    leadWorkState,
    ownerId,
    interestedProducts: [],
    createdAt,
    painPoint: "Need a reliable CRM workflow",
    nextFollowUpAt: "2026-07-20T09:00:00.000Z",
    activities: [],
  };
}
