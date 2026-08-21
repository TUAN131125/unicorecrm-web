/**
 * AI runtime binding.
 *
 * The application composition root selects the concrete runtime exactly once.
 * React components resolve the AI capability through this binding instead of
 * constructing browser or mock services themselves.
 */
import type { HttpClient } from "@/platform/api";
import { registerWorkspaceScopeDisposer } from "@/platform/workspace-scope";
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
import { ConnectedAiRuntime } from "./ConnectedAiRuntime";
import { DemoAiRuntime } from "./DemoAiRuntime";

const demoRuntime = new DemoAiRuntime();
let runtime: AiRuntime = demoRuntime;

registerWorkspaceScopeDisposer(() => runtime.clear());

export function configureConnectedAiRuntime(client: HttpClient): void {
  runtime.clear();
  runtime = new ConnectedAiRuntime(client);
}

export function resetAiRuntime(): void {
  runtime.clear();
  runtime = demoRuntime;
}

export const getAiRuntime = (): AiRuntime => runtime;
export const getAiRuntimeMode = (): AiRuntime["mode"] => runtime.mode;
export const isConnectedAiRuntime = (): boolean => runtime.mode === "connected";

export const askAiAssistant = (request: AiAskRequest): Promise<AiAskResult> => runtime.ask(request);
export const listAiConversations = (scope: AiWorkspaceScope): Promise<AiChatThread[]> => runtime.listConversations(scope);
export const getAiConversation = (scope: AiWorkspaceScope, conversationId: string): Promise<AiChatThread | null> => runtime.getConversation(scope, conversationId);
export const createAiConversation = (scope: AiWorkspaceScope, input: AiCreateConversationInput): Promise<AiChatThread> => runtime.createConversation(scope, input);
export const appendAiConversationMessage = (scope: AiWorkspaceScope, conversationId: string, message: AiChatMessage): Promise<AiChatThread | null> => runtime.appendMessage(scope, conversationId, message);
export const deleteAiConversation = (scope: AiWorkspaceScope, conversationId: string): Promise<void> => runtime.deleteConversation(scope, conversationId);
export const getAiActionGovernanceDecision = (
  scope: AiWorkspaceScope,
  intent: AiActionIntent,
  options?: { approval?: AiActionApproval; evidenceRefs?: string[]; capabilityGranted?: boolean },
): Promise<AiGovernanceDecisionView> => runtime.getGovernanceDecision(scope, intent, options);
export const executeAiAction = (request: AiActionExecutionRequest): Promise<AiActionExecutionResult> => runtime.executeAction(request);
