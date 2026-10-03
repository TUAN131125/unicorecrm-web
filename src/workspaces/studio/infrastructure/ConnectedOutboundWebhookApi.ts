import type { IntegrationConfigurationApiClient, OutboundWebhookMutationResponse as ApiMutationResponse } from "@/platform/api/generated/integrationConfigurationApi";
import type { OutboundWebhookGateway, OutboundWebhookMutationResponse } from "../application/OutboundWebhookGateway";

function mutationResult(response: ApiMutationResponse): OutboundWebhookMutationResponse {
  return {
    subscription: response.subscription,
    outcome: response.outcome,
    ...(typeof response.signingSecret === "string" ? { signingSecret: response.signingSecret } : {}),
  };
}

export function createConnectedOutboundWebhookGateway(client: IntegrationConfigurationApiClient): OutboundWebhookGateway {
  return {
    getIntegrationEventCatalog: () => client.getIntegrationEventCatalog(),
    listOutboundWebhookSubscriptions: () => client.listOutboundWebhookSubscriptions(),
    listOutboundWebhookDeliveries: () => client.listOutboundWebhookDeliveries(),
    createOutboundWebhookSubscription: async (body, options) => mutationResult(await client.createOutboundWebhookSubscription(body, options)),
    updateOutboundWebhookSubscription: async (id, body, options) => mutationResult(await client.updateOutboundWebhookSubscription(id, body, options)),
    activateOutboundWebhookSubscription: async (id, body, options) => mutationResult(await client.activateOutboundWebhookSubscription(id, body, options)),
    pauseOutboundWebhookSubscription: async (id, body, options) => mutationResult(await client.pauseOutboundWebhookSubscription(id, body, options)),
    resumeOutboundWebhookSubscription: async (id, body, options) => mutationResult(await client.resumeOutboundWebhookSubscription(id, body, options)),
    archiveOutboundWebhookSubscription: async (id, body, options) => mutationResult(await client.archiveOutboundWebhookSubscription(id, body, options)),
    rotateOutboundWebhookSecret: async (id, body, options) => mutationResult(await client.rotateOutboundWebhookSecret(id, body, options)),
    replayOutboundWebhookDelivery: (id, body, options) => client.replayOutboundWebhookDelivery(id, body, options),
  };
}
