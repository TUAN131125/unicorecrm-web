import type { WorkspaceOperationalConfiguration } from "./workspaceOperationalConfiguration.types";

export type WorkspaceOperationalConfigurationListener = (value: WorkspaceOperationalConfiguration) => void;

export interface WorkspaceOperationalConfigurationRepository {
  getSnapshot(): WorkspaceOperationalConfiguration;
  update(updater: (current: WorkspaceOperationalConfiguration) => WorkspaceOperationalConfiguration): WorkspaceOperationalConfiguration;
  subscribe(listener: WorkspaceOperationalConfigurationListener): () => void;
}
