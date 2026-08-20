import { BrowserEventBus } from "@/platform/events";
import { BrowserStorageAdapter } from "@/platform/persistence";
import { PreferenceStore } from "@/platform/preferences";
import { createWorkspaceScopedRepository } from "@/platform/workspace-scope/createWorkspaceScopedRepository";
import { WorkspaceScopedStorageAdapter } from "@/platform/workspace-scope/WorkspaceScopedStorageAdapter";
import { InMemoryQuoteRepository } from "../infrastructure/InMemoryQuoteRepository";
import { QUOTE_SEED } from "../infrastructure/quote.mock";

const events = new BrowserEventBus();
const storage = new BrowserStorageAdapter();
const hasBrowserStorage = typeof window !== "undefined" && typeof window.localStorage !== "undefined";
export const quoteRepository = createWorkspaceScopedRepository({
  resourceKey: "quotes",
  createRepository: (workspaceId) => new InMemoryQuoteRepository(
    structuredClone(QUOTE_SEED),
    events,
    hasBrowserStorage ? new WorkspaceScopedStorageAdapter(storage, workspaceId, "quotes") : undefined,
  ),
});
export const quotePreferences = new PreferenceStore(storage, "");
