import type { IntegrationConfiguration, IntegrationConnection } from "./integrationConfiguration.types";

export interface IntegrationConfigurationRepository {
  getSnapshot(): IntegrationConfiguration;
  saveConnection(value: IntegrationConnection): IntegrationConfiguration;
  verifyConnection(connectionId: string): IntegrationConfiguration;
  disconnect(connectionId: string): IntegrationConfiguration;
  subscribe(listener: (value: IntegrationConfiguration) => void): () => void;
}
