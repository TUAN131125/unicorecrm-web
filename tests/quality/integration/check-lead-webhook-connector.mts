import assert from "node:assert/strict";
import { ingestLeadWebhook } from "@/modules/leads";
import { getLeadsSnapshot } from "@/modules/leads";
import { resetIntegrationResilienceRuntime } from "@/platform/enterprise-security";
import { getWorkspaceContextSnapshot, resetWorkspaceContextSelection } from "@/platform/workspace-context";

resetWorkspaceContextSelection();
resetIntegrationResilienceRuntime();
const workspaceId = getWorkspaceContextSnapshot().workspaceId;
const now = "2026-07-13T01:00:00.000Z";
const command = {
  workspaceId,
  connectorId: "development-lead-webhook",
  authentication: { verified: true, keyId: "vault://ws1/webhook/signing-key", signedAt: now },
  idempotencyKey: "external-event-001",
  payload: { name: "Connector Contract Lead", email: "connector.contract@example.com", source: "Website", sourceRecordId: "web-001" },
  now,
};
const first = await ingestLeadWebhook(command);
assert.equal(first.disposition, "CREATED");
assert.ok(first.leadId);
assert.equal(getLeadsSnapshot().filter((lead) => lead.id === first.leadId).length, 1);

const replay = await ingestLeadWebhook(command);
assert.equal(replay.disposition, "IDEMPOTENT_REPLAY");
assert.equal(replay.leadId, first.leadId);
assert.equal(getLeadsSnapshot().filter((lead) => lead.id === first.leadId).length, 1, "Replay must not create a duplicate Lead");

await assert.rejects(
  ingestLeadWebhook({ ...command, idempotencyKey: "external-event-stale", authentication: { ...command.authentication, signedAt: "2026-07-12T00:00:00.000Z" } }),
  /replay window/i,
);
await assert.rejects(
  ingestLeadWebhook({ ...command, idempotencyKey: "external-event-cross-tenant", workspaceId: "ws2" }),
  /tenant does not match/i,
);
await assert.rejects(
  ingestLeadWebhook({ ...command, idempotencyKey: "external-event-unsigned", authentication: { ...command.authentication, verified: false } }),
  /authentication failed/i,
);

console.log("Lead webhook connector: OK — authenticated evidence, replay window, tenant boundary, idempotency, and end-to-end Lead creation verified in the development adapter");
