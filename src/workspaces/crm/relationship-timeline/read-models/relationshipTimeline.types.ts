import type { RelationshipRef } from "@/platform/identity";

export type RelationshipTimelineEventType =
  | "ACQUISITION"
  | "QUALIFICATION"
  | "DEAL"
  | "QUOTE"
  | "ORDER"
  | "PAYMENT"
  | "SHIPPING"
  | "PURCHASE_EVIDENCE"
  | "SUPPORT"
  | "ACTIVITY"
  | "TASK";

export interface RelationshipTimelineEvent {
  id: string;
  relationshipRef: RelationshipRef;
  type: RelationshipTimelineEventType;
  title: string;
  description?: string;
  occurredAt: string;
  sourceRef: { type: string; id: string };
  status?: string;
  metadata?: Record<string, string | number | boolean | undefined>;
}
