/**
 * Demo AI runtime.
 *
 * It reuses the existing browser mock engine and browser-scoped conversation
 * storage. It is explicitly not an authority: every governance decision it
 * produces is marked `authority: "demo"`.
 */
import {
  evaluateDemoAiActionDecision,
  executeGovernedAiActionIntent,
} from "../application/aiActionApplicationService";
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
  AiWorkspaceScope,
} from "../application/ports/aiRuntime.types";
import { DEFAULT_AI_GOVERNANCE_POLICY, normalizeAiGovernancePolicy } from "../governance";
import { BrowserAiConversationStore } from "../infrastructure/BrowserAiConversationStore";
import type { AiChatMessage, AiChatThread } from "../aiTypes";
import { ApplicationError } from "@/shared/domain";

const makeId = (prefix: string): string => `${prefix}_${Math.random().toString(36).slice(2, 11)}`;

export class DemoAiRuntime implements AiRuntime {
  readonly mode = "demo" as const;

  constructor(private readonly store: BrowserAiConversationStore = new BrowserAiConversationStore()) {}

  async ask(request: AiAskRequest): Promise<AiAskResult> {
    const decision = this.decide(request.scope, { type: "NONE" }, {
      evidenceRefs: [
        `crm-context:${request.scope.workspaceId}`,
        `user-question:${request.question.slice(0, 80)}`,
      ],
    });
    if (!decision.allowed) {
      return { message: this.assistantMessage(decision.reasons[0] ?? "AI policy blocked this request."), decision };
    }
    if (!request.localContext) {
      throw new ApplicationError({
        code: "AI_CONTEXT_UNAVAILABLE",
        message: "The demo AI runtime requires a browser CRM context to answer.",
        category: "NOT_FOUND",
        retryable: false,
      });
    }
    // The browser mock engine is demo-only material and is loaded on demand.
    const { askCrmAi } = await import("../askCrmAi");
    return { message: askCrmAi(request.question, request.localContext), decision };
  }

  listConversations(scope: AiWorkspaceScope): Promise<AiChatThread[]> {
    return Promise.resolve(this.store.list(scope));
  }

  getConversation(scope: AiWorkspaceScope, conversationId: string): Promise<AiChatThread | null> {
    return Promise.resolve(this.store.find(scope, conversationId));
  }

  createConversation(scope: AiWorkspaceScope, input: AiCreateConversationInput): Promise<AiChatThread> {
    const now = new Date().toISOString();
    return Promise.resolve(this.store.create(scope, {
      id: makeId("thread"),
      title: input.title,
      workspaceId: scope.workspaceId,
      actorId: scope.actorId,
      messages: [{ id: makeId("wel"), role: "assistant", content: input.welcomeMessage, createdAt: now }],
      createdAt: now,
      updatedAt: now,
    }));
  }

  appendMessage(
    scope: AiWorkspaceScope,
    conversationId: string,
    message: AiChatMessage,
  ): Promise<AiChatThread | null> {
    return Promise.resolve(this.store.append(scope, conversationId, message));
  }

  deleteConversation(scope: AiWorkspaceScope, conversationId: string): Promise<void> {
    this.store.remove(scope, conversationId);
    return Promise.resolve();
  }

  getGovernanceDecision(
    scope: AiWorkspaceScope,
    intent: AiActionIntent,
    options: { approval?: AiActionApproval; evidenceRefs?: string[]; capabilityGranted?: boolean } = {},
  ): Promise<AiGovernanceDecisionView> {
    return Promise.resolve(this.decide(scope, intent, { ...options, persist: false }));
  }

  async executeAction(request: AiActionExecutionRequest): Promise<AiActionExecutionResult> {
    const decision = this.decide(request.scope, request.intent, {
      ...(request.approval === undefined ? {} : { approval: request.approval }),
      ...(request.evidenceRefs === undefined ? {} : { evidenceRefs: request.evidenceRefs }),
      ...(request.capabilityGranted === undefined ? {} : { capabilityGranted: request.capabilityGranted }),
    });
    return executeGovernedAiActionIntent(request, decision);
  }

  clear(): void {
    // Conversations are persisted per workspace/actor, so a scope switch simply
    // stops reading the previous scope. No in-memory answer cache survives.
  }

  private decide(
    scope: AiWorkspaceScope,
    intent: AiActionIntent,
    options: {
      approval?: AiActionApproval;
      evidenceRefs?: string[];
      capabilityGranted?: boolean;
      persist?: boolean;
    },
  ): AiGovernanceDecisionView {
    return evaluateDemoAiActionDecision({
      scope,
      intent,
      policy: normalizeAiGovernancePolicy(DEFAULT_AI_GOVERNANCE_POLICY),
      requestId: makeId("ai_request"),
      ...options,
    });
  }

  private assistantMessage(content: string): AiChatMessage {
    return { id: makeId("as"), role: "assistant", content, createdAt: new Date().toISOString() };
  }
}
