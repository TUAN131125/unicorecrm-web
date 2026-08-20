import fs from "node:fs";
const scenarios = JSON.parse(fs.readFileSync(new URL("../../fixtures/backend-contract/studio-core/provider-scenarios.json", import.meta.url), "utf8"));
const missing = ["UNICORE_PROVIDER_BASE_URL"].filter((key) => !process.env[key]);
if (missing.length) { console.log(JSON.stringify({ status: "BLOCKED_EXTERNAL", pack: "studio-core", missing })); process.exit(2); }
console.log(JSON.stringify({
  status: "READY_TO_EXECUTE",
  pack: "studio-core",
  scenarios: scenarios.scenarios.length,
  operations: [...new Set(scenarios.scenarios.map((scenario) => scenario.operationId))],
  requiredEvidence: [
    "backend-owned workspace configuration revision",
    "atomic locale, currency and exchange-rate configuration",
    "idempotent Studio mutations",
    "optimistic concurrency for mutable configuration",
    "immutable Studio configuration audit",
    "authoritative Quick Setup state",
    "selected-workspace authorization"
  ]
}));
