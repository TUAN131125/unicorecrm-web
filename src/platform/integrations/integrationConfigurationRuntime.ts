import { BrowserStorageAdapter } from "@/platform/persistence";
import { createWorkspaceScopedRepository, WorkspaceScopedStorageAdapter } from "@/platform/workspace-scope";
import { BrowserIntegrationConfigurationRepository } from "./BrowserIntegrationConfigurationRepository";
import type { IntegrationConfigurationRepository } from "./IntegrationConfigurationRepository";

const storage = new BrowserStorageAdapter();
const repository = createWorkspaceScopedRepository<IntegrationConfigurationRepository>({
  resourceKey: "integration_configuration",
  authorizeReads: false,
  createRepository: (workspaceId) => new BrowserIntegrationConfigurationRepository(
    new WorkspaceScopedStorageAdapter(storage, workspaceId, "integrations"),
  ),
});

export const getIntegrationConfiguration = () => repository.getSnapshot();
export const saveIntegrationConnection: IntegrationConfigurationRepository["saveConnection"] = (value) => repository.saveConnection(value);
export const verifyIntegrationConnection = (connectionId: string) => repository.verifyConnection(connectionId);
export const disconnectIntegrationConnection = (connectionId: string) => repository.disconnect(connectionId);
export const subscribeToIntegrationConfiguration: IntegrationConfigurationRepository["subscribe"] = (listener) => repository.subscribe(listener);
