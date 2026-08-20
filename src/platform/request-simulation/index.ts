export type FrontendFailureKind =
  | "timeout"
  | "conflict"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation"
  | "rate_limit"
  | "server_error"
  | "partial_response"
  | "malformed_response";

export interface FrontendRequestScenario {
  latencyMs?: number;
  failure?: FrontendFailureKind;
  message?: string;
  once?: boolean;
  fieldErrors?: Record<string, string>;
}

const DEFAULT_FAILURES: Record<FrontendFailureKind, { status: number; code: string; message: string }> = {
  timeout: { status: 408, code: "REQUEST_TIMEOUT", message: "The request timed out." },
  conflict: { status: 409, code: "CONFLICT", message: "The record changed before this request completed." },
  unauthorized: { status: 401, code: "UNAUTHORIZED", message: "Authentication is required." },
  forbidden: { status: 403, code: "FORBIDDEN", message: "You do not have permission to complete this action." },
  not_found: { status: 404, code: "NOT_FOUND", message: "The requested record was not found." },
  validation: { status: 422, code: "VALIDATION_ERROR", message: "The submitted data is invalid." },
  rate_limit: { status: 429, code: "RATE_LIMITED", message: "Too many requests. Try again shortly." },
  server_error: { status: 500, code: "SERVER_ERROR", message: "The request could not be completed." },
  partial_response: { status: 502, code: "PARTIAL_RESPONSE", message: "The response was incomplete." },
  malformed_response: { status: 502, code: "MALFORMED_RESPONSE", message: "The response could not be read." },
};

export class FrontendRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors?: Record<string, string>;

  constructor(input: { status: number; code: string; message: string; fieldErrors?: Record<string, string> }) {
    super(input.message);
    this.name = "FrontendRequestError";
    this.status = input.status;
    this.code = input.code;
    this.fieldErrors = input.fieldErrors;
  }
}

const scenarios = new Map<string, FrontendRequestScenario>();

export function configureFrontendRequestScenario(operation: string, scenario: FrontendRequestScenario | null): void {
  const key = operation.trim();
  if (!key) throw new Error("Frontend request operation is required.");
  if (!scenario) {
    scenarios.delete(key);
    return;
  }
  scenarios.set(key, {
    ...scenario,
    latencyMs: Math.max(0, Number(scenario.latencyMs) || 0),
  });
}

export function clearFrontendRequestScenarios(): void {
  scenarios.clear();
}

export function getFrontendRequestScenario(operation: string): FrontendRequestScenario | undefined {
  const scenario = scenarios.get(operation);
  return scenario ? { ...scenario, fieldErrors: scenario.fieldErrors ? { ...scenario.fieldErrors } : undefined } : undefined;
}

function delay(milliseconds: number): Promise<void> {
  if (milliseconds <= 0) return Promise.resolve();
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}

export async function applyFrontendRequestScenario(operation: string): Promise<void> {
  const scenario = scenarios.get(operation);
  if (!scenario) return;
  if (scenario.once) scenarios.delete(operation);
  await delay(scenario.latencyMs ?? 0);
  if (!scenario.failure) return;
  const failure = DEFAULT_FAILURES[scenario.failure];
  throw new FrontendRequestError({
    ...failure,
    message: scenario.message?.trim() || failure.message,
    fieldErrors: scenario.fieldErrors,
  });
}

export async function executeFrontendRequest<T>(operation: string, task: () => T | Promise<T>): Promise<T> {
  await applyFrontendRequestScenario(operation);
  return task();
}
