import type { MutationOutcome } from "@/shared/application";

export interface CrmTarget { targetType: "LEAD" | "CONTACT"; targetId: string; label?: string; eligible: boolean }
export interface ConversationCrmContext { state: "NONE" | "AVAILABLE" | "UNAVAILABLE"; version: number; canLink: boolean; target?: CrmTarget; successor?: CrmTarget }
export interface CommunicationsLinkQueries {
  context(id: string, signal: AbortSignal): Promise<ConversationCrmContext>;
  search(id: string, type: "LEAD" | "CONTACT", search: string, signal: AbortSignal): Promise<CrmTarget[]>;
}
export interface CommunicationsLinkCommands {
  change(id: string, target: CrmTarget | null, expectedVersion: number, signal: AbortSignal, key: string): Promise<MutationOutcome<{ changed: boolean }>>;
}
