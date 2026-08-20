import { BrowserEventBus } from "@/platform/events";
import { BrowserStorageAdapter } from "@/platform/persistence";
import { PreferenceStore } from "@/platform/preferences";
import { createWorkspaceScopedRepository } from "@/platform/workspace-scope/createWorkspaceScopedRepository";
import { InMemoryLeadRepository } from "../infrastructure/InMemoryLeadRepository";
import { BrowserLeadExporter } from "../infrastructure/BrowserLeadExporter";
import { LEAD_DEMO_SEED } from "../infrastructure/dev-memory/leadDemoSeed";

const events = new BrowserEventBus();
const storage = new BrowserStorageAdapter();

export const leadRepository = createWorkspaceScopedRepository({
  resourceKey: "leads",
  createRepository: () => new InMemoryLeadRepository(structuredClone(LEAD_DEMO_SEED), events),
});
export const leadExporter = new BrowserLeadExporter();
export const leadPreferences = new PreferenceStore(storage, "");
