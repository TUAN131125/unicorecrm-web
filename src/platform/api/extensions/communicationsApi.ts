import type { HttpClient } from "../client/HttpClient";
import { ApiClientError } from "../errors/ApiClientError";
import { CommunicationsApiClient as CanonicalCommunicationsClient } from "../generated/communicationsApi";

// Validated wire projection over canonical generated transport; no handwritten route authority.
export type CommunicationStatusWire = "NEW" | "OPEN" | "PENDING" | "CLOSED";
export interface CommunicationConversationWire { id: string; lastActivityAt: string; version?: number; status?: CommunicationStatusWire; canTransition?: boolean }
export interface CommunicationTransitionWire { id: string; status: CommunicationStatusWire; version: number; changed: boolean; auditId: string | null; occurredAt: string; correlationId: string }
export interface CommunicationMessageWire { id: string; conversationId: string; sequence: number; occurredAt: string; text?: string }
export interface CommunicationPageWire<T> { items: T[]; nextCursor: string | null; canClaim?: boolean }
export interface CommunicationClaimWire { conversationId: string; version: number; auditId: string; occurredAt: string; replayed: boolean; correlationId: string }
export interface CommunicationCrmTargetWire { targetType: "LEAD" | "CONTACT"; targetId: string; label?: string; eligible: boolean }
export interface CommunicationCrmContextWire { state: "NONE" | "AVAILABLE" | "UNAVAILABLE"; version: number; canLink: boolean; target?: CommunicationCrmTargetWire; successor?: CommunicationCrmTargetWire }
export interface CommunicationLinkMutationWire { id: string; version: number; changed: boolean; auditId: string | null; occurredAt: string; correlationId: string }
const invalid = (): never => { throw new ApiClientError({ code: "CONTRACT_VIOLATION", message: "Invalid Communications response.", retryable: false }); };
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
function id(value: unknown): string { if (typeof value !== "string" || !/^[A-Za-z0-9-]+$/.test(value)) return invalid(); return value; }
function date(value: unknown): string { if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return invalid(); return value; }
function integer(value: unknown): number { if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) return invalid(); return value; }
function status(value: unknown): CommunicationStatusWire {
  if (value !== "NEW" && value !== "OPEN" && value !== "PENDING" && value !== "CLOSED") return invalid();
  return value;
}
function conversation(value: unknown, queue: boolean): CommunicationConversationWire {
  const row = object(value);
  if (Object.keys(row).some(key => !(queue ? ["id", "lastActivityAt"] : ["id", "lastActivityAt", "version", "status", "canTransition"]).includes(key))
    || !queue && typeof row.canTransition !== "boolean") return invalid();
  return { id: id(row.id), lastActivityAt: date(row.lastActivityAt), ...(queue ? {} : {
    version: integer(row.version), status: status(row.status), canTransition: row.canTransition === true }) };
}
function message(value: unknown): CommunicationMessageWire {
  const row = object(value);
  if (Object.keys(row).some(key => !["id", "conversationId", "sequence", "occurredAt", "text"].includes(key))) return invalid();
  if (row.text !== undefined && typeof row.text !== "string") return invalid();
  return { id: id(row.id), conversationId: id(row.conversationId), sequence: integer(row.sequence), occurredAt: date(row.occurredAt),
    ...(typeof row.text === "string" ? { text: row.text } : {}) };
}
function page<T>(value: unknown, item: (value: unknown) => T): CommunicationPageWire<T> {
  const row = object(value);
  if (Object.keys(row).some(key => !["items", "nextCursor", "canClaim"].includes(key)) || !Array.isArray(row.items) || row.items.length > 100
    || (row.canClaim !== undefined && typeof row.canClaim !== "boolean")
    || !(row.nextCursor === null || row.nextCursor === undefined || (typeof row.nextCursor === "string" && row.nextCursor.length <= 4096))) return invalid();
  return { items: row.items.map(item), nextCursor: typeof row.nextCursor === "string" ? row.nextCursor : null,
    ...(typeof row.canClaim === "boolean" ? { canClaim: row.canClaim } : {}) };
}
export class CommunicationsApiClient {
  private readonly client: CanonicalCommunicationsClient;
  constructor(http: HttpClient) { this.client = new CanonicalCommunicationsClient(http); }
  async crmContext(conversationId: string, signal: AbortSignal): Promise<CommunicationCrmContextWire> {
    const row = object(await this.client.getConversationCrmContext<unknown>(conversationId, {}, signal));
    if (Object.keys(row).some(key => !["state", "version", "canLink", "target", "successor"].includes(key))
      || row.state !== "NONE" && row.state !== "AVAILABLE" && row.state !== "UNAVAILABLE" || typeof row.canLink !== "boolean"
      || row.state === "AVAILABLE" && !row.target || row.state !== "AVAILABLE" && (row.target != null || row.successor != null)) return invalid();
    return { state: row.state, version: integer(row.version), canLink: row.canLink,
      ...(row.target ? { target: crmTarget(row.target) } : {}), ...(row.successor ? { successor: crmTarget(row.successor) } : {}) };
  }
  async crmCandidates(conversationId: string, targetType: "LEAD" | "CONTACT", search: string, signal: AbortSignal) {
    const rows = await this.client.searchConversationCrmCandidates<unknown>(conversationId, { targetType, search }, signal);
    if (!Array.isArray(rows) || rows.length > 20) return invalid();
    return rows.map(row => { const target = crmTarget(row); if (target.targetType !== targetType || !target.eligible) return invalid(); return target; });
  }
  async changeCrmLink(conversationId: string, target: CommunicationCrmTargetWire | null, expectedVersion: number, signal: AbortSignal, idempotencyKey: string): Promise<CommunicationLinkMutationWire> {
    const options = { signal, idempotencyKey, retry: "never" as const };
    const row = object(target
      ? await this.client.linkConversationCrmRecord<unknown>(conversationId, { targetType: target.targetType, targetId: target.targetId, expectedVersion }, options)
      : await this.client.unlinkConversationCrmRecord<unknown>(conversationId, { expectedVersion }, options));
    if (Object.keys(row).some(key => !["id", "version", "changed", "auditId", "occurredAt", "correlationId"].includes(key))
      || row.id !== conversationId || typeof row.changed !== "boolean" || typeof row.correlationId !== "string"
      || row.version !== expectedVersion + (row.changed ? 1 : 0)
      || (row.changed ? typeof row.auditId !== "string" : row.auditId != null)) return invalid();
    return { id: id(row.id), version: integer(row.version), changed: row.changed, auditId: row.auditId == null ? null : id(row.auditId),
      occurredAt: date(row.occurredAt), correlationId: row.correlationId };
  }
  async transition(conversationId: string, targetStatus: CommunicationStatusWire, expectedVersion: number,
    signal: AbortSignal, idempotencyKey: string): Promise<CommunicationTransitionWire> {
    const row = object(await this.client.transitionConversation<unknown>(conversationId, { targetStatus, expectedVersion },
      { signal, idempotencyKey, retry: "never" }));
    if (Object.keys(row).some(key => !["id", "status", "version", "changed", "auditId", "occurredAt", "correlationId"].includes(key))
      || row.id !== conversationId || typeof row.changed !== "boolean" || typeof row.correlationId !== "string"
      || row.status !== targetStatus || row.version !== expectedVersion + (row.changed ? 1 : 0)
      || (row.changed ? typeof row.auditId !== "string" : row.auditId !== null && row.auditId !== undefined)) return invalid();
    return { id: id(row.id), status: status(row.status), version: integer(row.version), changed: row.changed,
      auditId: row.auditId === null || row.auditId === undefined ? null : id(row.auditId), occurredAt: date(row.occurredAt), correlationId: row.correlationId };
  }
  async claim(conversationId: string, signal: AbortSignal, _idempotencyKey: string): Promise<CommunicationClaimWire> {
    const row = object(await this.client.claimConversation<unknown>(conversationId, {}, signal));
    if (Object.keys(row).some(key => !["conversationId", "version", "auditId", "occurredAt", "replayed", "correlationId"].includes(key))
      || row.conversationId !== conversationId || typeof row.replayed !== "boolean" || typeof row.correlationId !== "string") return invalid();
    return { conversationId: id(row.conversationId), version: integer(row.version), auditId: id(row.auditId),
      occurredAt: date(row.occurredAt), replayed: row.replayed, correlationId: row.correlationId };
  }
  async list(view: "assigned" | "unassigned", cursor: string | null, signal: AbortSignal, statusView: "active" | "closed" = "active") {
    const value = await this.client.listConversations<unknown>({ view, statusView, ...(cursor ? { cursor } : {}), limit: 25 }, signal);
    return page(value, row => conversation(row, view === "unassigned"));
  }
  async get(conversationId: string, signal: AbortSignal) {
    const value = await this.client.getConversation<unknown>(conversationId, {}, signal);
    return conversation(value, false);
  }
  async messages(conversationId: string, cursor: string | null, signal: AbortSignal) {
    const value = await this.client.listConversationMessages<unknown>(conversationId, { ...(cursor ? { cursor } : {}), limit: 25 }, signal);
    const result = page(value, message);
    if (result.items.some(row => row.conversationId !== conversationId)) return invalid();
    return result;
  }
}

function crmTarget(value: unknown): CommunicationCrmTargetWire {
  const row = object(value);
  if (Object.keys(row).some(key => !["targetType", "targetId", "label", "eligible"].includes(key))
    || row.targetType !== "LEAD" && row.targetType !== "CONTACT" || typeof row.targetId !== "string"
    || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(row.targetId) || typeof row.eligible !== "boolean"
    || row.label != null && (typeof row.label !== "string" || row.label.length > 1000)) return invalid();
  return { targetType: row.targetType, targetId: row.targetId, eligible: row.eligible, ...(typeof row.label === "string" ? { label: row.label } : {}) };
}
