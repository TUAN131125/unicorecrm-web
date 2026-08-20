import fs from "node:fs";
const required = ["UNICORE_PROVIDER_BASE_URL", "UNICORE_PROVIDER_ACCESS_TOKEN", "UNICORE_PROVIDER_WORKSPACE_ID", "UNICORE_PROVIDER_SECOND_WORKSPACE_ID", "UNICORE_PROVIDER_ORDER_ID", "UNICORE_PROVIDER_PAYMENT_PLAN_ID"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.log(JSON.stringify({ status: "BLOCKED_EXTERNAL", pack: "commercial-credit-approval", missing }));
  process.exit(2);
}
const scenarios = JSON.parse(fs.readFileSync(new URL("../../fixtures/backend-contract/commercial-credit-approval/provider-scenarios.json", import.meta.url), "utf8"));
console.log(JSON.stringify({ status: "READY_TO_EXECUTE", pack: "commercial-credit-approval", scenarios: scenarios.scenarios.length, operations: ["requestOrderCreditApproval", "getOrderCreditApproval", "approveOrderCreditApproval", "rejectOrderCreditApproval", "revokeOrderCreditApproval"], requiredEvidence: ["resourceVersion", "evaluationFingerprint", "policyVersion", "WORKSPACE_MISMATCH", "CREDIT_APPROVAL_ALREADY_CONSUMED"] }));
