import { OutboundWebhookMutationIntents } from "./outboundWebhookMutationIntents";

export type OutboundWebhookForm = { name: string; eventType: string; endpointUrl: string };
export type EditableOutboundWebhook = OutboundWebhookForm & { subscriptionId: string; status: string; version: number };
export type OutboundWebhookMutationResult = { signingSecret?: string };
export interface ConnectedOutboundWebhookCommands {
  createOutboundWebhookSubscription(request: OutboundWebhookForm, options: { idempotencyKey: string }): Promise<OutboundWebhookMutationResult>;
  updateOutboundWebhookSubscription(id: string, request: OutboundWebhookForm, options: { idempotencyKey: string; expectedVersion: number }): Promise<OutboundWebhookMutationResult>;
}

export class ConnectedOutboundWebhookBehavior {
  constructor(private readonly api: ConnectedOutboundWebhookCommands, private readonly intents: OutboundWebhookMutationIntents) {}
  beginEdit(item: EditableOutboundWebhook): OutboundWebhookForm | undefined {
    return item.status === "DRAFT" || item.status === "PAUSED" ? { name: item.name, eventType: item.eventType, endpointUrl: item.endpointUrl } : undefined;
  }
  async create(request: OutboundWebhookForm, refresh: () => Promise<void>): Promise<OutboundWebhookMutationResult> {
    const intent = { operation: "create", request };
    const result = await this.api.createOutboundWebhookSubscription(request, { idempotencyKey: this.intents.keyFor(intent) });
    this.intents.complete(intent); await refresh(); return result;
  }
  async update(item: EditableOutboundWebhook, request: OutboundWebhookForm, refresh: () => Promise<void>): Promise<OutboundWebhookMutationResult> {
    const intent = { operation: "update", request: { subscriptionId: item.subscriptionId, ...request }, expectedVersion: item.version };
    const result = await this.api.updateOutboundWebhookSubscription(item.subscriptionId, request, { idempotencyKey: this.intents.keyFor(intent), expectedVersion: item.version });
    this.intents.complete(intent); await refresh(); return result;
  }
}
