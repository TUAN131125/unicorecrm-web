/**
 * Connected AI runtime.
 *
 * The browser calls only the backend-owned read-only advisory extension. CRM
 * records, permissions, provider selection and credentials remain server-side.
 * Conversation state is an ephemeral presentation shell: it is scoped in
 * memory, cleared on workspace/session disposal and never treated as CRM truth.
 */
import { AiAdvisoryApiClient, ApiClientError, type AiAdvisoryContextReferences, type HttpClient } from "@/platform/api";
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
import type { AiChatMessage, AiChatThread } from "../aiTypes";

export const AI_MUTATION_DECISION_ID = "DEC-AI-MUTATION-TOOLS";

export class ConnectedAiRuntime implements AiRuntime {
  readonly mode = "connected" as const;
  private readonly api: AiAdvisoryApiClient;
  private readonly conversations = new Map<string, AiChatThread[]>();

  constructor(client: HttpClient) {
    this.api = new AiAdvisoryApiClient(client);
  }

  async ask(request: AiAskRequest): Promise<AiAskResult> {
    const response = await this.api.requestAdvisory({
      question: request.question.trim(),
      locale: request.locale,
      contextReferences: toAdvisoryContextReferences(request),
    }, request.signal);
    return {
      message: {
        id: response.executionId,
        role: "assistant",
        content: formatAdvisory(response, request.locale),
        createdAt: new Date().toISOString(),
        ...(request.focusedEntity?.entityId === undefined ? {} : {
          relatedEntityType: request.focusedEntity.entityType,
          relatedEntityId: request.focusedEntity.entityId,
        }),
      },
      decision: {
        allowed: true,
        requiresApproval: false,
        reasons: [request.locale === "vi"
          ? "Nội dung chỉ mang tính tư vấn; không có bản ghi nghiệp vụ nào được thay đổi."
          : "This is advisory-only output; no business record was changed."],
        decisionId: response.executionId,
        authority: "backend",
      },
    };
  }

  listConversations(scope: AiWorkspaceScope): Promise<AiChatThread[]> {
    return Promise.resolve(this.readThreads(scope));
  }

  getConversation(scope: AiWorkspaceScope, conversationId: string): Promise<AiChatThread | null> {
    return Promise.resolve(this.readThreads(scope).find((thread) => thread.id === conversationId) ?? null);
  }

  createConversation(scope: AiWorkspaceScope, input: AiCreateConversationInput): Promise<AiChatThread> {
    const now = new Date().toISOString();
    const thread: AiChatThread = {
      id: createPresentationId("ai_thread"),
      title: input.title,
      workspaceId: scope.workspaceId,
      actorId: scope.actorId,
      messages: [{ id: createPresentationId("ai_welcome"), role: "assistant", content: input.welcomeMessage, createdAt: now }],
      createdAt: now,
      updatedAt: now,
    };
    this.writeThreads(scope, [thread, ...this.readThreads(scope)]);
    return Promise.resolve(cloneThread(thread));
  }

  appendMessage(scope: AiWorkspaceScope, conversationId: string, message: AiChatMessage): Promise<AiChatThread | null> {
    let updated: AiChatThread | null = null;
    const next = this.readThreads(scope).map((thread) => {
      if (thread.id !== conversationId) return thread;
      updated = {
        ...thread,
        title: thread.messages.some((item) => item.role === "user") || message.role !== "user"
          ? thread.title
          : message.content.trim().slice(0, 80) || thread.title,
        messages: [...thread.messages, cloneMessage(message)],
        updatedAt: message.createdAt,
      };
      return updated;
    });
    this.writeThreads(scope, next);
    return Promise.resolve(updated === null ? null : cloneThread(updated));
  }

  deleteConversation(scope: AiWorkspaceScope, conversationId: string): Promise<void> {
    this.writeThreads(scope, this.readThreads(scope).filter((thread) => thread.id !== conversationId));
    return Promise.resolve();
  }

  getGovernanceDecision(
    scope: AiWorkspaceScope,
    _intent: AiActionIntent,
    _options?: { approval?: AiActionApproval; evidenceRefs?: string[]; capabilityGranted?: boolean },
  ): Promise<AiGovernanceDecisionView> {
    return this.blockedMutation("evaluateAiActionGovernance", scope);
  }

  executeAction(request: AiActionExecutionRequest): Promise<AiActionExecutionResult> {
    return this.blockedMutation("executeAiAction", request.scope);
  }

  clear(): void {
    this.conversations.clear();
  }

  private readThreads(scope: AiWorkspaceScope): AiChatThread[] {
    return (this.conversations.get(scopeKey(scope)) ?? []).map(cloneThread);
  }

  private writeThreads(scope: AiWorkspaceScope, threads: readonly AiChatThread[]): void {
    this.conversations.set(scopeKey(scope), threads.map(cloneThread));
  }

  private blockedMutation<TResult>(operation: string, scope: AiWorkspaceScope): Promise<TResult> {
    return Promise.reject(new ApiClientError({
      code: "CONTRACT_OPERATION_BLOCKED",
      message: `AI mutation operation ${operation} is not implemented. Advisory output cannot mutate CRM records.`,
      status: 501,
      retryable: false,
      details: { decisionId: AI_MUTATION_DECISION_ID, operation, workspaceId: scope.workspaceId },
    }));
  }
}

function toAdvisoryContextReferences(request: AiAskRequest): AiAdvisoryContextReferences {
  const entity = request.focusedEntity;
  const entityId = entity?.entityId?.trim();
  if (!entity || !entityId || !["lead", "deal", "task"].includes(entity.entityType)) {
    throw new ApiClientError({
      code: "AI_CONTEXT_UNAVAILABLE",
      message: "Connected AI advisories require a focused Lead, Deal, or Task record.",
      status: 422,
      retryable: false,
    });
  }
  if (entity.entityType === "lead") return { leadId: entityId };
  if (entity.entityType === "deal") return { dealId: entityId };
  return { taskId: entityId };
}

function formatAdvisory(
  response: Awaited<ReturnType<AiAdvisoryApiClient["requestAdvisory"]>>,
  locale: "vi" | "en",
): string {
  const blocks = [response.summary.trim()];
  if (response.suggestedNextAction?.trim()) {
    blocks.push(`${locale === "vi" ? "Hành động đề xuất" : "Suggested next action"}: ${response.suggestedNextAction.trim()}`);
  }
  if (response.attentionPoints.length > 0) {
    blocks.push(`${locale === "vi" ? "Điểm cần chú ý" : "Attention points"}:\n${response.attentionPoints.map((point) => `• ${point}`).join("\n")}`);
  }
  blocks.push(`${locale === "vi" ? "Tư vấn chỉ đọc" : "Read-only advisory"} · ${response.provider.name} / ${response.provider.model}`);
  return blocks.join("\n\n");
}

function scopeKey(scope: AiWorkspaceScope): string {
  return `${scope.workspaceId}::${scope.actorId}`;
}

function cloneMessage(message: AiChatMessage): AiChatMessage {
  return {
    ...message,
    ...(message.suggestedActions === undefined ? {} : { suggestedActions: message.suggestedActions.map((action) => ({ ...action })) }),
  };
}

function cloneThread(thread: AiChatThread): AiChatThread {
  return { ...thread, messages: thread.messages.map(cloneMessage) };
}

function createPresentationId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}
