import assert from "node:assert/strict";
import fs from "node:fs";

const auditPage = fs.readFileSync("src/workspaces/people-access/presentation/pages/AuditLogsPage.tsx", "utf8");
const activityLog = fs.readFileSync("src/workspaces/people-access/presentation/components/PeopleActivityLog.tsx", "utf8");
const guidance = fs.readFileSync("src/guidance/content/people/extendedScreens.ts", "utf8");
const index = fs.readFileSync("src/workspaces/people-access/pilot-acceptance/index.ts", "utf8");
const evaluator = fs.readFileSync("src/workspaces/people-access/pilot-acceptance/runtime/pilotAcceptanceEvaluator.ts", "utf8");
const store = fs.readFileSync("src/workspaces/people-access/pilot-acceptance/runtime/pilotEvidenceStore.ts", "utf8");

assert.doesNotMatch(auditPage, /PilotAcceptancePanel|Trung tâm nghiệm thu pilot|Pilot acceptance center/, "Internal pilot acceptance tooling must not appear in the user-facing audit log");
assert.match(auditPage, /<PeopleActivityLog\s*\/>/, "The audit page must delegate to the shared People activity log");
assert.match(activityLog, /useAuditTrail\(/, "The People activity log must use the authoritative audit query boundary");
assert.doesNotMatch(auditPage, /grid gap-3 sm:grid-cols-4|PilotSummary/, "The audit page must not present QA result counts as KPI blocks");
assert.equal(fs.existsSync("src/workspaces/people-access/pilot-acceptance/presentation/PilotAcceptancePanel.tsx"), false, "The internal pilot panel must not ship in the user-facing frontend");
assert.doesNotMatch(index, /PilotAcceptancePanel/, "The pilot package must not export a user-facing panel");
assert.doesNotMatch(guidance, /people\.audit\.pilot-acceptance|people\.audit\.pilot-metrics|Mốc 9|Milestone 9/, "User guidance must not expose internal acceptance tooling");
assert.match(evaluator, /manualEvidenceFor/);
assert.match(evaluator, /NEEDS_EVIDENCE/);
assert.match(evaluator, /relationshipBlockingIssues/);
assert.match(evaluator, /dashboardReportDelta/);
assert.match(evaluator, /roleScopeVerified/);
assert.match(store, /unicore_pilot_acceptance_v1/);
assert.match(store, /workspaceId/);
assert.match(guidance, /version: 5/);

console.log("Pilot acceptance boundary: PASS (source/runtime checks retained; internal QA console removed from the user-facing audit page)");
