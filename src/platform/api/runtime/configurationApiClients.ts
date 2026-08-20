import type { HttpClient } from "../client";
import { CrmConfigurationApiClient, FinancialConfigurationApiClient, IntegrationConfigurationApiClient, ProductConfigurationApiClient, StudioQuickSetupApiClient, WorkspaceConfigurationApiClient } from "../generated";

export interface ConfigurationApiClients {
  workspace: WorkspaceConfigurationApiClient;
  quickSetup: StudioQuickSetupApiClient;
  crm: CrmConfigurationApiClient;
  products: ProductConfigurationApiClient;
  financial: FinancialConfigurationApiClient;
  integrations: IntegrationConfigurationApiClient;
}

export function createConfigurationApiClients(http: HttpClient): ConfigurationApiClients {
  return {
    workspace: new WorkspaceConfigurationApiClient(http),
    quickSetup: new StudioQuickSetupApiClient(http),
    crm: new CrmConfigurationApiClient(http),
    products: new ProductConfigurationApiClient(http),
    financial: new FinancialConfigurationApiClient(http),
    integrations: new IntegrationConfigurationApiClient(http),
  };
}
