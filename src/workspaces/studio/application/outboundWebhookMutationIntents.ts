export type WebhookMutationIntent = { operation: string; request: unknown; expectedVersion?: number };

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

export class OutboundWebhookMutationIntents {
  private readonly pending = new Map<string, string>();
  constructor(private readonly createKey: () => string = () => `webhook-${crypto.randomUUID()}`) {}
  keyFor(intent: WebhookMutationIntent): string {
    const fingerprint = stable(intent);
    const existing = this.pending.get(fingerprint);
    if (existing) return existing;
    const key = this.createKey();
    this.pending.set(fingerprint, key);
    return key;
  }
  complete(intent: WebhookMutationIntent): void { this.pending.delete(stable(intent)); }
}
