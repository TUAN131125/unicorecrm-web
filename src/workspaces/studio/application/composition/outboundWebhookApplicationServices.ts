import { createApplicationServiceBinding } from "@/shared/application/applicationServiceBinding";
import type { OutboundWebhookGateway } from "../OutboundWebhookGateway";
export type { IntegrationEventCatalogItem, OutboundWebhookDelivery, OutboundWebhookSubscription } from "../OutboundWebhookGateway";

const binding = createApplicationServiceBinding<OutboundWebhookGateway>("Outbound Webhooks");
export const configureOutboundWebhookGateway = binding.configure;
export const resetOutboundWebhookGateway = binding.reset;
export function getConnectedOutboundWebhookApi(): OutboundWebhookGateway {
  if (!binding.isConfigured()) throw new Error("Generated configuration API clients are available only in connected mode.");
  return binding.get();
}
