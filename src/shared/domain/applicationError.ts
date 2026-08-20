export type ApplicationErrorCategory =
  | "VALIDATION"
  | "AUTHENTICATION"
  | "AUTHORIZATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "BUSINESS_RULE"
  | "RATE_LIMIT"
  | "TIMEOUT"
  | "CANCELLED"
  | "NETWORK"
  | "INTEGRATION"
  | "INFRASTRUCTURE"
  | "UNKNOWN";

export type ApplicationErrorFieldMap = Record<string, string[]>;

export interface ApplicationErrorOptions {
  code: string;
  message: string;
  category?: ApplicationErrorCategory;
  status?: number;
  fieldErrors?: ApplicationErrorFieldMap;
  blockers?: string[];
  correlationId?: string;
  requestId?: string;
  retryable?: boolean;
  userMessage?: string;
  details?: unknown;
  cause?: unknown;
}

export class ApplicationError extends Error {
  readonly code: string;
  readonly category: ApplicationErrorCategory;
  readonly status: number | undefined;
  readonly fieldErrors: ApplicationErrorFieldMap | undefined;
  readonly blockers: string[];
  readonly correlationId: string | undefined;
  readonly requestId: string | undefined;
  readonly retryable: boolean;
  readonly userMessage: string | undefined;
  readonly details?: unknown;

  constructor(options: ApplicationErrorOptions) {
    super(options.message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "ApplicationError";
    this.code = normalizeApplicationErrorCode(options.code);
    this.category = options.category ?? classifyApplicationErrorCategory({
      code: this.code,
      ...(options.status === undefined ? {} : { status: options.status }),
      ...(options.fieldErrors === undefined ? {} : { fieldErrors: options.fieldErrors }),
      ...(options.blockers === undefined ? {} : { blockers: options.blockers }),
    });
    this.status = options.status;
    this.fieldErrors = options.fieldErrors;
    this.blockers = options.blockers ?? [];
    this.correlationId = options.correlationId;
    this.requestId = options.requestId;
    this.retryable = options.retryable ?? defaultRetryableForCategory(this.category);
    this.userMessage = options.userMessage;
    this.details = options.details;
  }
}

export interface ErrorClassificationInput {
  code: string;
  status?: number;
  fieldErrors?: ApplicationErrorFieldMap;
  blockers?: readonly string[];
}

export interface NormalizeApplicationErrorOptions {
  fallbackCode?: string;
  fallbackMessage?: string;
  fallbackCategory?: ApplicationErrorCategory;
  userMessage?: string;
}

export function isApplicationError(value: unknown): value is ApplicationError {
  return value instanceof ApplicationError;
}

export function normalizeApplicationErrorCode(code: string): string {
  const normalized = code.trim().replace(/[^A-Za-z0-9]+/gu, "_").replace(/^_+|_+$/gu, "").toUpperCase();
  return normalized || "UNEXPECTED_ERROR";
}

export function classifyApplicationErrorCategory(input: ErrorClassificationInput): ApplicationErrorCategory {
  if (input.status !== undefined) {
    if (input.status === 401) return "AUTHENTICATION";
    if (input.status === 403) return "AUTHORIZATION";
    if (input.status === 404) return "NOT_FOUND";
    if (input.status === 408) return "TIMEOUT";
    if (input.status === 409 || input.status === 412) return "CONFLICT";
    if (input.status === 429) return "RATE_LIMIT";
    if (input.status === 400 || input.status === 422) return "VALIDATION";
    if (input.status >= 500) return "INFRASTRUCTURE";
  }

  const code = normalizeApplicationErrorCode(input.code);
  if (code === "REQUEST_CANCELLED" || code.endsWith("_CANCELLED") || code.endsWith("_ABORTED")) return "CANCELLED";
  if (code === "REQUEST_TIMEOUT" || code.endsWith("_TIMEOUT") || code.endsWith("_TIMED_OUT")) return "TIMEOUT";
  if (code === "AUTHENTICATION_REQUIRED" || code === "UNAUTHENTICATED" || code.startsWith("AUTHENTICATION_")) return "AUTHENTICATION";
  if (code === "AUTHORIZATION_DENIED" || code === "FORBIDDEN" || code.includes("PERMISSION_DENIED") || code.includes("ACCESS_DENIED")) return "AUTHORIZATION";
  if (code === "RESOURCE_NOT_FOUND" || code.endsWith("_NOT_FOUND")) return "NOT_FOUND";
  if (code === "RESOURCE_CONFLICT" || code.includes("VERSION_CONFLICT") || code.includes("IDEMPOTENCY_KEY_REUSED") || code.endsWith("_CONFLICT") || code.startsWith("STALE_")) return "CONFLICT";
  if (code === "RATE_LIMITED" || code.includes("RATE_LIMIT")) return "RATE_LIMIT";
  if (code === "NETWORK_REQUEST_FAILED" || code.startsWith("NETWORK_")) return "NETWORK";
  if (code.includes("PROVIDER_") || code.includes("INTEGRATION_")) return "INTEGRATION";
  if (code === "SERVER_UNAVAILABLE" || code === "HTTP_REQUEST_FAILED" || code.startsWith("INFRASTRUCTURE_") || code.startsWith("SERVER_")) return "INFRASTRUCTURE";

  if (input.fieldErrors && Object.keys(input.fieldErrors).length > 0) return "VALIDATION";
  if (input.blockers && input.blockers.length > 0) return "BUSINESS_RULE";
  if (
    code === "REQUEST_INVALID"
    || code === "BUSINESS_VALIDATION_FAILED"
    || code === "CSV_EMPTY"
    || code.endsWith("_REQUIRED")
    || code.endsWith("_INVALID")
    || code.endsWith("_MISMATCH")
  ) return "VALIDATION";
  if (
    code.includes("BLOCKED")
    || code.includes("NOT_ALLOWED")
    || code.includes("NOT_ISSUABLE")
    || code.includes("POLICY")
    || code.includes("LIMIT_EXCEEDED")
    || code.includes("OVERDUE")
    || code === "DEAL_NOT_WON"
  ) return "BUSINESS_RULE";
  return "UNKNOWN";
}

export function normalizeApplicationError(
  value: unknown,
  options: NormalizeApplicationErrorOptions = {},
): ApplicationError {
  if (value instanceof ApplicationError) return value;
  if (value instanceof DOMException && value.name === "AbortError") {
    return new ApplicationError({
      code: "REQUEST_CANCELLED",
      message: value.message || "The operation was cancelled.",
      category: "CANCELLED",
      retryable: false,
      cause: value,
    });
  }

  if (value && typeof value === "object") {
    const candidate = value as {
      code?: unknown;
      message?: unknown;
      status?: unknown;
      fieldErrors?: unknown;
      blockers?: unknown;
      businessBlockers?: unknown;
      correlationId?: unknown;
      requestId?: unknown;
      retryable?: unknown;
      userMessage?: unknown;
      details?: unknown;
    };
    const code = typeof candidate.code === "string" ? candidate.code : options.fallbackCode;
    const message = typeof candidate.message === "string" ? candidate.message : options.fallbackMessage;
    if (code || message) {
      const fieldErrors = normalizeFieldErrors(candidate.fieldErrors);
      const blockers = normalizeStringArray(candidate.blockers) ?? normalizeStringArray(candidate.businessBlockers);
      const status = typeof candidate.status === "number" ? candidate.status : undefined;
      return new ApplicationError({
        code: code ?? "UNEXPECTED_ERROR",
        message: message ?? "An unexpected error occurred.",
        ...(options.fallbackCategory === undefined ? {} : { category: options.fallbackCategory }),
        ...(status === undefined ? {} : { status }),
        ...(fieldErrors === undefined ? {} : { fieldErrors }),
        ...(blockers === undefined ? {} : { blockers }),
        ...(typeof candidate.correlationId === "string" ? { correlationId: candidate.correlationId } : {}),
        ...(typeof candidate.requestId === "string" ? { requestId: candidate.requestId } : {}),
        ...(typeof candidate.retryable === "boolean" ? { retryable: candidate.retryable } : {}),
        ...(typeof candidate.userMessage === "string" ? { userMessage: candidate.userMessage } : options.userMessage === undefined ? {} : { userMessage: options.userMessage }),
        ...(candidate.details === undefined ? {} : { details: candidate.details }),
        cause: value,
      });
    }
  }

  if (value instanceof Error) {
    return new ApplicationError({
      code: options.fallbackCode ?? "UNEXPECTED_ERROR",
      message: value.message || options.fallbackMessage || "An unexpected error occurred.",
      category: options.fallbackCategory ?? "UNKNOWN",
      ...(options.userMessage === undefined ? {} : { userMessage: options.userMessage }),
      cause: value,
    });
  }

  return new ApplicationError({
    code: options.fallbackCode ?? "UNEXPECTED_ERROR",
    message: options.fallbackMessage ?? "An unexpected error occurred.",
    category: options.fallbackCategory ?? "UNKNOWN",
    ...(options.userMessage === undefined ? {} : { userMessage: options.userMessage }),
    ...(value === undefined ? {} : { details: value }),
  });
}

function defaultRetryableForCategory(category: ApplicationErrorCategory): boolean {
  return category === "NETWORK" || category === "TIMEOUT" || category === "RATE_LIMIT" || category === "INFRASTRUCTURE" || category === "INTEGRATION";
}

function normalizeFieldErrors(value: unknown): ApplicationErrorFieldMap | undefined {
  if (!value || typeof value !== "object") return undefined;
  const result: ApplicationErrorFieldMap = {};
  for (const [field, messages] of Object.entries(value)) {
    if (Array.isArray(messages)) {
      const normalized = messages.filter((message): message is string => typeof message === "string");
      if (normalized.length > 0) result[field] = normalized;
    } else if (typeof messages === "string") {
      result[field] = [messages];
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const normalized = value.filter((item): item is string => typeof item === "string");
  return normalized.length > 0 ? normalized : undefined;
}
