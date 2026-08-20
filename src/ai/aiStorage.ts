import { AiChatThread, AiChatMessage } from "./aiTypes";

const LOCK_KEY_THREADS = "centrix_ai_chat_threads_v1";
const LOCK_KEY_PREFS = "centrix_ai_preferences_v1";

export function getAiChatThreads(): AiChatThread[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }
  try {
    const raw = localStorage.getItem(LOCK_KEY_THREADS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((thread: AiChatThread) => ({
        ...thread,
        title: String(thread.title || "").replace(/Centrix/gi, "UnicoreCRM"),
        messages: (thread.messages || []).map((message) => ({
          ...message,
          content: String(message.content || "").replace(/Centrix AI/gi, "UnicoreCRM AI"),
        })),
      }));
    }
  } catch (e) {
    console.error("Failed to parse AI chat threads from localStorage", e);
  }
  return [];
}

export function saveAiChatThreads(threads: AiChatThread[]): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    // Only store metadata and messages, preventing heavy CRM attachments
    const safeBackup = threads.map(t => ({
      id: t.id,
      title: t.title,
      messages: t.messages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
        relatedEntityType: m.relatedEntityType,
        relatedEntityId: m.relatedEntityId,
        suggestedActions: m.suggestedActions
      })),
      createdAt: t.createdAt,
      updatedAt: t.updatedAt
    }));
    localStorage.setItem(LOCK_KEY_THREADS, JSON.stringify(safeBackup));
  } catch (e) {
    console.error("Failed to write AI chat threads to localStorage", e);
  }
}

export function createAiChatThread(
  title: string = "New conversation",
  welcomeMessage: string = "Hello! I am the UnicoreCRM AI Assistant. How can I help with your CRM workspace today?",
): AiChatThread {
  const threads = getAiChatThreads();
  const newThread: AiChatThread = {
    id: "thread_" + Math.random().toString(36).substring(2, 11),
    title,
    messages: [
      {
        id: "wel_" + Math.random().toString(36).substring(2, 11),
        role: "assistant",
        content: welcomeMessage,
        createdAt: new Date().toISOString()
      }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  threads.unshift(newThread);
  saveAiChatThreads(threads);
  return newThread;
}

export function appendAiChatMessage(threadId: string, message: AiChatMessage): AiChatThread | null {
  const threads = getAiChatThreads();
  const index = threads.findIndex(t => t.id === threadId);
  if (index === -1) return null;

  threads[index].messages.push(message);
  threads[index].updatedAt = new Date().toISOString();
  
  // Set thread title if it has only greeting + user message
  if ((threads[index].title.startsWith("New") || threads[index].title.startsWith("Cuộc trò chuyện")) && threads[index].messages.length <= 3) {
    const userMsg = threads[index].messages.find(m => m.role === "user");
    if (userMsg) {
      threads[index].title = userMsg.content.substring(0, 30) + (userMsg.content.length > 30 ? "..." : "");
    }
  }

  saveAiChatThreads(threads);
  return threads[index];
}

export function clearAiChatThreads(): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    localStorage.removeItem(LOCK_KEY_THREADS);
  } catch (e) {}
}

export interface AiPreferences {
  enabled: boolean;
  insightSlaThresholdHours: number;
}

export function getAiPreferences(): AiPreferences {
  const defaults: AiPreferences = {
    enabled: true,
    insightSlaThresholdHours: 24
  };
  if (typeof window === "undefined" || !window.localStorage) {
    return defaults;
  }
  try {
    const raw = localStorage.getItem(LOCK_KEY_PREFS);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch (e) {
    return defaults;
  }
}

export function saveAiPreferences(prefs: AiPreferences): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    localStorage.setItem(LOCK_KEY_PREFS, JSON.stringify(prefs));
  } catch (e) {}
}
