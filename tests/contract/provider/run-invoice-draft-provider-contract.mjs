import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const required = [
  "UNICORECRM_TEST_API_BASE_URL",
  "UNICORECRM_TEST_ACCESS_TOKEN",
  "UNICORECRM_TEST_WORKSPACE_ID",
  "UNICORECRM_TEST_INVOICE_ORDER_ID",
  "UNICORECRM_TEST_SECONDARY_ACCESS_TOKEN",
  "UNICORECRM_TEST_SECONDARY_WORKSPACE_ID",
];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  console.error(`[invoice-provider] BLOCKED_EXTERNAL missing environment: ${missing.join(", ")}`);
  process.exitCode = 2;
} else {
  await run();
}

async function run() {
  const baseUrl = process.env.UNICORECRM_TEST_API_BASE_URL.replace(/\/$/u, "");
  const workspaceId = process.env.UNICORECRM_TEST_WORKSPACE_ID;
  const token = process.env.UNICORECRM_TEST_ACCESS_TOKEN;
  const secondaryToken = process.env.UNICORECRM_TEST_SECONDARY_ACCESS_TOKEN;
  const secondaryWorkspaceId = process.env.UNICORECRM_TEST_SECONDARY_WORKSPACE_ID;
  const createTemplate = fixture("invoice-draft/create-request.json");
  createTemplate.sourceLinks.orderId = process.env.UNICORECRM_TEST_INVOICE_ORDER_ID;
  const createKey = `provider-invoice-create-${randomUUID()}`;

  const created = await request("POST", `${baseUrl}/v1/invoices/drafts`, {
    token,
    workspaceId,
    idempotencyKey: createKey,
    body: createTemplate,
    expectedStatus: 201,
  });
  assertMutationEnvelope(created, "createInvoiceDraft");
  assert(created.aggregateId !== createTemplate.creationIntentId, "createInvoiceDraft reused client creationIntentId as aggregateId");
  assertCalculatedTotals(created.result, "createInvoiceDraft");

  const replayed = await request("POST", `${baseUrl}/v1/invoices/drafts`, {
    token,
    workspaceId,
    idempotencyKey: createKey,
    body: createTemplate,
    expectedStatus: 201,
  });
  assertMutationEnvelope(replayed, "createInvoiceDraft replay");
  assert(replayed.outcome === "REPLAYED", "same-key/same-payload must return REPLAYED");
  assert(replayed.commandId === created.commandId, "replay must preserve commandId");
  assert(replayed.aggregateId === created.aggregateId, "replay must preserve aggregateId");

  const changedCreate = structuredClone(createTemplate);
  changedCreate.paymentTerms = `${changedCreate.paymentTerms ?? ""} changed`;
  await expectProblem("POST", `${baseUrl}/v1/invoices/drafts`, {
    token,
    workspaceId,
    idempotencyKey: createKey,
    body: changedCreate,
    expectedStatus: 409,
    expectedCode: "IDEMPOTENCY_KEY_REUSED",
  });

  const saveBody = fixture("invoice-draft/save-request.json");
  saveBody.lines[0].lineId = created.result.lines[0].id;
  const saveKey = `provider-invoice-save-${randomUUID()}`;
  const saved = await request("PATCH", `${baseUrl}/v1/invoices/${encodeURIComponent(created.aggregateId)}/draft`, {
    token,
    workspaceId,
    idempotencyKey: saveKey,
    expectedVersion: created.version,
    body: saveBody,
    expectedStatus: 200,
  });
  assertMutationEnvelope(saved, "saveInvoiceDraft");
  assert(saved.aggregateId === created.aggregateId, "saveInvoiceDraft changed aggregateId");
  assert(saved.version > created.version, "saveInvoiceDraft did not advance version");
  assertCalculatedTotals(saved.result, "saveInvoiceDraft");

  await expectProblem("PATCH", `${baseUrl}/v1/invoices/${encodeURIComponent(created.aggregateId)}/draft`, {
    token,
    workspaceId,
    idempotencyKey: `${saveKey}-stale`,
    expectedVersion: created.version,
    body: saveBody,
    expectedStatus: 412,
    expectedCode: "VERSION_CONFLICT",
  });

  const injected = structuredClone(saveBody);
  injected.totals = { grandTotal: { amount: "1", currency: "VND" } };
  await expectProblem("PATCH", `${baseUrl}/v1/invoices/${encodeURIComponent(created.aggregateId)}/draft`, {
    token,
    workspaceId,
    idempotencyKey: `${saveKey}-mass-assignment`,
    expectedVersion: saved.version,
    body: injected,
    expectedStatus: 422,
    expectedCode: "VALIDATION_FAILED",
  });

  await expectProblem("GET", `${baseUrl}/v1/invoices/${encodeURIComponent(created.aggregateId)}`, {
    token: secondaryToken,
    workspaceId: secondaryWorkspaceId,
    expectedStatus: 403,
    expectedCode: "WORKSPACE_MISMATCH",
  });

  const issueKey = `provider-invoice-issue-${randomUUID()}`;
  const issued = await request("POST", `${baseUrl}/v1/invoices/${encodeURIComponent(created.aggregateId)}/issue`, {
    token,
    workspaceId,
    idempotencyKey: issueKey,
    expectedVersion: saved.version,
    body: { expectedVersion: saved.version },
    expectedStatus: 200,
  });
  assertMutationEnvelope(issued, "issueInvoice");
  assert(issued.result.lifecycleState === "ISSUED", "issueInvoice did not return ISSUED state");
  assert(typeof issued.result.invoiceNumber === "string" && issued.result.invoiceNumber.length > 0, "issueInvoice did not return an authoritative invoice number");
  assert(Array.isArray(issued.auditEvidenceIds) && issued.auditEvidenceIds.length > 0, "issueInvoice did not return audit evidence IDs");

  console.log("[invoice-provider] PASS create/replay/save/conflict/isolation/issue provider contract");
}

function fixture(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/backend-contract", relativePath), "utf8"));
}

async function request(method, url, options) {
  const headers = {
    Accept: "application/json, application/problem+json",
    Authorization: `Bearer ${options.token}`,
    "X-Workspace-Id": options.workspaceId,
    "X-Request-Id": `provider-${cryptoRandom()}`,
  };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;
  if (options.expectedVersion !== undefined) headers["If-Match"] = String(options.expectedVersion);
  const response = await fetch(url, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("json") ? await response.json() : await response.text();
  if (response.status !== options.expectedStatus) {
    throw new Error(`${method} ${url}: expected ${options.expectedStatus}, received ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function expectProblem(method, url, options) {
  const problem = await request(method, url, options);
  assert(problem && typeof problem === "object", `${method} ${url}: Problem Details body missing`);
  assert(problem.status === options.expectedStatus, `${method} ${url}: Problem Details status mismatch`);
  assert(problem.code === options.expectedCode, `${method} ${url}: expected ${options.expectedCode}, received ${problem.code}`);
  assert(typeof problem.correlationId === "string" && problem.correlationId.length > 0, `${method} ${url}: correlationId missing`);
}

function assertMutationEnvelope(value, operationId) {
  assert(value && typeof value === "object", `${operationId}: response is not an object`);
  for (const field of ["commandId", "correlationId", "aggregateId", "aggregateType", "occurredAt"]) {
    assert(typeof value[field] === "string" && value[field].length > 0, `${operationId}: ${field} missing`);
  }
  assert(Number.isInteger(value.version) && value.version > 0, `${operationId}: version missing`);
  assert(["COMMITTED", "REPLAYED"].includes(value.outcome), `${operationId}: invalid outcome`);
  assert(value.result && typeof value.result === "object", `${operationId}: typed result missing`);
  assert(value.result.id === value.aggregateId, `${operationId}: result.id differs from aggregateId`);
}

function assertCalculatedTotals(invoice, operationId) {
  assert(invoice.totals && invoice.totals.grandTotal, `${operationId}: calculated totals missing`);
  assert(invoice.lines.every((line) => line.discountAmount && line.taxAmount && line.lineTotal), `${operationId}: calculated line amounts missing`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function cryptoRandom() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
