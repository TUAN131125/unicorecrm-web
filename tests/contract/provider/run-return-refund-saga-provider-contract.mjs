import fs from "node:fs";
const required = ["UNICORE_PROVIDER_BASE_URL", "UNICORE_PROVIDER_ACCESS_TOKEN", "UNICORE_PROVIDER_WORKSPACE_ID", "UNICORE_PROVIDER_OTHER_WORKSPACE_ID"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.log(JSON.stringify({ status: "BLOCKED_EXTERNAL", pack: "return-refund-saga", missing }));
  process.exit(2);
}
const scenarios = JSON.parse(fs.readFileSync(new URL("../../fixtures/backend-contract/return-refund-saga/provider-scenarios.json", import.meta.url), "utf8"));
console.log(JSON.stringify({ status: "READY_TO_EXECUTE", pack: "return-refund-saga", scenarios: scenarios.scenarios.length }));
