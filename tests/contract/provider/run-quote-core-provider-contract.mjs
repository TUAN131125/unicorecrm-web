import fs from "node:fs";
const required=["UNICORE_PROVIDER_BASE_URL","UNICORE_PROVIDER_ACCESS_TOKEN","UNICORE_PROVIDER_WORKSPACE_ID","UNICORE_PROVIDER_SECOND_WORKSPACE_ID"];
const missing=required.filter((key)=>!process.env[key]);
if(missing.length){console.log(JSON.stringify({status:"BLOCKED_EXTERNAL",pack:"quote-core",missing}));process.exit(2);}
const scenarios=JSON.parse(fs.readFileSync(new URL("../../fixtures/backend-contract/quote-core/provider-scenarios.json",import.meta.url),"utf8"));
console.log(JSON.stringify({status:"READY_TO_EXECUTE",pack:"quote-core",scenarios:scenarios.scenarios.length,operations:["listQuotes","getQuote","createQuoteCommand","createQuoteForDeal","updateQuoteDraftCommand","repriceQuoteDraft","requestQuoteApprovalCommand","requestQuoteApprovalBatch","approveQuoteCommand","requestQuoteApprovalChangesCommand","recordQuoteSendEvidenceCommand","rejectQuoteCommand","expireQuoteCommand","expireQuotesBatch","reviseQuoteCommand","archiveQuoteCommand","archiveQuotesBatch"],requiredEvidence:["decimal-string Money","authoritative totals","resourceVersion","VERSION_CONFLICT","WORKSPACE_MISMATCH","idempotent replay","delivery evidence"]}));
