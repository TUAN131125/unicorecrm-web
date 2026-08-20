import type { DeveloperConfiguration, WebhookDefinition } from "./developerConfiguration.types";

export interface DeveloperConfigurationRepository {
  getSnapshot(): DeveloperConfiguration;
  saveWebhooks(value: WebhookDefinition[]): DeveloperConfiguration;
  subscribe(listener: (value: DeveloperConfiguration) => void): () => void;
}
