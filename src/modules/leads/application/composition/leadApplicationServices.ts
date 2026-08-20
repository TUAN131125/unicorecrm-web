import type { PreferencePort } from "@/platform/preferences";
import { createApplicationServiceBinding } from "@/shared/application";
import type { LeadExporter } from "../ports/LeadExporter";
import type { LeadRepository } from "../ports/LeadRepository";
import type { LeadWebhookIngressPort } from "../ports/LeadWebhookIngressPort";
import type { LeadApiRuntime } from "../ports/LeadApiRuntime";

export interface LeadApplicationServices {
  repository: LeadRepository;
  exporter: LeadExporter;
  preferences: PreferencePort;
  webhookIngress: LeadWebhookIngressPort;
  api: LeadApiRuntime;
}

const binding = createApplicationServiceBinding<LeadApplicationServices>("Leads");
export const configureLeadApplication = binding.configure;
export const getLeadApplicationServices = binding.get;
export const resetLeadApplication = binding.reset;

import { createApplicationServiceProxy } from "@/shared/application";
export const leadRepository = createApplicationServiceProxy(() => binding.get().repository);
export const leadExporter = createApplicationServiceProxy(() => binding.get().exporter);
export const leadPreferences = createApplicationServiceProxy(() => binding.get().preferences);
export function getLeadApiRuntime(): LeadApiRuntime { return binding.get().api; }
export function isLeadConnectedApiRuntime(): boolean { return binding.get().api.mode === "connected"; }
export const ingestLeadWebhook: LeadWebhookIngressPort["ingest"] = (command) => binding.get().webhookIngress.ingest(command);
export type { IngestLeadWebhookCommand, LeadWebhookIngressResult, LeadWebhookPayload, WebhookAuthenticationEvidence } from "../ports/LeadWebhookIngressPort";
