import {
  ApplicationError,
  classifyApplicationErrorCategory,
  type ApplicationErrorCategory,
  type ApplicationErrorFieldMap,
} from "@/shared/domain";

export type ApiErrorFieldMap = ApplicationErrorFieldMap;

export interface ApiErrorPayload {
  code: string;
  message: string;
  userMessage?: string;
  fieldErrors?: ApiErrorFieldMap;
  businessBlockers?: string[];
  correlationId?: string;
  retryable?: boolean;
  details?: unknown;
}

export interface ApiErrorEnvelope {
  error: ApiErrorPayload;
}

export interface ApiClientErrorOptions extends ApiErrorPayload {
  status?: number;
  requestId?: string;
  category?: ApplicationErrorCategory;
  cause?: unknown;
}

export class ApiClientError extends ApplicationError {
  readonly businessBlockers: string[] | undefined;

  constructor(options: ApiClientErrorOptions) {
    super({
      code: options.code,
      message: options.message,
      category: options.category ?? classifyApplicationErrorCategory({
        code: options.code,
        ...(options.status === undefined ? {} : { status: options.status }),
        ...(options.fieldErrors === undefined ? {} : { fieldErrors: options.fieldErrors }),
        ...(options.businessBlockers === undefined ? {} : { blockers: options.businessBlockers }),
      }),
      ...(options.status === undefined ? {} : { status: options.status }),
      ...(options.fieldErrors === undefined ? {} : { fieldErrors: options.fieldErrors }),
      ...(options.businessBlockers === undefined ? {} : { blockers: options.businessBlockers }),
      ...(options.correlationId === undefined ? {} : { correlationId: options.correlationId }),
      ...(options.requestId === undefined ? {} : { requestId: options.requestId }),
      ...(options.retryable === undefined ? {} : { retryable: options.retryable }),
      ...(options.userMessage === undefined ? {} : { userMessage: options.userMessage }),
      ...(options.details === undefined ? {} : { details: options.details }),
      ...(options.cause === undefined ? {} : { cause: options.cause }),
    });
    this.name = "ApiClientError";
    this.businessBlockers = options.businessBlockers;
  }
}

export function isApiClientError(value: unknown): value is ApiClientError {
  return value instanceof ApiClientError;
}

export function fallbackApiErrorCode(status: number): string {
  if (status === 400 || status === 422) return "VALIDATION_FAILED";
  if (status === 401) return "AUTHENTICATION_REQUIRED";
  if (status === 403) return "ACCESS_DENIED";
  if (status === 404) return "RESOURCE_NOT_FOUND";
  if (status === 408) return "REQUEST_TIMEOUT";
  if (status === 409) return "LIFECYCLE_CONFLICT";
  if (status === 412) return "VERSION_CONFLICT";
  if (status === 429) return "RATE_LIMITED";
  if (status === 502 || status === 503 || status === 504) return "INTEGRATION_UNAVAILABLE";
  if (status >= 500) return "INTERNAL_ERROR";
  return "CONTRACT_VIOLATION";
}

export function statusIsRetryable(status: number): boolean {
  return status === 408 || status === 429 || status === 502 || status === 503 || status === 504;
}
