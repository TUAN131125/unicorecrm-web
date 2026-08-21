/**
 * AI Assistant — a cross-cutting CRM application owner/capability.
 *
 * The AI Assistant owns:
 * - AI conversations
 * - AI insights
 * - AI recommendations
 * - AI action intents
 * - AI frontend state
 * - AI governance presentation and decision consumption
 *
 * The AI Assistant does NOT own Customer, Contact, Organization, Deal, Task,
 * Order, Quote, Support or any other CRM aggregate. Every business mutation it
 * proposes must pass through the target module's canonical command or workflow
 * boundary; AI code never writes to a CRM repository.
 *
 * Layering:
 *   AI UI -> AI application ports -> AiRuntime (demo | connected) -> backend AI API
 *
 * The frontend never depends on an external model provider and never holds
 * provider credentials.
 */
export type {
  AiChatMessage,
  AiChatThread,
  AiInsight,
  AiInsightSeverity,
  AiInsightType,
  AiSuggestedAction,
} from "./aiTypes";

export type {
  AiActionIntent,
  AiActionIntentType,
  AiCreateTaskIntent,
  AiDraftChannel,
  AiDraftMessageIntent,
  AiNavigateIntent,
  AiRecordRef,
  AiTaskIntentPriority,
} from "./application/aiActionIntent";
export {
  AI_ACTION_INTENT_TYPES,
  aiActionIntentEffect,
  isAiActionIntentType,
  isSafeAiRoute,
  parseAiActionIntent,
  toAiActionIntent,
  toStoredActionType,
} from "./application/aiActionIntent";

export type {
  AiActionApproval,
  AiActionExecutionRequest,
  AiActionExecutionResult,
  AiActionExecutionStatus,
  AiActionPort,
  AiApiPort,
  AiAskRequest,
  AiAskResult,
  AiContextScopeKey,
  AiConversationPort,
  AiCreateConversationInput,
  AiFocusedEntityRef,
  AiFocusedEntityType,
  AiGovernanceDecisionView,
  AiRuntime,
  AiRuntimeMode,
  AiSanitizedRequestContext,
  AiWorkspaceScope,
} from "./application/ports/aiRuntime.types";

export {
  buildSanitizedAiRequestContext,
  containsBlockedFieldKey,
  defaultAiContextScope,
  resolveAiFocusedEntityRef,
} from "./application/aiRequestContext";
export {
  aiActionKindForIntent,
  aiDataClassesForIntent,
  aiEvidenceForIntent,
  evaluateDemoAiActionDecision,
  executeGovernedAiActionIntent,
} from "./application/aiActionApplicationService";
export {
  AI_RETRYABLE_STATES,
  isRetryableAiInteractionState,
  resolveAiInteractionState,
  type AiInteractionState,
} from "./application/aiInteractionState";

/**
 * Stable AI capability façade. It delegates to whichever runtime the application
 * composition root selected, mirroring the platform runtime-binding convention.
 * Callers receive AI through this boundary and never instantiate a runtime.
 */
export {
  appendAiConversationMessage,
  askAiAssistant,
  createAiConversation,
  deleteAiConversation,
  executeAiAction,
  getAiActionGovernanceDecision,
  getAiConversation,
  getAiRuntimeMode,
  isConnectedAiRuntime,
  listAiConversations,
} from "./runtime/aiRuntimeBinding";
