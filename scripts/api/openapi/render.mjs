import fs from "node:fs";
import path from "node:path";
import { repositoryRoot } from "../../quality/core/repo-context.mjs";
import { buildApiOperationCatalog, buildOperationCoverageLedger } from "./normalize.mjs";
import { getServerPath, refName, resolveRef } from "./validate.mjs";

const generatorVersion = 15;

function schemaType(schema) {
  if (schema === true || !schema || Object.keys(schema).length === 0) return "unknown";
  if (schema.$ref) return refName(schema.$ref);
  if (schema.enum) return schema.enum.map((value) => JSON.stringify(value)).join(" | ");
  if (schema.type === "string") return "string";
  if (schema.type === "integer" || schema.type === "number") return "number";
  if (schema.type === "boolean") return "boolean";
  if (schema.type === "array") return `Array<${schemaType(schema.items)}>`;
  if (schema.type === "object" || schema.properties || schema.additionalProperties) {
    if (!schema.properties && schema.additionalProperties) return `Record<string, ${schemaType(schema.additionalProperties)}>`;
    return "Record<string, unknown>";
  }
  return "unknown";
}

function propertyName(name) { return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name); }

function renderSchema(name, schema) {
  if (schema.type === "array") return `export type ${name} = ${schemaType(schema)};`;
  if (schema.enum || (schema.type !== "object" && !schema.properties && !schema.additionalProperties)) return `export type ${name} = ${schemaType(schema)};`;
  if (!schema.properties && schema.additionalProperties) return `export type ${name} = ${schemaType(schema)};`;
  const required = new Set(schema.required ?? []);
  const properties = Object.entries(schema.properties ?? {}).map(([property, propertySchema]) =>
    `  ${propertyName(property)}${required.has(property) ? "" : "?"}: ${schemaType(propertySchema)};`,
  );
  return [`export interface ${name} {`, ...properties, `}`].join("\n");
}

function orderedSchemas(document) {
  const preferred = [
    "EntityId", "WorkspaceId", "RequestId", "CorrelationId", "IdempotencyKey", "ResourceVersion",
    "DecimalAmount", "CurrencyCode", "Money", "UtcDateTime", "BusinessDate", "CursorToken", "PageInfo",
    "BuyerType", "BuyerRef", "SettlementState", "AgingBucket", "ReceivableEntry", "ReceivablesListResponse",
    "ReceivablesSummary", "AgingBucketSummary", "AgingBuckets", "ReceivablesAgingSummary", "AccountStatementResponse",
    "ProblemFieldErrors", "ErrorCode", "ProblemDetails",
  ];
  const schemas = document.components?.schemas ?? {};
  return [...new Set([...preferred.filter((name) => schemas[name]), ...Object.keys(schemas).sort()])];
}

function operationParameters(document, operationRecord) {
  const parameters = [...(operationRecord.pathItem.parameters ?? []), ...(operationRecord.operation.parameters ?? [])]
    .map((parameter) => resolveRef(document, parameter));
  return {
    path: parameters.filter((parameter) => parameter.in === "path"),
    query: parameters.filter((parameter) => parameter.in === "query"),
  };
}


function operationHeaderParameters(document, operationRecord) {
  return [...(operationRecord.pathItem.parameters ?? []), ...(operationRecord.operation.parameters ?? [])]
    .map((parameter) => resolveRef(document, parameter))
    .filter((parameter) => parameter.in === "header");
}

function operationAuthMode(document, operationRecord) {
  const security = operationRecord.operation.security ?? document.security ?? [];
  return security.length > 0 ? undefined : "none";
}

function operationWorkspaceMode(document, operationRecord) {
  const required = operationHeaderParameters(document, operationRecord)
    .some((parameter) => parameter.name === "X-Workspace-Id" && parameter.required === true);
  return required ? undefined : "none";
}

function renderTransportPolicyLines(document, operationRecord) {
  const lines = [];
  const auth = operationAuthMode(document, operationRecord);
  const workspace = operationWorkspaceMode(document, operationRecord);
  if (auth) lines.push(`      auth: ${JSON.stringify(auth)},`);
  if (workspace) lines.push(`      workspace: ${JSON.stringify(workspace)},`);
  if (operationRecord.operation["x-credentials-policy"] === "INCLUDE") lines.push('      credentials: "include",');
  return lines;
}

function responseType(operation) {
  const success = operation.responses?.["200"] ?? operation.responses?.["201"] ?? operation.responses?.["202"];
  const schema = success?.content?.["application/json"]?.schema;
  if (!schema?.$ref) throw new Error(`Operation ${operation.operationId} must use a named success response schema.`);
  return refName(schema.$ref);
}

function requestBodyType(operation) {
  const schema = operation.requestBody?.content?.["application/json"]?.schema;
  return schema?.$ref ? refName(schema.$ref) : undefined;
}

function queryTypeName(operationId) { return `${operationId[0].toUpperCase()}${operationId.slice(1)}Query`; }

function renderQueryInterface(document, operationRecord) {
  const parameters = operationParameters(document, operationRecord).query;
  const name = queryTypeName(operationRecord.operationId);
  const lines = parameters.map((parameter) => {
    const schema = resolveRef(document, parameter.schema);
    return `  ${propertyName(parameter.name)}${parameter.required ? "" : "?"}: ${schemaType(parameter.schema?.$ref ? parameter.schema : schema)};`;
  });
  return [`export interface ${name} {`, ...lines, `}`].join("\n");
}

function renderPathExpression(route, pathParameters) {
  if (pathParameters.length === 0) return JSON.stringify(route);
  const expression = route.replaceAll(/\{([^}]+)\}/g, (_, parameterName) => `\${encodeURIComponent(${parameterName})}`);
  return `\`${expression}\``;
}

function renderBlockedMethod(operationRecord) {
  const decisionId = operationRecord.blockingDecisionId ?? "UNRESOLVED";
  return [
    `  ${operationRecord.operationId}(..._args: unknown[]): Promise<never> {`,
    `    return Promise.reject(new Error(${JSON.stringify("OPENAPI_OPERATION_BLOCKED:")} + ${JSON.stringify(decisionId)}));`,
    "  }",
  ].join("\n");
}

function renderReceivablesMethod(document, operationRecord) {
  if (operationRecord.contractStatus === "BLOCKED") return renderBlockedMethod(operationRecord);
  const { operation, operationId, method, route } = operationRecord;
  const parameters = operationParameters(document, operationRecord);
  const queryName = queryTypeName(operationId);
  const resultType = responseType(operation);
  const pathArguments = parameters.path.map((parameter) => {
    const schema = resolveRef(document, parameter.schema);
    return `${parameter.name}: ${schemaType(parameter.schema?.$ref ? parameter.schema : schema)}`;
  });
  const argumentsList = [...pathArguments, `query: ${queryName} = {}`, "signal?: AbortSignal"].join(", ");
  const queryEntries = parameters.query.map((parameter) => `        ${propertyName(parameter.name)}: query.${parameter.name},`);
  return [
    `  ${operationId}(${argumentsList}): Promise<${resultType}> {`,
    `    return this.http.request<${resultType}>({`,
    `      operationId: ${JSON.stringify(operationId)},`,
    `      method: ${JSON.stringify(method)},`,
    `      path: ${renderPathExpression(route, parameters.path)},`,
    ...renderTransportPolicyLines(document, operationRecord),
    ...(queryEntries.length ? ["      query: {", ...queryEntries, "      },"] : []),
    "      ...(signal === undefined ? {} : { signal }),",
    "    });",
    "  }",
  ].join("\n");
}

function renderFinancialMethod(document, operationRecord) {
  if (operationRecord.contractStatus === "BLOCKED") return renderBlockedMethod(operationRecord);
  const { operation, operationId, method, route } = operationRecord;
  const parameters = operationParameters(document, operationRecord);
  const queryName = queryTypeName(operationId);
  const defaultResponse = responseType(operation);
  const bodyType = requestBodyType(operation);
  const pathArguments = parameters.path.map((parameter) => {
    const schema = resolveRef(document, parameter.schema);
    return `${parameter.name}: ${schemaType(parameter.schema?.$ref ? parameter.schema : schema)}`;
  });
  const queryEntries = parameters.query.map((parameter) => `        ${propertyName(parameter.name)}: query.${parameter.name},`);
  if (bodyType) {
    const args = [...pathArguments, "body: TBody", "options: FinancialRequestOptions = {}"].join(", ");
    return [
      `  ${operationId}<TResponse = ${defaultResponse}, TBody extends object = ${bodyType}>(${args}): Promise<TResponse> {`,
      `    return this.http.request<TResponse, TBody>({`,
      `      operationId: ${JSON.stringify(operationId)},`,
      `      method: ${JSON.stringify(method)},`,
      `      path: ${renderPathExpression(route, parameters.path)},`,
      ...renderTransportPolicyLines(document, operationRecord),
      "      body,",
      "      ...(options.signal === undefined ? {} : { signal: options.signal }),",
      "      ...(options.idempotencyKey === undefined ? {} : { idempotencyKey: options.idempotencyKey }),",
      "      ...(options.expectedVersion === undefined ? {} : { expectedVersion: options.expectedVersion }),",
      "      retry: options.retry ?? \"never\",",
      "    });",
      "  }",
    ].join("\n");
  }
  const queryArgument = parameters.query.some((parameter) => parameter.required)
    ? `query: ${queryName}`
    : `query: ${queryName} = {}`;
  const args = [...pathArguments, queryArgument, "signal?: AbortSignal"].join(", ");
  return [
    `  ${operationId}<TResponse = ${defaultResponse}>(${args}): Promise<TResponse> {`,
    `    return this.http.request<TResponse>({`,
    `      operationId: ${JSON.stringify(operationId)},`,
    `      method: ${JSON.stringify(method)},`,
    `      path: ${renderPathExpression(route, parameters.path)},`,
    ...renderTransportPolicyLines(document, operationRecord),
    ...(queryEntries.length ? ["      query: {", ...queryEntries, "      },"] : []),
    "      ...(signal === undefined ? {} : { signal }),",
    "    });",
    "  }",
  ].join("\n");
}

function renderHeader(document, sha256) {
  return [
    "// @generated by scripts/api/generate-openapi-client.mjs. Do not edit by hand.",
    `// OpenAPI ${document.openapi}; contract ${document.info.version}; SHA-256 ${sha256}`,
    'import type { HttpClient } from "@/platform/api/client";',
    "",
    `export const OPENAPI_CONTRACT_VERSION = ${JSON.stringify(document.info.version)} as const;`,
    `export const OPENAPI_SPEC_SHA256 = ${JSON.stringify(sha256)} as const;`,
    `export const OPENAPI_SERVER_PATH = ${JSON.stringify(getServerPath(document))} as const;`,
    "",
  ];
}

function renderReceivablesClient(document, sha256, operations) {
  const schemas = document.components.schemas;
  const used = [
    "EntityId", "WorkspaceId", "RequestId", "CorrelationId", "IdempotencyKey", "ResourceVersion", "DecimalAmount", "CurrencyCode", "Money",
    "UtcDateTime", "BusinessDate", "CursorToken", "PageInfo", "BuyerType", "BuyerRef", "SettlementState", "AgingBucket", "ReceivableEntry",
    "ReceivablesListResponse", "ReceivablesSummary", "AgingBucketSummary", "AgingBuckets", "ReceivablesAgingSummary", "AccountStatementResponse",
    "ProblemFieldErrors", "ErrorCode", "ProblemDetails",
  ];
  return [
    ...renderHeader(document, sha256),
    ...used.filter((name) => schemas[name]).flatMap((name) => [renderSchema(name, schemas[name]), ""]),
    ...operations.flatMap((operation) => [renderQueryInterface(document, operation), ""]),
    "export class ReceivablesApiClient {",
    "  constructor(private readonly http: HttpClient) {}",
    "",
    ...operations.flatMap((operation, index) => [renderReceivablesMethod(document, operation), ...(index === operations.length - 1 ? [] : [""])]),
    "}",
    "",
  ].join("\n");
}

function renderFinancialClient(document, sha256, operations) {
  const schemas = document.components.schemas;
  const usedNames = new Set(["EntityId", "ResourceVersion", "IdempotencyKey"]);
  for (const operation of operations) {
    if (operation.contractStatus === "BLOCKED") continue;
    usedNames.add(responseType(operation.operation));
    for (const [status, response] of Object.entries(operation.operation.responses ?? {})) {
      if (!/^2\d\d$/u.test(status)) continue;
      const responseRef = response?.content?.["application/json"]?.schema?.$ref;
      if (responseRef) usedNames.add(refName(responseRef));
    }
    const body = requestBodyType(operation.operation);
    if (body) usedNames.add(body);
    for (const parameter of [...operationParameters(document, operation).path, ...operationParameters(document, operation).query]) {
      if (parameter.schema?.$ref) usedNames.add(refName(parameter.schema.$ref));
    }
  }
  const expand = (name) => {
    if (usedNames.has(name) && schemas[name]) {
      const source = JSON.stringify(schemas[name]);
      for (const match of source.matchAll(/#\/components\/schemas\/([^"/]+)/g)) usedNames.add(match[1]);
    }
  };
  for (let index = 0; index < 8; index += 1) [...usedNames].forEach(expand);
  const names = orderedSchemas(document).filter((name) => usedNames.has(name));
  return [
    ...renderHeader(document, sha256),
    "export interface FinancialRequestOptions {",
    "  signal?: AbortSignal;",
    "  idempotencyKey?: string;",
    "  expectedVersion?: number;",
    '  retry?: "never" | "idempotent";',
    "}",
    "",
    ...names.flatMap((name) => [renderSchema(name, schemas[name]), ""]),
    ...operations.flatMap((operation) => [renderQueryInterface(document, operation), ""]),
    "export class FinancialApiClient {",
    "  constructor(private readonly http: HttpClient) {}",
    "",
    ...operations.flatMap((operation, index) => [renderFinancialMethod(document, operation), ...(index === operations.length - 1 ? [] : [""])]),
    "}",
    "",
  ].join("\n");
}


function readRepositoryJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8"));
}

function renderOperationContractStatus(document, operations) {
  const status = {
    schemaVersion: 2,
    contractVersion: document.info.version,
    operations: operations
      .map((record) => ({
        operationId: record.operationId,
        method: record.method,
        path: record.route,
        status: record.contractStatus,
        blockingDecisionId: record.blockingDecisionId ?? null,
      }))
      .sort((left, right) => left.operationId.localeCompare(right.operationId)),
  };
  return `${JSON.stringify(status, null, 2)}\n`;
}

function renderRuntimeContract(document, operations) {
  const operationContracts = Object.fromEntries(operations.map((record) => {
    const ready = record.contractStatus === "PRODUCTION_CONTRACT_READY";
    const responseSchemas = ready
      ? Object.fromEntries(Object.entries(record.operation.responses ?? {})
          .filter(([status]) => /^2\d\d$/u.test(status))
          .map(([status, response]) => [status, response?.content?.["application/json"]?.schema?.$ref ? refName(response.content["application/json"].schema.$ref) : null])
          .filter(([, schema]) => schema))
      : {};
    return [record.operationId, {
      contractStatus: record.contractStatus,
      requestSchema: ready ? requestBodyType(record.operation) ?? null : null,
      responseSchema: ready ? responseType(record.operation) : null,
      responseSchemas,
    }];
  }));
  return [
    "// @generated by scripts/api/generate-openapi-client.mjs. Do not edit by hand.",
    `export const OPENAPI_RUNTIME_CONTRACT_VERSION = ${JSON.stringify(document.info.version)} as const;`,
    `export const OPENAPI_OPERATION_RUNTIME_CONTRACTS = ${JSON.stringify(operationContracts)} as const;`,
    `export const OPENAPI_RUNTIME_SCHEMAS = ${JSON.stringify(document.components?.schemas ?? {})} as const;`,
    "",
  ].join("\n");
}

function renderProductionCommandRegistry(normalized) {
  const registry = readRepositoryJson("docs/backend-readiness/command-registry.json");
  const operationById = new Map(normalized.operations.map((record) => [record.operationId, record]));
  const commands = registry.commands
    .filter((command) => command.status === "PRODUCTION_CONTRACT_READY" && !["DEDICATED_MODULE_HTTP_ADAPTER", "DEDICATED_WORKFLOW_HTTP_ADAPTER"].includes(command.runtimeImplementationMode))
    .sort((left, right) => left.commandType.localeCompare(right.commandType));
  const rows = commands.map((command) => {
    const operation = operationById.get(command.openApiOperationId);
    if (!operation || operation.contractStatus !== "PRODUCTION_CONTRACT_READY") {
      throw new Error(`${command.commandType}: production command does not map to a ready OpenAPI operation.`);
    }
    const pathParameter = operation.route.match(/\{([^}]+)\}/u)?.[1];
    const requestSchema = requestBodyType(operation.operation);
    const successSchema = responseType(operation.operation);
    if (requestSchema !== command.requestSchema || successSchema !== command.successResponseSchema) {
      throw new Error(`${command.commandType}: command registry schema drifted from OpenAPI.`);
    }
    const values = [
      `commandType: ${JSON.stringify(command.commandType)}`,
      `operationId: ${JSON.stringify(operation.operationId)}`,
      `method: ${JSON.stringify(operation.method)}`,
      `pathTemplate: ${JSON.stringify(operation.route)}`,
      ...(pathParameter ? [`pathParameter: ${JSON.stringify(pathParameter)}`] : []),
      `requestSchema: ${JSON.stringify(requestSchema)}`,
      `responseSchema: ${JSON.stringify(successSchema)}`,
      `requiredCapability: ${JSON.stringify(operation.requiredCapability)}`,
      `idempotencyPolicy: ${JSON.stringify(operation.idempotencyPolicy)}`,
      `concurrencyPolicy: ${JSON.stringify(operation.concurrencyPolicy)}`,
      `aggregateIdPolicy: ${JSON.stringify(command.aggregateIdPolicy)}`,
      `requestProjection: ${JSON.stringify(command.requestProjection)}`,
      `affectedModuleKeys: ${JSON.stringify(command.affectedModuleKeys ?? [command.moduleOwner === "commercial-evidence" ? "commercialEvidence" : command.moduleOwner])}`,
    ];
    return `  ${JSON.stringify(command.commandType)}: { ${values.join(", ")} },`;
  });
  return [
    "// @generated by scripts/api/generate-openapi-client.mjs from OpenAPI and docs/backend-readiness/command-registry.json.",
    "export interface ProductionCommandContract {",
    "  commandType: string;",
    "  operationId: string;",
    '  method: "POST" | "PATCH" | "PUT" | "DELETE";',
    "  pathTemplate: string;",
    "  pathParameter?: string;",
    "  requestSchema: string;",
    "  responseSchema: string;",
    "  requiredCapability: string;",
    '  idempotencyPolicy: "REQUIRED" | "OPTIONAL" | "NOT_APPLICABLE";',
    "  concurrencyPolicy: string;",
    '  aggregateIdPolicy: "MUST_MATCH_TARGET" | "SERVER_ASSIGNED";',
    "  requestProjection: string;",
    "  affectedModuleKeys: readonly string[];",
    "}",
    "",
    "export const PRODUCTION_COMMAND_CONTRACTS = {",
    ...rows,
    "} as const satisfies Record<string, ProductionCommandContract>;",
    "",
    "export type ProductionCommandType = keyof typeof PRODUCTION_COMMAND_CONTRACTS;",
    "",
  ].join("\n");
}

function renderProductionQueryRegistry(normalized) {
  const registry = readRepositoryJson("docs/backend-readiness/query-registry.json");
  const operationById = new Map(normalized.operations.map((record) => [record.operationId, record]));
  const rows = registry.moduleAuthorityQueries.map((module) => {
    const values = [`key: ${JSON.stringify(module.moduleKey)}`];
    if (module.listStatus === "PRODUCTION_API" && module.list) {
      const operation = operationById.get(module.list.operationId);
      if (!operation || operation.contractStatus !== "PRODUCTION_CONTRACT_READY" || operation.method !== "GET") {
        throw new Error(`${module.module}: list query does not map to a ready GET operation.`);
      }
      const allowed = [...(operation.pathItem.parameters ?? []), ...(operation.operation.parameters ?? [])]
        .map((parameter) => resolveRef(normalized.document, parameter))
        .filter((parameter) => parameter.in === "query")
        .map((parameter) => parameter.name);
      values.push(`list: { operationId: ${JSON.stringify(operation.operationId)}, path: ${JSON.stringify(operation.route)}, allowedQueryParameters: ${JSON.stringify(allowed)} }`);
    }
    if (module.detailStatus === "PRODUCTION_API" && module.detail) {
      const operation = operationById.get(module.detail.operationId);
      if (!operation || operation.contractStatus !== "PRODUCTION_CONTRACT_READY" || operation.method !== "GET") {
        throw new Error(`${module.module}: detail query does not map to a ready GET operation.`);
      }
      const pathParameter = operation.route.match(/\{([^}]+)\}/u)?.[1];
      if (!pathParameter) throw new Error(`${module.module}: detail route has no path parameter.`);
      values.push(`detail: { operationId: ${JSON.stringify(operation.operationId)}, pathTemplate: ${JSON.stringify(operation.route)}, pathParameter: ${JSON.stringify(pathParameter)} }`);
    }
    return `  { ${values.join(", ")} },`;
  });
  return [
    "// @generated by scripts/api/generate-openapi-client.mjs from OpenAPI and docs/backend-readiness/query-registry.json.",
    "export interface ProductionModuleQueryDefinition {",
    "  key: string;",
    "  list?: { operationId: string; path: string; allowedQueryParameters: readonly string[] };",
    "  detail?: { operationId: string; pathTemplate: string; pathParameter: string };",
    "}",
    "",
    "export const PRODUCTION_MODULE_QUERY_DEFINITIONS = [",
    ...rows,
    "] as const satisfies readonly ProductionModuleQueryDefinition[];",
    "",
  ].join("\n");
}


function renderApiOperationCatalogSource(catalog) {
  const byId = Object.fromEntries(catalog.operations.map((operation) => [operation.operationId, operation]));
  return [
    "// @generated by scripts/api/generate-openapi-client.mjs from OpenAPI. Do not edit by hand.",
    'export type ApiOperationKind = "QUERY" | "COMMAND";',
    'export type ApiContractStatus = "PRODUCTION_CONTRACT_READY" | "BLOCKED";',
    'export type ApiAdapterStatus = "CONNECTED_BOUNDARY_DECLARED" | "PENDING_CONNECTED_ADAPTER" | "BLOCKED_BY_CONTRACT";',
    "export interface ApiOperationParameterDefinition {",
    "  name: string;",
    "  in: string;",
    "  required: boolean;",
    "  schema: { ref: string | null; type: string | null; format: string | null; pattern: string | null };",
    "}",
    "export interface ApiOperationDefinition {",
    "  operationId: string;",
    "  moduleId: string;",
    "  boundedContext: string;",
    "  kind: ApiOperationKind;",
    "  method: string;",
    "  path: string;",
    "  contractStatus: ApiContractStatus;",
    "  blockingDecisionId: string | null;",
    "  generatedClient: { id: string; file: string; className: string; method: string };",
    "  adapter: { file: string | null; status: ApiAdapterStatus };",
    "  request: { schema: string | null; parameters: readonly ApiOperationParameterDefinition[] };",
    "  response: { schema: string | null; successStatus: string | null };",
    '  authorization: { auth: "REQUIRED" | "NONE"; workspace: "REQUIRED" | "NOT_REQUIRED"; capability: string | null; resourceScope: string | null; dataScope: string | null };',
    "  delivery: { idempotency: string; concurrency: string; audit: string | null; transactionBoundary: string | null };",
    "  testGateIds: readonly string[];",
    "}",
    "",
    `export const API_OPERATION_CATALOG = ${JSON.stringify(byId, null, 2)} as const satisfies Readonly<Record<string, ApiOperationDefinition>>;`,
    "",
    "export type ApiOperationId = keyof typeof API_OPERATION_CATALOG;",
    "export const API_OPERATION_IDS = Object.freeze(Object.keys(API_OPERATION_CATALOG) as ApiOperationId[]);",
    "const API_OPERATION_LOOKUP: Readonly<Record<string, ApiOperationDefinition>> = API_OPERATION_CATALOG;",
    "export function getApiOperationDefinition(operationId: string): ApiOperationDefinition | undefined {",
    "  return API_OPERATION_LOOKUP[operationId];",
    "}",
    "",
  ].join("\n");
}

export function renderGeneratedArtifacts(normalized, sha256) {
  const { document, ownership, operationsByClient } = normalized;
  const renderedClients = {};
  for (const client of ownership.clients) {
    const operations = operationsByClient.get(client.id) ?? [];
    if (client.id === "receivables") {
      renderedClients[client.output] = renderReceivablesClient(document, sha256, operations);
      continue;
    }
    let source = renderFinancialClient(document, sha256, operations);
    source = source.replaceAll("FinancialApiClient", client.className);
    source = source.replaceAll("FinancialRequestOptions", client.requestOptionsName);
    renderedClients[client.output] = source;
  }

  const indexSource = [
    "// @generated by scripts/api/generate-openapi-client.mjs. Do not edit by hand.",
    'export * from "./receivablesApi";',
    ...ownership.clients.filter((client) => client.id !== "receivables").flatMap((client) => {
      const modulePath = `./${client.output.split("/").at(-1).replace(/\.ts$/, "")}`;
      return [
        `export { ${client.className} } from ${JSON.stringify(modulePath)};`,
        ...(client.requestOptionsName ? [`export type { ${client.requestOptionsName} } from ${JSON.stringify(modulePath)};`] : []),
      ];
    }),
    "",
  ].join("\n");

  const coverage = buildOperationCoverageLedger(normalized, sha256);
  const operationCatalog = buildApiOperationCatalog(normalized, sha256);
  const operationCatalogSource = renderApiOperationCatalogSource(operationCatalog);
  const runtimeContractSource = renderRuntimeContract(document, normalized.operations);
  const operationContractStatusSource = renderOperationContractStatus(document, normalized.operations);
  const productionCommandRegistrySource = renderProductionCommandRegistry(normalized);
  const productionQueryRegistrySource = renderProductionQueryRegistry(normalized);
  const manifest = {
    schemaVersion: 2,
    generatorVersion,
    openapiVersion: document.openapi,
    contractVersion: document.info.version,
    specPath: "docs/api/openapi.json",
    specSha256: sha256,
    ownershipPath: "scripts/api/openapi/client-ownership.json",
    coverageLedgerPath: "docs/api/operation-coverage-ledger.json",
    breakingBaselinePath: "docs/api/openapi-breaking-baseline.json",
    generatedAt: "DETERMINISTIC",
    outputs: [...ownership.clients.map((client) => client.output), "src/platform/api/generated/index.ts", "src/platform/api/contracts/generatedOpenApiRuntimeContract.ts", "src/platform/api/contracts/generatedProductionCommandRegistry.ts", "src/platform/api/contracts/generatedProductionQueryRegistry.ts", "src/platform/api/catalog/generatedApiOperationCatalog.ts", "docs/api/api-operation-catalog.json", "docs/backend-readiness/operation-contract-status.json"],
    clients: ownership.clients.map((client) => ({
      id: client.id,
      tags: client.tags,
      output: client.output,
      className: client.className,
      requestOptionsName: client.requestOptionsName,
      operationCount: (operationsByClient.get(client.id) ?? []).length,
    })),
    operations: normalized.operations.map((operation) => ({
      operationId: operation.operationId,
      method: operation.method,
      path: operation.route,
      boundedContext: operation.tag,
      ownerModule: operation.ownerModule,
      generatedClientId: operation.clientId,
      generatedMethod: operation.generatedClient.method,
      idempotencyPolicy: operation.idempotencyPolicy,
      concurrencyPolicy: operation.concurrencyPolicy,
      contractStatus: operation.contractStatus,
      blockingDecisionId: operation.blockingDecisionId,
      requiredCapability: operation.requiredCapability,
    })),
  };

  return {
    checksum: `${sha256}  docs/api/openapi.json\n`,
    renderedClients,
    indexSource,
    manifestSource: `${JSON.stringify(manifest, null, 2)}\n`,
    coverageSource: `${JSON.stringify(coverage, null, 2)}\n`,
    operationCatalogSource,
    operationCatalogJsonSource: `${JSON.stringify(operationCatalog, null, 2)}\n`,
    runtimeContractSource,
    productionCommandRegistrySource,
    productionQueryRegistrySource,
    operationContractStatusSource,
    document,
    sha256,
  };
}
