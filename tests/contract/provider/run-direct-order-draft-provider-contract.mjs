import fs from "node:fs";
const required=["UNICORE_PROVIDER_BASE_URL","UNICORE_PROVIDER_ACCESS_TOKEN","UNICORE_PROVIDER_WORKSPACE_ID","UNICORE_PROVIDER_SECOND_WORKSPACE_ID"];
const missing=required.filter((key)=>!process.env[key]);
if(missing.length){console.log(JSON.stringify({status:"BLOCKED_EXTERNAL",pack:"direct-order-draft",missing}));process.exit(2);}
const scenarios=JSON.parse(fs.readFileSync(new URL("../../fixtures/backend-contract/direct-order-draft/provider-scenarios.json",import.meta.url),"utf8"));
console.log(JSON.stringify({status:"READY_TO_EXECUTE",pack:"direct-order-draft",scenarios:scenarios.scenarios.length,operations:["createOrderDraftCommand"],requiredEvidence:["commercialSnapshotFingerprint","ORDER_DRAFT_SOURCE_QUOTE_NOT_ALLOWED","WORKSPACE_MISMATCH"]}));
