import assert from "node:assert/strict";
import { ROUTE_METADATA } from "@/app/routes/routeMeta";
import {
  PILOT_ACTORS,
  PILOT_JOURNEY_STEPS,
  PILOT_LEAD_INGRESS_CASES,
  PILOT_METRICS,
  PILOT_RECORDS,
} from "../../../scripts/user-experience-baseline/pilotJourneyFixture";
import type { PilotRecordKind } from "../../../scripts/user-experience-baseline/userExperienceBaseline.types";

const actorIds = new Set(PILOT_ACTORS.map((actor) => actor.memberId));
assert.equal(actorIds.size, PILOT_ACTORS.length, "Pilot actors must be unique");
for (const role of ["SALES", "SALES_MANAGER", "FINANCE", "OPERATIONS", "WORKSPACE_ADMIN", "PRODUCT_ENGINEERING"]) {
  assert.ok(PILOT_ACTORS.some((actor) => actor.role === role), `Pilot must include role ${role}`);
}

assert.deepEqual(PILOT_LEAD_INGRESS_CASES.map((entry) => entry.channel).sort(), ["import", "manual", "webhook"]);
assert.ok(PILOT_LEAD_INGRESS_CASES.some((entry) => entry.expectedResult === "MATCH_EXISTING"), "Pilot ingress must characterize duplicate matching");

const requiredKinds: PilotRecordKind[] = ["lead", "contact", "organization", "deal", "quote", "order", "payment", "shipping", "return", "support", "task"];
const recordsById = new Map(PILOT_RECORDS.map((record) => [record.id, record]));
assert.equal(recordsById.size, PILOT_RECORDS.length, "Pilot record ids must be unique");
for (const kind of requiredKinds) {
  assert.ok(PILOT_RECORDS.some((record) => record.kind === kind), `Pilot fixture requires ${kind}`);
}

const relationshipIds = new Set(PILOT_RECORDS.map((record) => record.customerRelationshipId));
assert.equal(relationshipIds.size, 1, "All pilot customer-bound records must share one relationship identity");
for (const record of PILOT_RECORDS) {
  assert.ok(actorIds.has(record.ownerId), `${record.id} owner must be a pilot actor`);
  for (const [linkName, linkedId] of Object.entries(record.links)) {
    assert.ok(recordsById.has(linkedId), `${record.id}.${linkName} references missing record ${linkedId}`);
  }
}
assert.equal(recordsById.get("pilot-lead-001")?.ownerId, "pilot-member-sales", "Lead owner must match the authenticated Sales member in the desired pilot fixture");
assert.equal(recordsById.get("pilot-deal-001")?.ownerId, "pilot-member-sales", "Deal owner must match the authenticated Sales member in the desired pilot fixture");

assert.equal(PILOT_JOURNEY_STEPS.length, 10, "Pilot journey must contain the ten research acceptance steps");
assert.deepEqual(PILOT_JOURNEY_STEPS.map((step) => step.sequence), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
for (const step of PILOT_JOURNEY_STEPS) {
  assert.ok(ROUTE_METADATA[step.routeKey], `${step.id} references unknown route ${step.routeKey}`);
  assert.ok(step.recordIds.length > 0, `${step.id} must identify records`);
  assert.ok(step.expectedEvidence.length > 0, `${step.id} must define evidence`);
  for (const recordId of step.recordIds) assert.ok(recordsById.has(recordId), `${step.id} references missing record ${recordId}`);
}

const metricIds = new Set<string>();
for (const metric of PILOT_METRICS) {
  assert.equal(metricIds.has(metric.id), false, `Duplicate pilot metric ${metric.id}`);
  metricIds.add(metric.id);
  assert.ok(metric.sourceRecordKinds.length > 0, `${metric.id} needs source records`);
  assert.ok(metric.dimensions.length > 0, `${metric.id} needs analysis dimensions`);
  for (const kind of metric.sourceRecordKinds) assert.ok(requiredKinds.includes(kind), `${metric.id} uses unsupported source kind ${kind}`);
}
for (const requiredMetric of [
  "lead-create-duration",
  "deal-create-duration",
  "form-abandonment-rate",
  "missing-owner-next-step-rate",
  "lead-sla-rate",
  "outside-crm-action-count",
  "dashboard-report-reconciliation-delta",
  "order-operations-quality-rate",
]) {
  assert.ok(metricIds.has(requiredMetric), `Missing pilot measurement ${requiredMetric}`);
}

console.log(`Pilot journey fixture: PASS (${PILOT_ACTORS.length} actors, ${PILOT_RECORDS.length} connected records, ${PILOT_JOURNEY_STEPS.length} steps, ${PILOT_METRICS.length} metrics)`);
