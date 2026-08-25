import { BrowserStorageAdapter } from "@/platform/persistence";
import { createWorkspaceScopedRepository, WorkspaceScopedStorageAdapter } from "@/platform/workspace-scope";
import {
  assertConfigurationOperationAvailable,
  INTEGRATION_CONNECTION_DISCONNECT_OPERATION,
  INTEGRATION_CONNECTION_SAVE_OPERATION,
  INTEGRATION_CONNECTION_VERIFY_OPERATION,
} from "@/platform/connected-configuration/connectedConfigurationAvailability";
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
/**
 * Integration connection writes are browser-persisted. Every backend write operation is
 * BLOCKED while `listIntegrationConnections` is READY, so connected mode must not pair a
 * backend read with a local write. Reads stay available in both modes.
 */
export const saveIntegrationConnection: IntegrationConfigurationRepository["saveConnection"] = (value) => {
  assertConfigurationOperationAvailable(INTEGRATION_CONNECTION_SAVE_OPERATION);
  return repository.saveConnection(value);
};
export const verifyIntegrationConnection = (connectionId: string) => {
  assertConfigurationOperationAvailable(INTEGRATION_CONNECTION_VERIFY_OPERATION);
  return repository.verifyConnection(connectionId);
};
export const disconnectIntegrationConnection = (connectionId: string) => {
  assertConfigurationOperationAvailable(INTEGRATION_CONNECTION_DISCONNECT_OPERATION);
  return repository.disconnect(connectionId);
};
export const subscribeToIntegrationConfiguration: IntegrationConfigurationRepository["subscribe"] = (listener) => repository.subscribe(listener);
