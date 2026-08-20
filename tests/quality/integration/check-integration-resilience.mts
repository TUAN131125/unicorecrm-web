import assert from "node:assert/strict";
import {
  executeResilientIntegrationOperation,
  resetIntegrationResilienceRuntime,
  type IntegrationResiliencePolicy,
} from "@/platform/enterprise-security";

resetIntegrationResilienceRuntime();
let clock = Date.parse("2026-07-13T00:00:00.000Z");
let calls = 0;
const sleeps: number[] = [];
const policy: IntegrationResiliencePolicy = {
  maxAttempts: 3,
  baseBackoffMs: 100,
  rateLimit: { maxOperations: 2, windowMs: 60_000 },
  idempotencyWindowMs: 60_000,
};
const first = await executeResilientIntegrationOperation({
  workspaceId: "ws1",
  connectorId: "lead-webhook",
  idempotencyKey: "event-1",
  policy,
  now: () => clock,
  sleep: async (milliseconds) => { sleeps.push(milliseconds); clock += milliseconds; },
  operation: () => {
    calls += 1;
    if (calls < 3) throw new TypeError("temporary provider failure");
    return { accepted: true, reference: "external-1" };
  },
});
assert.equal(first.status, "SUCCEEDED");
assert.equal(first.attempts.length, 3);
assert.deepEqual(sleeps, [100, 200]);

const replay = await executeResilientIntegrationOperation({
  workspaceId: "ws1",
  connectorId: "lead-webhook",
  idempotencyKey: "event-1",
  policy,
  now: () => clock,
  operation: () => { throw new Error("must not execute replay"); },
});
assert.equal(replay.status, "IDEMPOTENT_REPLAY");
assert.deepEqual(replay.value, first.value);

const second = await executeResilientIntegrationOperation({
  workspaceId: "ws1",
  connectorId: "lead-webhook",
  idempotencyKey: "event-2",
  policy,
  now: () => clock,
  operation: () => "ok",
});
assert.equal(second.status, "SUCCEEDED");
const limited = await executeResilientIntegrationOperation({
  workspaceId: "ws1",
  connectorId: "lead-webhook",
  idempotencyKey: "event-3",
  policy,
  now: () => clock,
  operation: () => "should-not-run",
});
assert.equal(limited.status, "RATE_LIMITED");
assert.ok(limited.nextRetryAt);

const otherWorkspace = await executeResilientIntegrationOperation({
  workspaceId: "ws2",
  connectorId: "lead-webhook",
  idempotencyKey: "event-3",
  policy,
  now: () => clock,
  operation: () => "tenant-isolated",
});
assert.equal(otherWorkspace.status, "SUCCEEDED", "Rate and idempotency state must be isolated by workspace");

console.log("Integration resilience: OK — exponential retry, workspace-scoped idempotency, rate limiting, and replay behavior verified");
