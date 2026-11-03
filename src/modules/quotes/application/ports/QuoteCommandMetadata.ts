export interface QuoteCommandOptions {
  idempotencyKey: string;
  correlationId?: string;
  signal?: AbortSignal;
}
export interface QuoteVersionedCommandOptions extends QuoteCommandOptions { expectedVersion: number; }

export interface QuoteMutationEvidence {
  authority: "backend" | "demo" | "test";
  commandId: string;
  correlationId: string;
  aggregateId: string;
  aggregateType: string;
  version: number;
  occurredAt: string;
  outcome: "COMMITTED" | "REPLAYED" | "DEMO_COMMITTED";
  warnings: readonly string[];
  emittedEventIds: readonly string[];
  auditEvidenceIds: readonly string[];
}

