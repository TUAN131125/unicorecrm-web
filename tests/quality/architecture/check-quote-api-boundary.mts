import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";

const root = repositoryRoot;
const requiredFiles = [
  "src/modules/quotes/application/ports/QuoteApiRuntime.ts",
  "src/modules/quotes/application/vertical-slice/quoteAuthoritativeQueries.ts",
  "src/modules/quotes/infrastructure/http/QuoteApiMapper.ts",
  "src/modules/quotes/infrastructure/http/QuoteHttpApiAdapter.ts",
  "src/modules/quotes/infrastructure/http/createQuoteConnectedApiRuntime.ts",
  "src/modules/quotes/runtime/createQuoteDemoApiRuntime.ts",
];
for (const file of requiredFiles) assert.ok(existsSync(join(root, file)), `Missing ${file}`);

const openApi = JSON.parse(read("docs/api/openapi.json")) as any;
const requiredOperations = [
  "listQuotes", "getQuote", "createQuoteCommand", "createQuoteForDeal",
  "updateQuoteDraftCommand", "repriceQuoteDraft", "requestQuoteApprovalCommand",
  "requestQuoteApprovalBatch", "approveQuoteCommand", "requestQuoteApprovalChangesCommand",
  "recordQuoteSendEvidenceCommand", "rejectQuoteCommand", "expireQuoteCommand",
  "expireQuotesBatch", "reviseQuoteCommand", "archiveQuoteCommand", "archiveQuotesBatch",
];
const operations = new Map<string, any>();
for (const pathItem of Object.values(openApi.paths) as any[]) {
  for (const method of ["get", "post", "put", "patch", "delete"]) {
    const operation = pathItem?.[method];
    if (operation?.operationId) operations.set(operation.operationId, operation);
  }
}
for (const operationId of requiredOperations) {
  const operation = operations.get(operationId);
  assert.ok(operation, `Missing ${operationId}`);
  assert.equal(operation["x-contract-status"], "PRODUCTION_CONTRACT_READY", `${operationId} must be ready`);
  assert.equal(operation["x-module-owner"], "quotes", `${operationId} owner drift`);
}
for (const operationId of requiredOperations.filter((id) => !["listQuotes", "getQuote"].includes(id))) {
  assert.equal(operations.get(operationId)["x-idempotency-policy"], "REQUIRED", `${operationId} must require idempotency`);
}
for (const operationId of [
  "createQuoteForDeal", "updateQuoteDraftCommand", "repriceQuoteDraft", "requestQuoteApprovalCommand",
  "approveQuoteCommand", "requestQuoteApprovalChangesCommand", "recordQuoteSendEvidenceCommand",
  "rejectQuoteCommand", "expireQuoteCommand", "reviseQuoteCommand", "archiveQuoteCommand",
]) {
  assert.equal(operations.get(operationId)["x-concurrency-policy"], "IF_MATCH_REQUIRED", `${operationId} must require optimistic concurrency`);
}
for (const operationId of ["requestQuoteApprovalBatch", "expireQuotesBatch", "archiveQuotesBatch"]) {
  assert.equal(operations.get(operationId)["x-concurrency-policy"], "ITEMS_CARRY_EXPECTED_VERSION", `${operationId} must carry item versions`);
}
for (const operationId of ["changeQuoteStatusCommand", "acceptQuote"]) {
  assert.equal(operations.get(operationId)?.["x-contract-status"], "BLOCKED", `${operationId} must remain fail closed`);
}

const schemas = openApi.components.schemas;
for (const schemaName of [
  "QuoteDraftLineInput", "QuoteAdjustmentInput", "QuoteDraftRequest",
  "CreateQuoteForDealRequest", "ApproveQuoteRequest", "RejectQuoteRequest",
  "ExpireQuoteRequest", "RecordQuoteSendEvidenceRequest", "QuoteMutationResponse", "QuoteBatchMutationResponse",
]) {
  assert.equal(schemas[schemaName]?.additionalProperties, false, `${schemaName} must be closed`);
}
assert.equal(schemas.QuoteDraftLineInput.properties.unitPrice.$ref, "#/components/schemas/Money");
assert.equal(schemas.CreateQuoteDraftRequest.additionalProperties, false);
assert.equal(schemas.ReplaceQuoteDraftRequest.additionalProperties, false);
assert.ok(schemas.QuoteMutationResponse.required.includes("result"), "Mutation response must return authoritative result");
assert.ok(schemas.QuoteMutationResponse.required.includes("version"), "Mutation response must return resource version evidence");
assert.ok(schemas.QuoteMutationResult.required.includes("quote"), "Mutation result must return authoritative Quote");

const adapter = read("src/modules/quotes/infrastructure/http/QuoteHttpApiAdapter.ts");
for (const operationId of requiredOperations) {
  assert.match(adapter, new RegExp(`\\.${operationId}(?:<|\\()|${operationId}`), `Quote adapter must own ${operationId}`);
}
const ownership = JSON.parse(read("scripts/api/openapi/client-ownership.json"));
const commercial = ownership.clients.find((client: { id: string }) => client.id === "commercial");
assert.equal(commercial.adapterByTag.Quotes, "src/modules/quotes/infrastructure/http/QuoteHttpApiAdapter.ts");
assert.ok(commercial.testGateIds.includes("quality.quote-api-boundary"));

const connected = read("src/app/composition/connected/connectedCommercialModuleServices.ts");
assert.match(connected, /createQuoteConnectedApiRuntime/u);
const demo = read("src/app/composition/demoApplicationServiceBundle.ts");
assert.match(demo, /createQuoteDemoApiRuntime/u);
const application = read("src/modules/quotes/application/vertical-slice/quoteAuthoritativeQueries.ts");
assert.doesNotMatch(application, /HttpModuleDataAuthority|createModuleCollectionResource|getModuleDataAuthority/u, "Quote queries must not use generic module authority");
const publicApi = read("src/modules/quotes/public/quotes.ts");
assert.match(publicApi, /getQuoteApiRuntime/u);
assert.match(publicApi, /QUOTE_CONNECTED_MUTATION_REQUIRES_API/u);
assert.match(publicApi, /resourceVersion/u);
assert.doesNotMatch(publicApi, /getRoutedHttpMutationAuthority|executeGeneratedProductionCommand/u);
const generatedCommands = read("src/platform/api/contracts/generatedProductionCommandRegistry.ts");
assert.doesNotMatch(generatedCommands, /"quotes\.(?:approve|archive|create|request-approval|request-approval-changes|revise|send|reprice|reject|expire|update-draft)"/u);

const listPage = read("src/modules/quotes/presentation/pages/QuoteListPage.tsx");
assert.match(listPage, /requestQuoteApprovalBatchCommand/u);
assert.match(listPage, /expireQuotesBatchCommand/u);
assert.match(listPage, /archiveQuotesCommand/u);
assert.doesNotMatch(listPage, /Promise\.all/u, "Quote bulk lifecycle must be backend-owned");
const contactController = read("src/modules/contacts/presentation/hooks/useContactDetailController.tsx");
assert.doesNotMatch(contactController, /QuoteStatus\.SENT/u, "Contact must not fabricate Quote delivery state");
assert.match(contactController, /action=gmail/u, "Quote send must capture delivery evidence in the Quote flow");

console.log(`Quote API boundary: PASS (${requiredOperations.length} authoritative operations).`);
function read(relative: string): string { return readFileSync(join(root, relative), "utf8"); }
