import type { HttpClient } from "@/platform/api";
import { CommunicationsApiClient } from "@/platform/api/extensions/communicationsApi";
import type { CommunicationsLinkCommands, CommunicationsLinkQueries } from "../../application/CommunicationsLink";

export function createCommunicationsLink(http: HttpClient): { queries: CommunicationsLinkQueries; commands: CommunicationsLinkCommands } {
  const api = new CommunicationsApiClient(http);
  return { queries: { context: (id, signal) => api.crmContext(id, signal), search: (id, type, search, signal) => api.crmCandidates(id, type, search, signal) },
    commands: { change: async (id, target, version, signal, idempotencyKey) => {
      const result = await api.changeCrmLink(id, target, version, signal, idempotencyKey);
      return { data: { changed: result.changed }, commandId: result.auditId ?? result.correlationId,
        commandType: "communications.link", aggregateType: "conversation", aggregateId: id,
        idempotencyKey, correlationId: result.correlationId, occurredAt: result.occurredAt, version: result.version,
        emittedEvents: [], audit: { authority: "backend", evidenceIds: result.auditId ? [result.auditId] : [] } };
    } } };
}
