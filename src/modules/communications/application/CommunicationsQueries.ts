import type { CommunicationsPage, ConversationMessage, ConversationSummary } from "../domain/models";

// UI query boundary; wire validation belongs to the platform Communications API extension.
export interface CommunicationsQueries {
  list(cursor: string | null, signal: AbortSignal): Promise<CommunicationsPage<ConversationSummary>>;
  get(id: string, signal: AbortSignal): Promise<ConversationSummary | null>;
  messages(id: string, cursor: string | null, signal: AbortSignal): Promise<CommunicationsPage<ConversationMessage>>;
}
