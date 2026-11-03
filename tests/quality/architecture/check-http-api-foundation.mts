import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { initializeApplicationComposition, getApplicationHttpClient, getApplicationRuntimeMode } from "../../../src/app/composition/applicationComposition";
import { getInvoiceApplicationServices } from "../../../src/modules/invoices/application/composition/invoiceApplicationServices";
import { InvoiceHttpAdapter } from "../../../src/modules/invoices/infrastructure/http/InvoiceHttpAdapter";
import { PaymentHttpAdapter } from "../../../src/modules/payments/infrastructure/http/PaymentHttpAdapter";
import { ApiClientError, FetchHttpClient, fallbackApiErrorCode, type HttpClient, type HttpRequest } from "../../../src/platform/api/index";

const root = repositoryRoot;
const issueResponse = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/backend-contract/issue-invoice-success.json"), "utf8"));
const issueRequest = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/backend-contract/issue-invoice-request.json"), "utf8"));
const createIntentResponse = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/backend-contract/payment-plan-intent/create-intent-response.json"), "utf8"));
const sendInvoiceResponse = {
  ...issueResponse,
  version: 5,
  result: {
    invoice: { ...issueResponse.result, version: 5, deliveryState: "SENT" },
    delivery: {
      id: "delivery-1",
      invoiceId: "inv_001",
      channel: "EMAIL",
      recipient: "buyer@example.test",
      state: "SENT",
      sentAt: "2026-07-25T00:00:00.000Z",
      createdAt: "2026-07-25T00:00:00.000Z",
    },
  },
};
const recorded: Array<{ url: string; init?: RequestInit }> = [];
let responseIndex = 0;
const responses = [jsonResponse(issueResponse), jsonResponse(problem("INTEGRATION_UNAVAILABLE", 503, true, "corr-503"), 503), jsonResponse([]), jsonResponse(problem("VERSION_CONFLICT", 412, false, "corr-412"), 412)];
const fetchImplementation: typeof fetch = async (input, init) => { recorded.push({ url: String(input), init }); return responses[responseIndex++] ?? jsonResponse([]); };
const client = new FetchHttpClient({
  baseUrl: "https://api.example.test/v1",
  accessTokenProvider: { getAccessToken: () => "access-token" },
  workspaceIdProvider: { getWorkspaceId: () => "workspace-42" },
  requestIdProvider: { createRequestId: () => `request-${recorded.length + 1}` },
  correlationIdProvider: { createCorrelationId: () => `correlation-${recorded.length + 1}` },
  fetchImplementation,
  defaultTimeoutMs: 100,
  retryPolicy: { maxAttempts: 2, baseDelayMs: 0, maxDelayMs: 0 },
});

const mutationResult = await client.request<typeof issueResponse>({ operationId: "issueInvoice", method: "POST", path: "/invoices/inv_001/issue", body: issueRequest, idempotencyKey: "idem_issue_inv_001_v3", expectedVersion: 3, retry: "idempotent" });
assert.equal(mutationResult.commandId, issueResponse.commandId);
const headers = new Headers(recorded[0]?.init?.headers);
assert.equal(headers.get("Authorization"), "Bearer access-token");
assert.equal(headers.get("X-Workspace-Id"), "workspace-42");
assert.equal(headers.get("Idempotency-Key"), "idem_issue_inv_001_v3");
assert.equal(headers.get("If-Match"), '"3"');
assert.deepEqual(JSON.parse(String(recorded[0]?.init?.body)), issueRequest);

assert.deepEqual(await client.request<unknown[]>({ operationId: "listInvoices", method: "GET", path: "/invoices" }), []);
assert.equal(recorded.length, 3, "Safe GET retries one retryable 503.");
await assert.rejects(client.request({ operationId: "getInvoice", method: "GET", path: "/invoices/inv-1" }), (error: unknown) => {
  assert.ok(error instanceof ApiClientError);
  assert.equal(error.code, "VERSION_CONFLICT");
  assert.equal(error.status, 412);
  assert.equal(error.correlationId, "corr-412");
  return true;
});
assert.equal(recorded.length, 4);

await assert.rejects(client.request({ operationId: "issueInvoice", method: "POST", path: "/invoices/inv-1/issue", body: { expectedVersion: "not-an-integer" }, idempotencyKey: "bad", expectedVersion: 3 }), (error: unknown) => error instanceof ApiClientError && error.code === "CONTRACT_VIOLATION");
assert.equal(recorded.length, 4, "Invalid OpenAPI request fails before network.");

let nonIdempotentAttempts = 0;
const unsafeClient = new FetchHttpClient({ baseUrl: "https://api.example.test", accessTokenProvider: { getAccessToken: () => "token" }, workspaceIdProvider: { getWorkspaceId: () => "ws" }, fetchImplementation: async () => { nonIdempotentAttempts += 1; return jsonResponse(problem("INTEGRATION_UNAVAILABLE", 503, true, "corr"), 503); }, retryPolicy: { maxAttempts: 2, baseDelayMs: 0, maxDelayMs: 0 } });
await assert.rejects(unsafeClient.request({ operationId: "issueInvoice", method: "POST", path: "/invoices/inv/issue", body: issueRequest, retry: "idempotent" }));
assert.equal(nonIdempotentAttempts, 1, "Mutation without Idempotency-Key is never retried.");

let refreshToken = "expired-token";
let refreshCalls = 0;
const refreshHeaders: string[] = [];
let refreshAttempts = 0;
const refreshClient = new FetchHttpClient({
  baseUrl: "https://api.example.test",
  accessTokenProvider: { getAccessToken: () => refreshToken },
  workspaceIdProvider: { getWorkspaceId: () => "ws" },
  fetchImplementation: async (_input, init) => {
    refreshAttempts += 1;
    refreshHeaders.push(new Headers(init?.headers).get("Authorization") ?? "");
    return refreshAttempts === 1
      ? jsonResponse(problem("TOKEN_EXPIRED", 401, false, "corr-expired"), 401)
      : jsonResponse([]);
  },
  onUnauthorized: async () => {
    refreshCalls += 1;
    refreshToken = "refreshed-token";
    return true;
  },
  retryPolicy: { maxAttempts: 1 },
});
assert.deepEqual(await refreshClient.request<unknown[]>({ operationId: "listInvoices", method: "GET", path: "/invoices" }), []);
assert.equal(refreshCalls, 1, "One canonical 401 coordinates one refresh attempt.");
assert.deepEqual(refreshHeaders, ["Bearer expired-token", "Bearer refreshed-token"], "The replay rebuilds headers with the refreshed access token.");

const semanticExtensionClient = new FetchHttpClient({
  baseUrl: "https://api.example.test",
  accessTokenProvider: { getAccessToken: () => "token" },
  workspaceIdProvider: { getWorkspaceId: () => "ws" },
  fetchImplementation: async () => jsonResponse({ advisory: true }),
});
assert.deepEqual(
  await semanticExtensionClient.request({
    operationId: "requestAiAdvisory",
    method: "POST",
    path: "/ai/advisories",
    body: { question: "next?", locale: "en", contextReferences: { leadId: "lead-1" } },
    contractAuthority: "semantic-extension",
  }),
  { advisory: true },
  "A semantic extension uses its colocated validator instead of pretending to be historical OpenAPI.",
);

const noAuthClient = new FetchHttpClient({ baseUrl: "https://api.example.test", workspaceIdProvider: { getWorkspaceId: () => "ws" }, fetchImplementation });
await assert.rejects(noAuthClient.request({ operationId: "listInvoices", method: "GET", path: "/invoices" }), (error: unknown) => error instanceof ApiClientError && error.code === "AUTHENTICATION_REQUIRED");
const noWorkspaceClient = new FetchHttpClient({ baseUrl: "https://api.example.test", accessTokenProvider: { getAccessToken: () => "token" }, fetchImplementation });
await assert.rejects(noWorkspaceClient.request({ operationId: "listInvoices", method: "GET", path: "/invoices" }), (error: unknown) => error instanceof ApiClientError && error.code === "WORKSPACE_CONTEXT_REQUIRED");

let timeoutAttempts = 0;
const timeoutClient = new FetchHttpClient({ baseUrl: "https://api.example.test", accessTokenProvider: { getAccessToken: () => "token" }, workspaceIdProvider: { getWorkspaceId: () => "ws" }, fetchImplementation: async (_input, init) => { timeoutAttempts += 1; if (init?.signal?.aborted) throw new DOMException("aborted", "AbortError"); return new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true })); }, defaultTimeoutMs: 5, retryPolicy: { maxAttempts: 1 } });
await assert.rejects(timeoutClient.request({ operationId: "listInvoices", method: "GET", path: "/invoices" }), (error: unknown) => error instanceof ApiClientError && error.code === "REQUEST_TIMEOUT" && error.retryable);
assert.equal(timeoutAttempts, 1);
const controller = new AbortController();
const cancelled = timeoutClient.request({ operationId: "listInvoices", method: "GET", path: "/invoices", signal: controller.signal, timeoutMs: 1000 });
controller.abort();
await assert.rejects(cancelled, (error: unknown) => error instanceof ApiClientError && error.code === "REQUEST_CANCELLED");

assert.equal(fallbackApiErrorCode(412), "VERSION_CONFLICT");
const adapterRequests: HttpRequest[] = [];
const adapterClient: HttpClient = { async request<TResponse>(input: HttpRequest): Promise<TResponse> {
  adapterRequests.push(input);
  if (input.operationId === "issueInvoice") return issueResponse as TResponse;
  if (input.operationId === "createPaymentIntent") return createIntentResponse as TResponse;
  if (input.operationId === "sendInvoice") return sendInvoiceResponse as TResponse;
  throw new Error(`Unexpected adapter request: ${input.operationId}`);
} };
const invoiceAdapter = new InvoiceHttpAdapter(adapterClient);
await invoiceAdapter.issue("inv_001", { expectedVersion: 3 });
assert.equal(adapterRequests[0]?.operationId, "issueInvoice");
assert.equal(adapterRequests[0]?.idempotencyKey, "invoice-issue:inv_001:3");
const paymentAdapter = new PaymentHttpAdapter(adapterClient);
const intent = await paymentAdapter.createIntent({
  id: "client-local-intent-1",
  buyerRef: { type: "ORGANIZATION_ACCOUNT", id: "buyer_001" },
  orderId: "order_001",
  invoiceIds: ["inv_001"],
  scheduleLineIds: ["psl_001"],
  amount: { amount: "1000000", currency: "VND" },
  methodCode: "BANK_TRANSFER",
  providerCode: "BANK_A",
  returnContext: { routeKey: "payment-return" },
  checkoutUrl: "https://client.invalid/must-not-be-sent",
  clientPayload: { transient: true },
  expiresAt: "2026-07-25T01:00:00Z",
  idempotencyKey: "intent-1",
  now: "2026-07-25T00:00:00Z",
});
assert.equal(intent.id, "pi_001");
assert.equal(adapterRequests[1]?.operationId, "createPaymentIntent");
assert.equal(adapterRequests[1]?.idempotencyKey, "intent-1");
assert.deepEqual(adapterRequests[1]?.body, {
  buyerRef: { type: "ORGANIZATION_ACCOUNT", id: "buyer_001" },
  orderId: "order_001",
  invoiceIds: ["inv_001"],
  scheduleLineIds: ["psl_001"],
  amount: { amount: "1000000", currency: "VND" },
  methodCode: "BANK_TRANSFER",
  providerCode: "BANK_A",
  returnRouteKey: "payment-return",
});
const sendResult = await invoiceAdapter.send("inv_001", {
  expectedVersion: 4,
  channel: "EMAIL",
  recipient: "buyer@example.test",
  idempotencyKey: "send-1",
});
assert.equal(sendResult.delivery.id, "delivery-1");
// The dedicated adapter must surface the backend's own mutation evidence.
assert.equal(sendResult.evidence.authority, "backend");
assert.equal(sendResult.evidence.commandId, issueResponse.commandId);
assert.equal(adapterRequests[2]?.operationId, "sendInvoice");
assert.equal(adapterRequests[2]?.idempotencyKey, "send-1");
assert.equal(adapterRequests[2]?.expectedVersion, 4);

await initializeApplicationComposition({ mode: "connected", http: { client: adapterClient } });
assert.equal(getApplicationRuntimeMode(), "connected");
assert.equal(getApplicationHttpClient(), adapterClient);
assert.ok(getInvoiceApplicationServices().api instanceof InvoiceHttpAdapter);
await assert.rejects(() => initializeApplicationComposition({ mode: "connected" }), /requires an HTTP client or API base URL/u);

const directFetchViolations = walkAllFiles(path.join(root, "src")).filter((file) => /\.tsx?$/u.test(file)).filter((file) => !file.endsWith("src/platform/api/client/FetchHttpClient.ts")).filter((file) => /\bfetch\s*\(/u.test(fs.readFileSync(file, "utf8"))).map((file) => path.relative(root, file));
assert.deepEqual(directFetchViolations, []);
console.log("HTTP/API foundation: PASS (OpenAPI runtime validation, auth/workspace, retry/idempotency, timeout/cancellation, connected fail-closed).")

function problem(code: string, status: number, retryable: boolean, correlationId: string) { return { type: "urn:unicorecrm:problem", title: code, status, code, retryable, correlationId }; }
function jsonResponse(payload: unknown, status = 200): Response { return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": status >= 400 ? "application/problem+json" : "application/json" } }); }

// Preflight recovery is before the first send, with the same command intent.
let recoveryToken: string | undefined, recoveryOwner = "A:1", recoveryWorkspace = "workspace-A";
let refreshCount = 0, sendCount = 0, finishRefresh: (() => void) | undefined;
const sentIntents: HttpRequest[] = [];
const recoveryClient = new FetchHttpClient({ baseUrl: "https://api.example.test", accessTokenProvider: { getAccessToken: () => recoveryToken },
  workspaceIdProvider: { getWorkspaceId: () => recoveryWorkspace }, getAuthorityKey: () => recoveryOwner,
  onUnauthorized: async () => { refreshCount++; await new Promise<void>((resolve) => { finishRefresh = resolve; }); recoveryToken = "fresh"; return true; },
  fetchImplementation: async (_url, init) => { sendCount++; assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer fresh"); return jsonResponse({ ok: true }); },
});
const readRequest: HttpRequest = { operationId: "fixtureRead", method: "GET", path: "/fixture", contractAuthority: "semantic-extension" };
const concurrentRead = recoveryClient.request(readRequest), secondRead = recoveryClient.request(readRequest);
await new Promise((resolve) => setTimeout(resolve, 0)); assert.equal(refreshCount, 1); assert.equal(sendCount, 0); assert(finishRefresh); finishRefresh();
await Promise.all([concurrentRead, secondRead]); assert.equal(sendCount, 2);
recoveryToken = undefined;
const stableWrite: HttpRequest = { operationId: "fixtureWrite", method: "POST", path: "/fixture", body: { marker: "same-intent" }, idempotencyKey: "intent-fixed", expectedVersion: 7, retry: "never", contractAuthority: "semantic-extension" };
const writeRecovery = recoveryClient.request(stableWrite); sentIntents.push(structuredClone(stableWrite));
await new Promise((resolve) => setTimeout(resolve, 0)); assert(finishRefresh); finishRefresh(); await writeRecovery;
assert.deepEqual(stableWrite, sentIntents[0]); assert.equal(sendCount, 3, "Preflight may send one first write, never duplicate it");
recoveryToken = undefined;
const retiredRequest = recoveryClient.request(readRequest); await new Promise((resolve) => setTimeout(resolve, 0)); recoveryOwner = "B:2"; assert(finishRefresh); finishRefresh();
await assert.rejects(retiredRequest, (e: unknown) => e instanceof ApiClientError && e.code === "REQUEST_CANCELLED"); assert.equal(sendCount, 3);
recoveryToken = undefined;
const changedWorkspace = recoveryClient.request(readRequest); await new Promise((resolve) => setTimeout(resolve, 0)); recoveryWorkspace = "workspace-B"; assert(finishRefresh); finishRefresh();
await assert.rejects(changedWorkspace, (e: unknown) => e instanceof ApiClientError && e.code === "REQUEST_CANCELLED"); assert.equal(sendCount, 3);
recoveryToken = undefined;
const abortRefresh = new AbortController(); const cancelledRefresh = recoveryClient.request({ ...readRequest, signal: abortRefresh.signal });
await new Promise((resolve) => setTimeout(resolve, 0)); abortRefresh.abort();
await assert.rejects(cancelledRefresh, (e: unknown) => e instanceof ApiClientError && e.code === "REQUEST_CANCELLED"); assert(finishRefresh); finishRefresh();
assert.equal(sendCount, 3);
console.log("HTTP preflight recovery: concurrent reads, first-send write, retired actor/workspace and cancellation PASS.");

// Binary decoding is admitted by the generated operation contract, with ordinary error/auth paths intact.
async function pdfRequest(response: Response, operationId = "downloadQuoteDocument") {
  const transport = new FetchHttpClient({ baseUrl: "https://api.example.test", fetchImplementation: async () => response,
    workspaceIdProvider: { getWorkspaceId: () => "synthetic-workspace" },
    accessTokenProvider: { getAccessToken: () => "synthetic-unit-token" } });
  return transport.request<Blob>({ operationId, method: "GET", path: "/quotes/unit/documents/unit/content", retry: "never" });
}
const pdfBlob = await pdfRequest(new Response("%PDF-unit-binary", { headers: { "content-type": "application/pdf" } }));
assert.equal(pdfBlob.type, "application/pdf"); assert.equal(await pdfBlob.text(), "%PDF-unit-binary");
for (const response of [
  new Response("%PDF-unit-binary", { headers: { "content-type": "text/html" } }),
  new Response("not-a-pdf", { headers: { "content-type": "application/pdf" } }),
  new Response("%PDF-unit-binary", { headers: { "content-type": "application/pdf", "content-length": "10485761" } }),
]) await assert.rejects(pdfRequest(response), (e: unknown) => e instanceof ApiClientError);
await assert.rejects(pdfRequest(jsonResponse(problem("ACCESS_DENIED", 403, false, "unit-pdf-denied"), 403)),
  (e: unknown) => e instanceof ApiClientError && e.code === "ACCESS_DENIED");
await assert.rejects(pdfRequest(new Response("%PDF-unit-binary", { headers: { "content-type": "application/pdf" } }), "getQuote"),
  (e: unknown) => e instanceof ApiClientError);
console.log("Generated PDF transport: PASS (bounded binary, invalid media/header, JSON errors, no generic bypass)");

// B6.1 raw binary request selection remains contract-bound and preserves transport authority.
const proofReceipt = { commandId: "command_unit", correlationId: "correlation_unit", aggregateId: "case_unit", aggregateType: "QUOTE_ACCEPTANCE_CASE", version: 2,
  occurredAt: "2026-10-26T00:00:00.000Z", outcome: "COMMITTED", eventIds: ["event_unit"], auditIds: ["audit_unit"], result: {
    case: { caseId: "case_unit", quoteId: "quote_unit", rootQuoteId: "quote_unit", quoteRevision: 1, documentId: "document_unit", createdBy: "actor_unit",
      commercialContentFingerprint: "A".repeat(64), pdfSha256: "B".repeat(64), buyerRef: { type: "CONTACT", id: "buyer_unit" }, caseStatus: "QUARANTINED", createdAt: "2026-10-26T00:00:00.000Z", resourceVersion: 2 },
  } };
const proofPayload = new Blob(["%PDF-1.7\nSAFE SYNTHETIC\n%%EOF"], { type: "application/pdf" });
let binarySends = 0, binaryRefreshes = 0;
const binaryUpload = new FetchHttpClient({ baseUrl: "https://api.example.test", accessTokenProvider: { getAccessToken: () => "unit-token" },
  workspaceIdProvider: { getWorkspaceId: () => "unit-workspace" }, onUnauthorized: () => { binaryRefreshes++; return true; },
  fetchImplementation: async (_url, init) => {
    binarySends++; assert.equal(init?.body, proofPayload); const headers = new Headers(init?.headers);
    assert.equal(headers.get("Content-Type"), "application/pdf"); assert.equal(headers.get("X-Workspace-Id"), "unit-workspace");
    assert.equal(headers.get("Authorization"), "Bearer unit-token"); assert.equal(headers.get("If-Match"), '\"1\"');
    assert.equal(headers.get("Idempotency-Key"), "proof-intent-unit");
    return binarySends === 1 ? jsonResponse(problem("AUTHENTICATION_REQUIRED", 401, false, "unit-401"), 401) : jsonResponse(proofReceipt, 201);
  } });
const uploadInput: HttpRequest<Blob> = { operationId: "uploadQuoteAcceptanceProof", method: "POST", path: "/quotes/quote_unit/acceptance-cases/case_unit/proofs", body: proofPayload,
  idempotencyKey: "proof-intent-unit", expectedVersion: 1, headers: { "X-Proof-File-Name": "unit.pdf", "X-Proof-Evidence-Type": "SUPPORTING_DOCUMENT" }, retry: "idempotent" };
await binaryUpload.request(uploadInput); assert.equal(binarySends, 2); assert.equal(binaryRefreshes, 1);
await assert.rejects(binaryUpload.request({ ...uploadInput, body: new Blob(["bad"], { type: "text/html" }) }), (e: unknown) => e instanceof ApiClientError);
await assert.rejects(binaryUpload.request({ ...uploadInput, body: { isClean: true } }), (e: unknown) => e instanceof ApiClientError);
assert.equal(binarySends, 2, "Invalid proof inputs must fail before network send");
console.log("B6.1 binary upload: generated schema, raw Blob, auth/workspace, stable refresh replay and invalid-input controls PASS");
