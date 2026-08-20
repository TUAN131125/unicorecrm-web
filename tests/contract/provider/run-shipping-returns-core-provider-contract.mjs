import fs from "node:fs";

const required = [
  "UNICORE_PROVIDER_BASE_URL",
  "UNICORE_PROVIDER_ACCESS_TOKEN",
  "UNICORE_PROVIDER_WORKSPACE_ID",
  "UNICORE_PROVIDER_SECOND_WORKSPACE_ID",
];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.log(JSON.stringify({ status: "BLOCKED_EXTERNAL", pack: "shipping-returns-core", missing }));
  process.exit(2);
}
const scenarios = JSON.parse(fs.readFileSync(
  new URL("../../fixtures/backend-contract/shipping-returns-core/provider-scenarios.json", import.meta.url),
  "utf8",
));
console.log(JSON.stringify({
  status: "READY_TO_EXECUTE",
  pack: "shipping-returns-core",
  scenarios: scenarios.scenarios.length,
  requiredEvidence: [
    "provider-normalized Shipping errors",
    "authoritative tracking and delivery evidence",
    "backend-owned COD Payment projection",
    "Return eligibility and override audit",
    "Return Inventory and refund saga evidence",
    "resourceVersion",
    "VERSION_CONFLICT",
    "WORKSPACE_MISMATCH",
    "idempotent replay",
  ],
}));
