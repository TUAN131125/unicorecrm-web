import { createApplicationServiceBinding } from "@/shared/application/applicationServiceBinding";
import type { AiConfiguration, AiConfigurationDraft, AiConfigurationGateway, AiProviderEntry } from "../AiConfigurationGateway";

const binding = createApplicationServiceBinding<AiConfigurationGateway>("AI Configuration");
export const configureAiConfigurationGateway = binding.configure;
export const resetAiConfigurationGateway = binding.reset;
function required(): AiConfigurationGateway { if (!binding.isConfigured()) throw new Error("AI_CONFIGURATION_RUNTIME_UNAVAILABLE"); return binding.get(); }
const key = (purpose: string) => `ai-${purpose}-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
export const loadAiProviderCatalog = (signal?: AbortSignal): Promise<AiProviderEntry[]> => required().getCatalog(signal);
export const loadAiConfiguration = (signal?: AbortSignal): Promise<AiConfiguration> => required().getConfiguration(signal);
export const loadAiUsageSummary = (signal?: AbortSignal) => required().getUsage(signal);
export const saveAiConfiguration = (draft: AiConfigurationDraft, version: number, signal?: AbortSignal) => required().saveDraft(draft, { expectedVersion: version, idempotencyKey: key("draft"), ...(signal ? { signal } : {}) });
export const setAiCredential = (credential: string, fallback: boolean, version: number, signal?: AbortSignal) => required().setCredential(credential, fallback, { expectedVersion: version, idempotencyKey: key("credential"), ...(signal ? { signal } : {}) });
export const testAiConfiguration = (version: number, signal?: AbortSignal) => required().test({ expectedVersion: version, idempotencyKey: key("test"), ...(signal ? { signal } : {}) });
export const activateAiConfiguration = (version: number, signal?: AbortSignal) => required().activate({ expectedVersion: version, idempotencyKey: key("activate"), ...(signal ? { signal } : {}) });
export const disableAiConfiguration = (version: number, signal?: AbortSignal) => required().disable({ expectedVersion: version, idempotencyKey: key("disable"), ...(signal ? { signal } : {}) });
