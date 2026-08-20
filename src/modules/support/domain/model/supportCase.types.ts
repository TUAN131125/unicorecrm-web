import type { RelationshipRef } from "@/platform/identity";
export type SupportCaseStatus =
  | "new"
  | "in_progress"
  | "waiting_customer"
  | "waiting_internal"
  | "resolved"
  | "closed"
  | "reopened"
  | "cancelled";

export type SupportCasePriority =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type SupportCaseCategory =
  | "request"
  | "consultation"
  | "complaint"
  | "follow_up"
  | "onboarding"
  | "usage_issue"
  | "post_purchase"
  // Legacy persisted values kept for safe read compatibility.
  | "technical_support"
  | "warranty"
  | "customer_care"
  | "billing"
  | "feature_request";

export type SupportCaseSource =
  | "manual"
  | "customer_360"
  | "email"
  | "phone"
  | "chat"
  | "web_form"
  | "order"
  | "product";

export type SupportCaseChannel =
  | "email"
  | "phone"
  | "chat"
  | "meeting"
  | "internal";

export type SupportCaseSlaStatus =
  | "on_track"
  | "at_risk"
  | "breached"
  | "paused"
  | "not_applicable";

export type SupportCaseActivityType =
  | "created"
  | "status_changed"
  | "assigned"
  | "first_response"
  | "comment_added"
  | "internal_note_added"
  | "resolved"
  | "closed"
  | "reopened"
  | "linked_record_changed";

export interface SupportCaseActivity {
  id: string;
  type: SupportCaseActivityType;
  title: string;
  description: string;
  createdAt: string;
  actorName: string;
  metadata?: Record<string, unknown>;
}

export interface SupportCaseComment {
  id: string;
  type: "customer_reply" | "agent_reply" | "internal_note";
  body: string;
  authorName: string;
  createdAt: string;
  isInternal: boolean;
}

export interface SupportCaseChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  completedAt?: string;
  completedBy?: string;
}

export interface CaseComment {
  id: string;
  authorName: string;
  authorRole: string; // "Support Agent" or "Customer" or "System"
  authorAvatar?: string;
  content: string;
  createdAt: string;
  type: "reply" | "note" | "system"; // reply to customer vs internal note vs system log
  attachments?: {
    name: string;
    type: "image" | "file";
    url?: string;
  }[];
}

export interface SupportCase {
  /** Backend optimistic-concurrency token. Demo/browser records may omit it. */
  resourceVersion?: number;
  id: string;
  caseNumber: string;

  title: string;
  description: string;

  status: SupportCaseStatus;
  priority: SupportCasePriority;
  category: SupportCaseCategory;
  source: SupportCaseSource;
  channel?: SupportCaseChannel;

  customerId: string;
  customerName: string;
  /** Canonical relationship identity. customerId is retained only for route/display compatibility. */
  relationshipRef?: RelationshipRef;

  contactId?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;

  relatedOrderId?: string;
  relatedOrderNumber?: string;

  relatedProductId?: string;
  relatedProductName?: string;
  relatedOwnedProductId?: string;

  ownerId?: string;
  ownerName?: string;
  team?: string;

  createdAt: string;
  updatedAt: string;
  firstResponseDueAt?: string;
  resolutionDueAt?: string;
  firstRespondedAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  nextFollowUpAt?: string;
  reopenedAt?: string;

  slaStatus: SupportCaseSlaStatus;

  tags?: string[];

  resolutionSummary?: string;
  internalSummary?: string;

  activities?: SupportCaseActivity[];
  comments?: SupportCaseComment[];
  checklist?: SupportCaseChecklistItem[];

  // Backward compatibility fields
  customerTier?: string;
  customerContactName?: string;
  customerContactEmail?: string;
  customerContactPhone?: string;
  customerContactCity?: string;
  customerContactMRR?: string;
  serviceCategory?: string;
  serviceModule?: string;
  version?: string;
  lastActivityMinutesAgo?: number;
  slaFirstResponseMinutes?: number;
  slaFirstResponseTarget?: string;
  slaFirstResponseTimeLeft?: string;
  slaFirstResponsePercent?: number;
  slaResolveHours?: number;
  slaResolveTarget?: string;
  slaResolveTimeLeft?: string;
  slaResolvePercent?: number;
  resolutionSteps?: {
    id: string;
    text: string;
    isCompleted: boolean;
  }[];
  conversationThread?: CaseComment[];
}
