import fs from "node:fs";
const required = ["UNICORE_PROVIDER_BASE_URL", "UNICORE_PROVIDER_ACCESS_TOKEN", "UNICORE_PROVIDER_WORKSPACE_ID", "UNICORE_PROVIDER_SECOND_WORKSPACE_ID", "UNICORE_PROVIDER_ACCEPTED_QUOTE_ID"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.log(JSON.stringify({ status: "BLOCKED_EXTERNAL", pack: "accepted-quote-order-conversion", missing }));
  process.exit(2);
}
const scenarios = JSON.parse(fs.readFileSync(new URL("../../fixtures/backend-contract/accepted-quote-order-conversion/provider-scenarios.json", import.meta.url), "utf8"));
console.log(JSON.stringify({ status: "READY_TO_EXECUTE", pack: "accepted-quote-order-conversion", scenarios: scenarios.scenarios.length, operations: ["convertAcceptedQuoteToOrderDraft"], requiredEvidence: ["sourceQuoteResourceVersion", "commercialSnapshotFingerprint", "QUOTE_ORDER_ALREADY_CONVERTED", "WORKSPACE_MISMATCH"] }));
