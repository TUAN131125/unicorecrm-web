import type {
  BackendMutationCommand,
  LocalMutationExecutor,
  MutationAuthorityPort,
  MutationCommandMetadata,
  MutationOutcome,
} from "./mutationAuthority";
import { MutationCommandError, readMutationVersion } from "./mutationAuthority";

interface CachedMutation {
  fingerprint: string;
  outcome: Promise<MutationOutcome<unknown>>;
}

function stableValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stableValue(entry)]));
  }
  if (typeof value === "bigint") return value.toString();
  return value;
}

function commandFingerprint(command: BackendMutationCommand<unknown>): string {
  return JSON.stringify(stableValue(command));
}

export class LocalMutationAuthority implements MutationAuthorityPort {
  private readonly idempotencyCache = new Map<string, CachedMutation>();

  execute<TPayload, TResult>(
    command: BackendMutationCommand<TPayload>,
    metadata: MutationCommandMetadata,
    localExecutor?: LocalMutationExecutor<TResult>,
  ): Promise<MutationOutcome<TResult>> {
    if (metadata.signal?.aborted) throw new DOMException("Operation was cancelled.", "AbortError");
    if (!localExecutor) {
      throw new MutationCommandError({
        code: "LOCAL_MUTATION_EXECUTOR_REQUIRED",
        message: `Demo mutation ${command.commandType} requires a local executor.`,
        ...(metadata.correlationId === undefined ? {} : { correlationId: metadata.correlationId }),
      });
    }

    const fingerprint = commandFingerprint(command);
    const cached = this.idempotencyCache.get(metadata.idempotencyKey);
    if (cached) {
      if (cached.fingerprint !== fingerprint) {
        throw new MutationCommandError({
          code: "IDEMPOTENCY_KEY_REUSED",
          message: `Idempotency key ${metadata.idempotencyKey} was reused for a different command.`,
          ...(metadata.correlationId === undefined ? {} : { correlationId: metadata.correlationId }),
        });
      }
      return cached.outcome as Promise<MutationOutcome<TResult>>;
    }

    const commandId = `cmd_${crypto.randomUUID()}`;
    const correlationId = metadata.correlationId ?? `corr_${crypto.randomUUID()}`;
    const outcome = Promise.resolve()
      .then(() => {
        if (metadata.signal?.aborted) throw new DOMException("Operation was cancelled.", "AbortError");
        return localExecutor();
      })
      .then((data) => {
        const occurredAt = new Date().toISOString();
        const version = readMutationVersion(data);
        return {
          data,
          commandId,
          commandType: command.commandType,
          aggregateType: command.aggregateType,
          aggregateId: command.aggregateId,
          idempotencyKey: metadata.idempotencyKey,
          correlationId,
          occurredAt,
          ...(version === undefined ? {} : { version }),
          outcome: "DEMO_COMMITTED" as const,
          emittedEvents: [`${command.commandType}.completed`],
          audit: { authority: "demo" as const, evidenceIds: [`audit_${commandId}`] },
        } satisfies MutationOutcome<TResult>;
      })
      .catch((error) => {
        this.idempotencyCache.delete(metadata.idempotencyKey);
        throw error;
      });

    this.idempotencyCache.set(metadata.idempotencyKey, {
      fingerprint,
      outcome: outcome as Promise<MutationOutcome<unknown>>,
    });
    return outcome;
  }
}
