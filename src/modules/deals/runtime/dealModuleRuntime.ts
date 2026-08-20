import { BrowserEventBus } from "@/platform/events";
import { BrowserStorageAdapter } from "@/platform/persistence";
import { PreferenceStore } from "@/platform/preferences";
import { createWorkspaceScopedRepository } from "@/platform/workspace-scope/createWorkspaceScopedRepository";
import { WorkspaceScopedStorageAdapter } from "@/platform/workspace-scope/WorkspaceScopedStorageAdapter";
import { BrowserDealStageRepository } from "../infrastructure/BrowserDealStageRepository";
import { InMemoryDealRepository } from "../infrastructure/InMemoryDealRepository";
import { MOCK_DEALS } from "../infrastructure/deal.mock";

const events = new BrowserEventBus();
const storage = new BrowserStorageAdapter();

export const dealRepository = createWorkspaceScopedRepository({
  resourceKey: "deals",
  createRepository: () => new InMemoryDealRepository(structuredClone(MOCK_DEALS), events),
});
export const dealStageRepository = createWorkspaceScopedRepository({
  resourceKey: "deals",
  authorizeReads: false,
  createRepository: (workspaceId) => new BrowserDealStageRepository(
    new PreferenceStore(new WorkspaceScopedStorageAdapter(storage, workspaceId, "deal-stages"), ""),
    events,
  ),
});
