import fs from "node:fs";
const required=["UNICORE_PROVIDER_BASE_URL","UNICORE_PROVIDER_ACCESS_TOKEN","UNICORE_PROVIDER_WORKSPACE_ID","UNICORE_PROVIDER_SECOND_WORKSPACE_ID"];
const missing=required.filter((key)=>!process.env[key]);
if(missing.length){console.log(JSON.stringify({status:"BLOCKED_EXTERNAL",pack:"deal-core",missing}));process.exit(2);}
const scenarios=JSON.parse(fs.readFileSync(new URL("../../fixtures/backend-contract/deal-core/provider-scenarios.json",import.meta.url),"utf8"));
console.log(JSON.stringify({status:"READY_TO_EXECUTE",pack:"deal-core",scenarios:scenarios.scenarios.length,operations:["listDeals","getDeal","getDealForecastSummary","createDealCommand","updateDealCommand","changeDealStageCommand","assignDealOwner","updateDealForecast","updateDealNextAction","markDealWonCommand","markDealLostCommand","archiveDealCommand","archiveDealsBatch"],requiredEvidence:["resourceVersion","forecast multi-currency buckets","VERSION_CONFLICT","WORKSPACE_MISMATCH","idempotent replay"]}));
