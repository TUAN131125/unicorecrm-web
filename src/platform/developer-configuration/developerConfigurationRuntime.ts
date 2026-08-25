import { BrowserStorageAdapter } from "@/platform/persistence";
import { createWorkspaceScopedRepository, WorkspaceScopedStorageAdapter } from "@/platform/workspace-scope";
import {
  assertConfigurationOperationAvailable,
  DEVELOPER_WEBHOOK_SAVE_OPERATION,
} from "@/platform/connected-configuration/connectedConfigurationAvailability";
import { BrowserDeveloperConfigurationRepository } from "./BrowserDeveloperConfigurationRepository";
import type { DeveloperConfigurationRepository } from "./DeveloperConfigurationRepository";

const storage = new BrowserStorageAdapter();
const repository = createWorkspaceScopedRepository<DeveloperConfigurationRepository>({ resourceKey: "developer_configuration", authorizeReads: false, createRepository: (workspaceId) => new BrowserDeveloperConfigurationRepository(new WorkspaceScopedStorageAdapter(storage, workspaceId, "developer-configuration")) });
export const getDeveloperConfiguration = () => repository.getSnapshot();
/**
 * Webhook configuration is browser-persisted and OpenAPI publishes no webhook operation in
 * either direction, so connected mode has no authority to write it. Reads stay available.
 */
export const saveDeveloperWebhooks: DeveloperConfigurationRepository["saveWebhooks"] = (value) => {
  assertConfigurationOperationAvailable(DEVELOPER_WEBHOOK_SAVE_OPERATION);
  return repository.saveWebhooks(value);
};
export const subscribeToDeveloperConfiguration: DeveloperConfigurationRepository["subscribe"] = (listener) => repository.subscribe(listener);
