import fs from "node:fs";
const scenarios = JSON.parse(fs.readFileSync(new URL("../../fixtures/backend-contract/workspace-bootstrap/provider-scenarios.json", import.meta.url), "utf8"));
const missing = ["UNICORE_PROVIDER_BASE_URL"].filter((key) => !process.env[key]);
if (missing.length) { console.log(JSON.stringify({ status: "BLOCKED_EXTERNAL", pack: "workspace-bootstrap", missing })); process.exit(2); }
console.log(JSON.stringify({
  status: "READY_TO_EXECUTE",
  pack: "workspace-bootstrap",
  scenarios: scenarios.scenarios.length,
  operations: [...new Set(scenarios.scenarios.map((scenario) => scenario.operationId))],
  requiredEvidence: [
    "authenticated workspace membership listing",
    "server-side membership validation",
    "workspace capability projection",
    "runtime configuration projection",
    "cross-workspace denial",
    "no X-Workspace-Id requirement before bootstrap"
  ]
}));
