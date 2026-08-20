import { collectOperations, operationParameters, requestBodyType, responseType, resolveRef } from "./validate.mjs";

function componentRef(value) {
  return value?.$ref?.startsWith("#/components/schemas/") ? value.$ref.slice("#/components/schemas/".length) : null;
}

function parameterSchema(document, parameter) {
  const schema = parameter.schema?.$ref ? parameter.schema : resolveRef(document, parameter.schema);
  return {
    ref: componentRef(parameter.schema),
    type: schema?.type ?? null,
    format: schema?.format ?? null,
    pattern: schema?.pattern ?? null,
  };
}

function headerPolicy(operationRecord, document, headerName) {
  return operationParameters(document, operationRecord).header.some((parameter) => parameter.name === headerName && parameter.required === true);
}

function authPolicy(operationRecord, document) {
  const security = operationRecord.operation.security ?? document.security ?? [];
  return security.length > 0 ? "REQUIRED" : "NONE";
}

function workspacePolicy(operationRecord, document) {
  return headerPolicy(operationRecord, document, "X-Workspace-Id") ? "REQUIRED" : "NOT_REQUIRED";
}

function successStatus(operation) {
  return ["200", "201", "202"].find((status) => operation.responses?.[status]) ?? null;
}

function operationTag(operation) {
  return operation.tags?.[0] ?? "Unknown";
}

function findClient(ownership, tag) {
  const matches = ownership.clients.filter((client) => client.tags.includes(tag));
  if (matches.length !== 1) throw new Error(`Expected exactly one generated client for tag ${tag}, found ${matches.length}.`);
  return matches[0];
}

export function normalizeOpenApi(document, ownership) {
  const operations = collectOperations(document).map((record) => {
    const tag = operationTag(record.operation);
    const client = findClient(ownership, tag);
    const parameters = operationParameters(document, record);
    const adapter = client.adapterByTag?.[tag] ?? null;
    return {
      ...record,
      tag,
      ownerModule: client.ownerByTag[tag],
      clientId: client.id,
      generatedClient: {
        file: client.output,
        className: client.className,
        method: record.operationId,
      },
      httpAdapter: adapter,
      adapterStatus: record.operation["x-contract-status"] === "BLOCKED"
        ? "BLOCKED_BY_CONTRACT"
        : adapter ? "CONNECTED_BOUNDARY_DECLARED" : "PENDING_CONNECTED_ADAPTER",
      testGateIds: [...client.testGateIds].sort(),
      operationKind: record.method === "GET" ? "QUERY" : "COMMAND",
      contractStatus: record.operation["x-contract-status"] ?? "PRODUCTION_CONTRACT_READY",
      blockingDecisionId: record.operation["x-blocking-decision-id"] ?? null,
      requiredCapability: record.operation["x-required-capability"] ?? null,
      resourceScope: record.operation["x-resource-scope"] ?? null,
      dataScope: record.operation["x-data-scope"] ?? null,
      authPolicy: authPolicy(record, document),
      workspacePolicy: workspacePolicy(record, document),
      auditRequirement: record.operation["x-audit-requirement"] ?? null,
      transactionBoundary: record.operation["x-transaction-boundary"] ?? null,
      idempotencyPolicy: record.operation["x-idempotency-policy"] ?? (headerPolicy(record, document, "Idempotency-Key") ? "REQUIRED" : "NOT_APPLICABLE"),
      concurrencyPolicy: record.operation["x-concurrency-policy"] ?? (headerPolicy(record, document, "If-Match") ? "IF_MATCH_REQUIRED" : "NOT_APPLICABLE"),
      requestBodySchema: requestBodyType(record.operation) ?? null,
      responseSchema: record.operation["x-contract-status"] === "BLOCKED" ? null : responseType(record.operation),
      successStatus: successStatus(record.operation),
      parameters: parameters.all.map((parameter) => ({
        name: parameter.name,
        in: parameter.in,
        required: parameter.required === true,
        schema: parameterSchema(document, parameter),
      })).sort((left, right) => `${left.in}:${left.name}`.localeCompare(`${right.in}:${right.name}`)),
    };
  });

  return {
    document,
    ownership,
    operations,
    operationsByClient: new Map(ownership.clients.map((client) => [client.id, operations.filter((operation) => operation.clientId === client.id)])),
  };
}


export function buildApiOperationCatalog(normalized, sha256) {
  const operations = normalized.operations.map((operation) => ({
    operationId: operation.operationId,
    moduleId: operation.ownerModule,
    boundedContext: operation.tag,
    kind: operation.operationKind,
    method: operation.method,
    path: operation.route,
    contractStatus: operation.contractStatus,
    blockingDecisionId: operation.blockingDecisionId,
    generatedClient: {
      id: operation.clientId,
      file: operation.generatedClient.file,
      className: operation.generatedClient.className,
      method: operation.generatedClient.method,
    },
    adapter: {
      file: operation.httpAdapter,
      status: operation.adapterStatus,
    },
    request: {
      schema: operation.requestBodySchema,
      parameters: operation.parameters,
    },
    response: {
      schema: operation.responseSchema,
      successStatus: operation.successStatus,
    },
    authorization: {
      auth: operation.authPolicy,
      workspace: operation.workspacePolicy,
      capability: operation.requiredCapability,
      resourceScope: operation.resourceScope,
      dataScope: operation.dataScope,
    },
    delivery: {
      idempotency: operation.idempotencyPolicy,
      concurrency: operation.concurrencyPolicy,
      audit: operation.auditRequirement,
      transactionBoundary: operation.transactionBoundary,
    },
    testGateIds: operation.testGateIds,
  }));

  return {
    schemaVersion: 1,
    generatorVersion: 1,
    authority: "docs/api/openapi.json",
    contractVersion: normalized.document.info.version,
    specSha256: sha256,
    generatedAt: "DETERMINISTIC",
    summary: {
      operations: operations.length,
      queries: operations.filter((operation) => operation.kind === "QUERY").length,
      commands: operations.filter((operation) => operation.kind === "COMMAND").length,
      productionReady: operations.filter((operation) => operation.contractStatus === "PRODUCTION_CONTRACT_READY").length,
      blocked: operations.filter((operation) => operation.contractStatus === "BLOCKED").length,
      modules: new Set(operations.map((operation) => operation.moduleId)).size,
    },
    operations,
  };
}

export function buildOperationCoverageLedger(normalized, sha256) {
  return {
    schemaVersion: 1,
    generatorVersion: 11,
    contractVersion: normalized.document.info.version,
    specSha256: sha256,
    generatedAt: "DETERMINISTIC",
    coveragePolicy: {
      ownerModule: "REQUIRED",
      generatedClient: "REQUIRED",
      httpAdapter: "EXPLICIT_STATUS_REQUIRED",
      testCoverage: "AT_LEAST_ONE_STABLE_GATE_ID",
      idempotency: "DERIVED_FROM_IDEMPOTENCY_KEY_HEADER",
      concurrency: "DERIVED_FROM_IF_MATCH_HEADER",
    },
    summary: {
      operations: normalized.operations.length,
      ownedOperations: normalized.operations.filter((operation) => operation.ownerModule).length,
      generatedClientMappings: normalized.operations.filter((operation) => operation.generatedClient).length,
      productionReadyOperations: normalized.operations.filter((operation) => operation.contractStatus === "PRODUCTION_CONTRACT_READY").length,
      blockedOperations: normalized.operations.filter((operation) => operation.contractStatus === "BLOCKED").length,
      declaredConnectedBoundaries: normalized.operations.filter((operation) => operation.adapterStatus === "CONNECTED_BOUNDARY_DECLARED").length,
      blockedByContract: normalized.operations.filter((operation) => operation.adapterStatus === "BLOCKED_BY_CONTRACT").length,
      pendingConnectedAdapters: normalized.operations.filter((operation) => operation.adapterStatus === "PENDING_CONNECTED_ADAPTER").length,
    },
    operations: normalized.operations.map((operation) => ({
      operationId: operation.operationId,
      method: operation.method,
      path: operation.route,
      boundedContext: operation.tag,
      ownerModule: operation.ownerModule,
      generatedClient: operation.generatedClient,
      httpAdapter: operation.httpAdapter,
      adapterStatus: operation.adapterStatus,
      testGateIds: operation.testGateIds,
      idempotencyPolicy: operation.idempotencyPolicy,
      concurrencyPolicy: operation.concurrencyPolicy,
      requestBodySchema: operation.requestBodySchema,
      responseSchema: operation.responseSchema,
      successStatus: operation.successStatus,
      contractStatus: operation.contractStatus,
      blockingDecisionId: operation.blockingDecisionId,
      requiredCapability: operation.requiredCapability,
      resourceScope: operation.resourceScope,
      dataScope: operation.dataScope,
    })),
  };
}

function normalizeSchema(schema) {
  if (Array.isArray(schema)) return schema.map(normalizeSchema);
  if (!schema || typeof schema !== "object") return schema;
  return Object.fromEntries(Object.entries(schema)
    .filter(([key]) => !["description", "example", "examples", "title"].includes(key))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => [key, normalizeSchema(value)]));
}

export function buildBreakingBaseline(normalized) {
  return {
    schemaVersion: 1,
    contractVersion: normalized.document.info.version,
    acceptedAt: "DETERMINISTIC",
    operations: normalized.operations.map((operation) => ({
      operationId: operation.operationId,
      method: operation.method,
      path: operation.route,
      parameters: operation.parameters,
      requestBody: operation.requestBodySchema === null ? null : {
        required: operation.operation.requestBody?.required === true,
        schema: operation.requestBodySchema,
      },
      success: operation.contractStatus === "BLOCKED" ? null : {
        status: operation.successStatus,
        schema: operation.responseSchema,
      },
      contractStatus: operation.contractStatus,
      blockingDecisionId: operation.blockingDecisionId,
    })),
    schemas: Object.fromEntries(Object.entries(normalized.document.components?.schemas ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, schema]) => [name, normalizeSchema(schema)])),
  };
}
