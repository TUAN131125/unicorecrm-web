import type {
  AccessTokenProvider,
  CorrelationIdProvider,
  HttpClient,
  HttpRequest,
  HttpRetryPolicy,
  RequestIdProvider,
  WorkspaceIdProvider,
} from "./HttpClient";
import {
  ApiClientError,
  fallbackApiErrorCode,
  statusIsRetryable,
  type ApiErrorPayload,
} from "../errors/ApiClientError";
import { readJsonResponse, serializeApiPayload } from "./httpSerialization";
import { validateOpenApiRequest, validateOpenApiResponse } from "../contracts/openApiRuntimeValidation";

const DEFAULT_RETRY_POLICY: HttpRetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 150,
  maxDelayMs: 1_500,
  retryableStatuses: new Set([408, 429, 502, 503, 504]),
};

export interface FetchHttpClientOptions {
  baseUrl: string;
  accessTokenProvider?: AccessTokenProvider;
  workspaceIdProvider?: WorkspaceIdProvider;
  requestIdProvider?: RequestIdProvider;
  correlationIdProvider?: CorrelationIdProvider;
  fetchImplementation?: typeof fetch;
  defaultTimeoutMs?: number;
  retryPolicy?: Partial<Omit<HttpRetryPolicy, "retryableStatuses">> & { retryableStatuses?: Iterable<number> };
  onUnauthorized?: () => void | Promise<void>;
}

export class FetchHttpClient implements HttpClient {
  private readonly baseUrl: string;
  private readonly fetchImplementation: typeof fetch;
  private readonly defaultTimeoutMs: number;
  private readonly retryPolicy: HttpRetryPolicy;
  private readonly requestIdProvider: RequestIdProvider;
  private readonly correlationIdProvider: CorrelationIdProvider;

  constructor(private readonly options: FetchHttpClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 15_000;
    this.retryPolicy = {
      maxAttempts: options.retryPolicy?.maxAttempts ?? DEFAULT_RETRY_POLICY.maxAttempts,
      baseDelayMs: options.retryPolicy?.baseDelayMs ?? DEFAULT_RETRY_POLICY.baseDelayMs,
      maxDelayMs: options.retryPolicy?.maxDelayMs ?? DEFAULT_RETRY_POLICY.maxDelayMs,
      retryableStatuses: new Set(options.retryPolicy?.retryableStatuses ?? DEFAULT_RETRY_POLICY.retryableStatuses),
    };
    this.requestIdProvider = options.requestIdProvider ?? { createRequestId: createTransportId };
    this.correlationIdProvider = options.correlationIdProvider ?? { createCorrelationId: createTransportId };
  }

  async request<TResponse, TBody = unknown>(input: HttpRequest<TBody>): Promise<TResponse> {
    assertOpenApiPayload(input.operationId, "request", input.body);
    const requestId = this.requestIdProvider.createRequestId();
    const correlationId = input.correlationId?.trim() || this.correlationIdProvider.createCorrelationId();
    const headers = await this.buildHeaders(input, requestId, correlationId);
    const body = input.body === undefined ? undefined : serializeApiPayload(input.body);
    const maxAttempts = this.resolveMaxAttempts(input);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const attemptSignal = createAttemptSignal(input.signal, input.timeoutMs ?? this.defaultTimeoutMs);
      try {
        const response = await this.fetchImplementation(this.buildUrl(input), {
          method: input.method,
          headers,
          signal: attemptSignal.signal,
          ...(body === undefined ? {} : { body }),
          ...(input.credentials === undefined ? {} : { credentials: input.credentials }),
        });
        const payload = await readJsonResponse(response);
        if (response.ok) {
          assertOpenApiPayload(input.operationId, "response", payload, response.status);
          return payload as TResponse;
        }

        const error = mapHttpError(response, payload, requestId, correlationId);
        if (response.status === 401) {
          try { await this.options.onUnauthorized?.(); } catch { /* preserve the authoritative API error */ }
        }
        if (!this.shouldRetry(input, attempt, maxAttempts, response.status, error)) throw error;
        await waitForRetry(response, attempt, this.retryPolicy, input.signal);
      } catch (error) {
        if (error instanceof ApiClientError && error.status !== undefined) throw error;
        const mapped = mapTransportError(error, attemptSignal.timedOut(), requestId, correlationId);
        if (!this.shouldRetry(input, attempt, maxAttempts, undefined, mapped)) throw mapped;
        await delay(backoffMs(attempt, this.retryPolicy), input.signal);
      } finally {
        attemptSignal.cleanup();
      }
    }

    throw new ApiClientError({
      code: "HTTP_RETRY_EXHAUSTED",
      message: "The request could not be completed after the configured retry attempts.",
      correlationId,
      requestId,
      retryable: false,
    });
  }

  private buildUrl(input: HttpRequest): string {
    const path = input.path.startsWith("/") ? input.path : `/${input.path}`;
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(input.query ?? {})) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  private async buildHeaders(input: HttpRequest, requestId: string, correlationId: string): Promise<Headers> {
    const headers = new Headers(input.headers);
    headers.set("Accept", "application/json");
    headers.set("X-Request-Id", requestId);
    headers.set("X-Correlation-Id", correlationId);
    if (input.body !== undefined) headers.set("Content-Type", "application/json");

    const authMode = input.auth ?? "required";
    if (authMode !== "none") {
      let token: string | undefined;
      try {
        token = (await this.options.accessTokenProvider?.getAccessToken())?.trim();
      } catch (cause) {
        throw new ApiClientError({
          code: "AUTH_TOKEN_UNAVAILABLE",
          message: "The connected identity adapter could not provide an access token.",
          correlationId,
          requestId,
          retryable: false,
          cause,
        });
      }
      if (token) headers.set("Authorization", `Bearer ${token}`);
      else if (authMode === "required") {
        throw new ApiClientError({
          code: "AUTHENTICATION_REQUIRED",
          message: "A connected API request requires an access token.",
          status: 401,
          correlationId,
          requestId,
          retryable: false,
        });
      }
    }

    const workspaceMode = input.workspace ?? "required";
    if (workspaceMode !== "none") {
      let workspaceId: string | undefined;
      try {
        workspaceId = this.options.workspaceIdProvider?.getWorkspaceId()?.trim();
      } catch (cause) {
        throw new ApiClientError({
          code: "WORKSPACE_CONTEXT_UNAVAILABLE",
          message: "The active workspace context could not be resolved.",
          correlationId,
          requestId,
          retryable: false,
          cause,
        });
      }
      if (workspaceId) headers.set("X-Workspace-Id", workspaceId);
      else if (workspaceMode === "required") {
        throw new ApiClientError({
          code: "WORKSPACE_CONTEXT_REQUIRED",
          message: "A connected API request requires an active workspace.",
          correlationId,
          requestId,
          retryable: false,
        });
      }
    }

    if (input.idempotencyKey) headers.set("Idempotency-Key", input.idempotencyKey);
    if (input.expectedVersion !== undefined) headers.set("If-Match", formatIfMatch(input.expectedVersion));
    return headers;
  }

  private resolveMaxAttempts(input: HttpRequest): number {
    if (input.retry === "never") return 1;
    if (isSafeMethod(input.method)) return this.retryPolicy.maxAttempts;
    if (input.retry === "idempotent" && input.idempotencyKey) return this.retryPolicy.maxAttempts;
    return 1;
  }

  private shouldRetry(
    input: HttpRequest,
    attempt: number,
    maxAttempts: number,
    status: number | undefined,
    error: ApiClientError,
  ): boolean {
    if (attempt >= maxAttempts || !error.retryable) return false;
    if (!isSafeMethod(input.method) && !(input.retry === "idempotent" && input.idempotencyKey)) return false;
    return status === undefined || this.retryPolicy.retryableStatuses.has(status);
  }
}

function assertOpenApiPayload(operationId: string, direction: "request" | "response", value: unknown, responseStatus?: number): void {
  const validation = direction === "request"
    ? validateOpenApiRequest(operationId, value)
    : validateOpenApiResponse(operationId, value, responseStatus);
  if (validation.valid) return;
  throw new ApiClientError({
    code: "CONTRACT_VIOLATION",
    message: `OpenAPI ${direction} validation failed for ${operationId}.`,
    retryable: false,
    details: { operationId, direction, issues: validation.issues },
  });
}

function formatIfMatch(value: number | string): string {
  if (typeof value === "number") return `"${value}"`;
  const normalized = value.trim();
  if (!normalized) throw new Error("Expected resource version cannot be empty.");
  if (normalized === "*") return normalized;
  if (/^(?:W\/)?".*"$/u.test(normalized)) return normalized;
  return `"${normalized.replaceAll('"', '\\"')}"`;
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) throw new Error("HTTP base URL is required.");
  const parsed = new URL(trimmed);
  if (!/^https?:$/.test(parsed.protocol)) throw new Error("HTTP base URL must use http or https.");
  return parsed.toString().replace(/\/+$/, "");
}

function isSafeMethod(method: HttpRequest["method"]): boolean {
  return method === "GET";
}

function createTransportId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

function createAttemptSignal(parent: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  let timeoutTriggered = false;
  const onAbort = () => controller.abort(parent?.reason);
  if (parent?.aborted) controller.abort(parent.reason);
  else parent?.addEventListener("abort", onAbort, { once: true });
  const timeout = timeoutMs > 0
    ? setTimeout(() => {
        timeoutTriggered = true;
        controller.abort(new DOMException("Request timed out.", "TimeoutError"));
      }, timeoutMs)
    : undefined;
  return {
    signal: controller.signal,
    timedOut: () => timeoutTriggered,
    cleanup: () => {
      if (timeout !== undefined) clearTimeout(timeout);
      parent?.removeEventListener("abort", onAbort);
    },
  };
}

function mapTransportError(error: unknown, timedOut: boolean, requestId: string, correlationId: string): ApiClientError {
  if (error instanceof ApiClientError) return error;
  if (timedOut) {
    return new ApiClientError({
      code: "REQUEST_TIMEOUT",
      message: "The request timed out.",
      status: 408,
      correlationId,
      requestId,
      retryable: true,
      cause: error,
    });
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return new ApiClientError({
      code: "REQUEST_CANCELLED",
      message: "The request was cancelled.",
      correlationId,
      requestId,
      retryable: false,
      cause: error,
    });
  }
  return new ApiClientError({
    code: "NETWORK_UNAVAILABLE",
    message: "The API could not be reached.",
    correlationId,
    requestId,
    retryable: true,
    cause: error,
  });
}

function mapHttpError(response: Response, payload: unknown, requestId: string, correlationId: string): ApiClientError {
  const candidate = extractApiErrorPayload(payload);
  const fieldErrors = candidate?.fieldErrors;
  const businessBlockers = candidate?.businessBlockers;
  const userMessage = candidate?.userMessage;
  return new ApiClientError({
    code: candidate?.code || fallbackApiErrorCode(response.status),
    message: candidate?.message || response.statusText || "The API request failed.",
    ...(userMessage === undefined ? {} : { userMessage }),
    status: response.status,
    correlationId: candidate?.correlationId || response.headers.get("X-Correlation-Id") || correlationId,
    requestId: response.headers.get("X-Request-Id") || requestId,
    retryable: candidate?.retryable ?? statusIsRetryable(response.status),
    details: candidate?.details,
    ...(fieldErrors === undefined ? {} : { fieldErrors }),
    ...(businessBlockers === undefined ? {} : { businessBlockers }),
  });
}

function extractApiErrorPayload(payload: unknown): ApiErrorPayload | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const record = payload as Record<string, unknown>;
  const source = record.error && typeof record.error === "object" ? record.error as Record<string, unknown> : record;
  if (typeof source.code !== "string") return undefined;

  // Production HTTP errors follow RFC 9457-style Problem Details. A noncanonical
  // message envelope remains readable only as an input fallback; it is not
  // emitted by the canonical OpenAPI contract.
  const title = typeof source.title === "string" ? source.title : undefined;
  const detail = typeof source.detail === "string" ? source.detail : undefined;
  const fallbackMessage = typeof source.message === "string" ? source.message : undefined;
  const message = detail ?? title ?? fallbackMessage;
  if (!message) return undefined;

  const fieldErrors = normalizeFieldErrors(source.fieldErrors);
  const businessBlockers = Array.isArray(source.businessBlockers)
    ? source.businessBlockers.filter((item): item is string => typeof item === "string")
    : undefined;
  const sourceCorrelationId = typeof source.correlationId === "string" ? source.correlationId : undefined;
  const retryable = typeof source.retryable === "boolean" ? source.retryable : undefined;
  const userMessage = title ?? (typeof source.userMessage === "string" ? source.userMessage : undefined);
  const problemDetails = title === undefined ? source.details : {
    type: source.type,
    title,
    detail,
    instance: source.instance,
    aggregateId: source.aggregateId,
    expectedVersion: source.expectedVersion,
    currentVersion: source.currentVersion,
    idempotencyKey: source.idempotencyKey,
    retryAfterSeconds: source.retryAfterSeconds,
  };
  return {
    code: source.code,
    message,
    ...(userMessage === undefined ? {} : { userMessage }),
    details: problemDetails,
    ...(fieldErrors === undefined ? {} : { fieldErrors }),
    ...(businessBlockers === undefined ? {} : { businessBlockers }),
    ...(sourceCorrelationId === undefined ? {} : { correlationId: sourceCorrelationId }),
    ...(retryable === undefined ? {} : { retryable }),
  };
}

function normalizeFieldErrors(value: unknown): Record<string, string[]> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const result: Record<string, string[]> = {};
  for (const [field, messages] of Object.entries(value as Record<string, unknown>)) {
    if (typeof messages === "string") result[field] = [messages];
    else if (Array.isArray(messages)) result[field] = messages.filter((item): item is string => typeof item === "string");
  }
  return Object.keys(result).length ? result : undefined;
}

async function waitForRetry(response: Response, attempt: number, policy: HttpRetryPolicy, signal?: AbortSignal): Promise<void> {
  const retryAfter = response.headers.get("Retry-After");
  const delayMs = retryAfter ? parseRetryAfter(retryAfter) : backoffMs(attempt, policy);
  await delay(Math.min(delayMs, policy.maxDelayMs), signal);
}

function parseRetryAfter(value: string): number {
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : Math.max(0, timestamp - Date.now());
}

function backoffMs(attempt: number, policy: HttpRetryPolicy): number {
  return Math.min(policy.baseDelayMs * 2 ** Math.max(0, attempt - 1), policy.maxDelayMs);
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  if (signal?.aborted) return Promise.reject(new DOMException("Request cancelled.", "AbortError"));
  return new Promise((resolve, reject) => {
    const cleanup = () => signal?.removeEventListener("abort", onAbort);
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      cleanup();
      reject(new DOMException("Request cancelled.", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
