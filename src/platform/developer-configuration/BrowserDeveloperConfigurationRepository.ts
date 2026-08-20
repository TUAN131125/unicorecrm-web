import type { StoragePort } from "@/platform/persistence";
import type { DeveloperConfigurationRepository } from "./DeveloperConfigurationRepository";
import type { DeveloperConfiguration, WebhookDefinition } from "./developerConfiguration.types";

const KEY = "developer-configuration";

export class BrowserDeveloperConfigurationRepository implements DeveloperConfigurationRepository {
  private readonly listeners = new Set<(value: DeveloperConfiguration) => void>();
  private current: DeveloperConfiguration;
  constructor(private readonly storage: StoragePort) { this.current = storage.get<DeveloperConfiguration>(KEY) ?? { revision: 1, webhooks: [], apiKeys: [] }; }
  getSnapshot() { return structuredClone(this.current); }
  saveWebhooks(value: WebhookDefinition[]) { this.current = { ...this.current, revision: this.current.revision + 1, webhooks: structuredClone(value).map((item) => ({ ...item, status: "DRAFT" })) }; this.storage.set(KEY, this.current); this.listeners.forEach((listener) => listener(this.getSnapshot())); return this.getSnapshot(); }
  subscribe(listener: (value: DeveloperConfiguration) => void) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
}
