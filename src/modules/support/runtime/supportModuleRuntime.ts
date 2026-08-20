import { BrowserEventBus } from "@/platform/events";
import { BrowserStorageAdapter } from "@/platform/persistence";
import { PreferenceStore } from "@/platform/preferences";
import { createWorkspaceScopedRepository } from "@/platform/workspace-scope/createWorkspaceScopedRepository";
import { WorkspaceScopedStorageAdapter } from "@/platform/workspace-scope/WorkspaceScopedStorageAdapter";
import type { SupportCase } from "../domain/model/supportCase.types";
import { InMemorySupportCaseRepository } from "../infrastructure/InMemorySupportCaseRepository";

const events = new BrowserEventBus();
const storage = new BrowserStorageAdapter();
const LEGACY_DEMO_CASE_IDS = new Set(["cs1"]);

export const supportCaseRepository = createWorkspaceScopedRepository({
  resourceKey: "support",
  createRepository: (workspaceId) => {
    const scopedStorage = new WorkspaceScopedStorageAdapter(storage, workspaceId, "support");
    const stored = scopedStorage.get<SupportCase[]>("cases") ?? [];
    const migrated = stored.filter((item) => !LEGACY_DEMO_CASE_IDS.has(item.id));
    if (migrated.length !== stored.length) scopedStorage.set("cases", migrated);
    return new InMemorySupportCaseRepository(migrated, events, scopedStorage);
  },
});
export const supportPreferences = new PreferenceStore(storage, "unicore.support");
