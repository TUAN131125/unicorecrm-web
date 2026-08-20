import { BrowserEventBus } from "@/platform/events";
import { BrowserStorageAdapter } from "@/platform/persistence";
import { PreferenceStore } from "@/platform/preferences";
import { createWorkspaceScopedRepository } from "@/platform/workspace-scope/createWorkspaceScopedRepository";
import { WorkspaceScopedStorageAdapter } from "@/platform/workspace-scope/WorkspaceScopedStorageAdapter";
import { InMemoryOrderRepository } from "../infrastructure/InMemoryOrderRepository";
import { INITIAL_ORDERS } from "../infrastructure/order.mock";

const events = new BrowserEventBus();
const storage = new BrowserStorageAdapter();
const hasBrowserStorage = typeof window !== "undefined" && typeof window.localStorage !== "undefined";
export const orderRepository = createWorkspaceScopedRepository({
  resourceKey: "orders",
  createRepository: (workspaceId) => new InMemoryOrderRepository(
    structuredClone(INITIAL_ORDERS),
    events,
    hasBrowserStorage ? new WorkspaceScopedStorageAdapter(storage, workspaceId, "orders") : undefined,
  ),
});
export const orderPreferences = new PreferenceStore(storage, "");
