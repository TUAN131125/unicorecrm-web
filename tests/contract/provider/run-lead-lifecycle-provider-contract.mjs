import fs from "node:fs";

const required = [
  "UNICORE_PROVIDER_BASE_URL",
  "UNICORE_PROVIDER_ACCESS_TOKEN",
  "UNICORE_PROVIDER_WORKSPACE_ID",
  "UNICORE_PROVIDER_SECOND_WORKSPACE_ID",
];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.log(JSON.stringify({ status: "BLOCKED_EXTERNAL", pack: "lead-lifecycle", missing }));
  process.exit(2);
}

const scenarios = JSON.parse(
  fs.readFileSync(
    new URL("../../fixtures/backend-contract/lead-lifecycle/provider-scenarios.json", import.meta.url),
    "utf8",
  ),
);
console.log(JSON.stringify({
  status: "READY_TO_EXECUTE",
  pack: "lead-lifecycle",
  scenarios: scenarios.scenarios.length,
  operations: ["advanceLeadWorkState", "disqualifyLead", "reopenDisqualifiedLead"],
  requiredEvidence: [
    "resourceVersion",
    "LEAD_INVALID_TRANSITION",
    "LEAD_PROGRESSIVE_PROFILE_INCOMPLETE",
    "LEAD_DISQUALIFICATION_EVIDENCE_REQUIRED",
    "LEAD_REOPEN_NOT_ALLOWED",
    "VERSION_CONFLICT",
    "WORKSPACE_MISMATCH",
  ],
}));
