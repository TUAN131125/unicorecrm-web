import { AiApiClient, type AiConfigurationView } from "@/platform/api/generated/aiApi";
import type { HttpClient, HttpRequest } from "@/platform/api/client";
import type { AiConfiguration, AiConfigurationCommandOptions, AiConfigurationDraft, AiConfigurationGateway, AiProviderEntry, AiUsageSummary } from "../application/AiConfigurationGateway";

/** Two admitted targets at the server's 60-second cap, plus persistence/transport overhead. */
export function withAiConfigurationTestTimeout(client: HttpClient): HttpClient {
  return {
    request<TResponse, TBody = unknown>(input: HttpRequest<TBody>): Promise<TResponse> {
      return client.request<TResponse, TBody>(input.operationId === "testAiConfiguration"
        ? { ...input, timeoutMs: 130_000 }
        : input);
    },
  };
}

export class AiConfigurationHttpAdapter implements AiConfigurationGateway {
  constructor(private readonly api: AiApiClient) {}
  async getCatalog(signal?: AbortSignal): Promise<AiProviderEntry[]> { return (await this.api.getAiProviderCatalog({}, signal)).providers as AiProviderEntry[]; }
  async getConfiguration(signal?: AbortSignal): Promise<AiConfiguration> { return map(await this.api.getAiConfiguration({}, signal)); }
  async getUsage(signal?: AbortSignal): Promise<AiUsageSummary> { return await this.api.getAiUsageSummary({}, signal) as AiUsageSummary; }
  async saveDraft(draft: AiConfigurationDraft, options: AiConfigurationCommandOptions): Promise<AiConfiguration> {
    return map((await this.api.saveAiConfiguration(draft, requestOptions(options))).configuration);
  }
  async setCredential(credential: string, fallback: boolean, options: AiConfigurationCommandOptions): Promise<AiConfiguration> {
    return map((await this.api.setAiCredential({ credential, fallback }, requestOptions(options))).configuration);
  }
  async test(options: AiConfigurationCommandOptions): Promise<AiConfiguration> { return map((await this.api.testAiConfiguration({}, requestOptions(options))).configuration); }
  async activate(options: AiConfigurationCommandOptions): Promise<AiConfiguration> { return map((await this.api.activateAiConfiguration({}, requestOptions(options))).configuration); }
  async disable(options: AiConfigurationCommandOptions): Promise<AiConfiguration> { return map((await this.api.disableAiConfiguration({}, requestOptions(options))).configuration); }
}
const requestOptions = (options: AiConfigurationCommandOptions) => ({ expectedVersion: options.expectedVersion, idempotencyKey: options.idempotencyKey, retry: "never" as const, ...(options.signal ? { signal: options.signal } : {}) });
const map = (value: AiConfigurationView): AiConfiguration => ({
  ...value,
  fallbackProvider: value.fallbackProvider ?? null,
  fallbackModel: typeof value.fallbackModel === "string" ? value.fallbackModel : null,
  fallbackCredentialSource: value.fallbackCredentialSource ?? null,
  activatedAt: typeof value.activatedAt === "string" ? value.activatedAt : null,
  pendingDraft: value.pendingDraft ? {
    ...value.pendingDraft,
    fallbackProvider: value.pendingDraft.fallbackProvider ?? null,
    fallbackModel: typeof value.pendingDraft.fallbackModel === "string" ? value.pendingDraft.fallbackModel : null,
    fallbackCredentialSource: value.pendingDraft.fallbackCredentialSource ?? null,
  } : null,
});
