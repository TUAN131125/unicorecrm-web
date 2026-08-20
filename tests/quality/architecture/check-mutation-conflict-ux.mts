import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ApplicationError } from "../../../src/shared/domain";
import { FetchHttpClient } from "../../../src/platform/api";
import { classifyMutationFailure } from "../../../src/shared/operations";

const failure = classifyMutationFailure(new ApplicationError({
  code: "ORDER_VERSION_CONFLICT",
  message: "The order changed.",
  status: 409,
  correlationId: "corr-conflict",
  requestId: "req-conflict",
  details: {
    expectedVersion: 'W/"order-v4"',
    currentVersion: 'W/"order-v5"',
    changedFields: ["status", "shippingAddress"],
    updatedAt: "2026-07-19T04:00:00.000Z",
    updatedBy: "member-22",
  },
}));
assert.equal(failure.state, "CONFLICTED");
assert.equal(failure.recoveryAction, "REFRESH");
assert.equal(failure.conflict?.expectedVersion, 'W/"order-v4"');
assert.equal(failure.conflict?.actualVersion, 'W/"order-v5"');
assert.deepEqual(failure.conflict?.changedFields, ["status", "shippingAddress"]);
assert.equal(failure.requestId, "req-conflict");

const capturedHeaders: Headers[] = [];
const successfulResponse = JSON.parse(
  fs.readFileSync(path.join(repositoryRoot, "tests/fixtures/backend-contract/transaction-semantics/order-confirm-success.json"), "utf8"),
);
const client = new FetchHttpClient({
  baseUrl: "https://api.example.test/v1",
  accessTokenProvider: { getAccessToken: () => "token" },
  workspaceIdProvider: { getWorkspaceId: () => "workspace-1" },
  fetchImplementation: async (_input, init) => {
    capturedHeaders.push(new Headers(init?.headers));
    return new Response(JSON.stringify(successfulResponse), { status: 200, headers: { "content-type": "application/json" } });
  },
});
await client.request({
  operationId: "confirmOrderWithPaymentPlan",
  method: "POST",
  path: "/workflows/order-confirmation/order-1/confirm-with-payment-plan",
  body: {},
  expectedVersion: 'W/"order-v4"',
});
await client.request({
  operationId: "confirmOrderWithPaymentPlan",
  method: "POST",
  path: "/workflows/order-confirmation/order-1/confirm-with-payment-plan",
  body: {},
  expectedVersion: "order-v5",
});
assert.equal(capturedHeaders[0]?.get("If-Match"), 'W/"order-v4"');
assert.equal(capturedHeaders[1]?.get("If-Match"), '"order-v5"');

const root = repositoryRoot;
const hookSource = fs.readFileSync(path.join(root, "src/shared/operations/useMutationTask.ts"), "utf8");
assert.match(hookSource, /const submittedAt = new Date\(\)\.toISOString\(\)/u);
assert.match(hookSource, /reloadLatest/u);
assert.match(hookSource, /recovering/u);
assert.match(hookSource, /conflicted: snapshot\.state === "CONFLICTED"/u);

const dialogSource = fs.readFileSync(path.join(root, "src/shared/operations/MutationConflictDialog.tsx"), "utf8");
assert.match(dialogSource, /Tải phiên bản mới nhất/u);
assert.match(dialogSource, /Changed fields/u);
assert.match(dialogSource, /correlationId/u);

for (const relative of [
  "src/modules/payments/presentation/pages/PaymentDetailPage.tsx",
  "src/modules/invoices/presentation/pages/InvoiceFormPage.tsx",
]) {
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  assert.match(source, /MutationConflictDialog/u, `${relative} must use the canonical conflict recovery surface.`);
  assert.match(source, /reloadLatest/u, `${relative} must reload authoritative data after a conflict.`);
  assert.match(source, /mutation\.conflicted/u, `${relative} must distinguish conflicts from generic failures.`);
}

console.log("Mutation conflict UX contracts: PASS (ETag string support, conflict details, canonical reload dialog, authoritative financial refresh)");
