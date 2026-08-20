import type { PreferencePort } from "@/platform/preferences";
import { createApplicationServiceBinding } from "@/shared/application";
import type { QuoteApiRuntime } from "../ports/QuoteApiRuntime";
import type { QuoteRepository } from "../ports/QuoteRepository";

export interface QuoteApplicationServices {
  api: QuoteApiRuntime;
  repository: QuoteRepository;
  preferences: PreferencePort;
}

const binding = createApplicationServiceBinding<QuoteApplicationServices>("Quotes");
export const configureQuoteApplication = binding.configure;
export const getQuoteApplicationServices = binding.get;
export const resetQuoteApplication = binding.reset;

import { createApplicationServiceProxy } from "@/shared/application";
export const quoteRepository = createApplicationServiceProxy(() => binding.get().repository);
export const quotePreferences = createApplicationServiceProxy(() => binding.get().preferences);
export function getQuoteApiRuntime(): QuoteApiRuntime { return binding.get().api; }
export function isQuoteConnectedApiRuntime(): boolean { return binding.get().api.mode === "connected"; }
