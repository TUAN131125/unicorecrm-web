export type AiProviderId = "GEMINI" | "OPENAI";
export type AiCredentialSource = "WORKSPACE" | "DEPLOYMENT";
export interface AiProviderModel { id: string; displayName: string; structuredOutput: boolean }
export interface AiProviderEntry { id: AiProviderId; displayName: string; deploymentCredentialAvailable: boolean; models: AiProviderModel[] }
export interface AiConfiguration {
  status: "UNCONFIGURED" | "DRAFT" | "ACTIVE" | "DISABLED";
  primaryProvider: AiProviderId; primaryModel: string; primaryCredentialSource: AiCredentialSource; primaryCredentialConfigured: boolean;
  fallbackEnabled: boolean; fallbackProvider?: AiProviderId | null; fallbackModel?: string | null; fallbackCredentialSource?: AiCredentialSource | null;
  fallbackCredentialConfigured: boolean; retryRateLimited: boolean; isValidated: boolean; version: number;
  createdAt: string; updatedAt: string; activatedAt?: string | null;
  pendingDraft?: AiPendingConfiguration | null;
}
export interface AiPendingConfiguration extends AiConfigurationDraft {
  status: "DRAFT"; primaryCredentialConfigured: boolean; fallbackCredentialConfigured: boolean; isValidated: boolean;
}
export interface AiConfigurationDraft {
  primaryProvider: AiProviderId; primaryModel: string; primaryCredentialSource: AiCredentialSource; fallbackEnabled: boolean;
  fallbackProvider?: AiProviderId | null; fallbackModel?: string | null; fallbackCredentialSource?: AiCredentialSource | null; retryRateLimited: boolean;
}
export interface AiUsageSummary { executions: number; successfulExecutions: number; failedExecutions: number; providerAttempts: number; inputTokens: number; outputTokens: number; windowStartedAt: string; lastExecutionAt?: string | null; lastStatus?: string | null }
export interface AiConfigurationCommandOptions { expectedVersion: number; idempotencyKey: string; signal?: AbortSignal }
export interface AiConfigurationGateway {
  getCatalog(signal?: AbortSignal): Promise<AiProviderEntry[]>;
  getConfiguration(signal?: AbortSignal): Promise<AiConfiguration>;
  getUsage(signal?: AbortSignal): Promise<AiUsageSummary>;
  saveDraft(draft: AiConfigurationDraft, options: AiConfigurationCommandOptions): Promise<AiConfiguration>;
  setCredential(credential: string, fallback: boolean, options: AiConfigurationCommandOptions): Promise<AiConfiguration>;
  test(options: AiConfigurationCommandOptions): Promise<AiConfiguration>;
  activate(options: AiConfigurationCommandOptions): Promise<AiConfiguration>;
  disable(options: AiConfigurationCommandOptions): Promise<AiConfiguration>;
}
