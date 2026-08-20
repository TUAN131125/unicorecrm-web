import fs from "node:fs";

const required = [
  "UNICORE_PROVIDER_BASE_URL",
  "UNICORE_PROVIDER_ACCESS_TOKEN",
  "UNICORE_PROVIDER_WORKSPACE_ID",
  "UNICORE_PROVIDER_SECOND_WORKSPACE_ID",
];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.log(JSON.stringify({ status: "BLOCKED_EXTERNAL", pack: "lead-qualification", missing }));
  process.exit(2);
}

const scenarios = JSON.parse(
  fs.readFileSync(
    new URL("../../fixtures/backend-contract/lead-qualification/provider-scenarios.json", import.meta.url),
    "utf8",
  ),
);
console.log(JSON.stringify({
  status: "READY_TO_EXECUTE",
  pack: "lead-qualification",
  scenarios: scenarios.scenarios.length,
  operations: ["qualifyLeadForNurture", "qualifyLeadForOpportunity", "qualifyLeadForDirectSale"],
  requiredEvidence: [
    "resourceVersion",
    "createdResources",
    "LEAD_QUALIFICATION_RELATIONSHIP_INVALID",
    "LEAD_NURTURE_INPUT_INVALID",
    "LEAD_OPPORTUNITY_INPUT_INVALID",
    "LEAD_DIRECT_SALE_INPUT_INVALID",
    "LEAD_QUALIFICATION_DOWNSTREAM_CAPABILITY_REQUIRED",
    "LEAD_QUALIFICATION_DOWNSTREAM_MODULE_DISABLED",
    "VERSION_CONFLICT",
    "WORKSPACE_MISMATCH",
  ],
}));
