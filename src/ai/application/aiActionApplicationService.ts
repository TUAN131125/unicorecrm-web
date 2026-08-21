/**
 * AI action application service.
 *
 * It converts a typed AI action intent into a governed execution. CRM-effecting
 * intents are dispatched to the owning module's canonical workflow command; the
 * service never writes to a CRM repository and never duplicates business rules.
 */
import { aiActionIntentEffect, type AiActionIntent } from "./aiActionIntent";
import {
  evaluateAiAction,
  normalizeAiGovernancePolicy,
  recordAiGovernanceDecision,
  type AiActionKind,
  type AiDataClass,
  type AiGovernancePolicy,
} from "../governance";
import type {
  AiActionApproval,
  AiActionExecutionRequest,
  AiActionExecutionResult,
  AiGovernanceDecisionView,
  AiWorkspaceScope,
} from "./ports/aiRuntime.types";

export function aiActionKindForIntent(intent: AiActionIntent): AiActionKind {
  switch (intent.type) {
    case "CREATE_TASK": return "INTERNAL_UPDATE";
    case "DRAFT_MESSAGE": return "DRAFT";
    case "NAVIGATE":
    case "COPY": return "READ";
    case "NONE":
    default: return "RECOMMEND";
  }
}

export function aiDataClassesForIntent(intent: AiActionIntent): AiDataClass[] {
  switch (intent.type) {
    case "CREATE_TASK": return ["INTERNAL", "CUSTOMER_PII"];
    case "DRAFT_MESSAGE": return ["INTERNAL", "CUSTOMER_PII"];
    case "COPY": return ["INTERNAL"];
    case "NAVIGATE":
    case "NONE":
    default: return ["INTERNAL"];
  }
}

export function aiEvidenceForIntent(intent: AiActionIntent, extra: readonly string[] = []): string[] {
  const base = intent.type === "CREATE_TASK" ? [...intent.evidenceRefs] : [];
  const seed = intent.type === "CREATE_TASK"
    ? [`ai-suggestion:${intent.suggestionId}`]
    : [`ai-intent:${intent.type}`];
  return [...new Set([...base, ...seed, ...extra])].filter((item) => item.length > 0);
}

export interface DemoAiDecisionInput {
  scope: AiWorkspaceScope;
  intent: AiActionIntent;
  policy: AiGovernancePolicy;
  approval?: AiActionApproval;
  evidenceRefs?: string[];
  capabilityGranted?: boolean;
  requestId: string;
  occurredAt?: string;
  persist?: boolean;
}

/**
 * Browser-local governance evaluation. It is demo/support logic and a UX hint
 * only; the resulting decision is always marked with `authority: "demo"` so no
 * caller can mistake it for production authorization.
 */
export function evaluateDemoAiActionDecision(input: DemoAiDecisionInput): AiGovernanceDecisionView {
  const policy = normalizeAiGovernancePolicy(input.policy);
  const evidenceRefs = aiEvidenceForIntent(input.intent, input.evidenceRefs ?? []);
  const request = {
    requestId: input.requestId,
    actorId: input.scope.actorId,
    action: aiActionKindForIntent(input.intent),
    dataClasses: aiDataClassesForIntent(input.intent),
    capabilityGranted: input.capabilityGranted ?? true,
    evidenceRefs,
    approved: input.approval?.approved ?? false,
    ...(input.occurredAt ? { occurredAt: input.occurredAt } : {}),
  };
  const decision = input.persist === false
    ? evaluateAiAction(policy, request)
    : recordAiGovernanceDecision(input.scope.workspaceId, policy, request).decision;
  return { ...decision, reasons: [...decision.reasons], authority: "demo" };
}

/**
 * Executes an already-governed intent. `decision.allowed` must be true; callers
 * never bypass this by constructing their own approval flag, because the
 * decision is produced by the runtime, not by the component.
 */
export async function executeGovernedAiActionIntent(
  request: AiActionExecutionRequest,
  decision: AiGovernanceDecisionView,
): Promise<AiActionExecutionResult> {
  const evidenceRefs = aiEvidenceForIntent(request.intent, request.evidenceRefs ?? []);
  const effect = aiActionIntentEffect(request.intent);

  if (!decision.allowed) {
    return {
      status: decision.requiresApproval && !request.approval?.approved ? "APPROVAL_REQUIRED" : "BLOCKED",
      effect,
      decision,
      evidenceRefs,
    };
  }

  if (request.intent.type !== "CREATE_TASK") {
    // NAVIGATE / COPY / DRAFT_MESSAGE stay in the browser; the presentation layer
    // performs them. NONE is inert by definition.
    return { status: "EXECUTED", effect, decision, evidenceRefs };
  }

  const intent = request.intent;
  const assigneeId = intent.assigneeId ?? request.scope.actorId;
  // The canonical Task activation boundary is loaded on demand so the AI
  // capability never pulls the Task module into the application entry bundle.
  const { activateAiSuggestedTask } = await import("@/workflows/work-activation");
  const outcome = await activateAiSuggestedTask({
    suggestionId: intent.suggestionId,
    title: intent.title,
    ...(intent.description === undefined ? {} : { description: intent.description }),
    assigneeId,
    ...(intent.dueAt === undefined ? {} : { dueAt: intent.dueAt }),
    ...(intent.priority === undefined ? {} : { priority: intent.priority }),
    ...(intent.recordRef === undefined ? {} : { recordRef: intent.recordRef }),
    evidence: evidenceRefs.join(" | "),
    actor: { id: request.scope.actorId, name: request.scope.actorName ?? request.scope.actorId },
  });

  return {
    status: "EXECUTED",
    effect: "CRM_COMMAND",
    decision,
    evidenceRefs,
    correlationId: outcome.correlationId,
    createdTask: { id: outcome.data.id, title: outcome.data.title },
  };
}
