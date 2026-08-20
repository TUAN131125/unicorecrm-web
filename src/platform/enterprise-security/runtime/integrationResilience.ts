import type { IntegrationExecutionResult, IntegrationResiliencePolicy } from "../domain/enterpriseSecurity.types";

interface StoredResult<T> { expiresAt: number; value: T; }
const idempotencyResults = new Map<string, StoredResult<unknown>>();
const operationTimes = new Map<string, number[]>();

export const DEFAULT_INTEGRATION_RESILIENCE_POLICY: IntegrationResiliencePolicy = Object.freeze({
  maxAttempts: 3,
  baseBackoffMs: 1_000,
  rateLimit: { maxOperations: 60, windowMs: 60_000 },
  idempotencyWindowMs: 24 * 60 * 60_000,
});

export async function executeResilientIntegrationOperation<T>(input: {
  workspaceId: string;
  connectorId: string;
  idempotencyKey: string;
  operation: () => Promise<T> | T;
  policy?: IntegrationResiliencePolicy;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
}): Promise<IntegrationExecutionResult<T>> {
  const policy = input.policy ?? DEFAULT_INTEGRATION_RESILIENCE_POLICY;
  const now = input.now ?? Date.now;
  const sleep = input.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const scopeKey = `${input.workspaceId}:${input.connectorId}`;
  const replayKey = `${scopeKey}:${input.idempotencyKey}`;
  const replay = idempotencyResults.get(replayKey);
  if (replay && replay.expiresAt > now()) return { status: "IDEMPOTENT_REPLAY", value: structuredClone(replay.value) as T, attempts: [], idempotencyKey: input.idempotencyKey };

  const threshold = now() - policy.rateLimit.windowMs;
  const recent = (operationTimes.get(scopeKey) ?? []).filter((time) => time > threshold);
  if (recent.length >= policy.rateLimit.maxOperations) {
    const nextRetryAt = new Date(recent[0] + policy.rateLimit.windowMs).toISOString();
    return { status: "RATE_LIMITED", attempts: [], idempotencyKey: input.idempotencyKey, nextRetryAt, errorCode: "RATE_LIMITED" };
  }
  recent.push(now());
  operationTimes.set(scopeKey, recent);

  const attempts: IntegrationExecutionResult<T>["attempts"] = [];
  for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
    const startedAt = new Date(now()).toISOString();
    try {
      const value = await input.operation();
      const completedAt = new Date(now()).toISOString();
      attempts.push({ attempt, startedAt, completedAt, status: "SUCCEEDED" });
      idempotencyResults.set(replayKey, { expiresAt: now() + policy.idempotencyWindowMs, value: structuredClone(value) });
      return { status: "SUCCEEDED", value, attempts, idempotencyKey: input.idempotencyKey };
    } catch (error) {
      const completedAt = new Date(now()).toISOString();
      const errorCode = error instanceof Error ? error.name || "INTEGRATION_ERROR" : "INTEGRATION_ERROR";
      attempts.push({ attempt, startedAt, completedAt, status: "FAILED", errorCode });
      if (attempt < policy.maxAttempts) await sleep(policy.baseBackoffMs * 2 ** (attempt - 1));
    }
  }
  return { status: "FAILED", attempts, idempotencyKey: input.idempotencyKey, errorCode: attempts.at(-1)?.errorCode ?? "INTEGRATION_ERROR" };
}

export function resetIntegrationResilienceRuntime(): void {
  idempotencyResults.clear();
  operationTimes.clear();
}
