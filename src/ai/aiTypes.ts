import type { AiActionIntent } from "./application/aiActionIntent";

export type AiInsightType =
  | "summary"
  | "risk"
  | "next_action"
  | "opportunity"
  | "support"
  | "forecast"
  | "priority"
  | "draft"
  | "warning";

export type AiInsightSeverity =
  | "info"
  | "low"
  | "medium"
  | "high"
  | "critical";

export interface AiInsight {
  id: string;
  type: AiInsightType;
  severity: AiInsightSeverity;
  title: string;
  description: string;
  reasons: string[];
  suggestedActions: AiSuggestedAction[];
  relatedEntityType?: string;
  relatedEntityId?: string;
  route?: string;
  createdAt: string;
}

export interface AiSuggestedAction {
  id: string;
  label: string;
  description?: string;
  /** Original discriminator, kept so stored conversations keep rendering. */
  actionType: "navigate" | "copy" | "draft" | "view" | "none";
  route?: string;
  payload?: string;
  /**
   * Canonical typed intent. When present it takes precedence over `actionType`.
   * See `src/ai/application/aiActionIntent.ts` for the closed union.
   */
  intent?: AiActionIntent;
  /** Explainability references carried through to the executed action. */
  evidenceRefs?: string[];
}

export interface AiChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  suggestedActions?: AiSuggestedAction[];
}

export interface AiChatThread {
  id: string;
  title: string;
  messages: AiChatMessage[];
  createdAt: string;
  updatedAt: string;
  /** Scope owners. Present on every thread produced by the AI runtime. */
  workspaceId?: string;
  actorId?: string;
}
