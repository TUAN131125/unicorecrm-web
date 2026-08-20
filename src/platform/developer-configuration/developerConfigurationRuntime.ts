import { BrowserStorageAdapter } from "@/platform/persistence";
import { createWorkspaceScopedRepository, WorkspaceScopedStorageAdapter } from "@/platform/workspace-scope";
import { BrowserDeveloperConfigurationRepository } from "./BrowserDeveloperConfigurationRepository";
import type { DeveloperConfigurationRepository } from "./DeveloperConfigurationRepository";

const storage = new BrowserStorageAdapter();
const repository = createWorkspaceScopedRepository<DeveloperConfigurationRepository>({ resourceKey: "developer_configuration", authorizeReads: false, createRepository: (workspaceId) => new BrowserDeveloperConfigurationRepository(new WorkspaceScopedStorageAdapter(storage, workspaceId, "developer-configuration")) });
export const getDeveloperConfiguration = () => repository.getSnapshot();
export const saveDeveloperWebhooks: DeveloperConfigurationRepository["saveWebhooks"] = (value) => repository.saveWebhooks(value);
export const subscribeToDeveloperConfiguration: DeveloperConfigurationRepository["subscribe"] = (listener) => repository.subscribe(listener);
