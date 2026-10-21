export type ConversationStatus = "NEW" | "OPEN" | "PENDING" | "CLOSED";
export interface ConversationSummary {
  id: string;
  lastActivityAt: string;
  version?: number;
  status?: ConversationStatus;
  canTransition?: boolean;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  sequence: number;
  text?: string;
  occurredAt: string;
}

export interface CommunicationsPage<T> {
  canClaim?: boolean;
  items: readonly T[];
  nextCursor: string | null;
}
