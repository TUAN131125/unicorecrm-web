import fs from "node:fs";
const scenarios = JSON.parse(fs.readFileSync(new URL("../../fixtures/backend-contract/access-governance/provider-scenarios.json", import.meta.url), "utf8"));
const missing = ["UNICORE_PROVIDER_BASE_URL"].filter((key) => !process.env[key]);
if (missing.length) { console.log(JSON.stringify({ status: "BLOCKED_EXTERNAL", pack: "access-governance", missing })); process.exit(2); }
console.log(JSON.stringify({
  status: "READY_TO_EXECUTE",
  pack: "access-governance",
  scenarios: scenarios.scenarios.length,
  operations: [...new Set(scenarios.scenarios.map((scenario) => scenario.operationId))],
  requiredEvidence: [
    "backend-enforced workspace authorization",
    "object-level action and field decisions",
    "last-administrator invariant",
    "atomic role and membership updates",
    "session revocation on suspension",
    "idempotent invitation and role commands",
    "optimistic concurrency for mutable access resources"
  ]
}));
