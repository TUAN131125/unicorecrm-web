/**
 * Typed AI action intents.
 *
 * The AI Assistant may only propose actions that belong to this closed union.
 * Arbitrary command names and unrestricted payloads are rejected at the
 * boundary, so an AI answer can never become an executable instruction that the
 * frontend did not model explicitly.
 */
/**
 * Structural view of the stored `AiSuggestedAction` shape. Declaring it here
 * keeps the intent union free of a dependency on the message types that use it.
 */
export interface StoredAiSuggestedAction {
  actionType: "navigate" | "copy" | "draft" | "view" | "none";
  route?: string;
  payload?: string;
  intent?: unknown;
}

export type StoredAiActionType = StoredAiSuggestedAction["actionType"];

export interface AiRecordRef {
  moduleKey: string;
  recordId: string;
  label?: string;
}

export type AiDraftChannel = "EMAIL" | "MESSAGE" | "NOTE";
export type AiTaskIntentPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export interface AiNavigateIntent {
  type: "NAVIGATE";
  route: string;
}

export interface AiCopyIntent {
  type: "COPY";
  payload: string;
}

export interface AiDraftMessageIntent {
  type: "DRAFT_MESSAGE";
  channel: AiDraftChannel;
  body: string;
  subject?: string;
  recordRef?: AiRecordRef;
}

export interface AiCreateTaskIntent {
  type: "CREATE_TASK";
  suggestionId: string;
  title: string;
  description?: string;
  dueAt?: string;
  assigneeId?: string;
  priority?: AiTaskIntentPriority;
  recordRef?: AiRecordRef;
  evidenceRefs: string[];
}

export interface AiNoneIntent {
  type: "NONE";
}

export type AiActionIntent =
  | AiNavigateIntent
  | AiCopyIntent
  | AiDraftMessageIntent
  | AiCreateTaskIntent
  | AiNoneIntent;

export type AiActionIntentType = AiActionIntent["type"];

export const AI_ACTION_INTENT_TYPES: readonly AiActionIntentType[] = [
  "NAVIGATE",
  "COPY",
  "DRAFT_MESSAGE",
  "CREATE_TASK",
  "NONE",
];

const DRAFT_CHANNELS: readonly AiDraftChannel[] = ["EMAIL", "MESSAGE", "NOTE"];
const TASK_PRIORITIES: readonly AiTaskIntentPriority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];

export function isAiActionIntentType(value: unknown): value is AiActionIntentType {
  return typeof value === "string" && (AI_ACTION_INTENT_TYPES as readonly string[]).includes(value);
}

/** In-app routes only. External destinations are never executable AI actions. */
export function isSafeAiRoute(value: unknown): value is string {
  return typeof value === "string"
    && value.startsWith("/")
    && !value.startsWith("//")
    && !value.includes("://")
    && !/^\s*javascript:/iu.test(value);
}

/**
 * Fail-closed intent parser. Unknown discriminators, missing required fields and
 * unsafe routes produce `undefined` rather than a partially trusted intent.
 */
export function parseAiActionIntent(value: unknown): AiActionIntent | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Record<string, unknown>;
  if (!isAiActionIntentType(candidate.type)) return undefined;

  switch (candidate.type) {
    case "NAVIGATE":
      return isSafeAiRoute(candidate.route) ? { type: "NAVIGATE", route: candidate.route } : undefined;
    case "COPY":
      return typeof candidate.payload === "string" && candidate.payload.length > 0
        ? { type: "COPY", payload: candidate.payload }
        : undefined;
    case "DRAFT_MESSAGE": {
      const channel = DRAFT_CHANNELS.find((item) => item === candidate.channel) ?? "MESSAGE";
      if (typeof candidate.body !== "string" || candidate.body.length === 0) return undefined;
      const recordRef = parseRecordRef(candidate.recordRef);
      return {
        type: "DRAFT_MESSAGE",
        channel,
        body: candidate.body,
        ...(typeof candidate.subject === "string" ? { subject: candidate.subject } : {}),
        ...(recordRef ? { recordRef } : {}),
      };
    }
    case "CREATE_TASK": {
      if (typeof candidate.suggestionId !== "string" || candidate.suggestionId.length === 0) return undefined;
      if (typeof candidate.title !== "string" || candidate.title.trim().length === 0) return undefined;
      const evidenceRefs = Array.isArray(candidate.evidenceRefs)
        ? candidate.evidenceRefs.filter((item): item is string => typeof item === "string" && item.length > 0)
        : [];
      const priority = TASK_PRIORITIES.find((item) => item === candidate.priority);
      const recordRef = parseRecordRef(candidate.recordRef);
      return {
        type: "CREATE_TASK",
        suggestionId: candidate.suggestionId,
        title: candidate.title.trim(),
        ...(typeof candidate.description === "string" ? { description: candidate.description } : {}),
        ...(typeof candidate.dueAt === "string" ? { dueAt: candidate.dueAt } : {}),
        ...(typeof candidate.assigneeId === "string" ? { assigneeId: candidate.assigneeId } : {}),
        ...(priority ? { priority } : {}),
        ...(recordRef ? { recordRef } : {}),
        evidenceRefs,
      };
    }
    case "NONE":
    default:
      return { type: "NONE" };
  }
}

/**
 * Interoperates with the existing `AiSuggestedAction` shape. Suggestions that
 * already carry a typed intent use it; older suggestions are projected onto the
 * same closed union so the UI has exactly one execution path.
 */
export function toAiActionIntent(action: StoredAiSuggestedAction): AiActionIntent {
  const declared = parseAiActionIntent(action.intent);
  if (declared) return declared;

  switch (action.actionType) {
    case "navigate":
    case "view":
      return isSafeAiRoute(action.route) ? { type: "NAVIGATE", route: action.route } : { type: "NONE" };
    case "copy":
      return action.payload ? { type: "COPY", payload: action.payload } : { type: "NONE" };
    case "draft":
      return action.payload
        ? { type: "DRAFT_MESSAGE", channel: "MESSAGE", body: action.payload }
        : { type: "NONE" };
    case "none":
    default:
      return { type: "NONE" };
  }
}

/** Projection onto the stored shape so older readers keep rendering answers. */
export function toStoredActionType(intent: AiActionIntent): StoredAiActionType {
  switch (intent.type) {
    case "NAVIGATE": return "navigate";
    case "COPY": return "copy";
    case "DRAFT_MESSAGE": return "draft";
    case "CREATE_TASK": return "view";
    case "NONE":
    default: return "none";
  }
}

/**
 * Client-only intents change the browser view or clipboard. CRM-command intents
 * must pass through a canonical module or workflow command boundary.
 */
export function aiActionIntentEffect(intent: AiActionIntent): "CLIENT" | "CRM_COMMAND" | "NONE" {
  if (intent.type === "CREATE_TASK") return "CRM_COMMAND";
  if (intent.type === "NONE") return "NONE";
  return "CLIENT";
}

function parseRecordRef(value: unknown): AiRecordRef | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.moduleKey !== "string" || typeof candidate.recordId !== "string") return undefined;
  return {
    moduleKey: candidate.moduleKey,
    recordId: candidate.recordId,
    ...(typeof candidate.label === "string" ? { label: candidate.label } : {}),
  };
}
