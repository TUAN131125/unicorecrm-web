import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  HttpEffectiveRecordAccessAuthority,
} from "../../../src/platform/access-control";
import type { HttpClient, HttpRequest } from "../../../src/platform/api";
import { CommercialApiClient } from "../../../src/platform/api/generated/commercialApi";
import { ProductHttpApiAdapter } from "../../../src/modules/products/infrastructure/http/ProductHttpApiAdapter";
import { ApplicationError } from "../../../src/shared/domain";

let networkCalls = 0;
let capturedRequest: HttpRequest | undefined;
const client: HttpClient = {
  async request<TResponse>(input: HttpRequest): Promise<TResponse> {
    networkCalls += 1;
    capturedRequest = input;
    return {
      workspaceId: "workspace-1",
      resourceKey: "orders",
      recordId: "order-1",
      canRead: true,
      canUpdate: true,
      canDelete: false,
      canExport: true,
      canApprove: false,
      allowedCommands: ["order.update"],
      fieldAccess: { buyerRef: "READ_ONLY" },
      decisionReasons: [{ code: "RESOURCE_SCOPE_ALLOWED", effect: "ALLOW" }],
      evaluatedAt: "2026-07-26T00:00:00.000Z",
      authority: "backend",
    } as TResponse;
  },
};
const authority = new HttpEffectiveRecordAccessAuthority(client);
const decision = await authority.evaluate({ workspaceId: "workspace-1", resourceKey: "orders", recordId: "order-1" });
assert.equal(networkCalls, 1);
assert.equal(capturedRequest?.operationId, "evaluateEffectiveRecordAccess");
assert.deepEqual(capturedRequest?.body, { resourceKey: "orders", recordId: "order-1" });
assert.equal(decision.canRead, true);
assert.equal(decision.canDelete, false);
assert.deepEqual(decision.allowedCommands, ["order.update"]);

const read = (relative: string) => fs.readFileSync(path.join(repositoryRoot, relative), "utf8");
const composition = read("src/app/composition/applicationComposition.ts");
assert.match(composition, /configureEffectiveRecordAccessAuthority\(new HttpEffectiveRecordAccessAuthority/);
assert.match(composition, /resetEffectiveRecordAccessAuthority\(\)/);
assert.match(composition, /effectiveRecordAccessAuthority: mode === "connected" \? "connected-http" : "demo-local"/);

const hook = read("src/platform/access-control/react/useEffectiveRecordAccess.ts");
assert.match(hook, /isEffectiveRecordAccessAuthorityConfigured\(\)/);
assert.match(hook, /query\.state === "READY" \? query\.data : undefined/);
assert.match(hook, /access\.getFieldAccess/);
assert.match(hook, /"HIDDEN"/);

const boundary = read("src/platform/access-control/react/EffectiveRecordAccessBoundary.tsx");
assert.match(boundary, /if \(!access\.data\.canRead \|\| commandDenied\)/);
assert.match(boundary, /data-access-authority/);
assert.match(boundary, /Backend chỉ cho phép xem bản ghi này/);

const protectedSurfaces = [
  "src/modules/leads/detail-route.tsx",
  "src/modules/deals/detail-route.tsx",
  "src/modules/quotes/detail.tsx",
  "src/modules/orders/detail-route.tsx",
  "src/modules/contacts/detail-route.tsx",
  "src/modules/organizations/detail-route.tsx",
  "src/modules/customers/detail-route.tsx",
  "src/modules/returns/detail-route.tsx",
  "src/modules/shipping/detail-route.tsx",
  "src/modules/support/detail-route.tsx",
  "src/modules/tasks/detail-route.tsx",
  "src/modules/quotes/builder-route.tsx",
  "src/modules/orders/form-route.tsx",
  "src/modules/support/form-route.tsx",
  "src/modules/returns/form-route.tsx",
  "src/modules/shipping/create-route.tsx",
];
for (const relative of protectedSurfaces) {
  assert.match(read(relative), /EffectiveRecordAccessBoundary/, `${relative} must use backend-effective access boundary.`);
}

// Product reads enforce record and field authority in getProduct itself. The
// canonical route consumes that protected read rather than a second evaluator.
const productRoute = read("src/modules/products/detail-route.tsx");
assert.match(productRoute, /useModuleAuthoritativeResource\(getProductDetailResource\(productId/u);
assert.match(productRoute, /scopeKey: workspace\.workspaceId/u);
assert.match(productRoute, /onScopeChange: \(\) => replaceProductCatalog\(\[\]\)/u);
assert.match(productRoute, /<AuthoritativeQueryBoundary[\s\S]*?query=\{detailQuery\}/u);
const productResource = read("src/modules/products/application/vertical-slice/productAuthoritativeQueries.ts");
assert.match(productResource, /createModuleDetailResource\("products", id/u);
const productAdapter = read("src/modules/products/infrastructure/http/ProductHttpApiAdapter.ts");
assert.match(productAdapter, /await this\.api\.getProduct\(productId, \{\}, signal\)/u);
const openapi = JSON.parse(read("docs/api/openapi.json"));
const productRead = openapi.paths["/products/{productId}"].get;
assert.equal(productRead.operationId, "getProduct");
assert.equal(productRead["x-required-capability"], "products.read");
assert.equal(productRead["x-workspace-required"], true);
assert.equal(productRead["x-resource-scope"], "RESOURCE");
assert.equal(productRead["x-data-scope"], "WORKSPACE");
for (const status of [403, 404]) {
  const denied = new ApplicationError({ code: status === 403 ? "ACCESS_DENIED" : "RESOURCE_NOT_FOUND", status, message: "Protected Product read denied" });
  let attemptedRead: HttpRequest | undefined;
  const deniedClient: HttpClient = { async request(input) { attemptedRead = input; throw denied; } };
  const products = new ProductHttpApiAdapter(new CommercialApiClient(deniedClient));
  await assert.rejects(() => products.get("product-denied"), error => error === denied, "A denied backend Product read must propagate without a browser fallback");
  assert.equal(attemptedRead?.operationId, "getProduct");
  assert.equal(attemptedRead?.path, "/products/product-denied");
}

const quoteBuilderView = read("src/modules/quotes/presentation/views/QuoteBuilderView.tsx");
assert.match(quoteBuilderView, /EffectiveFieldAccessScope fieldKey="items"/);
assert.match(quoteBuilderView, /EffectiveFieldAccessScope fieldKey="paymentAgreement"/);
const orderFormView = read("src/modules/orders/presentation/views/OrderFormView.tsx");
assert.match(orderFormView, /EffectiveFieldAccessScope fieldKey="buyerRef"/);
assert.match(orderFormView, /EffectiveFieldAccessScope fieldKey="shippingAddress"/);
assert.match(orderFormView, /EffectiveFieldAccessScope fieldKey="items"/);
assert.match(orderFormView, /EffectiveFieldAccessScope fieldKey="paymentAgreement"/);

const quoteDetail = read("src/modules/quotes/presentation/pages/QuoteDetailPage.tsx");
assert.match(quoteDetail, /useEffectiveRecordAccessDecision/);
assert.match(quoteDetail, /serverAllows\("quote\.approve"\)/);
assert.match(quoteDetail, /effectiveRecordAccess\?\.canDelete/);
const orderDetail = read("src/modules/orders/presentation/pages/OrderDetailPage.tsx");
assert.match(orderDetail, /serverAllows\("order\.confirm"\)/);
assert.match(orderDetail, /serverAllows\("payments\.record"\)/);
assert.match(orderDetail, /serverAllows\("invoices\.create"\)/);

console.log("Effective record access authority: PASS (OpenAPI-backed connected authority, fail-closed record/form boundaries, command and field decisions)");
