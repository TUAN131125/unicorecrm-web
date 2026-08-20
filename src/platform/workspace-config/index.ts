export type * from "./workspaceConfig.types";
export { getQuoteDocumentLabel, getTerminologyLabel } from "./workspaceTerminology";
export { CRM_WORKSPACE_CONFIG_PRESETS, DEFAULT_CRM_WORKSPACE_CONFIG } from "./workspaceConfigDefaults";
export type { WorkspaceConfigRepository, WorkspaceConfigListener } from "./WorkspaceConfigRepository";
export { BrowserWorkspaceConfigRepository } from "./BrowserWorkspaceConfigRepository";
export {
  getWorkspaceConfigSnapshot,
  replaceWorkspaceConfig,
  resetWorkspaceConfig,
  subscribeToWorkspaceConfig,
  updateWorkspaceConfig,
  replaceConnectedWorkspaceConfigProjection,
  clearConnectedWorkspaceConfigProjection,
  isConnectedWorkspaceConfigProjection,
} from "./workspaceConfigRuntime";
export { useWorkspaceConfigSnapshot } from "./useWorkspaceConfigSnapshot";
export type * from "./workspaceOperationalConfiguration.types";
export type { WorkspaceOperationalConfigurationRepository } from "./WorkspaceOperationalConfigurationRepository";
export { BrowserWorkspaceOperationalConfigurationRepository, createDefaultWorkspaceOperationalConfiguration } from "./BrowserWorkspaceOperationalConfigurationRepository";
export {
  getWorkspaceOperationalConfiguration,
  subscribeToWorkspaceOperationalConfiguration,
  updateWorkspaceBusinessAddresses,
  updateWorkspaceBusinessInformation,
  updateWorkspaceCurrencyConfiguration,
  updateWorkspaceExchangeRates,
  updateWorkspaceLocaleRegion,
  updateWorkspaceOperationalConfiguration,
  replaceConnectedWorkspaceOperationalConfigurationProjection,
  clearConnectedWorkspaceOperationalConfigurationProjection,
  isConnectedWorkspaceOperationalConfigurationProjection,
} from "./workspaceOperationalConfigurationRuntime";
export { useWorkspaceOperationalConfiguration } from "./useWorkspaceOperationalConfiguration";

export * from "./businessPolicy";
