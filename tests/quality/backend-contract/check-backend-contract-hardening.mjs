import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";

const root = repositoryRoot;
const gate = process.argv[2];
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const json = (p) => JSON.parse(read(p));
const exists = (p) => fs.existsSync(path.join(root, p));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const spec = json("docs/api/openapi.json");
const schemas = spec.components.schemas;
const operations = [];
for (const [route, item] of Object.entries(spec.paths)) {
  for (const method of ["get", "post", "put", "patch", "delete"]) {
    const op = item[method];
    if (op) operations.push({ route, method: method.toUpperCase(), ...op });
  }
}
const opById = new Map(operations.map((op) => [op.operationId, op]));
const derefName = (ref) => typeof ref === "string" ? ref.split("/").at(-1) : undefined;
const resolveParameter = (p) => p.$ref ? spec.components.parameters[derefName(p.$ref)] : p;
const parameters = (op) => (op.parameters ?? []).map(resolveParameter);
const successResponse = (op) => Object.entries(op.responses ?? {}).find(([code]) => /^2\d\d$/.test(code));
const requestSchemaName = (op) => derefName(op.requestBody?.content?.["application/json"]?.schema?.$ref);
const responseSchemaName = (op) => derefName(successResponse(op)?.[1]?.content?.["application/json"]?.schema?.$ref);
const readyNonGetOperations = operations.filter((op) => op["x-contract-status"] === "PRODUCTION_CONTRACT_READY" && op.method !== "GET");
const readyMutations = readyNonGetOperations.filter((op) => !String(op["x-transaction-boundary"] ?? "").startsWith("READ_ONLY"));

function validate(schemaOrRef, value, where = "$", stack = new Set()) {
  const issues = [];
  function walk(schema, current, at) {
    if (!schema) { issues.push(`${at}: missing schema`); return; }
    if (schema.$ref) {
      const name = derefName(schema.$ref);
      if (stack.has(name)) return;
      stack.add(name); walk(schemas[name], current, at); stack.delete(name); return;
    }
    for (const item of schema.allOf ?? []) walk(item, current, at);
    if (schema.oneOf) {
      const matches = schema.oneOf.filter((item) => validate(item, current, at, new Set(stack)).length === 0).length;
      if (matches !== 1) issues.push(`${at}: oneOf matched ${matches}`);
    }
    if (schema.anyOf && !schema.anyOf.some((item) => validate(item, current, at, new Set(stack)).length === 0)) issues.push(`${at}: anyOf failed`);
    if (schema.const !== undefined && current !== schema.const) issues.push(`${at}: const mismatch`);
    if (schema.enum && !schema.enum.includes(current)) issues.push(`${at}: unknown enum ${JSON.stringify(current)}`);
    const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
    if (types.length && !types.some((t) => matchesType(current, t))) { issues.push(`${at}: expected ${types.join("|")}`); return; }
    const effective = types.find((t) => t !== "null") ?? (schema.properties || schema.additionalProperties !== undefined ? "object" : schema.items ? "array" : undefined);
    if (effective === "object" && current && typeof current === "object" && !Array.isArray(current)) {
      for (const key of schema.required ?? []) if (!(key in current) || current[key] === undefined) issues.push(`${at}.${key}: required`);
      const props = schema.properties ?? {};
      for (const [key, item] of Object.entries(current)) {
        if (props[key]) walk(props[key], item, `${at}.${key}`);
        else if (schema.additionalProperties === false) issues.push(`${at}.${key}: additional property`);
        else if (schema.additionalProperties && typeof schema.additionalProperties === "object") walk(schema.additionalProperties, item, `${at}.${key}`);
      }
    }
    if (effective === "array" && Array.isArray(current)) {
      if (schema.minItems !== undefined && current.length < schema.minItems) issues.push(`${at}: minItems`);
      if (schema.maxItems !== undefined && current.length > schema.maxItems) issues.push(`${at}: maxItems`);
      current.forEach((item, i) => schema.items && walk(schema.items, item, `${at}[${i}]`));
    }
    if (effective === "string" && typeof current === "string") {
      if (schema.minLength !== undefined && current.length < schema.minLength) issues.push(`${at}: minLength`);
      if (schema.maxLength !== undefined && current.length > schema.maxLength) issues.push(`${at}: maxLength`);
      if (schema.pattern && !new RegExp(schema.pattern, "u").test(current)) issues.push(`${at}: pattern`);
      if (schema.format === "date-time" && (!current.endsWith("Z") || Number.isNaN(Date.parse(current)))) issues.push(`${at}: UTC date-time`);
      if (schema.format === "date" && !/^\d{4}-\d{2}-\d{2}$/u.test(current)) issues.push(`${at}: date`);
    }
    if ((effective === "number" || effective === "integer") && typeof current === "number") {
      if (!Number.isFinite(current)) issues.push(`${at}: finite`);
      if (effective === "integer" && !Number.isInteger(current)) issues.push(`${at}: integer`);
      if (schema.minimum !== undefined && current < schema.minimum) issues.push(`${at}: minimum`);
      if (schema.maximum !== undefined && current > schema.maximum) issues.push(`${at}: maximum`);
    }
  }
  walk(schemaOrRef, value, where);
  return issues;
}
function matchesType(v, t) {
  if (t === "null") return v === null;
  if (t === "object") return Boolean(v && typeof v === "object" && !Array.isArray(v));
  if (t === "array") return Array.isArray(v);
  if (t === "string") return typeof v === "string";
  if (t === "number") return typeof v === "number" && Number.isFinite(v);
  if (t === "integer") return typeof v === "number" && Number.isInteger(v);
  if (t === "boolean") return typeof v === "boolean";
  return true;
}
function filesUnder(dir, extensions = /\.(?:ts|tsx|mts|mjs)$/u) {
  const base = path.join(root, dir);
  if (!fs.existsSync(base)) return [];
  return walkAllFiles(base)
    .filter((file) => extensions.test(path.basename(file)))
    .map((file) => path.relative(root, file).replaceAll(path.sep, "/"));
}

const checks = {
  "openapi-syntax": () => {
    assert(spec.openapi === "3.1.0", "OpenAPI must be 3.1.0");
    assert(spec["x-contract-authority"] === "OPENAPI", "OpenAPI authority marker missing");
    assert(operations.length === 270, `Expected 270 operations, found ${operations.length}`);
  },
  "openapi-lint": () => {
    for (const op of operations) {
      for (const key of ["operationId", "x-contract-status", "x-module-owner", "x-required-capability", "x-resource-scope", "x-data-scope", "x-idempotency-policy", "x-concurrency-policy", "x-audit-requirement", "x-transaction-boundary", "x-error-codes"]) assert(op[key] !== undefined, `${op.operationId}: missing ${key}`);
      const status = op["x-contract-status"];
      assert(["PRODUCTION_CONTRACT_READY", "BLOCKED"].includes(status), `${op.operationId}: invalid status`);
      if (status === "BLOCKED") {
        assert(!op.requestBody, `${op.operationId}: blocked operation has request body`);
        assert(!successResponse(op), `${op.operationId}: blocked operation has success response`);
        assert(op["x-blocking-decision-id"], `${op.operationId}: blocked operation has no decision`);
      } else {
        assert(successResponse(op), `${op.operationId}: ready operation has no 2xx`);
        assert(responseSchemaName(op), `${op.operationId}: ready response must use named schema`);
        if (op.method !== "GET") assert(["MUST_MATCH_TARGET", "SERVER_ASSIGNED"].includes(op["x-aggregate-id-policy"]), `${op.operationId}: aggregate ID policy missing`);
      }
    }
    const runtimeContract = read("src/platform/api/contracts/generatedOpenApiRuntimeContract.ts");
    assert(runtimeContract.includes(`OPENAPI_RUNTIME_CONTRACT_VERSION = ${JSON.stringify(spec.info.version)}`), "Generated runtime contract version drifted from OpenAPI");
    for (const operation of operations) {
      const expected = `${JSON.stringify(operation.operationId)}:{"contractStatus":${JSON.stringify(operation["x-contract-status"])}`;
      assert(runtimeContract.includes(expected), `${operation.operationId}: generated runtime status drifted from OpenAPI`);
    }
    const moduleAuthority = read("src/platform/api/runtime/HttpModuleDataAuthority.ts");
    assert(moduleAuthority.includes("OPENAPI_RUNTIME_CONTRACT_VERSION") && !/openapi-0\.13\.0-contract\.0/u.test(moduleAuthority), "Connected query authority hard-codes a stale OpenAPI version");
    const decisionLedger = json("docs/backend-readiness/unresolved-decisions.json");
    const operationDecisionPairs = (decisionLedger.operationDecisions ?? []).flatMap((decision) =>
      (decision.blockingOperations ?? []).map((operationId) => ({ operationId, decision })),
    );
    const decisionByOperationId = new Map(operationDecisionPairs.map((item) => [item.operationId, item.decision]));
    assert(decisionByOperationId.size === operationDecisionPairs.length, "Blocked operation appears in multiple decision entries");
    for (const op of operations) {
      const decision = decisionByOperationId.get(op.operationId);
      if (op["x-contract-status"] === "BLOCKED") {
        assert(decision?.status === "BLOCKED", `${op.operationId}: blocked decision ledger entry missing`);
        assert(decision.decisionId === op["x-blocking-decision-id"], `${op.operationId}: blocking decision ID drifted`);
      } else {
        assert(!decision, `${op.operationId}: production-ready operation remains blocked in decision ledger`);
      }
    }
  },
  "breaking-change-detection": () => {
    const baseline = json("docs/api/openapi-breaking-baseline.json");
    const ledger = json("docs/backend-readiness/remediation-ledger.json");
    assert(baseline.contractVersion === spec.info.version, "Breaking baseline does not match contract version");
    assert(ledger.findings.some((finding) => finding.ID === "H-01" && finding.remediationStatus === "CLOSED"), "Generic contract breaking remediation is not recorded");
  },
  "no-generic-mutation-payload": () => {
    for (const op of readyNonGetOperations) {
      const name = requestSchemaName(op); assert(name, `${op.operationId}: missing typed request schema`);
      const schema = schemas[name]; assert(schema && schema.type === "object", `${op.operationId}: request is not object schema`);
      assert(schema.additionalProperties !== true, `${op.operationId}: request has additionalProperties true`);
      assert(!["CommandPayload", "JsonObject"].includes(name), `${op.operationId}: generic request schema`);
    }
    assert(!schemas.CommandPayload, "CommandPayload remains");
  },
  "no-generic-mutation-result": () => {
    for (const op of readyMutations) {
      const name = responseSchemaName(op); const schema = schemas[name];
      assert(schema && schema.additionalProperties === false, `${op.operationId}: response envelope must be closed`);
      assert(!schema.properties?.data, `${op.operationId}: generic data property remains`);
      if (op.tags?.includes("Identity")) {
        assert(Object.keys(schema.properties ?? {}).length > 0, `${op.operationId}: authoritative identity response is empty`);
        continue;
      }
      assert(schema.properties?.result, `${op.operationId}: typed result missing`);
      const resultName = derefName(schema.properties.result.$ref);
      assert(resultName && !["JsonObject", "JsonObjectList"].includes(resultName), `${op.operationId}: generic result schema`);
      assert(schemas[resultName]?.additionalProperties !== true, `${op.operationId}: open result projection`);
    }
    assert(!schemas.CommandMutationResponse, "CommandMutationResponse remains");
  },
  "command-registry": () => {
    const d = json("docs/backend-readiness/command-registry.json");
    assert(d.commands.length === 173, `Expected 173 commands, found ${d.commands.length}`);
    assert(new Set(d.commands.map((x) => x.stableCommandId)).size === 173, "Command IDs are not unique");
    for (const c of d.commands) assert(d.allowedStatuses.includes(c.status), `${c.commandType}: invalid status`);
  },
  "query-registry": () => {
    const d = json("docs/backend-readiness/query-registry.json");
    assert(d.queries.length === 162, `Expected 162 queries, found ${d.queries.length}`);
    assert(new Set(d.queries.map((x) => x.stableQueryId)).size === 162, "Query IDs are not unique");
    assert(d.moduleAuthorityQueries.length === 15, "Expected 15 module query decisions");
  },
  "operation-id-uniqueness": () => assert(new Set(operations.map((x) => x.operationId)).size === operations.length, "Duplicate operationId"),
  "command-operation-one-to-one": () => {
    const commands = json("docs/backend-readiness/command-registry.json").commands;
    const mapped = [];
    for (const c of commands) {
      if (c.status === "PRODUCTION_CONTRACT_READY") { assert(c.openApiOperationId && opById.get(c.openApiOperationId)?.["x-contract-status"] === "PRODUCTION_CONTRACT_READY", `${c.commandType}: invalid operation`); mapped.push(c.openApiOperationId); }
      else assert(!c.openApiOperationId, `${c.commandType}: blocked/local command maps to production operation`);
    }
    assert(new Set(mapped).size === mapped.length, "Multiple commands map to one production operation");
  },
  "authorization-matrix": () => {
    const rows = json("docs/backend-readiness/operation-authorization-matrix.json").operations;
    assert(rows.length === 270, "Authorization matrix incomplete");
    const ids = new Set(rows.map((x) => x.operationId));
    for (const op of operations) { assert(ids.has(op.operationId), `${op.operationId}: auth row missing`); assert(op["x-required-capability"] !== "UNRESOLVED", `${op.operationId}: capability unresolved`); if (op.tags?.includes("Identity")) assert(op["x-workspace-required"] === false && op["x-data-scope"] === "GLOBAL_IDENTITY", `${op.operationId}: identity scope invalid`); else if (op.tags?.includes("WorkspaceBootstrap")) assert(op["x-workspace-required"] === false && ["GLOBAL_IDENTITY", "SELECTED_WORKSPACE"].includes(op["x-data-scope"]), `${op.operationId}: workspace bootstrap scope invalid`); else assert(op["x-workspace-required"] === true, `${op.operationId}: workspace boundary missing`); }
  },
  "idempotency-policy": () => {
    const rows = json("docs/backend-readiness/idempotency-policy.json").operations;
    assert(rows.length === 270, "Idempotency matrix incomplete");
    for (const op of operations.filter((x) => x["x-contract-status"] === "PRODUCTION_CONTRACT_READY" && x.method !== "GET")) {
      assert(["REQUIRED", "OPTIONAL", "NOT_APPLICABLE"].includes(op["x-idempotency-policy"]), `${op.operationId}: invalid idempotency policy`);
      if (op["x-idempotency-policy"] === "REQUIRED") assert(parameters(op).some((p) => p.in === "header" && p.name === "Idempotency-Key" && p.required), `${op.operationId}: required header missing`);
    }
  },
  "concurrency-policy": () => {
    const rows = json("docs/backend-readiness/concurrency-policy.json").operations;
    assert(rows.length === 270, "Concurrency matrix incomplete");
    for (const op of operations.filter((x) => x["x-contract-status"] === "PRODUCTION_CONTRACT_READY")) {
      assert(op["x-concurrency-policy"], `${op.operationId}: concurrency policy missing`);
      if (op["x-concurrency-policy"] === "IF_MATCH_REQUIRED") assert(parameters(op).some((p) => p.in === "header" && p.name === "If-Match" && p.required), `${op.operationId}: If-Match missing`);
    }
  },
  "error-catalog": () => {
    const d = json("docs/backend-readiness/error-catalog.json"); const codes = new Set(d.errors.map((x) => x.code));
    assert(d.mediaType === "application/problem+json" && codes.size === schemas.ErrorCode.enum.length, "Error catalog incomplete");
    for (const op of operations) for (const code of op["x-error-codes"]) assert(codes.has(code), `${op.operationId}: unknown error ${code}`);
    for (const op of operations.filter((x) => x["x-contract-status"] === "PRODUCTION_CONTRACT_READY" && (x.security ?? spec.security ?? []).length > 0)) { assert(op.responses["401"] && op.responses["403"], `${op.operationId}: auth errors missing`); }
  },
  "money-contract": () => {
    assert(schemas.Money.type === "object" && schemas.Money.additionalProperties === false, "Money must be a closed object");
    assert(schemas.DecimalAmount.type === "string" && schemas.DecimalAmount["x-maximum-scale"] === 6, "DecimalAmount must be string scale 6");
    assert(schemas.Money["x-rounding-mode"] === "HALF_UP", "Rounding mode missing");
    const source = read("src/shared/money/money.ts"); assert(source.includes("amount: string") && source.includes("bigint"), "Frontend canonical money is not decimal-string based");
    for (const [name, schema] of Object.entries(schemas)) for (const [key, prop] of Object.entries(schema.properties ?? {})) if (/(amount|price|total|tax|discount|rate)$/iu.test(key)) assert(prop.type !== "number", `${name}.${key}: production monetary number`);
    const queryRegistry = read("src/platform/api/contracts/generatedProductionQueryRegistry.ts");
    const mapperRegistry = read("src/app/composition/connectedModuleQueryResponseMappers.ts");
    for (const moduleKey of ["leads", "products"]) {
      const row = queryRegistry.split("\n").find((line) => line.includes(`key: "${moduleKey}"`));
      assert(row?.includes("list:") && row.includes("detail:"), `${moduleKey}: typed OpenAPI read authority is not reachable`);
      assert(mapperRegistry.includes(`${moduleKey}:`), `${moduleKey}: application DTO Money mapper missing`);
    }
    for (const moduleKey of ["deals", "orders", "payments", "quotes"]) {
      const row = queryRegistry.split("\n").find((line) => line.includes(`key: "${moduleKey}"`));
      assert(row?.includes("list:") && row.includes("detail:"), `${moduleKey}: typed commercial read model is not reachable`);
    }
    for (const schemaName of ["DealReadModel", "QuoteReadModel", "OrderReadModel", "PaymentRecordDocument", "PaymentRecordDetailResponse"]) {
      assert(schemas[schemaName]?.additionalProperties === false, `${schemaName}: closed read model contract missing`);
    }
    assert(schemas.PaymentRecordDocument.properties.resourceVersion && schemas.PaymentRecordDocument.properties.amount.$ref.endsWith("/Money"), "Payment ledger Money/read version contract missing");
    const paymentAdapter = read("src/modules/payments/infrastructure/http/PaymentHttpAdapter.ts");
    const paymentMapper = read("src/modules/payments/infrastructure/http/paymentPlanIntentDtoMapper.ts");
    assert(paymentAdapter.includes("paymentPlanIntentDtoMapper") && !paymentAdapter.includes("blockedMoneyProjection"), "Typed Payment Plan/Intent DTO boundary is not active");
    assert(!/parseFloat|Number\s*\(/u.test(paymentAdapter + paymentMapper), "Payment connected money projection uses floating point conversion");
  },
  "connected-concurrency-source": () => {
    for (const file of [
      "src/workflows/quote-acceptance/index.ts",
      "src/workflows/order-confirmation/index.ts",
      "src/workflows/order-cancellation/index.ts",
    ]) {
      const source = read(file);
      assert(!/expectedVersion:\s*metadata\.expectedVersion\s*\?\?/u.test(source), `${file}: connected If-Match falls back to a browser/demo projection`);
      assert(source.includes("createMutationMetadata") && source.includes("metadata"), `${file}: caller-supplied concurrency metadata boundary missing`);
    }
    for (const [schemaName, forbidden] of Object.entries({
      AcceptedQuoteTransactionResult: ["quoteVersion", "dealVersion"],
      ConfirmedOrderTransactionResult: ["orderVersion", "dealVersion"],
      CancelledOrderTransactionResult: ["orderVersion"],
    })) {
      for (const field of forbidden) assert(!schemas[schemaName].properties?.[field], `${schemaName}.${field}: duplicates an authoritative mutation envelope or unresolved secondary version`);
    }
  },
  "connected-fail-closed": () => {
    const mutation = read("src/platform/api/runtime/RoutedHttpMutationAuthority.ts");
    const query = read("src/platform/api/runtime/HttpModuleDataAuthority.ts");
    assert(mutation.includes("PRODUCTION_COMMAND_CONTRACTS") && !mutation.includes("workflowBasePath") && !mutation.includes("commandPath"), "Mutation authority is not registry-only");
    assert(query.includes("PRODUCTION_MODULE_QUERY_DEFINITIONS") && !query.includes("/${module"), "Query authority infers generic endpoints");
    assert(!/localStorage|InMemory|BrowserRepository/u.test(mutation + query), "Connected authority falls back to browser/demo persistence");
  },
  "no-server-evidence-generation": () => {
    const source = read("src/platform/api/runtime/RoutedHttpMutationAuthority.ts");
    assert(!/randomUUID|new Date\(|Date\.now|Math\.random/u.test(source), "Connected mutation authority generates server-like evidence");
    for (const token of ["commandId", "correlationId", "occurredAt", "version"]) assert(source.includes(token) && source.includes("Mutation response is missing authoritative"), `Mutation outcome does not require ${token}`);
  },
  "workflow-ownership": () => {
    const d = json("docs/backend-readiness/workflow-ownership.json");
    assert(d.workflows.length === 27, "Expected 27 workflows");
    for (const w of d.workflows) { assert(w.ownershipDecision !== "UNRESOLVED", `${w.name}: unresolved workflow`); assert(w.connectedFrontendCoordinatorAllowed === false, `${w.name}: connected coordinator allowed`); }
  },
  "no-production-transaction-coordinator": () => {
    const files = filesUnder("src").filter((p) => p.includes("/infrastructure/http/") || p.startsWith("src/platform/api/"));
    const violations = files.filter((p) => /snapshotRollback|restoreSnapshot|rollbackSnapshot|beginTransaction/u.test(read(p)));
    assert(violations.length === 0, `Connected transaction coordinator remains: ${violations.join(", ")}`);
  },
  "generated-client-boundary": () => {
    const violations = [];
    for (const p of filesUnder("src")) {
      const s = read(p);
      if (!s.includes("@/platform/api") && !s.includes("shared/api/generated")) continue;
      if (p.includes("/presentation/") || p.includes("/application/")) violations.push(p);
    }
    assert(violations.length === 0, `Generated clients imported outside infrastructure/composition: ${violations.join(", ")}`);
  },
  "endpoint-literal-ownership": () => {
    const d = json("docs/backend-readiness/endpoint-ownership.json");
    assert(d.handwrittenCount === 0, "Handwritten production endpoint literals remain");
    assert(read("scripts/api/openapi/write-or-check.mjs").includes("assertEndpointAuthority"), "Endpoint authority check missing");
  },
  "fixture-schema-validation": () => {
    const fixtures = [
      ["InvoiceDraftCreateRequest", "invoice-draft/create-request.json"],
      ["InvoiceDraftMutationResponse", "invoice-draft/create-success.json"],
      ["InvoiceDraftSaveRequest", "invoice-draft/save-request.json"],
      ["InvoiceDraftMutationResponse", "invoice-draft/save-success.json"],
      ["InvoiceIssueRequest", "issue-invoice-request.json"],
      ["IssueInvoiceResponse", "issue-invoice-success.json"],
      ["AcceptQuoteTransactionRequest", "transaction-semantics/quote-accept-request.json"],
      ["AcceptQuoteTransactionResponse", "transaction-semantics/quote-accept-success.json"],
      ["ConfirmOrderWithPaymentPlanRequest", "transaction-semantics/order-confirm-request.json"],
      ["ConfirmOrderWithPaymentPlanResponse", "transaction-semantics/order-confirm-success.json"],
      ["CancelOrderRequest", "transaction-semantics/order-cancel-request.json"],
      ["CancelOrderResponse", "transaction-semantics/order-cancel-success.json"],
      ["ReconcilePaymentRecordRequest", "transaction-semantics/payment-reconcile-request.json"],
      ["ReconcilePaymentRecordResponse", "transaction-semantics/payment-reconcile-success.json"],
      ["ProblemDetails", "transaction-semantics/problem-credit-approval-required.json"],
      ["ProblemDetails", "transaction-semantics/problem-order-cancellation-blocked.json"],
    ];
    for (const [schemaName, fixturePath] of fixtures) {
      const issues = validate(schemas[schemaName], json(`tests/fixtures/backend-contract/${fixturePath}`));
      assert(issues.length === 0, `${fixturePath}: ${issues.join("; ")}`);
    }
  },
  "invoice-draft-contract": () => {
    const create = opById.get("createInvoiceDraft");
    const save = opById.get("saveInvoiceDraft");
    const issue = opById.get("issueInvoice");
    assert(create?.["x-contract-status"] === "PRODUCTION_CONTRACT_READY" && create["x-aggregate-id-policy"] === "SERVER_ASSIGNED", "createInvoiceDraft authority incomplete");
    assert(save?.["x-contract-status"] === "PRODUCTION_CONTRACT_READY" && save["x-concurrency-policy"] === "IF_MATCH_REQUIRED", "saveInvoiceDraft authority incomplete");
    assert(issue?.["x-contract-status"] === "PRODUCTION_CONTRACT_READY" && issue["x-concurrency-policy"] === "IF_MATCH_REQUIRED", "issueInvoice authority incomplete");
    for (const schemaName of ["InvoiceDraftCreateRequest", "InvoiceDraftSaveRequest"]) {
      const properties = schemas[schemaName].properties ?? {};
      for (const forbidden of ["id", "invoiceId", "invoiceNumber", "lifecycleState", "version", "totals", "createdAt", "updatedAt", "issuedAt", "auditEvidenceIds"]) {
        assert(!properties[forbidden], `${schemaName}: server-owned field ${forbidden} is client writable`);
      }
    }
    const port = read("src/modules/invoices/application/ports/InvoiceApiPort.ts");
    assert(port.includes("InvoiceDraftLineInput") && !/InvoiceDraftEditableFields[\s\S]{0,600}totals/u.test(port), "Invoice port still accepts authoritative totals");
    const adapter = read("src/modules/invoices/infrastructure/InMemoryInvoiceApiAdapter.ts");
    assert(adapter.includes("calculateInvoiceTotals") && adapter.includes("buildDraftLines"), "Demo adapter does not model backend calculation ownership");
  },
  "aggregate-id-authority": () => {
    for (const op of readyMutations) assert(["MUST_MATCH_TARGET", "SERVER_ASSIGNED"].includes(op["x-aggregate-id-policy"]), `${op.operationId}: aggregate ID policy missing`);
    const source = read("src/platform/api/runtime/RoutedHttpMutationAuthority.ts");
    assert(source.includes('contract.aggregateIdPolicy === "MUST_MATCH_TARGET"'), "Mutation authority does not enforce target-match policy");
    assert(source.includes('contract.aggregateIdPolicy === "SERVER_ASSIGNED"'), "Mutation authority does not enforce server-assigned policy");
    assert(source.includes("aggregateId: outcome.aggregateId"), "Committed event/query invalidation does not use authoritative aggregateId");
  },
  "provider-contract-pack": () => {
    const pack = json("tests/fixtures/backend-contract/invoice-draft/provider-scenarios.json");
    assert(pack.contractVersion === spec.info.version && pack.scenarios.length === 8, "Invoice provider scenario pack incomplete");
    assert(new Set(pack.scenarios.map((item) => item.id)).size === 8, "Provider scenario IDs are not unique");
    const runner = read("tests/contract/provider/run-invoice-draft-provider-contract.mjs");
    for (const token of ["REPLAYED", "IDEMPOTENCY_KEY_REUSED", "VERSION_CONFLICT", "WORKSPACE_MISMATCH", "issueInvoice"]) assert(runner.includes(token), `Provider runner misses ${token}`);
  },
  "transaction-semantics-decisions": () => {
    const pack = json("docs/backend-readiness/p02-transaction-semantics.json");
    assert(pack.contractVersion === spec.info.version && pack.closedTransactions.length === 4, "P0.2 transaction decision pack incomplete");
    for (const operationId of ["acceptQuoteAndCloseDeal", "confirmOrderWithPaymentPlan", "cancelOrder", "reconcilePaymentRecord"]) {
      const op = opById.get(operationId);
      assert(op?.["x-contract-status"] === "PRODUCTION_CONTRACT_READY" && successResponse(op), `${operationId}: closed transaction is not production-ready`);
      assert(op["x-transaction-boundary"].includes("TRANSACTION"), `${operationId}: transaction boundary missing`);
    }
    assert(!opById.has("cancelOrderWithCompensation"), "Misleading compensation operation remains");
    assert(opById.get("acceptQuoteAndCloseDeal").description.includes("never creates an Order"), "Quote acceptance/order creation separation is not explicit");
    assert(spec["x-shared-conventions"].commercialWorkflow.includes("never creates an Order"), "Shared commercial workflow contradicts Quote acceptance semantics");
    assert(spec["x-shared-conventions"].commercialWorkflow.includes("Accepted-Quote conversion and direct Order draft creation are separate"), "Shared commercial workflow conflates Order creation commands");
    for (const operationId of ["allocatePayment", "allocateCustomerCredit"]) {
      const op = opById.get(operationId); assert(op?.["x-contract-status"] === "BLOCKED" && !successResponse(op), `${operationId}: unresolved or superseded financial effect advertised as ready`);
    }
  },
  "explicit-command-payload-projection": () => {
    const registry = json("docs/backend-readiness/command-registry.json").commands.filter((item) => item.status === "PRODUCTION_CONTRACT_READY" && item.runtimeImplementationMode !== "DEDICATED_MODULE_HTTP_ADAPTER" && item.runtimeImplementationMode !== "DEDICATED_WORKFLOW_HTTP_ADAPTER");
    assert(registry.length === 28, `Expected 28 generic ready command projections after Phase 18 workflow promotion, found ${registry.length}`);
    for (const command of registry) assert(typeof command.requestProjection === "string" && command.requestProjection.length > 0, `${command.commandType}: request projection missing`);
    const authority = read("src/platform/api/runtime/RoutedHttpMutationAuthority.ts");
    const projector = read("src/platform/api/contracts/productionCommandPayloadProjection.ts");
    assert(authority.includes("projectProductionCommandPayload") && !authority.includes("body: command.payload"), "Connected authority serializes raw command payload");
    for (const projection of registry.map((item) => item.requestProjection)) assert(projector.includes(`case "${projection}"`), `${projection}: projector case missing`);
  },
  "no-inline-credit-approval": () => {
    const request = schemas.ConfirmOrderWithPaymentPlanRequest;
    assert(!request.properties.creditApproval && !request.properties.actorId && !request.properties.occurredAt, "Order confirmation accepts frontend-authored approval evidence");
    const workflow = read("src/workflows/order-confirmation/index.ts");
    const page = read("src/modules/orders/presentation/pages/OrderDetailPage.tsx");
    assert(!workflow.includes("approvedBy") && !page.includes("Approve postpaid credit"), "Frontend inline credit approval remains active");
    assert(opById.get("confirmOrderWithPaymentPlan")["x-error-codes"].includes("CREDIT_APPROVAL_REQUIRED"), "Credit approval blocker contract missing");
  },
  "transaction-provider-contract-pack": () => {
    const pack = json("tests/fixtures/backend-contract/transaction-semantics/provider-scenarios.json");
    assert(pack.contractVersion === spec.info.version && pack.scenarios.length === 12, "Transaction provider scenario pack incomplete");
    assert(new Set(pack.scenarios.map((item) => item.id)).size === 12, "Transaction provider scenario IDs are not unique");
    const runner = read("tests/contract/provider/run-transaction-semantics-provider-contract.mjs");
    for (const token of ["acceptQuoteAndCloseDeal", "confirmOrderWithPaymentPlan", "cancelOrder", "reconcilePaymentRecord", "CREDIT_APPROVAL_REQUIRED", "ORDER_CANCELLATION_BLOCKED", "WORKSPACE_MISMATCH"]) assert(runner.includes(token), `Transaction provider runner misses ${token}`);
  },
  "payment-financial-effects-decisions": () => {
    const pack = json("docs/backend-readiness/p04-payment-ledger-semantics.json");
    assert(pack.contractVersion === spec.info.version && pack.phase === "P0.4", "P0.4 payment decision pack missing");
    const status = new Map(pack.decisions.map((item) => [item.decisionId, item.status]));
    for (const id of ["DEC-P04-PAYMENT-ALLOCATION-LEDGER", "DEC-P04-PAYMENT-ALLOCATION-REVERSAL", "DEC-P04-REFUND-ASYNC-INTENT", "DEC-P04-COD-COLLECTION-EVIDENCE", "DEC-P04-COD-REMITTANCE-EVIDENCE"]) assert(status.get(id) === "CLOSED", `${id}: financial decision not closed`);
    assert(status.get("DEC-P04-RETURN-REFUND-SAGA") === "BLOCKED" && status.get("DEC-P04-REFUND-CANCEL-RETRY") === "BLOCKED", "P0.4 residual blockers missing");
    for (const operationId of ["allocatePaymentSource", "reversePaymentAllocation", "createRefundIntent", "recordCodCustomerCollection", "recordCodMerchantRemittance"]) {
      const op = opById.get(operationId); assert(op?.["x-contract-status"] === "PRODUCTION_CONTRACT_READY" && successResponse(op), `${operationId}: closed payment operation not ready`);
    }
    for (const operationId of ["allocatePayment", "allocateCustomerCredit"]) {
      const op = opById.get(operationId); assert(op?.["x-contract-status"] === "BLOCKED" && !successResponse(op), `${operationId}: superseded/unresolved operation advertised as ready`);
    }
  },
  "payment-ledger-read-model-contract": () => {
    for (const [operationId, schemaName] of Object.entries({ listPaymentRecords: "PaymentRecordList", getPaymentRecordDetail: "PaymentRecordDetailResponse", listPaymentAllocations: "PaymentAllocationList", listCustomerCredits: "CustomerCreditList", listRefunds: "RefundIntentList", getRefund: "RefundIntentDocument" })) {
      const op = opById.get(operationId); assert(op?.["x-contract-status"] === "PRODUCTION_CONTRACT_READY", `${operationId}: ledger read is not ready`); assert(responseSchemaName(op) === schemaName, `${operationId}: wrong ledger response schema`);
    }
    for (const schemaName of ["PaymentRecordDocument", "PaymentAllocationDocument", "CustomerCreditDocument", "RefundIntentDocument", "PaymentRecordDetailResponse"]) assert(schemas[schemaName]?.additionalProperties === false, `${schemaName}: open ledger projection`);
    for (const schemaName of ["PaymentRecordDocument", "PaymentAllocationDocument", "CustomerCreditDocument", "RefundIntentDocument"]) assert(schemas[schemaName].properties.resourceVersion, `${schemaName}: resourceVersion missing`);
    assert(schemas.PaymentRecordDocument.properties.amount.$ref.endsWith("/Money"), "PaymentRecord authoritative amount is not Money");
  },
  "payment-allocation-ledger-contract": () => {
    const op = opById.get("allocatePaymentSource");
    assert(op?.["x-transaction-boundary"] === "SINGLE_LEDGER_TRANSACTION" && op["x-concurrency-policy"] === "IF_MATCH_REQUIRED", "Allocation transaction/concurrency policy incomplete");
    assert(requestSchemaName(op) === "AllocatePaymentSourceRequest" && responseSchemaName(op) === "AllocatePaymentSourceResponse", "Allocation DTO contract drift");
    const request = schemas.AllocatePaymentSourceRequest; assert(request.additionalProperties === false && request.required.join(",") === "source,targets", "Allocation request trusts frontend evidence");
    const target = schemas.PaymentAllocationTargetRequest; for (const forbidden of ["buyerRef","outstandingAmount","version","id","idempotencyKey","now"]) assert(!target.properties?.[forbidden] && !request.properties?.[forbidden], `Allocation request exposes frontend-authoritative ${forbidden}`);
  },
  "refund-async-lifecycle-contract": () => {
    const op = opById.get("createRefundIntent"); assert(successResponse(op)?.[0] === "202", "Refund creation must be asynchronous 202");
    assert(op["x-aggregate-id-policy"] === "SERVER_ASSIGNED" && op["x-event-outbox-expectation"] === "REFUND_INTENT_CREATED", "Refund authority metadata incomplete");
    assert(schemas.RefundIntentState.enum.join(",") === "CREATED,PROCESSING,SUCCEEDED,FAILED,CANCELLED", "Refund lifecycle drift");
    for (const forbidden of ["id","buyerRef","orderId","invoiceIds","now","refundPaymentRecordId","failureCode"]) assert(!schemas.CreateRefundIntentRequest.properties?.[forbidden], `Refund request accepts server-owned ${forbidden}`);
  },
  "cod-evidence-contract": () => {
    const collection = opById.get("recordCodCustomerCollection"); const remittance = opById.get("recordCodMerchantRemittance");
    assert(collection["x-event-outbox-expectation"] === "COD_CUSTOMER_COLLECTION_RECORDED", "COD collection event missing");
    assert(remittance["x-event-outbox-expectation"] === "COD_MERCHANT_REMITTANCE_RECORDED" && remittance["x-error-codes"].includes("COD_COLLECTION_REQUIRED_BEFORE_REMITTANCE"), "COD remittance prerequisite missing");
    assert(schemas.PaymentRecordDocument.required.includes("effectiveForReceivables"), "COD receivables effectiveness not authoritative");
  },
  "payment-ledger-payload-projection": () => {
    const projector = read("src/platform/api/contracts/productionCommandPayloadProjection.ts");
    for (const projection of ["PAYMENT_ALLOCATE","PAYMENT_REVERSE_ALLOCATION","PAYMENT_REFUND_CREATE","PAYMENT_COD_COLLECTION","PAYMENT_COD_REMITTANCE"]) assert(projector.includes(`case "${projection}"`), `${projection}: production projection missing`);
    for (const forbidden of ["expectedSourceVersion", "idempotencyKey", "now", "actorId"]) assert(!projector.includes(`pick(input, ["${forbidden}"`), `Raw payment ${forbidden} projection remains`);
    const api = read("src/modules/payments/public/api.ts");
    for (const token of ["payment.reverse-allocation:${allocationId}:${input.expectedVersion}", "payment.cod.collection", "payment.cod.remittance"]) assert(api.includes(token), `Client idempotency boundary missing ${token}`);
  },
  "shipping-cod-no-frontend-coordinator": () => {
    const source = read("src/workflows/shipping-cod-evidence/index.ts");
    assert(source.includes("syncShippingBookingCommandBoundary") && !source.includes("syncShippingBookingSnapshot"), "Shipping COD workflow bypasses mutation authority");
    assert(source.includes("demo_cod_collection_") && source.includes("Demo/local mode"), "Demo COD projection is not isolated/labeled");
  },
  "payment-ledger-provider-contract-pack": () => {
    const pack = json("tests/fixtures/backend-contract/payment-ledger/provider-scenarios.json");
    assert(pack.contractVersion === spec.info.version && pack.scenarios.length === 14, "Payment ledger provider pack incomplete");
    const fixtureSchemas = {"allocation-request.json":"AllocatePaymentSourceRequest","allocation-success.json":"AllocatePaymentSourceResponse","reversal-request.json":"ReversePaymentAllocationRequest","reversal-success.json":"ReversePaymentAllocationResponse","refund-request.json":"CreateRefundIntentRequest","refund-accepted.json":"CreateRefundIntentResponse","refund-detail-created.json":"RefundIntentDocument","refund-detail-succeeded.json":"RefundIntentDocument","refund-detail-failed.json":"RefundIntentDocument","cod-collection-request.json":"RecordCodCustomerCollectionRequest","cod-collection-success.json":"CodPaymentEvidenceResponse","cod-remittance-request.json":"RecordCodMerchantRemittanceRequest","cod-remittance-success.json":"CodPaymentEvidenceResponse"};
    for (const [file,schemaName] of Object.entries(fixtureSchemas)) { const issues=validate(schemas[schemaName],json(`tests/fixtures/backend-contract/payment-ledger/${file}`)); assert(issues.length===0,`${file}: ${issues.join("; ")}`); }
    const runner=read("tests/contract/provider/run-payment-ledger-provider-contract.mjs"); for(const token of ["allocatePaymentSource","createRefundIntent","getRefund","REPLAYED","WORKSPACE_MISMATCH"]) assert(runner.includes(token),`Payment provider runner misses ${token}`);
  },
  "payment-plan-money-contract": () => {
    const decision = json("docs/backend-readiness/payment-plan-intent-money-contract.json");
    assert(decision.contractVersion === spec.info.version && decision.frontendFloatingPointAuthorityAllowed === false, "Payment Plan/Intent Money decision missing");
    for (const [operationId, schemaName] of Object.entries({ listPaymentPlans: "PaymentPlanList", listPaymentScheduleLines: "PaymentScheduleLineList", previewPaymentPlan: "PaymentPlanPreviewResponse", savePaymentPlanDraft: "SavePaymentPlanDraftResponse", activatePaymentPlan: "ActivatePaymentPlanResponse", cancelPaymentPlan: "CancelPaymentPlanResponse" })) {
      const op = opById.get(operationId); assert(op?.["x-contract-status"] === "PRODUCTION_CONTRACT_READY", `${operationId}: plan contract not ready`); assert(responseSchemaName(op) === schemaName, `${operationId}: wrong plan response`);
    }
    for (const schemaName of ["PaymentPlanDocument", "PaymentScheduleLineDocument", "PaymentPlanPreviewResponse", "SavePaymentPlanDraftRequest"]) assert(schemas[schemaName]?.additionalProperties === false, `${schemaName}: open plan schema`);
    const source = read("src/modules/payments/infrastructure/http/PaymentHttpAdapter.ts");
    assert(source.includes("projectPaymentAgreementInput") && !source.includes("blockedMoneyProjection"), "Connected Payment Plan adapter still blocks or trusts number-based projection");
  },
  "payment-intent-money-contract": () => {
    for (const [operationId, schemaName] of Object.entries({ listPaymentIntents: "PaymentIntentList", getPaymentIntent: "PaymentIntentDocument", createPaymentIntent: "CreatePaymentIntentResponse", cancelPaymentIntent: "CancelPaymentIntentResponse", retryPaymentIntent: "RetryPaymentIntentResponse" })) {
      const op = opById.get(operationId); assert(op?.["x-contract-status"] === "PRODUCTION_CONTRACT_READY", `${operationId}: intent contract not ready`); assert(responseSchemaName(op) === schemaName, `${operationId}: wrong intent response`);
    }
    const request = schemas.CreatePaymentIntentRequest;
    for (const forbidden of ["id","checkoutUrl","expiresAt","state","resourceVersion","createdAt","updatedAt","actorId","now"]) assert(!request.properties?.[forbidden], `Intent create accepts server-owned ${forbidden}`);
    assert(request.properties.amount.$ref.endsWith("/Money") && schemas.PaymentIntentDocument.properties.amount.$ref.endsWith("/Money"), "Payment Intent authoritative amount is not Money");
  },
  "payment-plan-intent-payload-projection": () => {
    const projector = read("src/platform/api/contracts/productionCommandPayloadProjection.ts");
    for (const projection of ["PAYMENT_INTENT_CREATE","PAYMENT_INTENT_CANCEL","PAYMENT_INTENT_RETRY","RETURN_CREDIT_REFUND_START"]) assert(projector.includes(`case "${projection}"`), `${projection}: production projection missing`);
    for (const forbidden of ["checkoutUrl", "expiresAt", "clientPayload", "now", "actorId", "actorName"]) assert(!projector.includes(`return pick(input, ["${forbidden}"`), `Projector passes server-owned ${forbidden}`);
    const adapter = read("src/modules/payments/infrastructure/http/PaymentHttpAdapter.ts");
    assert(adapter.includes("const body: CreatePaymentIntentRequest") && adapter.includes("returnRouteKey: command.returnContext.routeKey"), "Payment Intent adapter does not project business intent explicitly");
  },
  "return-refund-saga-contract": () => {
    const decision = json("docs/backend-readiness/return-refund-saga.json");
    assert(decision.contractVersion === spec.info.version && decision.ownership === "BACKEND_ORCHESTRATED_SAGA", "Return refund saga decision missing");
    const start = opById.get("resolveReturnCreditRefund"); const detail = opById.get("getReturnCreditRefundResolution");
    assert(start?.["x-contract-status"] === "PRODUCTION_CONTRACT_READY" && successResponse(start)?.[0] === "202", "Return saga start must be typed 202");
    assert(start["x-transaction-boundary"] === "BACKEND_ORCHESTRATED_SAGA" && start["x-saga-failure-policy"].includes("NO_FRONTEND_ROLLBACK"), "Return saga ownership/failure policy incomplete");
    assert(detail?.["x-contract-status"] === "PRODUCTION_CONTRACT_READY" && responseSchemaName(detail) === "ReturnCreditRefundResolutionDocument", "Return saga read model missing");
    assert(schemas.ReturnCreditRefundResolutionDocument.required.includes("resourceVersion"), "Saga read model has no version");
  },
  "return-refund-no-frontend-coordinator": () => {
    const workflow = read("src/workflows/return-credit-refund/index.ts");
    assert(workflow.includes("DEMO_ONLY local saga simulator"), "Local Return saga is not explicitly demo-only");
    const commandSection = workflow.slice(workflow.indexOf("export function executeReturnCreditRefundCommand"));
    assert(!commandSection.includes("getReturnSnapshot") && !commandSection.includes("metadata.expectedVersion ??"), "Connected Return command derives version from browser snapshot");
    const ownership = json("docs/backend-readiness/workflow-ownership.json").workflows.find((item) => item.name === "return-credit-refund");
    assert(ownership.contractReadiness === "PRODUCTION_CONTRACT_READY" && ownership.connectedFrontendCoordinatorAllowed === false && ownership.compensationOwner === "BACKEND_SAGA", "Return saga ownership registry drift");
  },
  "p05-provider-contract-pack": () => {
    const planPack = json("tests/fixtures/backend-contract/payment-plan-intent/provider-scenarios.json");
    const returnPack = json("tests/fixtures/backend-contract/return-refund-saga/provider-scenarios.json");
    assert(planPack.contractVersion === spec.info.version && planPack.scenarios.length === 10, "Payment Plan/Intent provider pack incomplete");
    assert(returnPack.contractVersion === spec.info.version && returnPack.scenarios.length === 10, "Return saga provider pack incomplete");
    const fixtures = {
      "payment-plan-intent/plan-list-response.json":"PaymentPlanList",
      "payment-plan-intent/schedule-lines-response.json":"PaymentScheduleLineList",
      "payment-plan-intent/preview-request.json":"PaymentPlanPreviewRequest",
      "payment-plan-intent/preview-response.json":"PaymentPlanPreviewResponse",
      "payment-plan-intent/save-request.json":"SavePaymentPlanDraftRequest",
      "payment-plan-intent/save-response.json":"SavePaymentPlanDraftResponse",
      "payment-plan-intent/create-intent-request.json":"CreatePaymentIntentRequest",
      "payment-plan-intent/create-intent-response.json":"CreatePaymentIntentResponse",
      "payment-plan-intent/cancel-intent-response.json":"CancelPaymentIntentResponse",
      "payment-plan-intent/retry-intent-response.json":"RetryPaymentIntentResponse",
      "return-refund-saga/start-request.json":"StartReturnCreditRefundRequest",
      "return-refund-saga/accepted-response.json":"StartReturnCreditRefundResponse",
      "return-refund-saga/waiting-detail.json":"ReturnCreditRefundResolutionDocument",
      "return-refund-saga/completed-detail.json":"ReturnCreditRefundResolutionDocument",
      "return-refund-saga/manual-review-detail.json":"ReturnCreditRefundResolutionDocument",
      "return-refund-saga/customer-credit-problem.json":"ProblemDetails"
    };
    for (const [file,schemaName] of Object.entries(fixtures)) { const issues=validate(schemas[schemaName],json(`tests/fixtures/backend-contract/${file}`)); assert(issues.length===0,`${file}: ${issues.join("; ")}`); }
  },
  "refund-retry-cancel-decision": () => {
    const unresolved = json("docs/backend-readiness/unresolved-decisions.json");
    const decision = [...(unresolved.operationDecisions ?? []), ...(unresolved.groupedDecisions ?? [])].find((item) => item.decisionId === "DEC-P04-REFUND-CANCEL-RETRY");
    assert(decision?.status === "CLOSED_BY_P08", "Refund retry/cancel decision was not closed by the provider-attempt contract");
    for (const operationId of ["requestRefundCancellation", "retryRefundIntent", "listRefundProviderAttempts"]) {
      assert(opById.get(operationId)?.["x-contract-status"] === "PRODUCTION_CONTRACT_READY", `${operationId}: P0.8 recovery operation missing`);
    }
    assert(!opById.has("cancelRefundIntent"), "Terminal cancelRefundIntent operation must not exist; cancellation is asynchronous");
  },
  "commercial-read-model-contract": () => {
    const decision = json("docs/backend-readiness/p03-commercial-read-models.json");
    assert(decision.contractVersion === spec.info.version && decision.status === "CLOSED", "P0.3 commercial read-model decision is not closed");
    for (const [operationId, schemaName] of Object.entries({ listDeals: "DealListResponse", getDeal: "DealReadModel", listQuotes: "QuoteListResponse", getQuote: "QuoteReadModel", listOrders: "OrderListResponse", getOrder: "OrderReadModel" })) {
      const op = opById.get(operationId);
      assert(op?.["x-contract-status"] === "PRODUCTION_CONTRACT_READY", `${operationId}: read operation is not ready`);
      assert(responseSchemaName(op) === schemaName, `${operationId}: wrong response projection`);
    }
    for (const schemaName of ["DealReadModel", "QuoteReadModel", "OrderReadModel"]) {
      const schema = schemas[schemaName];
      assert(schema?.additionalProperties === false && schema.required.includes("resourceVersion"), `${schemaName}: closed authoritative version missing`);
    }
    assert(schemas.QuoteReadModel.properties.status.enum.join(",") === "DRAFT,REVIEW,SENT,ACCEPTED,REJECTED,EXPIRED", "Quote lifecycle projection drift");
    assert(schemas.OrderReadModel.properties.state.enum.join(",") === "DRAFT,CONFIRMED,COMPLETED,CANCELLED", "Order lifecycle projection drift");
    assert(schemas.QuoteReadModel.properties.quoteRevision && schemas.QuoteReadModel.properties.resourceVersion, "Quote business revision/concurrency separation missing");
  },
  "commercial-read-projection-mapping": () => {
    for (const [module, singular, mapper] of [["deals", "deal", "projectDealReadModel"], ["quotes", "quote", "projectQuoteReadModel"], ["orders", "order", "projectOrderReadModel"]]) {
      let source = read(`src/modules/${module}/application/vertical-slice/${singular}AuthoritativeQueries.ts`);
      if (module === "deals") source += read("src/modules/deals/infrastructure/http/DealApiMapper.ts");
      if (module === "quotes") source += read("src/modules/quotes/infrastructure/http/QuoteApiMapper.ts");
      assert(source.includes(mapper), `${module}: authoritative DTO projection mapper missing`);
      const mapperSource = read(`src/modules/${module}/application/read-models/${singular}ReadModel.ts`);
      assert(mapperSource.includes("UI display projection") && mapperSource.includes("resourceVersion"), `${module}: UI projection boundary not explicit`);
      assert(mapperSource.includes("MoneyDto") && mapperSource.includes("displayNumber"), `${module}: decimal-string transport to legacy view mapping missing`);
    }
  },
  "connected-commercial-version-source": () => {
    for (const file of [
      "src/modules/quotes/presentation/pages/QuoteDetailPage.tsx",
      "src/modules/quotes/presentation/pages/QuoteListPage.tsx",
      "src/modules/deals/presentation/hooks/useDealDetailController.tsx",
      "src/modules/orders/presentation/pages/OrderDetailPage.tsx",
      "src/modules/orders/presentation/hooks/useOrderListController.tsx",
    ]) {
      const source = read(file);
      assert(source.includes("resourceVersion") && source.includes("expectedVersion"), `${file}: connected command lacks authoritative read version`);
      assert(!source.includes("expectedVersion: quote.version") && !source.includes("expectedVersion: order.version") && !source.includes("expectedVersion: targetQuote.version"), `${file}: business/browser version used as If-Match`);
    }
  },
  "credit-approval-decision-pack": () => {
    const decision = json("docs/backend-readiness/credit-approval-command-decision.json");
    assert(decision.contractVersion === spec.info.version && decision.status === "CLOSED", "Credit approval decision is not closed");
    assert(decision.reusePolicy.includes("SINGLE_USE") && decision.expiryPolicy.includes("BINDING_CHANGE_SUPERSEDES"), "Credit approval lifecycle binding/single-use policy incomplete");
    for (const operationId of decision.operations) assert(opById.get(operationId)?.["x-contract-status"] === "PRODUCTION_CONTRACT_READY", `${operationId}: credit approval operation not ready`);
    assert(schemas.OrderReadModel.properties.creditApproval?.$ref?.endsWith("/OrderCreditApprovalSummaryReadModel"), "Order read model lacks authoritative credit approval summary");
    assert(schemas.ConfirmOrderWithPaymentPlanRequest.properties.creditApprovalId && !schemas.ConfirmOrderWithPaymentPlanRequest.properties.creditApproval, "Order confirmation must accept evidence ID only");
  },
  "quote-order-conversion-decision": () => {
    const decision = json("docs/backend-readiness/quote-order-conversion-decision.json");
    assert(decision.contractVersion === spec.info.version && decision.status === "CLOSED", "Accepted Quote conversion decision is not closed");
    assert(decision.operationId === "convertAcceptedQuoteToOrderDraft" && decision.transactionBoundary.includes("QUOTE_UNIQUENESS_LOCK"), "Quote conversion transaction/uniqueness policy incomplete");
    const conversion = opById.get("convertAcceptedQuoteToOrderDraft");
    assert(conversion?.["x-contract-status"] === "PRODUCTION_CONTRACT_READY" && responseSchemaName(conversion) === "ConvertAcceptedQuoteToOrderDraftResponse", "Accepted Quote conversion operation not ready/typed");
    const createOrder = opById.get("createOrderDraftCommand");
    assert(createOrder?.["x-contract-status"] === "PRODUCTION_CONTRACT_READY" && createOrder.operationId !== conversion.operationId, "Direct-sale Order draft must remain a separate typed operation");
    assert(requestSchemaName(createOrder) === "CreateDirectOrderDraftRequest" && !schemas.CreateDirectOrderDraftRequest.properties.sourceQuoteId, "Direct-sale Order contract conflates accepted Quote conversion");
  },
  "p06-credit-approval-contract": () => {
    for (const [operationId, responseName] of Object.entries({ requestOrderCreditApproval: "OrderCreditApprovalMutationResponse", getOrderCreditApproval: "OrderCreditApprovalDocument", approveOrderCreditApproval: "OrderCreditApprovalMutationResponse", rejectOrderCreditApproval: "OrderCreditApprovalMutationResponse", revokeOrderCreditApproval: "OrderCreditApprovalMutationResponse" })) {
      const op = opById.get(operationId); assert(op?.["x-contract-status"] === "PRODUCTION_CONTRACT_READY", `${operationId}: credit approval operation not ready`); assert(responseSchemaName(op) === responseName, `${operationId}: wrong response schema`);
    }
    const doc = schemas.OrderCreditApprovalDocument;
    for (const field of ["orderResourceVersion","paymentPlanResourceVersion","amount","policyVersion","evaluationFingerprint","state","resourceVersion"]) assert(doc.required.includes(field), `OrderCreditApprovalDocument.${field}: binding/evidence missing`);
    assert(doc.properties.state.$ref.endsWith("/OrderCreditApprovalState"), "Credit approval state not canonical");
  },
  "p06-credit-approval-payload-projection": () => {
    const projector = read("src/platform/api/contracts/productionCommandPayloadProjection.ts");
    for (const projection of ["ORDER_CREDIT_APPROVAL_REQUEST","ORDER_CREDIT_APPROVAL_APPROVE","ORDER_CREDIT_APPROVAL_REJECT","ORDER_CREDIT_APPROVAL_REVOKE","ORDER_CONVERT_ACCEPTED_QUOTE"]) assert(projector.includes(`case "${projection}"`), `${projection}: production projection missing`);
    const request = schemas.RequestOrderCreditApprovalRequest;
    for (const forbidden of ["id","amount","currency","policyVersion","evaluationFingerprint","state","requestedBy","requestedAt","resourceVersion"]) assert(!request.properties?.[forbidden], `Credit approval request accepts server-owned ${forbidden}`);
    const confirm = schemas.ConfirmOrderWithPaymentPlanRequest;
    assert(confirm.properties.creditApprovalId && !confirm.properties.creditApproval, "Confirmation accepts inline credit authority");
  },
  "p06-quote-order-conversion-contract": () => {
    const op = opById.get("convertAcceptedQuoteToOrderDraft");
    assert(op?.["x-idempotency-policy"] === "REQUIRED" && op["x-concurrency-policy"] === "IF_MATCH_REQUIRED", "Quote conversion idempotency/concurrency policy incomplete");
    const req = schemas.ConvertAcceptedQuoteToOrderDraftRequest;
    assert(req.required.length === 1 && req.required[0] === "quoteId" && req.additionalProperties === false, "Quote conversion request must contain business intent only");
    const result = schemas.ConvertedAcceptedQuoteOrderDraftResult;
    for (const field of ["order","sourceQuoteId","sourceQuoteResourceVersion","commercialSnapshotFingerprint"]) assert(result.required.includes(field), `Conversion result missing ${field}`);
    const workflow = read("src/workflows/accepted-quote-order-conversion/index.ts");
    assert(workflow.includes("OPENAPI_CONNECTED_ONLY") && !/InMemory|localStorage|snapshotRollback/u.test(workflow), "Quote conversion connected workflow falls back to frontend authority");
  },
  "p06-customer-credit-policy": () => {
    const decision = json("docs/backend-readiness/p06-commercial-credit-conversion-refund-policy.json").decisions.find((item) => item.decisionId === "DEC-P06-RETURN-CUSTOMER-CREDIT-POLICY");
    assert(decision?.status === "CLOSED" && decision.decision.includes("MANUAL_REVIEW_REQUIRED"), "Return Customer Credit policy incomplete");
    const workflow = read("src/workflows/return-credit-refund/index.ts");
    assert(workflow.includes("RETURN_CUSTOMER_CREDIT_ALLOCATION_MANUAL_REVIEW_REQUIRED"), "Demo workflow does not fail closed for Customer Credit allocation");
    assert(schemas.ErrorCode.enum.includes("RETURN_CUSTOMER_CREDIT_ALLOCATION_MANUAL_REVIEW_REQUIRED"), "Typed Customer Credit blocker missing");
  },
  "p06-provider-contract-pack": () => {
    const creditPack = json("tests/fixtures/backend-contract/commercial-credit-approval/provider-scenarios.json");
    const conversionPack = json("tests/fixtures/backend-contract/accepted-quote-order-conversion/provider-scenarios.json");
    assert(creditPack.contractVersion === spec.info.version && creditPack.scenarios.length === 10, "Credit approval provider pack incomplete");
    assert(conversionPack.contractVersion === spec.info.version && conversionPack.scenarios.length === 8, "Quote conversion provider pack incomplete");
    const fixtures = {
      "commercial-credit-approval/request.json":"RequestOrderCreditApprovalRequest",
      "commercial-credit-approval/request-success.json":"OrderCreditApprovalMutationResponse",
      "commercial-credit-approval/approval-detail.json":"OrderCreditApprovalDocument",
      "commercial-credit-approval/approve-request.json":"ApproveOrderCreditApprovalRequest",
      "commercial-credit-approval/approve-success.json":"OrderCreditApprovalMutationResponse",
      "commercial-credit-approval/reject-request.json":"RejectOrderCreditApprovalRequest",
      "commercial-credit-approval/reject-success.json":"OrderCreditApprovalMutationResponse",
      "commercial-credit-approval/revoke-request.json":"RevokeOrderCreditApprovalRequest",
      "commercial-credit-approval/revoke-success.json":"OrderCreditApprovalMutationResponse",
      "commercial-credit-approval/binding-mismatch-problem.json":"ProblemDetails",
      "commercial-credit-approval/already-consumed-problem.json":"ProblemDetails",
      "accepted-quote-order-conversion/convert-request.json":"ConvertAcceptedQuoteToOrderDraftRequest",
      "accepted-quote-order-conversion/convert-success.json":"ConvertAcceptedQuoteToOrderDraftResponse",
      "accepted-quote-order-conversion/already-converted-problem.json":"ProblemDetails",
      "accepted-quote-order-conversion/conversion-blocked-problem.json":"ProblemDetails"
    };
    for (const [file,schemaName] of Object.entries(fixtures)) { const issues=validate(schemas[schemaName],json(`tests/fixtures/backend-contract/${file}`)); assert(issues.length===0,`${file}: ${issues.join("; ")}`); }
    const creditRunner=read("tests/contract/provider/run-commercial-credit-approval-provider-contract.mjs");
    const conversionRunner=read("tests/contract/provider/run-accepted-quote-order-conversion-provider-contract.mjs");
    for(const token of ["requestOrderCreditApproval","approveOrderCreditApproval","CREDIT_APPROVAL_ALREADY_CONSUMED","WORKSPACE_MISMATCH"]) assert(creditRunner.includes(token),`Credit provider runner misses ${token}`);
    for(const token of ["convertAcceptedQuoteToOrderDraft","commercialSnapshotFingerprint","QUOTE_ORDER_ALREADY_CONVERTED","WORKSPACE_MISMATCH"]) assert(conversionRunner.includes(token),`Conversion provider runner misses ${token}`);
  },

  "p07-direct-order-draft-contract": () => {
    const op = opById.get("createOrderDraftCommand");
    assert(op?.["x-contract-status"] === "PRODUCTION_CONTRACT_READY", "Direct Order draft operation is not ready");
    assert(requestSchemaName(op) === "CreateDirectOrderDraftRequest" && responseSchemaName(op) === "CreateDirectOrderDraftResponse", "Direct Order draft DTOs are not typed");
    assert(op["x-concurrency-policy"] === "NOT_APPLICABLE" && op["x-idempotency-policy"] === "REQUIRED", "Direct Order draft policies incomplete");
    const props = schemas.CreateDirectOrderDraftRequest.properties;
    for (const forbidden of ["id","orderId","orderNumber","state","subtotal","taxTotal","grandTotal","resourceVersion","createdAt","sourceQuoteId"]) assert(!props[forbidden], `Direct Order request exposes ${forbidden}`);
    assert(schemas.DirectOrderDraftMutationResult.properties.paymentPlan.$ref.endsWith("/PaymentPlanDocument"), "Direct Order Payment Plan result is not authoritative");
    const workflow = read("src/workflows/order-creation/index.ts");
    assert(workflow.includes("createDirectOrderDraftCommandBoundary") && workflow.includes("paymentAgreementVersion: result.paymentPlan.agreementSnapshot.version"), "Direct Order response is not projected through the dedicated Order boundary");
  },
  "p07-direct-order-payload-projection": () => {
    const source = read("src/platform/api/contracts/productionCommandPayloadProjection.ts");
    for (const token of ["ORDER_DIRECT_DRAFT_CREATE","projectDirectOrderDraft","order.sourceQuoteId","projectPaymentAgreement"]) assert(source.includes(token), `Direct Order projection misses ${token}`);
    for (const forbidden of ["orderNumber: order.orderNumber","state: order.state","createdAt: order.createdAt","actorId: input.actorId"]) assert(!source.includes(forbidden), `Direct Order projection serializes server evidence: ${forbidden}`);
  },
  "p07-support-contract": () => {
    for (const id of ["listSupportCases","getSupportCase","createSupportCase","replaceSupportCaseProfile","assignSupportCase","transitionSupportCase","addSupportCaseReply","addSupportCaseInternalNote"]) assert(opById.get(id)?.["x-contract-status"] === "PRODUCTION_CONTRACT_READY", `${id}: Support contract not ready`);
    assert(schemas.SupportCaseReadModel.required.includes("resourceVersion") && schemas.SupportCaseReadModel.required.includes("caseNumber"), "Support authority fields missing");
    assert(schemas.SupportCaseCreateCategory.enum.length === 7 && !schemas.SupportCaseCreateCategory.enum.includes("technical_support"), "Legacy Support category remains authorable");
    const status = json("docs/backend-readiness/support-tasks-contract-status.json");
    assert(status.connectedStatus === "DEDICATED_MODULE_API_BOUNDARIES_READY", "Support/Task connected status stale");
  },
  "p07-support-payload-projection": () => {
    const adapter = read("src/modules/support/infrastructure/http/SupportHttpApiAdapter.ts");
    for (const token of ["createSupportCase","replaceSupportCaseProfile","assignSupportCase","transitionSupportCase","addSupportCaseReply","addSupportCaseInternalNote"]) assert(adapter.includes(token), `Support adapter misses ${token}`);
    const api = read("src/modules/support/public/cases.ts");
    for (const token of ["createSupportCaseCommand","replaceSupportCaseProfileCommand","transitionSupportCaseCommand","addSupportCaseReplyCommand","addSupportCaseInternalNoteCommand"]) assert(api.includes(token), `Support public boundary misses ${token}`);
    assert(api.includes("getSupportCaseSnapshot(caseId)?.resourceVersion"), "Support If-Match is not sourced from authoritative resourceVersion");
  },
  "p07-task-contract": () => {
    for (const id of ["listTasks","getTask","createTask","completeTask","cancelTask","assignTask","rescheduleTask","archiveTask","logActivity"]) assert(opById.get(id)?.["x-contract-status"] === "PRODUCTION_CONTRACT_READY", `${id}: Task contract not ready`);
    assert(schemas.TaskReadModel.required.includes("resourceVersion") && schemas.TaskStatus.enum.join(",") === "OPEN,COMPLETED,CANCELLED", "Task lifecycle/read version incomplete");
    assert(schemas.CompleteTaskRequest.required.includes("outcome") && schemas.CancelTaskRequest.required.includes("reason"), "Task terminal evidence requirements missing");
  },
  "p07-task-payload-projection": () => {
    const source = read("src/platform/api/contracts/productionCommandPayloadProjection.ts");
    for (const token of ["TASK_CREATE","TASK_COMPLETE","TASK_CANCEL","TASK_ASSIGN","TASK_RESCHEDULE","TASK_ARCHIVE","TASK_LOG_ACTIVITY"]) assert(source.includes(token), `Task projection misses ${token}`);
    const api = read("src/modules/tasks/public/api.ts");
    for (const token of ["createTaskCommand","completeTaskCommand","cancelTaskCommand","reassignTaskCommand","rescheduleTaskCommand","archiveTaskCommand","logActivityCommand"]) assert(api.includes(token), `Task async command missing ${token}`);
    assert(api.includes("getTaskSnapshot(taskId)?.resourceVersion"), "Task If-Match is not sourced from authoritative resourceVersion");
  },
  "p07-connected-local-fallback": () => {
    const api = read("src/modules/tasks/public/api.ts");
    assert(api.includes("assertDemoTaskMutationAllowed") && api.includes("instanceof LocalMutationAuthority"), "Task snapshot mutations do not fail closed in connected mode");
    for (const name of ["createTaskSnapshot","completeTaskSnapshot","cancelTaskSnapshot","reassignTaskSnapshot","rescheduleTaskSnapshot","logActivitySnapshot"]) {
      const row = api.split("\n").find((line) => line.includes(`const ${name}`));
      assert(row?.includes("assertDemoTaskMutationAllowed"), `${name}: connected local fallback remains`);
    }
  },
  "p07-refund-recovery-blocked": () => {
    const historical = json("docs/backend-readiness/p07-order-support-tasks-refund-recovery.json").decisions.find((x) => x.decisionId === "DEC-P07-REFUND-RECOVERY");
    const p08 = json("docs/backend-readiness/p08-refund-provider-recovery.json");
    assert(historical?.status === "BLOCKED", "P0.7 historical evidence was rewritten");
    assert(p08.decisions.some((item) => item.decisionId === "DEC-P08-REFUND-PROVIDER-ATTEMPT" && item.status === "CLOSED"), "P0.8 provider-attempt decision missing");
    assert(schemas.RefundProviderAttemptDocument?.additionalProperties === false, "P0.8 provider-attempt projection is not closed");
    assert(!opById.has("cancelRefundIntent"), "P0.8 must not invent synchronous terminal cancellation");
  },
  "p07-provider-contract-pack": () => {
    const packs = [
      ["direct-order-draft",8,{"create-request.json":"CreateDirectOrderDraftRequest","create-success.json":"CreateDirectOrderDraftResponse"}],
      ["support-core",13,{"create-request.json":"CreateSupportCaseRequest","replace-request.json":"ReplaceSupportCaseProfileRequest","create-success.json":"SupportCaseMutationResponse","list-success.json":"SupportCaseListResponse","detail-success.json":"SupportCaseReadModel","transition-request.json":"TransitionSupportCaseRequest","reply-request.json":"AddSupportCaseReplyRequest","note-request.json":"AddSupportCaseInternalNoteRequest"}],
      ["task-core",17,{"create-request.json":"CreateTaskRequest","create-success.json":"TaskMutationResponse","list-success.json":"TaskListResponse","detail-success.json":"TaskReadModel","complete-request.json":"CompleteTaskRequest","cancel-request.json":"CancelTaskRequest","assign-request.json":"AssignTaskRequest","reschedule-request.json":"RescheduleTaskRequest","archive-request.json":"ArchiveTaskRequest","activity-request.json":"LogActivityRequest","activity-success.json":"ActivityMutationResponse"}],
    ];
    for (const [dir,count,fixtures] of packs) {
      const pack=json(`tests/fixtures/backend-contract/${dir}/provider-scenarios.json`); assert(pack.contractVersion===spec.info.version && pack.scenarios.length===count,`${dir}: provider scenarios incomplete`);
      for(const [file,schemaName] of Object.entries(fixtures)){const issues=validate(schemas[schemaName],json(`tests/fixtures/backend-contract/${dir}/${file}`));assert(issues.length===0,`${dir}/${file}: ${issues.join("; ")}`);}
      const runner=read(`tests/contract/provider/run-${dir}-provider-contract.mjs`); assert(runner.includes("BLOCKED_EXTERNAL") && runner.includes(dir),`${dir}: provider runner incomplete`);
    }
  },
  "p08-refund-provider-attempt-contract": () => {
    const schema = schemas.RefundProviderAttemptDocument;
    assert(schema?.additionalProperties === false, "RefundProviderAttemptDocument must be closed");
    for (const field of ["id","refundIntentId","providerCode","sequenceNumber","state","resourceVersion","createdAt","updatedAt"]) assert(schema.required.includes(field), `Refund provider attempt misses ${field}`);
    assert(schemas.RefundProviderAttemptState.enum.join(",") === "QUEUED,SUBMITTED,PROCESSING,SUCCEEDED,FAILED,CANCELLATION_REQUESTED,CANCELLED,CANCELLATION_REJECTED,UNKNOWN", "Refund provider attempt lifecycle drift");
    const list = opById.get("listRefundProviderAttempts");
    assert(list?.["x-contract-status"] === "PRODUCTION_CONTRACT_READY" && responseSchemaName(list) === "RefundProviderAttemptList", "Refund provider attempt read contract missing");
    assert(schemas.RefundIntentDocument.properties.latestProviderAttemptId && schemas.RefundIntentDocument.properties.providerCode, "Refund Intent does not reference provider attempt authority");
  },
  "p08-refund-cancellation-ack-contract": () => {
    const op = opById.get("requestRefundCancellation");
    assert(op?.["x-contract-status"] === "PRODUCTION_CONTRACT_READY", "Refund cancellation request contract missing");
    assert(successResponse(op)?.[0] === "202" && requestSchemaName(op) === "RequestRefundCancellationRequest" && responseSchemaName(op) === "RequestRefundCancellationResponse", "Refund cancellation contract must be typed 202");
    assert(op["x-idempotency-policy"] === "REQUIRED" && op["x-concurrency-policy"] === "IF_MATCH_REQUIRED", "Refund cancellation policies incomplete");
    assert(!opById.has("cancelRefundIntent"), "Synchronous refund cancellation was invented");
    const fixture = json("tests/fixtures/backend-contract/refund-recovery/cancellation-accepted.json");
    assert(fixture.result.providerAttempt.state === "CANCELLATION_REQUESTED" && fixture.result.refundIntent.state !== "CANCELLED", "Cancellation request fixture fabricates provider acknowledgement");
  },
  "p08-refund-retry-lineage-contract": () => {
    const op = opById.get("retryRefundIntent");
    assert(op?.["x-contract-status"] === "PRODUCTION_CONTRACT_READY", "Refund retry contract missing");
    assert(successResponse(op)?.[0] === "202" && requestSchemaName(op) === "RetryRefundIntentRequest" && responseSchemaName(op) === "RetryRefundIntentResponse", "Refund retry contract must be typed 202");
    const fixture = json("tests/fixtures/backend-contract/refund-recovery/retry-accepted.json");
    assert(fixture.result.providerAttempt.retryOfAttemptId && fixture.result.providerAttempt.sequenceNumber === 2 && fixture.result.providerAttempt.id !== fixture.result.providerAttempt.retryOfAttemptId, "Refund retry lineage is not explicit");
    assert(fixture.result.providerAttempt.state === "QUEUED" && fixture.result.refundIntent.state === "PROCESSING", "Retry fixture fabricates completion");
  },
  "p08-refund-recovery-payload-projection": () => {
    const source = read("src/platform/api/contracts/productionCommandPayloadProjection.ts");
    for (const token of ["PAYMENT_REFUND_CANCELLATION_REQUEST","PAYMENT_REFUND_RETRY_REQUEST","reasonCode","reason"]) assert(source.includes(token), `Refund recovery projection misses ${token}`);
    for (const forbidden of ["providerReference: input.providerReference","state: input.state","attemptId: input.attemptId","occurredAt: input.occurredAt","actorId: input.actorId"]) assert(!source.includes(forbidden), `Refund recovery projection serializes server evidence: ${forbidden}`);
    const adapter = read("src/modules/payments/infrastructure/http/PaymentHttpAdapter.ts");
    assert(adapter.includes("requestRefundCancellation") && adapter.includes("retryRefund") && adapter.includes("projectRefundProviderAttempt"), "Refund recovery HTTP adapter boundary incomplete");
  },
  "p08-refund-recovery-provider-pack": () => {
    const pack=json("tests/fixtures/backend-contract/refund-recovery/provider-scenarios.json");
    assert(pack.contractVersion===spec.info.version && pack.scenarios.length===14,"Refund recovery provider scenarios incomplete");
    const fixtures={"attempt-list.json":"RefundProviderAttemptList","cancellation-request.json":"RequestRefundCancellationRequest","cancellation-accepted.json":"RequestRefundCancellationResponse","retry-request.json":"RetryRefundIntentRequest","retry-accepted.json":"RetryRefundIntentResponse","cancellation-pending-problem.json":"ProblemDetails","retry-not-allowed-problem.json":"ProblemDetails","manual-review-problem.json":"ProblemDetails"};
    for(const [file,schemaName] of Object.entries(fixtures)){const issues=validate(schemas[schemaName],json(`tests/fixtures/backend-contract/refund-recovery/${file}`));assert(issues.length===0,`refund-recovery/${file}: ${issues.join("; ")}`);}
    const runner=read("tests/contract/provider/run-refund-recovery-provider-contract.mjs");
    for(const token of ["listRefundProviderAttempts","requestRefundCancellation","retryRefundIntent","CANCELLATION_REQUESTED","retryOfAttemptId","WORKSPACE_MISMATCH"]) assert(runner.includes(token),`Refund recovery provider runner misses ${token}`);
  },
  "p08-refund-recovery-decision-closure": () => {
    const pack=json("docs/backend-readiness/p08-refund-provider-recovery.json");
    assert(pack.contractVersion===spec.info.version,"P0.8 decision contract version drift");
    for(const id of ["DEC-P08-REFUND-PROVIDER-ATTEMPT","DEC-P08-REFUND-CANCELLATION-ACK","DEC-P08-REFUND-RETRY-LINEAGE","DEC-P08-REFUND-IDEMPOTENCY-RETENTION"]) assert(pack.decisions.some((item)=>item.decisionId===id&&item.status==="CLOSED"),`${id}: decision not closed`);
    const workflow=json("docs/backend-readiness/workflow-ownership.json").workflows.find((item)=>item.name==="refund-provider-recovery");
    assert(workflow?.ownershipDecision==="BACKEND_ORCHESTRATED"&&!workflow.connectedFrontendCoordinatorAllowed,"Refund recovery workflow ownership incomplete");
    const commands=json("docs/backend-readiness/command-registry.json").commands;
    for(const type of ["payment.request-refund-cancellation","payment.retry-refund"]) assert(commands.some((item)=>item.commandType===type&&item.status==="PRODUCTION_CONTRACT_READY"),`${type}: command registry missing`);
  },
  "p09-query-authority-closure": () => {
    const decision = json("docs/backend-readiness/p09-provider-conformance-query-closure.json");
    assert(decision.contractVersion === spec.info.version && decision.phase === "P0.9", "P0.9 decision pack drift");
    const expected = {
      listLeads: "LeadList", getLead: "LeadDocument",
      listProducts: "ProductList", getProduct: "ProductDocument",
      listShippingBookings: "ShippingBookingListResponse", getShippingBooking: "ShippingBookingReadModel",
      listReturns: "ReturnListResponse", getReturn: "ReturnReadModel",
    };
    for (const [operationId, responseSchema] of Object.entries(expected)) {
      const operation = opById.get(operationId);
      assert(operation?.method === "GET" && operation["x-contract-status"] === "PRODUCTION_CONTRACT_READY", `${operationId}: read authority missing`);
      assert(responseSchemaName(operation) === responseSchema, `${operationId}: response projection drift`);
      assert(operation["x-workspace-required"] === true && operation["x-data-scope"] === "WORKSPACE", `${operationId}: workspace authority incomplete`);
    }
    for (const schemaName of ["ProductDocument", "ShippingBookingReadModel", "ReturnReadModel"]) assert(schemas[schemaName]?.additionalProperties === false, `${schemaName}: projection must be closed`);
    const registry = json("docs/backend-readiness/query-registry.json");
    const counts = registry.queries.reduce((all, item) => ({ ...all, [item.classification]: (all[item.classification] ?? 0) + 1 }), {});
    assert(registry.queries.length === 162 && counts.PRODUCTION_API === 63, "P0.9 production API classifications drift");
    const authority = new Map(registry.moduleAuthorityQueries.map((item) => [item.module, item]));
    for (const module of ["leads", "products", "shipping", "returns"]) {
      const entry = authority.get(module);
      assert(entry?.list?.operationId && entry?.detail?.operationId, `${module}: explicit list/detail authority missing`);
      assert(entry.listStatus === "PRODUCTION_API" && entry.detailStatus === "PRODUCTION_API", `${module}: application DTO adapter authority not promoted`);
      assert(entry.decisionId.includes("DEC-P10"), `${module}: P0.10 adapter decision missing`);
    }
  },
  "p09-reference-provider-host-boundary": () => {
    const host = read("tests/contract/provider/reference-host/referenceProviderHost.mjs");
    const runner = read("tests/contract/provider/run-reference-provider-conformance.mjs");
    for (const token of ["reference-provider-host", "x-conformance-scenario-id", "validateSchema", "WORKSPACE_MISMATCH", "IDEMPOTENCY_KEY_REUSED"]) assert(host.includes(token), `Reference host misses ${token}`);
    for (const token of ["actual OpenAPI paths and schemas", "responseSchema", "validateSchema", "provider-scenarios.json"]) assert(runner.includes(token), `Reference conformance runner misses ${token}`);
    for (const file of walkAllFiles(path.join(root, "src")).filter((file) => /\.(?:ts|tsx)$/u.test(file))) assert(!fs.readFileSync(file, "utf8").includes("referenceProviderHost"), `${path.relative(root,file)} imports the non-production reference host`);
  },
  "p09-provider-scenario-coverage": () => {
    const base = path.join(root, "tests/fixtures/backend-contract");
    const packs = fs.readdirSync(base).filter((name) => exists(`tests/fixtures/backend-contract/${name}/provider-scenarios.json`)).sort();
    let count = 0;
    for (const pack of packs) {
      const fixture = json(`tests/fixtures/backend-contract/${pack}/provider-scenarios.json`);
      assert(fixture.contractVersion === spec.info.version, `${pack}: provider pack version drift`);
      for (const scenario of fixture.scenarios) assert(opById.get(scenario.operationId)?.["x-contract-status"] === "PRODUCTION_CONTRACT_READY", `${pack}/${scenario.id}: scenario targets blocked or unknown operation`);
      count += fixture.scenarios.length;
    }
    assert(packs.length === 26 && count === 516, `Expected 26 provider packs/516 scenarios, found ${packs.length}/${count}`);
    const queryPack = json("tests/fixtures/backend-contract/query-authority/provider-scenarios.json");
    assert(queryPack.scenarios.length === 8, "Query-authority pack incomplete");
  },
  "p09-connected-fixture-migration": () => {
    const integration = read("tests/quality/integration/check-connected-backend-integration.mts");
    const acceptance = read("tests/quality/acceptance/check-real-backend-contract.mts");
    const host = read("tests/fixtures/connected-host/connectedApiTestHost.mjs");
    for (const token of ["CommercialApiClient", "listLeads", "getLead", "createLead", "replaceLeadProfile", "CONNECTED_MODULE_QUERY_RESPONSE_MAPPERS", "mappedAlphaPage", "CONNECTED_COMMAND_CONTRACT_BLOCKED"]) assert(integration.includes(token), `Connected integration misses ${token}`);
    for (const forbidden of ["qualifyLead(", "/test/retry-once", "HttpAuditTrailAuthority", "OpenAPI-owned generic Lead update"]) assert(!integration.includes(forbidden), `Connected integration retains stale authority ${forbidden}`);
    for (const token of ["listLeads", "getLead", "createLead", "replaceLeadProfile", "CreateLeadResponse", "ReplaceLeadProfileResponse"]) assert(acceptance.includes(token), `External acceptance misses ${token}`);
    assert(!acceptance.includes("qualifyLead("), "External acceptance retains blocked Lead qualification");
    for (const token of ["commandId", "correlationId", "aggregateId", "auditEvidenceIds", "leadWorkState"]) assert(host.includes(token), `Connected host typed Lead outcome misses ${token}`);
  },
  "p09-live-provider-conformance-blocked": () => {
    const decision = json("docs/backend-readiness/p09-provider-conformance-query-closure.json");
    const external = decision.decisions.find((item) => item.decisionId === "DEC-P09-LIVE-PROVIDER-CONFORMANCE");
    assert(external?.status === "BLOCKED_EXTERNAL" && external.owner.includes("backend-provider"), "Live provider blocker is not explicit");
    const release = json("docs/quality/release-identity.json");
    assert(release.productionBaselineAccepted === false, "P0.9 reference conformance must not mark production accepted");
    assert(read("tests/contract/provider/reference-host/referenceProviderHost.mjs").includes("reference-provider-host"), "Reference host authority marker missing");
  },
  "p10-query-registry-decision-closure": () => {
    const decision = json("docs/backend-readiness/p10-provider-adapter-registry-closure.json");
    assert(decision.contractVersion === spec.info.version && decision.phase === "P0.10", "P0.10 decision pack drift");
    const registry = json("docs/backend-readiness/query-registry.json");
    const counts = registry.queries.reduce((all, item) => ({ ...all, [item.classification]: (all[item.classification] ?? 0) + 1 }), {});
    assert(registry.queries.length === 162, "Phase 16 query inventory drift");
    assert(!counts.UNRESOLVED && counts.PRODUCTION_API === 63 && counts.COMPOSED_READ_MODEL === 66 && counts.FRONTEND_LOCAL === 27 && counts.DEMO_ONLY === 5 && counts.BFF_CANDIDATE === 1, "P0.10 query classification closure drift");
    assert(!registry.queries.some((item) => item.classification === "UNRESOLVED"), "P0.10 leaves unresolved query symbols");
    const markdown = read("docs/backend-readiness/query-registry.md");
    assert(markdown.includes("UNRESOLVED: 0") && !markdown.includes("| UNRESOLVED |"), "Query registry Markdown is stale");
  },
  "p10-application-dto-adapter-boundary": () => {
    const registry = json("docs/backend-readiness/query-registry.json");
    const authority = new Map(registry.moduleAuthorityQueries.map((item) => [item.module, item]));
    const expected = { leads: ["listLeads","getLead"], products: ["listProducts","getProduct"], shipping: ["listShippingBookings","getShippingBooking"], returns: ["listReturns","getReturn"] };
    for (const [module, [listOperation, detailOperation]] of Object.entries(expected)) {
      const item = authority.get(module);
      assert(item?.list?.operationId === listOperation && item?.detail?.operationId === detailOperation, `${module}: module query authority drift`);
      assert(item.listStatus === "PRODUCTION_API" && item.detailStatus === "PRODUCTION_API", `${module}: module query authority is not production`);
    }
    const composition = read("src/app/composition/connectedModuleQueryResponseMappers.ts");
    for (const token of ["mapLeadDocumentToApplication","mapProductDocumentToApplication","mapShippingBookingReadModelToApplication","mapReturnReadModelToApplication"]) assert(composition.includes(token), `Connected mapper registry misses ${token}`);
    const authoritySource = read("src/platform/api/runtime/HttpModuleDataAuthority.ts");
    for (const token of ["ModuleQueryResponseMapperRegistry","mapListItem","mapDetail","mappers[key]"]) assert(authoritySource.includes(token), `HTTP module query mapper boundary misses ${token}`);
  },
  "p10-application-dto-money-safety": () => {
    const lead = read("src/modules/leads/infrastructure/http/LeadApiMapper.ts");
    const product = read("src/modules/products/infrastructure/openapi/productReadModelMapper.ts");
    const shipping = read("src/modules/shipping/infrastructure/openapi/shippingReadModelMapper.ts");
    const returns = read("src/modules/returns/infrastructure/openapi/returnReadModelMapper.ts");
    assert(lead.includes("estimatedValue: dto.estimatedValue") && lead.includes("moneyToDisplayNumber"), "Lead mapper does not preserve authoritative Money");
    assert(product.includes("unitPrice: dto.unitPrice") && product.includes("costPriceMoney: dto.costPrice"), "Product mapper does not preserve authoritative Money");
    assert(shipping.includes("shippingFee: dto.shippingFee") && shipping.includes("codAmount: dto.codAmount") && shipping.includes("resourceVersion: dto.resourceVersion"), "Shipping mapper loses Money/version evidence");
    assert(returns.includes("version: dto.resourceVersion"), "Return mapper must map authoritative version into application version");
    for (const file of filesUnder("src/modules/shipping").filter((name) => /(?:rules|queries|commands|providers).*\.(?:ts|tsx)$/u.test(name))) {
      const source = read(file);
      assert(!/\.amount\s*(?:>|<|>=|<=)\s*\d/u.test(source), `${file}: authoritative Money compared as JavaScript number`);
    }
  },
  "p10-connected-query-mapper-fail-closed": () => {
    const lead = read("src/modules/leads/infrastructure/http/LeadApiMapper.ts");
    const returns = read("src/modules/returns/infrastructure/openapi/returnReadModelMapper.ts");
    assert(lead.includes("CONNECTED_QUERY_CONTRACT_VIOLATION") && lead.includes("activityProjection"), "Lead mapper does not reject incomplete timeline authority");
    assert(returns.includes("CONNECTED_QUERY_CONTRACT_VIOLATION") && returns.includes("Return eligibility projection is incomplete"), "Return mapper does not reject incomplete eligibility authority");
    const composition = read("src/app/composition/applicationComposition.ts");
    assert(composition.includes("CONNECTED_MODULE_QUERY_RESPONSE_MAPPERS"), "Connected composition does not install application DTO mappers");
  },
  "p10-process-isolated-provider-conformance": () => {
    const server = read("tests/contract/provider/reference-host/serveReferenceProviderHost.mjs");
    const external = read("tests/contract/provider/run-external-reference-provider-conformance.mjs");
    const runner = read("tests/contract/provider/run-reference-provider-conformance.mjs");
    for (const token of ["UNICORE_REFERENCE_PROVIDER_BASE_URL","SIGTERM","createReferenceProviderHost"]) assert(server.includes(token), `Process host misses ${token}`);
    for (const token of ["spawn","serveReferenceProviderHost.mjs","UNICORE_REFERENCE_PROVIDER_BASE_URL","process-isolated conformance"]) assert(external.includes(token), `External process runner misses ${token}`);
    assert(runner.includes("process.env.UNICORE_REFERENCE_PROVIDER_BASE_URL") && runner.includes("if(host)await host.stop()"), "Reference runner cannot target an external process");
  },
  "p10-live-provider-remains-external": () => {
    const decision = json("docs/backend-readiness/p10-provider-adapter-registry-closure.json");
    const live = decision.decisions.find((item) => item.decisionId === "DEC-P10-LIVE-DURABLE-PROVIDER-CONFORMANCE");
    assert(live?.status === "BLOCKED_EXTERNAL", "P0.10 incorrectly claims live provider conformance");
    assert(live.owner.includes("backend-provider"), "Live provider blocker has no backend owner");
    assert(json("docs/quality/release-identity.json").productionBaselineAccepted === false, "P0.10 must not mark production baseline accepted");
  },
  "commercial-read-provider-contract-pack": () => {
    const pack = json("tests/fixtures/backend-contract/commercial-read-models/provider-scenarios.json");
    assert(pack.contractVersion === spec.info.version && pack.scenarios.length === 6, "Commercial read provider scenario pack incomplete");
    const fixtures = { "deal-list.json": "DealListResponse", "deal-detail.json": "DealReadModel", "quote-list.json": "QuoteListResponse", "quote-detail.json": "QuoteReadModel", "order-list.json": "OrderListResponse", "order-detail.json": "OrderReadModel" };
    for (const [file, schemaName] of Object.entries(fixtures)) {
      const issues = validate(schemas[schemaName], json(`tests/fixtures/backend-contract/commercial-read-models/${file}`));
      assert(issues.length === 0, `${file}: ${issues.join("; ")}`);
    }
    const invalid = validate(schemas.QuoteReadModel, json("tests/fixtures/backend-contract/commercial-read-models/invalid-quote-unknown-status.json"));
    assert(invalid.some((item) => item.includes("unknown enum")), "Unknown Quote status fixture was accepted");
    const runner = read("tests/contract/provider/run-commercial-read-model-provider-contract.mjs");
    for (const token of ["listDeals", "getDeal", "listQuotes", "getQuote", "listOrders", "getOrder", "WORKSPACE_MISMATCH", "resourceVersion"]) assert(runner.includes(token), `Commercial read provider runner misses ${token}`);
  },
  "unknown-enum-behavior": () => {
    const fixture = json("tests/fixtures/backend-contract/unknown-enum-response.json");
    const issues = validate(schemas.IssueInvoiceResponse, fixture);
    assert(issues.some((x) => x.includes("unknown enum")), "Unknown business enum was accepted");
    assert(read("src/platform/api/contracts/openApiRuntimeValidation.ts").includes("Unknown enum value"), "Runtime unknown-enum rejection missing");
  },
  "problem-response-parsing": () => {
    for (const p of ["problem-validation.json", "problem-version-conflict.json", "problem-idempotency-conflict.json", "cross-workspace-denied.json"]) {
      const issues = validate(schemas.ProblemDetails, json(`tests/fixtures/backend-contract/${p}`)); assert(issues.length === 0, `${p}: ${issues.join("; ")}`);
    }
    const source = read("src/platform/api/client/FetchHttpClient.ts");
    assert(source.includes("application/problem+json") || source.includes("Problem Details"), "Problem Details parser not documented");
    assert(source.includes("source.code") && source.includes("correlationId"), "Stable code/correlation parsing missing");
  },
  "duplicate-execution-contract": () => {
    const f = json("tests/fixtures/backend-contract/duplicate-execution-contract.json");
    assert(f.policy === "REQUIRED" && f.sameKeySamePayload.outcome === "REPLAYED", "Replay contract incomplete");
    assert(f.sameKeyDifferentPayload.code === "IDEMPOTENCY_KEY_REUSED" && f.concurrentDuplicate.code === "IDEMPOTENCY_REQUEST_IN_PROGRESS", "Duplicate conflict contract incomplete");
  },
  "concurrency-conflict-contract": () => {
    const f = json("tests/fixtures/backend-contract/concurrency-conflict-contract.json");
    assert(f.requestHeader === "If-Match" && f.httpStatus === 412 && f.code === "VERSION_CONFLICT", "Concurrency fixture incomplete");
    const problem = json("tests/fixtures/backend-contract/problem-version-conflict.json");
    for (const key of f.requiredFields) assert(problem[key] !== undefined, `Version conflict missing ${key}`);
  },
  "cross-workspace-denial": () => {
    const f = json("tests/fixtures/backend-contract/cross-workspace-denied.json");
    assert(f.status === 403 && f.code === "WORKSPACE_MISMATCH", "Cross-workspace fixture invalid");
    for (const op of operations.filter((x) => x["x-contract-status"] === "PRODUCTION_CONTRACT_READY")) {
      if (op.tags?.includes("Identity")) assert(op["x-workspace-required"] === false && op["x-data-scope"] === "GLOBAL_IDENTITY", `${op.operationId}: identity isolation metadata incomplete`);
      else if (op.tags?.includes("WorkspaceBootstrap")) assert(op["x-workspace-required"] === false && ["GLOBAL_IDENTITY", "SELECTED_WORKSPACE"].includes(op["x-data-scope"]), `${op.operationId}: workspace bootstrap isolation metadata incomplete`);
      else if (op.tags?.includes("AccessGovernance")) assert(op["x-workspace-required"] === true && op["x-data-scope"] === "SELECTED_WORKSPACE", `${op.operationId}: access governance isolation metadata incomplete`);
      else if (op.tags?.includes("WorkspaceConfiguration") || op.tags?.includes("StudioQuickSetup")) assert(op["x-workspace-required"] === true && op["x-data-scope"] === "SELECTED_WORKSPACE", `${op.operationId}: Studio isolation metadata incomplete`);
      else assert(op["x-workspace-required"] === true && op["x-data-scope"] === "WORKSPACE", `${op.operationId}: isolation metadata incomplete`);
    }
  },
  "inventory-integrity": () => {
    const d = json("docs/backend-readiness/contract-inventory.json");
    assert(d.modules.length === 15 && d.routeCount === 78 && d.commands === 173 && d.queries === 162 && d.workflows === 27 && d.openApiOperations === 270, "Contract inventory drift");
    assert(d.genericProductionMutationRequestOperations === 0 && d.genericProductionMutationResponseOperations === 0, "Generic mutation inventory non-zero");
    for (const forbidden of ["node_modules", "dist", ".git", "coverage", "playwright-report", "test-results"]) assert(!exists(forbidden), `Forbidden artifact present: ${forbidden}`);
    const repositoryInventory = json("docs/quality/repository-inventory.json");
    assert(repositoryInventory.summary.repositoryFiles >= 1558, "Unexpected source file loss");
    assert(d.sourceInputSha256 === "34da811714597df29b09505e51d5c283dd67707421b5ed75940281e2fa804f8a", "P0.10 input SHA authority drift");
    assert(d.providerContractPacks === 26 && d.providerScenarios === 516, "Provider contract inventory incomplete");
    const operationStatus = json("docs/backend-readiness/operation-contract-status.json");
    assert(operationStatus.contractVersion === spec.info.version, "Operation status contract version drift");
    assert(operationStatus.operations.length === operations.length, "Operation status registry coverage drift");
    const statusByOperation = new Map(operationStatus.operations.map((entry) => [entry.operationId, entry]));
    for (const operation of operations) {
      const entry = statusByOperation.get(operation.operationId);
      assert(entry && entry.method === operation.method && entry.path === operation.route, `${operation.operationId}: operation status ownership drift`);
      assert(entry.status === operation["x-contract-status"], `${operation.operationId}: operation status classification drift`);
      assert((entry.blockingDecisionId ?? null) === (operation["x-blocking-decision-id"] ?? null), `${operation.operationId}: blocker decision drift`);
    }
  },
};

if (!gate || !checks[gate]) throw new Error(`Unknown backend contract hardening gate: ${gate ?? "<missing>"}`);
checks[gate]();
console.log(`[backend-contract-hardening] PASS ${gate}`);
