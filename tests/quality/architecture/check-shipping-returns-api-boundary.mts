import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";

const root = repositoryRoot;
const requiredFiles = [
  "src/modules/shipping/application/ports/ShippingApiRuntime.ts",
  "src/modules/shipping/infrastructure/http/ShippingHttpApiAdapter.ts",
  "src/modules/returns/application/ports/ReturnApiRuntime.ts",
  "src/modules/returns/infrastructure/http/ReturnHttpApiAdapter.ts",
  "docs/architecture/shipping-returns-api-boundary.md",
  "tests/fixtures/backend-contract/shipping-returns-core/provider-scenarios.json",
];
for (const file of requiredFiles) assert.ok(existsSync(join(root, file)), `Missing ${file}`);

const openApi = JSON.parse(read("docs/api/openapi.json")) as any;
const release = JSON.parse(read("docs/quality/release-identity.json")) as any;
assert.equal(openApi.info.version, release.version);
assert.equal(openApi["x-contract-phase"], "PHASE_18_SHIPPING_RETURNS_API_BOUNDARY");
assert.equal(openApi["x-release-status"], "QUALITY_BASELINE_REMEDIATION_CANDIDATE");
assert.equal(openApi["x-source-scope"], "FRONTEND_QUALITY_AND_RUNTIME_REMEDIATION");
assert.equal(openApi["x-phase"], "18");
const operations = new Map<string, any>();
for (const pathItem of Object.values(openApi.paths) as any[]) {
  for (const method of ["get", "post", "put", "patch", "delete"]) {
    const operation = pathItem?.[method];
    if (operation?.operationId) operations.set(operation.operationId, operation);
  }
}

const directCommands = [
  "createShippingBookingCommand", "cancelShippingBookingCommand", "changeShippingProviderCommand",
  "retryShippingBookingCommand", "syncShippingBookingCommand", "createReturnRequestCommand",
  "approveReturnCommand", "rejectReturnCommand", "awaitReturnItemCommand", "configureReturnMethodCommand",
  "receiveReturnItemsCommand", "completeReturnResolutionCommand", "closeReturnCommand",
];
const workflowCommands = [
  "createOrderOutboundShippingBooking", "beginReturnCarrierPickup", "beginReturnReplacementResolution",
  "completeReturnRepairResolution", "completeReturnReplacementFromDelivery",
];
for (const operationId of [...directCommands, ...workflowCommands, "listShippingProviders"]) {
  assert.equal(operations.get(operationId)?.["x-contract-status"], "PRODUCTION_CONTRACT_READY", `${operationId} must be ready`);
}
for (const operationId of directCommands.filter((id) => !["createShippingBookingCommand", "createReturnRequestCommand"].includes(id))) {
  assert.equal(operations.get(operationId)["x-concurrency-policy"], "IF_MATCH_REQUIRED", `${operationId} must require If-Match`);
}
for (const operationId of [...directCommands, ...workflowCommands]) {
  assert.equal(operations.get(operationId)["x-idempotency-policy"], "REQUIRED", `${operationId} must require idempotency`);
}
const authorizationRows = JSON.parse(read("docs/backend-readiness/operation-authorization-matrix.json")).operations;
const idempotencyRows = JSON.parse(read("docs/backend-readiness/idempotency-policy.json")).operations;
const concurrencyRows = JSON.parse(read("docs/backend-readiness/concurrency-policy.json")).operations;
for (const rows of [authorizationRows, idempotencyRows, concurrencyRows]) {
  assert.equal(rows.length, operations.size, "Operation policy authority must cover every OpenAPI operation");
}
for (const operationId of [...directCommands, ...workflowCommands, "listShippingProviders"]) {
  const operation = operations.get(operationId);
  assert.equal(authorizationRows.find((row: any) => row.operationId === operationId)?.status, operation["x-contract-status"]);
  assert.equal(idempotencyRows.find((row: any) => row.operationId === operationId)?.policy, operation["x-idempotency-policy"]);
  assert.equal(concurrencyRows.find((row: any) => row.operationId === operationId)?.policy, operation["x-concurrency-policy"]);
}

const schemas = openApi.components.schemas;
for (const schemaName of [
  "CreateShippingBookingRequest", "CancelShippingBookingRequest", "RetryShippingBookingRequest",
  "ChangeShippingProviderRequest", "ShippingBookingMutationResponse", "ShippingProviderOption",
  "CreateReturnRequest", "ApproveReturnRequest", "RejectReturnRequest", "ConfigureReturnMethodRequest",
  "ReceiveReturnItemsRequest", "CompleteReturnResolutionRequest", "ReturnMutationResponse",
  "BeginReturnCarrierPickupRequest", "BeginReturnReplacementRequest", "CreateOrderOutboundShippingRequest",
]) assert.equal(schemas[schemaName]?.additionalProperties, false, `${schemaName} must be closed`);
for (const forbidden of ["id", "code", "bookingStatus", "externalStatus", "externalBookingId", "trackingCode", "shippingFee", "resourceVersion", "actorId", "now", "credentialReference"]) {
  assert.ok(!(forbidden in schemas.CreateShippingBookingRequest.properties), `Shipping create must not accept ${forbidden}`);
}
for (const forbidden of ["id", "code", "status", "eligibility", "decision", "resolution", "resourceVersion", "actorId", "now"]) {
  assert.ok(!(forbidden in schemas.CreateReturnRequest.properties), `Return create must not accept ${forbidden}`);
}
assert.equal(schemas.CreateShippingBookingRequest.properties.codAmount.$ref, "#/components/schemas/Money");
assert.equal(schemas.ReturnResolutionInput.properties.creditedAmount.$ref, "#/components/schemas/Money");
assert.ok(!JSON.stringify(schemas.ShippingProviderOption).includes("credentialReference"), "Provider credentials must not be exposed");

const shippingAdapter = read("src/modules/shipping/infrastructure/http/ShippingHttpApiAdapter.ts");
for (const operationId of ["listShippingBookings", "getShippingBooking", "listShippingProviders", ...directCommands.slice(0, 5)]) {
  assert.match(shippingAdapter, new RegExp(`\\.${operationId}(?:<|\\()`), `Shipping adapter must own ${operationId}`);
}
assert.doesNotMatch(shippingAdapter, /credentialReference|localStorage|BrowserStorage/u);
const returnAdapter = read("src/modules/returns/infrastructure/http/ReturnHttpApiAdapter.ts");
for (const operationId of ["listReturns", "getReturn", ...directCommands.slice(5)]) {
  assert.match(returnAdapter, new RegExp(`\\.${operationId}(?:<|\\()`), `Return adapter must own ${operationId}`);
}

const shippingPublic = read("src/modules/shipping/public/api.ts");
const returnPublic = read("src/modules/returns/public/api.ts");
assert.doesNotMatch(shippingPublic, /executeMutationCommand/u, "Shipping direct commands must use the typed runtime");
assert.doesNotMatch(returnPublic, /executeMutationCommand/u, "Return direct commands must use the typed runtime");
assert.match(shippingPublic, /getShippingApiRuntime\(\)\.commands/u);
assert.match(returnPublic, /getReturnApiRuntime\(\)\.commands/u);

const connected = read("src/app/composition/connected/connectedCommercialModuleServices.ts");
assert.match(connected, /createShippingConnectedApiRuntime\(httpClient\)/u);
assert.match(connected, /createReturnConnectedApiRuntime\(httpClient\)/u);
const orderWorkflow = read("src/workflows/order-shipping-booking/index.ts");
assert.match(orderWorkflow, /commandType:\s*"shipping\.create-order-outbound"/u);
assert.match(orderWorkflow, /executeMutationCommand/u);
const codWorkflow = read("src/workflows/shipping-cod-evidence/index.ts");
assert.match(codWorkflow, /getShippingApiRuntime\(\)\.mode === "connected"/u);
assert.match(codWorkflow, /demo_cod_collection_/u);

const ownership = JSON.parse(read("scripts/api/openapi/client-ownership.json"));
const commercial = ownership.clients.find((client: { id: string }) => client.id === "commercial");
assert.equal(commercial.adapterByTag.Shipping, "src/modules/shipping/infrastructure/http/ShippingHttpApiAdapter.ts");
assert.equal(commercial.adapterByTag.Returns, "src/modules/returns/infrastructure/http/ReturnHttpApiAdapter.ts");
assert.ok(commercial.testGateIds.includes("quality.shipping-returns-api-boundary"));

const commands = JSON.parse(read("docs/backend-readiness/command-registry.json")).commands;
for (const type of [
  "shipping.create-booking", "shipping.cancel-booking", "shipping.change-provider", "shipping.retry-booking", "shipping.sync-booking",
  "return.create", "return.approve", "return.reject", "return.await-item", "return.configure-method", "return.receive-items",
  "return.complete-resolution", "return.close",
]) {
  const command = commands.find((item: any) => item.commandType === type);
  assert.equal(command?.status, "PRODUCTION_CONTRACT_READY", `${type} must be ready`);
  assert.equal(command?.runtimeImplementationMode, "DEDICATED_MODULE_HTTP_ADAPTER", `${type} must use its module adapter`);
}
assert.equal(commands.find((item: any) => item.commandType === "shipping.create-order-outbound")?.status, "PRODUCTION_CONTRACT_READY");

const workflows = JSON.parse(read("docs/backend-readiness/workflow-ownership.json")).workflows;
for (const name of ["order-shipping-booking", "return-resolution", "return-resolution-evidence", "shipping-cod-evidence"]) {
  const workflow = workflows.find((item: any) => item.name === name);
  assert.equal(workflow?.contractReadiness, "PRODUCTION_CONTRACT_READY", `${name} workflow must be ready`);
  assert.equal(workflow?.connectedFrontendCoordinatorAllowed, false, `${name} must remain backend-owned`);
}

console.log("Shipping & Returns API boundary: PASS (13 module commands, 5 backend workflows, provider credentials excluded).");
function read(relative: string): string { return readFileSync(join(root, relative), "utf8"); }
