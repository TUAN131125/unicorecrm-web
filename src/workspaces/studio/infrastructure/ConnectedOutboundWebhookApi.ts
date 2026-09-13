import { getApplicationConfigurationApiClients } from "@/app/composition";
import type { IntegrationEventCatalogItem, OutboundWebhookDelivery, OutboundWebhookSubscription } from "@/platform/api/generated/integrationConfigurationApi";

export type { IntegrationEventCatalogItem, OutboundWebhookDelivery, OutboundWebhookSubscription };
export const getConnectedOutboundWebhookApi = () => getApplicationConfigurationApiClients().integrations;
