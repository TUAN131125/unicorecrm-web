/**
 * Demo-mode AI conversation persistence.
 *
 * Threads are stored per workspace and per actor
 * (`workspace:{workspaceId}:ai:conversations:{actorId}`), so switching workspace
 * or signing in as another member never exposes a foreign conversation. This is
 * browser convenience state, not an authority: connected mode owns conversations
 * on the server.
 */
import { BrowserStorageAdapter, type StoragePort } from "@/platform/persistence";
import { WorkspaceScopedStorageAdapter } from "@/platform/workspace-scope";
import type { AiChatMessage, AiChatThread } from "../aiTypes";
import type { AiWorkspaceScope } from "../application/ports/aiRuntime.types";

const NAMESPACE = "ai";
const CONVERSATIONS_KEY = "conversations";
const PREFERENCES_KEY = "preferences";

/** Pre-scoping global keys. Migrated once into the active workspace/actor scope. */
export const UNSCOPED_AI_THREADS_KEY = "centrix_ai_chat_threads_v1";
export const UNSCOPED_AI_PREFERENCES_KEY = "centrix_ai_preferences_v1";

export interface AiPreferences {
  enabled: boolean;
  insightSlaThresholdHours: number;
}

export const DEFAULT_AI_PREFERENCES: AiPreferences = {
  enabled: true,
  insightSlaThresholdHours: 24,
};

export function aiConversationStorageKey(scope: AiWorkspaceScope): string {
  return `workspace:${scope.workspaceId}:${NAMESPACE}:${CONVERSATIONS_KEY}:${scope.actorId}`;
}

export class BrowserAiConversationStore {
  private readonly adoptedScopes = new Set<string>();

  constructor(private readonly base: StoragePort = new BrowserStorageAdapter()) {}

  list(scope: AiWorkspaceScope): AiChatThread[] {
    this.adoptUnscopedThreadsOnce(scope);
    const stored = this.scoped(scope).get<AiChatThread[]>(this.actorKey(scope, CONVERSATIONS_KEY));
    if (!Array.isArray(stored)) return [];
    return stored.filter(isPersistableThread).map((thread) => normalizeThread(thread, scope));
  }

  replace(scope: AiWorkspaceScope, threads: AiChatThread[]): AiChatThread[] {
    const safe = threads.map((thread) => toPersistedThread(thread, scope));
    this.scoped(scope).set(this.actorKey(scope, CONVERSATIONS_KEY), safe);
    return safe;
  }

  find(scope: AiWorkspaceScope, conversationId: string): AiChatThread | null {
    return this.list(scope).find((thread) => thread.id === conversationId) ?? null;
  }

  create(scope: AiWorkspaceScope, thread: AiChatThread): AiChatThread {
    const next = toPersistedThread(thread, scope);
    this.replace(scope, [next, ...this.list(scope)]);
    return next;
  }

  append(scope: AiWorkspaceScope, conversationId: string, message: AiChatMessage): AiChatThread | null {
    const threads = this.list(scope);
    const index = threads.findIndex((thread) => thread.id === conversationId);
    const existing = threads[index];
    if (!existing) return null;
    const updated: AiChatThread = {
      ...existing,
      title: deriveThreadTitle(existing, message),
      messages: [...existing.messages, message],
      updatedAt: new Date().toISOString(),
    };
    threads[index] = updated;
    this.replace(scope, threads);
    return toPersistedThread(updated, scope);
  }

  remove(scope: AiWorkspaceScope, conversationId: string): void {
    this.replace(scope, this.list(scope).filter((thread) => thread.id !== conversationId));
  }

  getPreferences(scope: AiWorkspaceScope): AiPreferences {
    const stored = this.scoped(scope).get<Partial<AiPreferences>>(this.actorKey(scope, PREFERENCES_KEY));
    const unscoped = stored ? undefined : this.base.get<Partial<AiPreferences>>(UNSCOPED_AI_PREFERENCES_KEY);
    return { ...DEFAULT_AI_PREFERENCES, ...(stored ?? unscoped ?? {}) };
  }

  savePreferences(scope: AiWorkspaceScope, preferences: AiPreferences): void {
    this.scoped(scope).set(this.actorKey(scope, PREFERENCES_KEY), preferences);
  }

  private scoped(scope: AiWorkspaceScope): StoragePort {
    return new WorkspaceScopedStorageAdapter(this.base, scope.workspaceId, NAMESPACE);
  }

  private actorKey(scope: AiWorkspaceScope, key: string): string {
    return `${key}:${scope.actorId}`;
  }

  /**
   * One-time adoption of the pre-scoping global thread key into the active
   * workspace/actor scope. The unscoped key is removed so it can never be read
   * back by a different workspace.
   */
  private adoptUnscopedThreadsOnce(scope: AiWorkspaceScope): void {
    const fingerprint = `${scope.workspaceId}:${scope.actorId}`;
    if (this.adoptedScopes.has(fingerprint)) return;
    this.adoptedScopes.add(fingerprint);
    const adopted = this.base.get<AiChatThread[]>(UNSCOPED_AI_THREADS_KEY);
    this.base.remove(UNSCOPED_AI_THREADS_KEY);
    if (!Array.isArray(adopted) || adopted.length === 0) return;
    const scopedKey = this.actorKey(scope, CONVERSATIONS_KEY);
    if (this.scoped(scope).get<AiChatThread[]>(scopedKey)) return;
    this.scoped(scope).set(scopedKey, adopted.filter(isPersistableThread).map((thread) => toPersistedThread(thread, scope)));
  }
}

function isPersistableThread(value: unknown): value is AiChatThread {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AiChatThread>;
  return typeof candidate.id === "string" && Array.isArray(candidate.messages);
}

function normalizeThread(thread: AiChatThread, scope: AiWorkspaceScope): AiChatThread {
  return { ...thread, workspaceId: thread.workspaceId ?? scope.workspaceId, actorId: thread.actorId ?? scope.actorId };
}

/** Stores conversation text only; heavy CRM payloads never reach browser storage. */
function toPersistedThread(thread: AiChatThread, scope: AiWorkspaceScope): AiChatThread {
  return {
    id: thread.id,
    title: thread.title,
    workspaceId: scope.workspaceId,
    actorId: scope.actorId,
    messages: thread.messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
      ...(message.relatedEntityType === undefined ? {} : { relatedEntityType: message.relatedEntityType }),
      ...(message.relatedEntityId === undefined ? {} : { relatedEntityId: message.relatedEntityId }),
      ...(message.suggestedActions === undefined ? {} : { suggestedActions: message.suggestedActions }),
    })),
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
  };
}

function deriveThreadTitle(thread: AiChatThread, message: AiChatMessage): string {
  const isPlaceholder = /^(new |cuộc trò chuyện)/iu.test(thread.title ?? "");
  if (!isPlaceholder || thread.messages.length > 2 || message.role !== "user") return thread.title;
  const text = message.content.trim();
  if (!text) return thread.title;
  return text.length > 30 ? `${text.slice(0, 30)}...` : text;
}
