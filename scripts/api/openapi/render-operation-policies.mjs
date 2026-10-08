/** Operation rows are derivatives of the canonical contract, never a second authority. */
export function renderOperationPolicySources(normalized) {
  const operations = [...normalized.operations].sort((left, right) => left.operationId.localeCompare(right.operationId));
  const base = { schemaVersion: 1, contractVersion: normalized.document.info.version };
  const serialize = (value) => `${JSON.stringify(value, null, 2)}\n`;
  return {
    idempotencyPolicySource: serialize({
      ...base,
      keyScope: "WORKSPACE_OPERATION_IDEMPOTENCY_KEY",
      sameKeySamePayload: "REPLAY_OR_RETURN_ORIGINAL_OUTCOME",
      sameKeyDifferentPayload: "409_IDEMPOTENCY_KEY_REUSED",
      concurrentDuplicate: "409_IDEMPOTENCY_REQUEST_IN_PROGRESS",
      retentionExpectation: "AT_LEAST_AGGREGATE_LIFECYCLE_AND_PROVIDER_SETTLEMENT_WINDOW; PROVIDER_ADAPTER_LONGER_RETENTION_PREVAILS",
      operations: operations.map((operation) => ({ operationId: operation.operationId, policy: operation.idempotencyPolicy, status: operation.contractStatus })),
    }),
    concurrencyPolicySource: serialize({
      ...base, conflictStatus: 412, conflictCode: "VERSION_CONFLICT",
      operations: operations.map((operation) => ({ operationId: operation.operationId, policy: operation.concurrencyPolicy, status: operation.contractStatus })),
    }),
    authorizationMatrixSource: serialize({
      ...base,
      operations: operations.map((operation) => {
        if (typeof operation.operation["x-workspace-required"] !== "boolean" || typeof operation.operation["x-actor-required"] !== "boolean") {
          throw new Error(`${operation.operationId}: explicit workspace/actor authority is required.`);
        }
        return {
          operationId: operation.operationId, method: operation.method, path: operation.route,
          moduleOwner: operation.ownerModule, capability: operation.requiredCapability,
          resourceScope: operation.resourceScope, dataScope: operation.dataScope, status: operation.contractStatus,
          workspaceRequired: operation.operation["x-workspace-required"], actorRequired: operation.operation["x-actor-required"],
          backendEnforcement: operation.contractStatus === "BLOCKED" ? "BLOCKED_BY_DECISION" : "REQUIRED",
        };
      }),
    }),
  };
}
