export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type HttpRetryMode = "default" | "never" | "idempotent";
export type HttpAuthMode = "required" | "optional" | "none";
export type HttpWorkspaceMode = "required" | "optional" | "none";
export type HttpResourceVersion = number | string;

export interface HttpRequest<TBody = unknown> {
  operationId: string;
  method: HttpMethod;
  path: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: TBody;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
  retry?: HttpRetryMode;
  auth?: HttpAuthMode;
  workspace?: HttpWorkspaceMode;
  idempotencyKey?: string;
  expectedVersion?: HttpResourceVersion;
  correlationId?: string;
  credentials?: RequestCredentials;
}

export interface HttpClient {
  request<TResponse, TBody = unknown>(input: HttpRequest<TBody>): Promise<TResponse>;
}

export interface AccessTokenProvider {
  getAccessToken(): string | undefined | Promise<string | undefined>;
}

export interface WorkspaceIdProvider {
  getWorkspaceId(): string | undefined;
}

export interface RequestIdProvider {
  createRequestId(): string;
}

export interface CorrelationIdProvider {
  createCorrelationId(): string;
}

export interface HttpRetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableStatuses: ReadonlySet<number>;
}
