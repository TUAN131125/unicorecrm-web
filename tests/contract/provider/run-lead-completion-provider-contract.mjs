import fs from "node:fs";

const required = [
  "UNICORE_PROVIDER_BASE_URL",
  "UNICORE_PROVIDER_ACCESS_TOKEN",
  "UNICORE_PROVIDER_WORKSPACE_ID",
  "UNICORE_PROVIDER_SECOND_WORKSPACE_ID",
];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.log(JSON.stringify({ status: "BLOCKED_EXTERNAL", pack: "lead-completion", missing }));
  process.exit(2);
}

const scenarios = JSON.parse(
  fs.readFileSync(
    new URL("../../fixtures/backend-contract/lead-completion/provider-scenarios.json", import.meta.url),
    "utf8",
  ),
);
console.log(JSON.stringify({
  status: "READY_TO_EXECUTE",
  pack: "lead-completion",
  scenarios: scenarios.scenarios.length,
  operations: [...new Set(scenarios.scenarios.map((scenario) => scenario.operationId))],
  requiredEvidence: [
    "authoritative Lead projection",
    "resourceVersion",
    "idempotent replay",
    "workspace isolation",
    "atomic multi-Lead identity resolution",
    "atomic Lead and Task handover",
    "atomic batch lifecycle, assignment, disqualification and tagging",
    "backend-owned follow-up scheduling and queue claim",
    "authoritative short-lived export artifact",
  ],
}));
