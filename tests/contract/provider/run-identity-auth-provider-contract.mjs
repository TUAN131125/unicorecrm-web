import fs from "node:fs";

const scenarios = JSON.parse(fs.readFileSync(new URL("../../fixtures/backend-contract/identity-auth/provider-scenarios.json", import.meta.url), "utf8"));
const required = ["UNICORE_PROVIDER_BASE_URL"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.log(JSON.stringify({ status: "BLOCKED_EXTERNAL", pack: "identity-auth", missing }));
  process.exit(2);
}
console.log(JSON.stringify({
  status: "READY_TO_EXECUTE",
  pack: "identity-auth",
  scenarios: scenarios.scenarios.length,
  operations: [...new Set(scenarios.scenarios.map((scenario) => scenario.operationId))],
  requiredEvidence: [
    "cookie-assisted refresh session",
    "memory-only access token",
    "MFA challenge and verification",
    "idempotent account/session commands",
    "stable authentication errors",
    "workspace-independent identity endpoints"
  ]
}));
