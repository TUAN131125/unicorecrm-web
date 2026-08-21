/**
 * Connected AI runtime.
 *
 * The frontend never talks to a model provider. It talks to the product backend
 * through the shared HTTP boundary, and the backend owns the provider
 * credentials, the authoritative CRM context and the authoritative governance
 * decision.
 *
 * No approved OpenAPI operation exists for the AI Assistant yet, so every
 * connected operation fails closed with `CONTRACT_OPERATION_BLOCKED`, the same
 * pattern used by the other OpenAPI-blocked connected boundaries. Connected mode
 * must never fall back to the demo runtime: an unavailable AI backend is a
 * reported state, not simulated output.
 */
import { ApiClientError, type HttpClient } from "@/platform/api";
import type { AiActionIntent } from "../application/aiActionIntent";
import type {
  AiActionApproval,
  AiActionExecutionRequest,
  AiActionExecutionResult,
  AiAskRequest,
  AiAskResult,
  AiCreateConversationInput,
  AiGovernanceDecisionView,
  AiRuntime,
  AiSanitizedRequestContext,
  AiWorkspaceScope,
} from "../application/ports/aiRuntime.types";
import type { AiChatMessage, AiChatThread } from "../aiTypes";

/** Blocking decision recorded against the missing OpenAPI projection. */
export const AI_ASSISTANT_API_DECISION_ID = "DEC-AI-ASSISTANT-API";

/**
 * Proposed transport contract for the future backend AI API. These are frontend
 * expectations under review, not production-ready endpoints, which is why no
 * request is issued until the operations are approved in `docs/api/openapi.json`.
 */
export const CONNECTED_AI_OPERATIONS = [
  "askAiAssistant",
  "listAiConversations",
  "getAiConversation",
  "createAiConversation",
  "appendAiConversationMessage",
  "deleteAiConversation",
  "evaluateAiActionGovernance",
  "executeAiAction",
] as const;

export type ConnectedAiOperation = (typeof CONNECTED_AI_OPERATIONS)[number];

/** Wire payload for an AI question. Record collections are never transmitted. */
export interface ConnectedAiAskPayload {
  workspaceId: string;
  actorId: string;
  conversationId: string;
  question: string;
  locale: "vi" | "en";
  requestedContextScope: string[];
  focusedEntity?: { entityType: string; entityId?: string };
  context?: AiSanitizedRequestContext;
}

/**
 * Builds the connected request body. `localContext` — the in-browser CRM state
 * used by the demo engine — is dropped here and can never reach the wire.
 */
export function toConnectedAiAskPayload(request: AiAskRequest): ConnectedAiAskPayload {
  return {
    workspaceId: request.scope.workspaceId,
    actorId: request.scope.actorId,
    conversationId: request.conversationId,
    question: request.question,
    locale: request.locale,
    requestedContextScope: [...request.requestedContextScope],
    ...(request.focusedEntity
      ? {
          focusedEntity: {
            entityType: request.focusedEntity.entityType,
            ...(request.focusedEntity.entityId ? { entityId: request.focusedEntity.entityId } : {}),
          },
        }
      : {}),
    ...(request.sanitizedContext ? { context: request.sanitizedContext } : {}),
  };
}

/** Wire payload for an AI action execution or approval. */
export interface ConnectedAiActionPayload {
  workspaceId: string;
  actorId: string;
  conversationId?: string;
  intent: AiActionIntent;
  evidenceRefs: string[];
  approval?: { approved: boolean; approvedBy: string; approvedAt?: string; decisionId?: string };
}

export function toConnectedAiActionPayload(request: AiActionExecutionRequest): ConnectedAiActionPayload {
  return {
    workspaceId: request.scope.workspaceId,
    actorId: request.scope.actorId,
    ...(request.conversationId ? { conversationId: request.conversationId } : {}),
    intent: request.intent,
    evidenceRefs: [...(request.evidenceRefs ?? [])],
    ...(request.approval
      ? {
          approval: {
            approved: request.approval.approved,
            approvedBy: request.approval.approvedBy,
            ...(request.approval.approvedAt ? { approvedAt: request.approval.approvedAt } : {}),
            ...(request.approval.decisionId ? { decisionId: request.approval.decisionId } : {}),
          },
        }
      : {}),
  };
}

export class ConnectedAiRuntime implements AiRuntime {
  readonly mode = "connected" as const;

  constructor(private readonly client: HttpClient) {}

  ask(request: AiAskRequest): Promise<AiAskResult> {
    return this.blocked("askAiAssistant", request.scope);
  }

  listConversations(scope: AiWorkspaceScope): Promise<AiChatThread[]> {
    return this.blocked("listAiConversations", scope);
  }

  getConversation(scope: AiWorkspaceScope, _conversationId: string): Promise<AiChatThread | null> {
    return this.blocked("getAiConversation", scope);
  }

  createConversation(scope: AiWorkspaceScope, _input: AiCreateConversationInput): Promise<AiChatThread> {
    return this.blocked("createAiConversation", scope);
  }

  appendMessage(
    scope: AiWorkspaceScope,
    _conversationId: string,
    _message: AiChatMessage,
  ): Promise<AiChatThread | null> {
    return this.blocked("appendAiConversationMessage", scope);
  }

  deleteConversation(scope: AiWorkspaceScope, _conversationId: string): Promise<void> {
    return this.blocked("deleteAiConversation", scope);
  }

  getGovernanceDecision(
    scope: AiWorkspaceScope,
    _intent: AiActionIntent,
    _options?: { approval?: AiActionApproval; evidenceRefs?: string[]; capabilityGranted?: boolean },
  ): Promise<AiGovernanceDecisionView> {
    return this.blocked("evaluateAiActionGovernance", scope);
  }

  executeAction(request: AiActionExecutionRequest): Promise<AiActionExecutionResult> {
    return this.blocked("executeAiAction", request.scope);
  }

  clear(): void {
    // Connected conversations live on the server; nothing is cached locally.
  }

  private blocked<TResult>(operation: ConnectedAiOperation, scope: AiWorkspaceScope): Promise<TResult> {
    // The client is held so the boundary is ready for the approved contract; it
    // is intentionally not used while the operations remain blocked.
    void this.client;
    return Promise.reject(new ApiClientError({
      code: "CONTRACT_OPERATION_BLOCKED",
      message: `AI Assistant operation ${operation} is blocked until its OpenAPI projection is approved.`,
      status: 501,
      retryable: false,
      details: {
        decisionId: AI_ASSISTANT_API_DECISION_ID,
        operation,
        workspaceId: scope.workspaceId,
      },
    }));
  }
}
