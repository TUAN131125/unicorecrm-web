import assert from "node:assert/strict";
import { createPassingPilotAcceptanceFixture, evaluatePilotAcceptance, PILOT_METRIC_DEFINITIONS, PILOT_STEP_DEFINITIONS } from "@/workspaces/people-access/pilot-acceptance";

assert.equal(PILOT_STEP_DEFINITIONS.length, 10, "The pilot must preserve the ten research acceptance steps");
assert.deepEqual(PILOT_STEP_DEFINITIONS.map((step) => step.sequence), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
assert.equal(PILOT_METRIC_DEFINITIONS.length, 8, "The pilot must track all eight measurement contracts");

const passing = createPassingPilotAcceptanceFixture();
const acceptedSource = evaluatePilotAcceptance(passing.dataset, passing.manualEvidence, new Date("2026-07-19T00:00:00.000Z"));
assert.equal(acceptedSource.failedSteps, 0);
assert.equal(acceptedSource.blockedSteps, 0);
assert.equal(acceptedSource.needsEvidenceSteps, 0);
assert.equal(acceptedSource.passedSteps, 10);
assert.equal(acceptedSource.overallStatus, "READY_FOR_BROWSER_PILOT");
assert.ok(acceptedSource.steps.every((step) => step.checks.length >= 4), "Every pilot step must produce multiple evidence checks");
assert.ok(acceptedSource.metricCoverage.every((item) => item.observations.length > 0), "Every pilot metric needs an observation in the passing fixture");

const developmentOnly = createPassingPilotAcceptanceFixture({ externalProvider: false });
const developmentOnlyResult = evaluatePilotAcceptance(developmentOnly.dataset, developmentOnly.manualEvidence);
assert.equal(developmentOnlyResult.blockedSteps, 1, "A development webhook must not satisfy the real-provider acceptance condition");
assert.equal(developmentOnlyResult.overallStatus, "BLOCKED");
assert.ok(developmentOnlyResult.blockers.some((item) => item.en.includes("real provider")));

const noManual = createPassingPilotAcceptanceFixture({ manualEvidence: false });
const noManualResult = evaluatePilotAcceptance(noManual.dataset, noManual.manualEvidence);
assert.equal(noManualResult.needsEvidenceSteps, 10, "Source checks must not replace browser evidence");
assert.equal(noManualResult.passedSteps, 0);

const wrongOwner = createPassingPilotAcceptanceFixture();
wrongOwner.dataset.leads[0].ownerId = "pilot-member-finance";
const wrongOwnerResult = evaluatePilotAcceptance(wrongOwner.dataset, wrongOwner.manualEvidence);
assert.equal(wrongOwnerResult.steps.find((step) => step.definition.id === "owner-and-sla")?.status, "FAIL");

const orphaned = createPassingPilotAcceptanceFixture();
orphaned.dataset.relationshipBlockingIssues = 2;
const orphanedResult = evaluatePilotAcceptance(orphaned.dataset, orphaned.manualEvidence);
assert.equal(orphanedResult.steps.find((step) => step.definition.id === "customer-conversion")?.status, "FAIL");
assert.equal(orphanedResult.steps.find((step) => step.definition.id === "support-and-reconciliation")?.status, "FAIL");

const mismatchedTotal = createPassingPilotAcceptanceFixture();
mismatchedTotal.dataset.orders[0].grandTotal += 1000;
const mismatchedTotalResult = evaluatePilotAcceptance(mismatchedTotal.dataset, mismatchedTotal.manualEvidence);
assert.equal(mismatchedTotalResult.steps.find((step) => step.definition.id === "order-creation")?.status, "FAIL");
assert.equal(mismatchedTotalResult.steps.find((step) => step.definition.id === "payment-reconciliation")?.status, "FAIL");

const unresolvedReturn = createPassingPilotAcceptanceFixture();
unresolvedReturn.dataset.returns[0].resolutionEvidenceId = undefined;
const unresolvedReturnResult = evaluatePilotAcceptance(unresolvedReturn.dataset, unresolvedReturn.manualEvidence);
assert.equal(unresolvedReturnResult.steps.find((step) => step.definition.id === "return-resolution")?.status, "FAIL");

console.log(`Pilot end-to-end: PASS (${acceptedSource.passedSteps} steps, ${acceptedSource.metricCoverage.length} metrics, real-provider and manual-evidence boundaries enforced)`);
