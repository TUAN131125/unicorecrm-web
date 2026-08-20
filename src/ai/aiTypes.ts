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
  actionType: "navigate" | "copy" | "draft" | "view" | "none";
  route?: string;
  payload?: string;
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
}
