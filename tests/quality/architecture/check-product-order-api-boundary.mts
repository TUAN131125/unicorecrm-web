import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";

const root = repositoryRoot;
const requiredFiles = [
  "src/modules/products/application/ports/ProductApiRuntime.ts",
  "src/modules/products/infrastructure/http/ProductApiMapper.ts",
  "src/modules/products/infrastructure/http/ProductHttpApiAdapter.ts",
  "src/modules/products/infrastructure/http/createProductConnectedApiRuntime.ts",
  "src/modules/products/runtime/createProductDemoApiRuntime.ts",
  "src/modules/orders/application/ports/OrderApiRuntime.ts",
  "src/modules/orders/infrastructure/http/OrderApiMapper.ts",
  "src/modules/orders/infrastructure/http/OrderHttpApiAdapter.ts",
  "src/modules/orders/infrastructure/http/createOrderConnectedApiRuntime.ts",
  "src/modules/orders/runtime/createOrderDemoApiRuntime.ts",
];
for (const file of requiredFiles) assert.ok(existsSync(join(root, file)), `Missing ${file}`);

const openApi = JSON.parse(read("docs/api/openapi.json")) as any;
const operations = new Map<string, any>();
for (const pathItem of Object.values(openApi.paths) as any[]) {
  for (const method of ["get", "post", "put", "patch", "delete"]) {
    const operation = pathItem?.[method];
    if (operation?.operationId) operations.set(operation.operationId, operation);
  }
}
const productOperations = [
  "listProducts", "getProduct", "getProductAvailability", "getProductPriceProjection",
  "createProduct", "replaceProduct", "archiveProduct", "restoreProduct",
  "archiveProductsBatch", "restoreProductsBatch",
];
const orderOperations = [
  "listOrders", "getOrder", "getOrderFulfillmentEligibility", "getOrderInvoiceEligibility",
  "getOrderPaymentProjection", "createOrderDraftCommand", "updateOrderDraftCommand",
  "repriceOrderDraft", "recordOrderSendEvidenceCommand", "archiveOrderCommand",
  "archiveOrdersBatch", "duplicateOrderDraft", "completeOrderFromFulfillmentEvidence",
];
for (const [owner, ids] of [["products", productOperations], ["orders", orderOperations]] as const) {
  for (const operationId of ids) {
    const operation = operations.get(operationId);
    assert.ok(operation, `Missing ${operationId}`);
    assert.equal(operation["x-contract-status"], "PRODUCTION_CONTRACT_READY", `${operationId} must be ready`);
    assert.equal(operation["x-module-owner"], owner, `${operationId} owner drift`);
  }
}
for (const operationId of [...productOperations, ...orderOperations].filter((id) => !id.startsWith("list") && !id.startsWith("get"))) {
  assert.equal(operations.get(operationId)["x-idempotency-policy"], "REQUIRED", `${operationId} must require idempotency`);
}
for (const operationId of ["replaceProduct", "archiveProduct", "restoreProduct", "updateOrderDraftCommand", "repriceOrderDraft", "recordOrderSendEvidenceCommand", "archiveOrderCommand", "duplicateOrderDraft", "completeOrderFromFulfillmentEvidence"]) {
  assert.equal(operations.get(operationId)["x-concurrency-policy"], "IF_MATCH_REQUIRED", `${operationId} must require If-Match`);
}
for (const operationId of ["archiveProductsBatch", "restoreProductsBatch", "archiveOrdersBatch"]) {
  assert.equal(operations.get(operationId)["x-concurrency-policy"], "ITEMS_CARRY_EXPECTED_VERSION", `${operationId} must carry item versions`);
}
assert.ok(!operations.has("changeOrderStateCommand") || operations.get("changeOrderStateCommand")?.["x-contract-status"] === "BLOCKED", "Generic Order status patch must remain absent or fail closed");

const schemas = openApi.components.schemas;
for (const schemaName of [
  "CreateProductRequest", "ReplaceProductRequest", "ArchiveProductsBatchRequest", "RestoreProductsBatchRequest",
  "ProductMutationResponse", "ProductBatchMutationResponse", "ProductAvailabilityReadModel", "ProductPriceProjectionReadModel",
  "CreateDirectOrderDraftRequest", "CreateDirectOrderDraftResponse", "ReplaceOrderDraftRequest", "RecordOrderSendEvidenceRequest",
  "ArchiveOrdersBatchRequest", "OrderMutationResponse", "OrderBatchMutationResponse", "OrderEligibilityReadModel", "OrderPaymentProjectionReadModel",
]) assert.equal(schemas[schemaName]?.additionalProperties, false, `${schemaName} must be closed`);
assert.equal(schemas.ProductPriceProjectionReadModel.properties.unitPrice.$ref, "#/components/schemas/Money");
assert.equal(schemas.OrderPaymentProjectionReadModel.properties.grandTotal.$ref, "#/components/schemas/Money");
assert.equal(schemas.OrderDraftLineInput.properties.unitPrice.$ref, "#/components/schemas/Money");
assert.equal(schemas.CreateDirectOrderDraftResponse.properties.result.$ref, "#/components/schemas/DirectOrderDraftMutationResult");
assert.equal(schemas.DirectOrderDraftMutationResult.properties.paymentPlan.$ref, "#/components/schemas/PaymentPlanDocument");

const productAdapter = read("src/modules/products/infrastructure/http/ProductHttpApiAdapter.ts");
for (const operationId of productOperations) assert.match(productAdapter, new RegExp(`\\.${operationId}(?:<|\\()|${operationId}`), `Product adapter must own ${operationId}`);
const orderAdapter = read("src/modules/orders/infrastructure/http/OrderHttpApiAdapter.ts");
for (const operationId of orderOperations.filter((id) => id !== "completeOrderFromFulfillmentEvidence")) assert.match(orderAdapter, new RegExp(`\\.${operationId}(?:<|\\()|${operationId}`), `Order adapter must own ${operationId}`);
const closing = read("src/workflows/order-closing/index.ts");
assert.match(closing, /order\.complete-from-fulfillment-evidence/u, "Order closing workflow owner missing");

const ownership = JSON.parse(read("scripts/api/openapi/client-ownership.json"));
const commercial = ownership.clients.find((client: { id: string }) => client.id === "commercial");
assert.equal(commercial.adapterByTag.Products, "src/modules/products/infrastructure/http/ProductHttpApiAdapter.ts");
assert.equal(commercial.adapterByTag.Orders, "src/modules/orders/infrastructure/http/OrderHttpApiAdapter.ts");
assert.ok(commercial.testGateIds.includes("quality.product-order-api-boundary"));

const connectedCrm = read("src/app/composition/connected/connectedCrmModuleServices.ts");
assert.match(connectedCrm, /createProductConnectedApiRuntime/u);
const connectedCommercial = read("src/app/composition/connected/connectedCommercialModuleServices.ts");
assert.match(connectedCommercial, /createOrderConnectedApiRuntime/u);
const demo = read("src/app/composition/demoApplicationServiceBundle.ts");
assert.match(demo, /createProductDemoApiRuntime/u);
assert.match(demo, /createOrderDemoApiRuntime/u);

const productPublic = read("src/modules/products/public/catalog.ts");
for (const token of ["getProductApiRuntime", "PRODUCT_CONNECTED_OPERATION_REQUIRES_BACKEND_CONTRACT", "assertProductCatalogImportAvailable"]) assert.match(productPublic, new RegExp(token));
const orderPublic = read("src/modules/orders/public/orders.ts");
for (const token of ["getOrderApiRuntime", "ORDER_CONNECTED_MUTATION_REQUIRES_API", "createDirectOrderDraftCommandBoundary", "resourceVersion"]) assert.match(orderPublic, new RegExp(token));
assert.doesNotMatch(productPublic, /getRoutedHttpMutationAuthority|executeGeneratedProductionCommand/u);
assert.doesNotMatch(orderPublic, /getRoutedHttpMutationAuthority|executeGeneratedProductionCommand/u);

const workflow = read("src/workflows/order-creation/index.ts");
assert.match(workflow, /createDirectOrderDraftCommandBoundary/u);
assert.match(workflow, /paymentAgreementVersion: result\.paymentPlan\.agreementSnapshot\.version/u);
const generatedCommands = read("src/platform/api/contracts/generatedProductionCommandRegistry.ts");
assert.doesNotMatch(generatedCommands, /"product\.(?:create|replace|archive|restore|archive-many|restore-many)"/u);
assert.doesNotMatch(generatedCommands, /"order\.(?:create|update-draft|reprice-draft|send|archive|archive-many|duplicate-draft)"/u);

const productList = read("src/modules/products/presentation/hooks/useProductListController.ts");
assert.doesNotMatch(productList, /Promise\.all/u, "Product batch lifecycle must be backend-owned");
const orderList = read("src/modules/orders/presentation/hooks/useOrderListController.tsx");
assert.match(orderList, /archiveOrdersCommandBoundary\(selectedOrderIds/u, "Order batch archive must use the authoritative boundary");

console.log(`Product/Order API boundary: PASS (${productOperations.length + orderOperations.length} authoritative operations).`);
function read(relative: string): string { return readFileSync(join(root, relative), "utf8"); }
