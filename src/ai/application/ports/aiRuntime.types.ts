/**
 * Frontend AI application boundary.
 *
 * The AI UI depends on these ports only. It never depends on a mock engine, on
 * browser storage or on a model provider. Demo and connected runtimes implement
 * the same contract, which keeps the floating assistant UX identical while the
 * authority behind it changes.
 */
import type { AiChatMessage, AiChatThread } from "../../aiTypes";
import type { AiDataClass } from "../../governance";
import type { AiActionIntent } from "../aiActionIntent";
import type { AiContextWrapper } from "../../aiContextBuilder";

/** Every AI request carries workspace and actor scope to prevent cross-tenant leakage. */
export interface AiWorkspaceScope {
  workspaceId: string;
  workspaceKey?: string;
  actorId: string;
  actorName?: string;
}

export type AiFocusedEntityType =
  | "lead"
  | "customer"
  | "contact"
  | "organization"
  | "deal"
  | "quote"
  | "order"
  | "case"
  | "task"
  | "report";

export interface AiFocusedEntityRef {
  entityType: AiFocusedEntityType;
  entityId?: string;
}

export type AiContextScopeKey =
  | "GLOBAL_SUMMARY"
  | "FOCUSED_RECORD"
  | "WORK_PRIORITY"
  | "PIPELINE"
  | "SUPPORT"
  | "COMMERCIAL";

/**
 * The only CRM-derived payload a connected request may transmit. It carries
 * aggregate counts and identifiers, never record collections, credentials or
 * blocked field keys.
 */
export interface AiSanitizedRequestContext {
  scopeKeys: AiContextScopeKey[];
  allowedDataClasses: AiDataClass[];
  redactedFieldKeys: string[];
  counts: Record<string, number>;
  focusedEntity?: AiFocusedEntityRef;
  /** Present only when the effective policy allows the FINANCIAL data class. */
  commercial?: {
    totalPipelineValue: number;
    totalExpectedRevenue: number;
    totalOrdersValue: number;
  };
}

export interface AiAskRequest {
  scope: AiWorkspaceScope;
  conversationId: string;
  question: string;
  locale: "vi" | "en";
  requestedContextScope: AiContextScopeKey[];
  focusedEntity?: AiFocusedEntityRef;
  /** Transmittable, capability-filtered projection of the CRM context. */
  sanitizedContext?: AiSanitizedRequestContext;
  /**
   * Demo/offline answer material. It stays inside the browser: a connected
   * runtime must never place this value on the wire.
   */
  localContext?: AiContextWrapper;
  signal?: AbortSignal;
}

/**
 * Governance decision shape. In connected mode the backend is the authority and
 * `authority` is `"backend"`; the browser policy may only produce `"demo"`
 * decisions, which are never production authorization.
 */
export interface AiGovernanceDecisionView {
  allowed: boolean;
  requiresApproval: boolean;
  reasons: string[];
  decisionId?: string;
  authority: "backend" | "demo";
}

export interface AiAskResult {
  message: AiChatMessage;
  decision: AiGovernanceDecisionView;
}

export interface AiCreateConversationInput {
  title: string;
  welcomeMessage: string;
}

export interface AiActionApproval {
  approved: boolean;
  approvedBy: string;
  approvedAt?: string;
  /** Echoes the decision the backend issued; a frontend-invented id is not authorization. */
  decisionId?: string;
}

export interface AiActionExecutionRequest {
  scope: AiWorkspaceScope;
  intent: AiActionIntent;
  conversationId?: string;
  approval?: AiActionApproval;
  evidenceRefs?: string[];
  /**
   * Local capability projection used for demo evaluation and for hiding
   * impossible actions. It is a UX hint, never production authorization.
   */
  capabilityGranted?: boolean;
  signal?: AbortSignal;
}

export type AiActionExecutionStatus =
  | "EXECUTED"
  | "BLOCKED"
  | "APPROVAL_REQUIRED"
  | "NOT_SUPPORTED";

export interface AiActionExecutionResult {
  status: AiActionExecutionStatus;
  effect: "CLIENT" | "CRM_COMMAND" | "NONE";
  decision: AiGovernanceDecisionView;
  evidenceRefs: string[];
  correlationId?: string;
  createdTask?: { id: string; title: string };
}

export interface AiApiPort {
  ask(request: AiAskRequest): Promise<AiAskResult>;
}

export interface AiConversationPort {
  listConversations(scope: AiWorkspaceScope): Promise<AiChatThread[]>;
  getConversation(scope: AiWorkspaceScope, conversationId: string): Promise<AiChatThread | null>;
  createConversation(scope: AiWorkspaceScope, input: AiCreateConversationInput): Promise<AiChatThread>;
  appendMessage(scope: AiWorkspaceScope, conversationId: string, message: AiChatMessage): Promise<AiChatThread | null>;
  deleteConversation(scope: AiWorkspaceScope, conversationId: string): Promise<void>;
}

export interface AiActionPort {
  getGovernanceDecision(
    scope: AiWorkspaceScope,
    intent: AiActionIntent,
    options?: { approval?: AiActionApproval; evidenceRefs?: string[]; capabilityGranted?: boolean },
  ): Promise<AiGovernanceDecisionView>;
  executeAction(request: AiActionExecutionRequest): Promise<AiActionExecutionResult>;
}

export type AiRuntimeMode = "demo" | "connected";

export interface AiRuntime extends AiApiPort, AiConversationPort, AiActionPort {
  readonly mode: AiRuntimeMode;
  /** Called on workspace scope disposal so no answer or thread survives a switch. */
  clear(): void;
}
