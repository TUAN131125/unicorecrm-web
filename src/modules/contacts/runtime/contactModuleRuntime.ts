import { BrowserEventBus } from "@/platform/events";
import { BrowserStorageAdapter } from "@/platform/persistence";
import { PreferenceStore } from "@/platform/preferences";
import { getWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { createWorkspaceScopedRepository } from "@/platform/workspace-scope/createWorkspaceScopedRepository";
import { WorkspaceScopedStorageAdapter } from "@/platform/workspace-scope/WorkspaceScopedStorageAdapter";
import { InMemoryContactRepository } from "../infrastructure/InMemoryContactRepository";
import { CONTACT_SEED } from "../infrastructure/contact.mock";

const events = new BrowserEventBus();
const storage = new BrowserStorageAdapter();

export const contactRepository = createWorkspaceScopedRepository({
  resourceKey: "contacts",
  createRepository: () => new InMemoryContactRepository(structuredClone(CONTACT_SEED), events),
});

export const contactPreferences = {
  get<T>(key: string, fallback: T): T {
    return preferenceStore().get(key, fallback);
  },
  set<T>(key: string, value: T): void {
    preferenceStore().set(key, value);
  },
  remove(key: string): void {
    preferenceStore().remove(key);
  },
};

function preferenceStore(): PreferenceStore {
  return new PreferenceStore(
    new WorkspaceScopedStorageAdapter(storage, getWorkspaceContextSnapshot().workspaceId, "contacts"),
    "",
  );
}