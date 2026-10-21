import type { HttpClient } from "@/platform/api";
import { CommunicationsApiClient } from "@/platform/api/extensions/communicationsApi";
import type { CommunicationsCommands } from "../../application/CommunicationsCommands";

export function createCommunicationsCommands(http: HttpClient): CommunicationsCommands {
  const api = new CommunicationsApiClient(http);
  return { transition: async (id, target, expectedVersion, signal, idempotencyKey) => {
    const response = await api.transition(id, target, expectedVersion, signal, idempotencyKey);
    return { data: { id: response.id, status: response.status, changed: response.changed },
      commandId: response.auditId ?? response.correlationId, commandType: "communications.transition", aggregateType: "conversation",
      aggregateId: response.id, idempotencyKey, correlationId: response.correlationId, occurredAt: response.occurredAt,
      version: response.version, emittedEvents: [], audit: { authority: "backend", evidenceIds: response.auditId ? [response.auditId] : [] } };
  }, claim: async (id, signal, idempotencyKey) => {
    const response = await api.claim(id, signal, idempotencyKey);
    return { data: { conversationId: response.conversationId }, commandId: response.auditId,
      commandType: "communications.claim", aggregateType: "conversation", aggregateId: response.conversationId,
      idempotencyKey, correlationId: response.correlationId, occurredAt: response.occurredAt, version: response.version,
      outcome: response.replayed ? "REPLAYED" : "COMMITTED", emittedEvents: [],
      audit: { authority: "backend", evidenceIds: [response.auditId] } };
  } };
}
