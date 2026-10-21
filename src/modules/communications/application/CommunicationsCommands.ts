import type { MutationOutcome } from "@/shared/application";
import type { ConversationStatus } from "../domain/models";

export interface CommunicationsCommands {
  transition(id: string, target: ConversationStatus, expectedVersion: number, signal: AbortSignal, idempotencyKey: string): Promise<MutationOutcome<{ id: string; status: ConversationStatus; changed: boolean }>>;
  claim(id: string, signal: AbortSignal, idempotencyKey: string): Promise<MutationOutcome<{ conversationId: string }>>;
}
