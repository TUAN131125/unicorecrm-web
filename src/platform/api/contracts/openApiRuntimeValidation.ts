import {
  OPENAPI_OPERATION_RUNTIME_CONTRACTS,
  OPENAPI_RUNTIME_SCHEMAS,
} from "./generatedOpenApiRuntimeContract";

export interface OpenApiValidationIssue {
  path: string;
  message: string;
}

export interface OpenApiValidationResult {
  valid: boolean;
  issues: readonly OpenApiValidationIssue[];
}

type JsonSchema = Readonly<Record<string, unknown>>;

type OperationRuntimeContract = {
  contractStatus: string | null;
  requestSchema: string | null;
  responseSchema: string | null;
  responseSchemas?: Readonly<Record<string, string>>;
};

const operations = OPENAPI_OPERATION_RUNTIME_CONTRACTS as Readonly<Record<string, OperationRuntimeContract>>;
const schemas = OPENAPI_RUNTIME_SCHEMAS as Readonly<Record<string, JsonSchema>>;

export function validateOpenApiRequest(operationId: string, value: unknown): OpenApiValidationResult {
  return validateOperationPayload(operationId, "request", value);
}

export function validateOpenApiResponse(operationId: string, value: unknown, status?: number): OpenApiValidationResult {
  return validateOperationPayload(operationId, "response", value, status);
}

function validateOperationPayload(
  operationId: string,
  direction: "request" | "response",
  value: unknown,
  responseStatus?: number,
): OpenApiValidationResult {
  const operation = operations[operationId];
  if (!operation) return invalid("$", `Unknown OpenAPI operationId ${operationId}.`);
  if (operation.contractStatus !== "PRODUCTION_CONTRACT_READY") {
    return invalid("$", `Operation ${operationId} is ${operation.contractStatus ?? "UNCLASSIFIED"}.`);
  }
  const schemaName = direction === "request"
    ? operation.requestSchema
    : responseStatus === undefined
      ? operation.responseSchema
      : operation.responseSchemas?.[String(responseStatus)] ?? operation.responseSchema;
  if (!schemaName) {
    return value === undefined
      ? { valid: true, issues: [] }
      : invalid("$", `Operation ${operationId} has no declared ${direction} schema.`);
  }
  const issues: OpenApiValidationIssue[] = [];
  validateSchema(schemas[schemaName], value, "$", issues, new Set());
  return { valid: issues.length === 0, issues };
}

function validateSchema(
  schema: JsonSchema | undefined,
  value: unknown,
  path: string,
  issues: OpenApiValidationIssue[],
  refStack: Set<string>,
): void {
  if (!schema) {
    issues.push({ path, message: "Referenced schema is missing." });
    return;
  }
  const ref = stringValue(schema.$ref);
  if (ref) {
    const resolvedName = ref.split("/").at(-1);
    if (!resolvedName || refStack.has(resolvedName)) return;
    refStack.add(resolvedName);
    validateSchema(schemas[resolvedName], value, path, issues, refStack);
    refStack.delete(resolvedName);
    return;
  }
  const allOf = arrayValue(schema.allOf);
  if (allOf) for (const item of allOf) validateSchema(asSchema(item), value, path, issues, refStack);
  const anyOf = arrayValue(schema.anyOf);
  if (anyOf && !anyOf.some((item) => validateBranch(asSchema(item), value, refStack))) {
    issues.push({ path, message: "Value does not match any allowed schema." });
  }
  const oneOf = arrayValue(schema.oneOf);
  if (oneOf) {
    const matches = oneOf.filter((item) => validateBranch(asSchema(item), value, refStack)).length;
    if (matches !== 1) issues.push({ path, message: `Value must match exactly one schema; matched ${matches}.` });
  }
  if (schema.const !== undefined && !Object.is(value, schema.const)) {
    issues.push({ path, message: `Value must equal ${JSON.stringify(schema.const)}.` });
  }
  const enumValues = arrayValue(schema.enum);
  if (enumValues && !enumValues.some((item) => Object.is(item, value))) {
    issues.push({ path, message: `Unknown enum value ${JSON.stringify(value)}.` });
  }
  const allowedTypes = schemaTypes(schema.type);
  if (allowedTypes.length && !allowedTypes.some((type) => valueMatchesType(value, type))) {
    issues.push({ path, message: `Expected ${allowedTypes.join(" or ")}.` });
    return;
  }
  const effectiveType = allowedTypes.find((type) => type !== "null") ?? inferType(schema);
  if (effectiveType === "object" && value !== null && typeof value === "object" && !Array.isArray(value)) {
    validateObject(schema, value as Record<string, unknown>, path, issues, refStack);
  } else if (effectiveType === "array" && Array.isArray(value)) {
    validateArray(schema, value, path, issues, refStack);
  } else if (effectiveType === "string" && typeof value === "string") {
    validateString(schema, value, path, issues);
  } else if ((effectiveType === "number" || effectiveType === "integer") && typeof value === "number") {
    validateNumber(schema, value, path, issues, effectiveType === "integer");
  }
}

function validateObject(schema: JsonSchema, value: Record<string, unknown>, path: string, issues: OpenApiValidationIssue[], refStack: Set<string>): void {
  const properties = asSchemaRecord(schema.properties);
  for (const required of stringArray(schema.required)) {
    if (!Object.prototype.hasOwnProperty.call(value, required) || value[required] === undefined) {
      issues.push({ path: `${path}.${required}`, message: "Required property is missing." });
    }
  }
  for (const [key, item] of Object.entries(value)) {
    const propertySchema = properties[key];
    if (propertySchema) {
      validateSchema(propertySchema, item, `${path}.${key}`, issues, refStack);
      continue;
    }
    if (schema.additionalProperties === false) {
      issues.push({ path: `${path}.${key}`, message: "Additional property is not allowed." });
    } else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
      validateSchema(asSchema(schema.additionalProperties), item, `${path}.${key}`, issues, refStack);
    }
  }
}

function validateArray(schema: JsonSchema, value: unknown[], path: string, issues: OpenApiValidationIssue[], refStack: Set<string>): void {
  const minItems = numberValue(schema.minItems);
  const maxItems = numberValue(schema.maxItems);
  if (minItems !== undefined && value.length < minItems) issues.push({ path, message: `Expected at least ${minItems} items.` });
  if (maxItems !== undefined && value.length > maxItems) issues.push({ path, message: `Expected at most ${maxItems} items.` });
  if (schema.uniqueItems === true && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) {
    issues.push({ path, message: "Array items must be unique." });
  }
  const itemSchema = asSchema(schema.items);
  if (itemSchema) value.forEach((item, index) => validateSchema(itemSchema, item, `${path}[${index}]`, issues, refStack));
}

function validateString(schema: JsonSchema, value: string, path: string, issues: OpenApiValidationIssue[]): void {
  const minLength = numberValue(schema.minLength);
  const maxLength = numberValue(schema.maxLength);
  if (minLength !== undefined && value.length < minLength) issues.push({ path, message: `String is shorter than ${minLength}.` });
  if (maxLength !== undefined && value.length > maxLength) issues.push({ path, message: `String is longer than ${maxLength}.` });
  const pattern = stringValue(schema.pattern);
  if (pattern) {
    try { if (!new RegExp(pattern, "u").test(value)) issues.push({ path, message: `String does not match ${pattern}.` }); }
    catch { issues.push({ path, message: `Contract pattern is invalid: ${pattern}.` }); }
  }
  const format = stringValue(schema.format);
  if (format === "date-time" && (!value.endsWith("Z") || Number.isNaN(Date.parse(value)))) issues.push({ path, message: "Expected UTC date-time." });
  if (format === "date" && !/^\d{4}-\d{2}-\d{2}$/u.test(value)) issues.push({ path, message: "Expected calendar date." });
  if (format === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value)) issues.push({ path, message: "Expected email address." });
  if (format === "uuid" && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)) issues.push({ path, message: "Expected UUID." });
}

function validateNumber(schema: JsonSchema, value: number, path: string, issues: OpenApiValidationIssue[], integer: boolean): void {
  if (!Number.isFinite(value)) issues.push({ path, message: "Number must be finite." });
  if (integer && !Number.isInteger(value)) issues.push({ path, message: "Expected integer." });
  const minimum = numberValue(schema.minimum);
  const maximum = numberValue(schema.maximum);
  if (minimum !== undefined && value < minimum) issues.push({ path, message: `Number must be >= ${minimum}.` });
  if (maximum !== undefined && value > maximum) issues.push({ path, message: `Number must be <= ${maximum}.` });
}

function validateBranch(schema: JsonSchema | undefined, value: unknown, refStack: Set<string>): boolean {
  const issues: OpenApiValidationIssue[] = [];
  validateSchema(schema, value, "$", issues, new Set(refStack));
  return issues.length === 0;
}

function schemaTypes(value: unknown): string[] {
  if (typeof value === "string") return [value];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function inferType(schema: JsonSchema): string | undefined {
  if (schema.properties || schema.additionalProperties !== undefined) return "object";
  if (schema.items) return "array";
  return undefined;
}

function valueMatchesType(value: unknown, type: string): boolean {
  if (type === "null") return value === null;
  if (type === "object") return Boolean(value && typeof value === "object" && !Array.isArray(value));
  if (type === "array") return Array.isArray(value);
  if (type === "string") return typeof value === "string";
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "integer") return typeof value === "number" && Number.isInteger(value);
  if (type === "boolean") return typeof value === "boolean";
  return true;
}

function invalid(path: string, message: string): OpenApiValidationResult {
  return { valid: false, issues: [{ path, message }] };
}
function asSchema(value: unknown): JsonSchema | undefined { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonSchema : undefined; }
function asSchemaRecord(value: unknown): Readonly<Record<string, JsonSchema>> { return value && typeof value === "object" && !Array.isArray(value) ? value as Readonly<Record<string, JsonSchema>> : {}; }
function arrayValue(value: unknown): readonly unknown[] | undefined { return Array.isArray(value) ? value : undefined; }
function stringArray(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function stringValue(value: unknown): string | undefined { return typeof value === "string" ? value : undefined; }
function numberValue(value: unknown): number | undefined { return typeof value === "number" && Number.isFinite(value) ? value : undefined; }
