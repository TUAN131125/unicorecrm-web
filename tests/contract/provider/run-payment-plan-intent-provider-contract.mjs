import fs from "node:fs";
const required = ["UNICORE_PROVIDER_BASE_URL", "UNICORE_PROVIDER_ACCESS_TOKEN", "UNICORE_PROVIDER_WORKSPACE_ID"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.log(JSON.stringify({ status: "BLOCKED_EXTERNAL", pack: "payment-plan-intent", missing }));
  process.exit(2);
}
const scenarios = JSON.parse(fs.readFileSync(new URL("../../fixtures/backend-contract/payment-plan-intent/provider-scenarios.json", import.meta.url), "utf8"));
console.log(JSON.stringify({ status: "READY_TO_EXECUTE", pack: "payment-plan-intent", scenarios: scenarios.scenarios.length }));
