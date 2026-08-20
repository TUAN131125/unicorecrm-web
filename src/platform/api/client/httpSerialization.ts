import { ApiClientError } from "../errors/ApiClientError";

const DECIMAL_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

type JsonNormalized = null | boolean | number | string | JsonNormalized[] | { [key: string]: JsonNormalized };

export function serializeApiPayload(value: unknown): string {
  return JSON.stringify(normalize(value, new WeakSet<object>(), "$"));
}

export async function readJsonResponse(response: Response): Promise<unknown> {
  if (response.status === 204 || response.status === 205) return undefined;
  const text = await response.text();
  if (!text.trim()) return undefined;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("json")) return text;
  try {
    return JSON.parse(text) as unknown;
  } catch (cause) {
    throw new ApiClientError({
      code: "RESPONSE_DESERIALIZATION_FAILED",
      message: "The server returned an invalid JSON response.",
      status: response.status,
      retryable: false,
      cause,
    });
  }
}

function normalize(value: unknown, seen: WeakSet<object>, path: string): JsonNormalized {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw serializationError(path, "Non-finite numbers cannot be sent to the API.");
    return value;
  }
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw serializationError(path, "Invalid Date values cannot be sent to the API.");
    return value.toISOString();
  }
  if (value === undefined) return null;
  if (typeof value === "function" || typeof value === "symbol") throw serializationError(path, `Unsupported ${typeof value} value.`);
  if (Array.isArray(value)) return value.map((item, index) => normalize(item, seen, `${path}[${index}]`));
  if (typeof value !== "object") throw serializationError(path, "Unsupported API payload value.");

  if (seen.has(value)) throw serializationError(path, "Circular API payloads are not supported.");
  seen.add(value);
  try {
    const record = value as Record<string, unknown>;
    validateMoneyShape(record, path);
    const normalized: Record<string, JsonNormalized> = {};
    for (const [key, item] of Object.entries(record)) {
      if (item === undefined) continue;
      normalized[key] = normalize(item, seen, `${path}.${key}`);
    }
    return normalized;
  } finally {
    seen.delete(value);
  }
}

function validateMoneyShape(record: Record<string, unknown>, path: string): void {
  if (!("amount" in record) || typeof record.currency !== "string") return;
  if (typeof record.amount !== "string" || !DECIMAL_PATTERN.test(record.amount)) {
    throw serializationError(`${path}.amount`, "Money amounts must use a decimal string, never a floating-point number.");
  }
}

function serializationError(path: string, message: string): ApiClientError {
  return new ApiClientError({
    code: "REQUEST_SERIALIZATION_FAILED",
    message: `${message} Path: ${path}`,
    retryable: false,
  });
}
