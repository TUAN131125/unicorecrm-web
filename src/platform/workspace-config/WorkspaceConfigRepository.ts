import type { CrmWorkspaceConfig } from "./workspaceConfig.types";

export type WorkspaceConfigListener = (config: CrmWorkspaceConfig) => void;

export interface WorkspaceConfigRepository {
  getSnapshot(): CrmWorkspaceConfig;
  replace(config: CrmWorkspaceConfig): void;
  update(updater: (current: CrmWorkspaceConfig) => CrmWorkspaceConfig): void;
  reset(): void;
  subscribe(listener: WorkspaceConfigListener): () => void;
}
